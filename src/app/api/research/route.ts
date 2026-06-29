import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

// Cache completed reports
const reportCache: Record<string, { status: string; content?: string; runId?: string }> = {};

// POST: kick off a deep research task
export async function POST(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { eventId, headline, summary, monitorName } = await request.json();

  // Return cached if done
  if (reportCache[eventId]?.content) {
    return NextResponse.json(reportCache[eventId]);
  }

  // If already running, return status
  if (reportCache[eventId]?.runId) {
    return NextResponse.json(reportCache[eventId]);
  }

  const input = `Produce a comprehensive research report on this datacenter infrastructure development:\n\nHeadline: ${headline}\n\nSummary: ${summary}\n\nMonitor: ${monitorName}\n\nProvide a thorough analysis including: background context, key stakeholders involved, timeline of events, potential impact on the datacenter market, implications for infrastructure investors, regulatory considerations, and what to watch for next. Include specific data points, dates, and sources where possible.`;

  const res = await fetch(`${BASE_URL}/v1/tasks/runs`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      interaction_id: eventId,
      enable_events: true,
      task_spec: {
        output_schema: {
          type: "text",
          description: "A comprehensive markdown-formatted research report with headers, bullet points, and citations.",
        },
      },
      processor: "ultra-fast",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await res.json();
  reportCache[eventId] = { status: "running", runId: data.run_id };

  return NextResponse.json({ status: "running", runId: data.run_id });
}

// GET: stream events from a running task or return completed report
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  const stream = request.nextUrl.searchParams.get("stream") === "true";

  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const cached = reportCache[eventId];
  if (!cached) return NextResponse.json({ status: "not_started" });
  if (cached.content) return NextResponse.json(cached);

  if (!cached.runId) return NextResponse.json(cached);

  // Stream mode: proxy SSE from Parallel API
  if (stream && API_KEY) {
    const sseRes = await fetch(`${BASE_URL}/v1/tasks/runs/${cached.runId}/events`, {
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
            controller.enqueue(encoder.encode(chunk));

            // Check if the task completed in this chunk
            if (chunk.includes('"completed"') || chunk.includes('"failed"')) {
              // Fetch final result
              try {
                const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${cached.runId}/result`, {
                  headers: { "x-api-key": API_KEY },
                });
                if (resultRes.ok) {
                  const result = await resultRes.json();
                  const content = result.output?.content || "";
                  reportCache[eventId] = { status: "completed", content, runId: cached.runId };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "report.complete", content })}\n\n`));
                }
              } catch {}
            }
          }
        } catch {
          // Stream ended
        }
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Non-stream: poll for result
  try {
    const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${cached.runId}`, {
      headers: { "x-api-key": API_KEY },
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.status === "completed") {
        const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${cached.runId}/result`, {
          headers: { "x-api-key": API_KEY },
        });
        if (resultRes.ok) {
          const result = await resultRes.json();
          const content = result.output?.content || "";
          reportCache[eventId] = { status: "completed", content, runId: cached.runId };
          return NextResponse.json(reportCache[eventId]);
        }
      }
      return NextResponse.json({ status: statusData.status, runId: cached.runId });
    }
  } catch {}

  return NextResponse.json(cached);
}
