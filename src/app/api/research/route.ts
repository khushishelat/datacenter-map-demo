import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

// Store/retrieve report mapping from Vercel Blob
async function getReportMap(): Promise<Record<string, { runId: string; status: string; content?: string }>> {
  if (!BLOB_TOKEN) return {};
  try {
    const { blobs } = await list({ prefix: "reports/", token: BLOB_TOKEN });
    const mapBlob = blobs.find((b) => b.pathname === "reports/map.json");
    if (!mapBlob) return {};
    const res = await fetch(mapBlob.downloadUrl, {
      headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
    });
    if (res.ok) return res.json();
  } catch {}
  return {};
}

async function saveReportMap(map: Record<string, { runId: string; status: string; content?: string }>) {
  if (!BLOB_TOKEN) return;
  try {
    await put("reports/map.json", JSON.stringify(map), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      token: BLOB_TOKEN,
    });
  } catch {}
}

// POST: kick off a deep research task (idempotent per eventId)
export async function POST(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { eventId, headline, summary, monitorName } = await request.json();

  // Check if we already have a report for this event
  const reportMap = await getReportMap();
  if (reportMap[eventId]) {
    const existing = reportMap[eventId];
    // If completed, return it
    if (existing.content) {
      return NextResponse.json({ status: "completed", content: existing.content, runId: existing.runId });
    }
    // If running, check status
    if (existing.runId) {
      const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${existing.runId}`, {
        headers: { "x-api-key": API_KEY },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === "completed") {
          const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${existing.runId}/result`, {
            headers: { "x-api-key": API_KEY },
          });
          if (resultRes.ok) {
            const result = await resultRes.json();
            const content = result.output?.content || "";
            reportMap[eventId] = { runId: existing.runId, status: "completed", content };
            await saveReportMap(reportMap);
            return NextResponse.json({ status: "completed", content, runId: existing.runId });
          }
        }
        return NextResponse.json({ status: statusData.status, runId: existing.runId });
      }
    }
  }

  // Kick off new task
  const input = `Produce a comprehensive research report on this datacenter infrastructure development:\n\nHeadline: ${headline}\n\nSummary: ${summary}\n\nMonitor: ${monitorName}\n\nProvide a thorough analysis including: background context, key stakeholders involved, timeline of events, potential impact on the datacenter market, implications for infrastructure investors, regulatory considerations, and what to watch for next. Include specific data points, dates, and sources where possible.`;

  const res = await fetch(`${BASE_URL}/v1/tasks/runs`, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      interaction_id: eventId,
      enable_events: true,
      task_spec: { output_schema: { type: "text", description: "A comprehensive markdown-formatted research report with headers, bullet points, and citations." } },
      processor: "ultra-fast",
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 });
  }

  const data = await res.json();
  reportMap[eventId] = { runId: data.run_id, status: "running" };
  await saveReportMap(reportMap);

  return NextResponse.json({ status: "running", runId: data.run_id });
}

// GET: check status / retrieve report
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  const clientRunId = request.nextUrl.searchParams.get("runId");

  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Check blob storage first
  const reportMap = await getReportMap();
  const saved = reportMap[eventId];

  if (saved?.content) {
    return NextResponse.json({ status: "completed", content: saved.content, runId: saved.runId });
  }

  const stream = request.nextUrl.searchParams.get("stream") === "true";
  const activeRunId = saved?.runId || clientRunId;
  if (!activeRunId) return NextResponse.json({ status: "not_started" });

  // Stream mode: proxy SSE from Parallel
  if (stream && API_KEY) {
    const sseRes = await fetch(`${BASE_URL}/v1/tasks/runs/${activeRunId}/events`, {
      headers: { "x-api-key": API_KEY },
    });

    if (!sseRes.ok || !sseRes.body) {
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    const reader = sseRes.body.getReader();
    const encoder = new TextEncoder();

    const responseStream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // Strip "event: ..." lines so all events go through onmessage
            const cleaned = chunk.replace(/^event:.*\n/gm, "");
            controller.enqueue(encoder.encode(cleaned));

            if (chunk.includes('"completed"') || chunk.includes('"failed"')) {
              try {
                const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${activeRunId}/result`, {
                  headers: { "x-api-key": API_KEY },
                });
                if (resultRes.ok) {
                  const result = await resultRes.json();
                  const content = result.output?.content || "";
                  const map = await getReportMap();
                  map[eventId!] = { runId: activeRunId, status: "completed", content };
                  await saveReportMap(map);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "report.complete", content })}\n\n`));
                }
              } catch {}
            }
          }
        } catch {}
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  }

  // Check task status from Parallel
  try {
    const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${activeRunId}`, {
      headers: { "x-api-key": API_KEY },
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.status === "completed") {
        const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${activeRunId}/result`, {
          headers: { "x-api-key": API_KEY },
        });
        if (resultRes.ok) {
          const result = await resultRes.json();
          const content = result.output?.content || "";
          reportMap[eventId] = { runId: activeRunId, status: "completed", content };
          await saveReportMap(reportMap);
          return NextResponse.json({ status: "completed", content, runId: activeRunId });
        }
      }
      return NextResponse.json({ status: statusData.status, runId: activeRunId });
    }
  } catch {}

  return NextResponse.json({ status: "running", runId: activeRunId });
}
