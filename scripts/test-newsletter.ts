/**
 * Test script: generates a weekly newsletter from real monitor events.
 * Uses Task API (ultra-fast, text mode) to write the brief.
 * Outputs the result to stdout + saves to scripts/newsletter-output.md
 *
 * Usage: npx tsx scripts/test-newsletter.ts
 */

import * as fs from "fs";

const API_KEY = process.env.PARALLEL_API_KEY;
if (!API_KEY) { console.error("Set PARALLEL_API_KEY"); process.exit(1); }

const BASE_URL = "https://api.parallel.ai";

// Load monitors and fetch their events
async function fetchMonitorEvents(): Promise<{
  monitors: { name: string; class: string; events: { headline: string; summary: string; category: string; severity: string; eventDate: string; affectedEntities: string; citations: { title: string; url: string }[] }[] }[];
}> {
  const monitorsData = JSON.parse(fs.readFileSync("./src/data/monitors.json", "utf-8"));

  const monitors: typeof result.monitors = [];
  const result = { monitors };

  for (const [defId, info] of Object.entries(monitorsData) as [string, { monitorId: string; name: string; class: string }][]) {
    try {
      const res = await fetch(`${BASE_URL}/v1/monitors/${info.monitorId}/events`, {
        headers: { "x-api-key": API_KEY! },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events = (data.events || []).map((evt: Record<string, unknown>) => {
        const content = (evt.output as Record<string, unknown>)?.content as Record<string, string> || {};
        const basis = ((evt.output as Record<string, unknown>)?.basis as { citations?: { title?: string; url?: string }[] }[]) || [];
        const citations = basis.flatMap(b => (b.citations || []).map(c => ({ title: c.title || "", url: c.url || "" }))).slice(0, 3);
        return {
          headline: content.headline || "",
          summary: content.summary || "",
          category: content.category || "",
          severity: content.severity || "informational",
          eventDate: (evt as Record<string, string>).event_date || "",
          affectedEntities: content.affected_entities || "",
          citations,
        };
      });
      monitors.push({ name: info.name, class: info.class, events });
    } catch {}
  }

  return result;
}

function buildPrompt(monitors: Awaited<ReturnType<typeof fetchMonitorEvents>>["monitors"]): string {
  const allEvents = monitors.flatMap(m => m.events.map(e => ({ ...e, monitorName: m.name })));
  const criticalEvents = allEvents.filter(e => e.severity === "critical");
  const totalEvents = allEvents.length;
  const regionsWithEvents = new Set(monitors.filter(m => m.events.length > 0).map(m => m.name));

  // Build event details for the prompt
  let criticalSection = "";
  for (const evt of criticalEvents.slice(0, 3)) {
    criticalSection += `\n### ${evt.headline}\n`;
    criticalSection += `Region: ${evt.monitorName} | Category: ${evt.category} | Date: ${evt.eventDate}\n`;
    criticalSection += `${evt.summary}\n`;
    if (evt.affectedEntities) criticalSection += `Affects: ${evt.affectedEntities}\n`;
    if (evt.citations.length > 0) {
      criticalSection += `Sources: ${evt.citations.map(c => `${c.title} (${c.url})`).join("; ")}\n`;
    }
  }

  let regionalSection = "";
  for (const m of monitors.filter(m => m.events.length > 0).slice(0, 10)) {
    const topEvent = m.events[0];
    regionalSection += `- **${m.name}** (${m.events.length} events): ${topEvent.headline}\n`;
  }

  const issueNumber = Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));

  return `Write "Datacenter Signal — Issue ${issueNumber}", a weekly infrastructure intelligence brief for datacenter investors.

CRITICAL EVENTS THIS WEEK (deep-research each one):
${criticalSection || "No critical events this week."}

ALL EVENTS SUMMARY:
- Total events detected: ${totalEvents}
- Critical: ${criticalEvents.length}
- Monitors active: ${monitors.length}
- Markets with activity: ${regionsWithEvents.size}

REGIONAL ACTIVITY:
${regionalSection || "No regional activity."}

INSTRUCTIONS:
1. Open with "The week in one read" — a 2-3 sentence executive summary of the most important developments
2. "Critical developments" — for each critical event, write a thorough analysis: what happened, background context, key stakeholders, implications for infrastructure investors, regulatory considerations, and what to watch next. Include specific data points and cite sources inline as markdown links.
3. "Regional roundup" — one concise line per active region summarizing the key development
4. "By the numbers" — the week's key stats in a clean list

Tone: analytical, concise, data-anchored. Write for senior infrastructure investors — like a Financial Times or Stratechery briefing. No hype, no speculation. Evidence and clarity.

CITATION RULES (important):
- NEVER use numbered references like [1] or [27]. No references section at the bottom.
- Instead, cite sources INLINE as hyperlinks woven into the prose: e.g., "according to [Virginia Mercury](https://virginiamercury.com/...)" or "per a [Texas Tribune report](https://texastribune.org/...)"
- Every factual claim with a specific number, date, or quote MUST have an inline link to its source
- Use the publication name as the link text, not the article title
- This is an email — readers need to click through directly from the sentence, not scroll to a footnotes section

Format: clean markdown with ## headers, bullet points, and inline hyperlinks. No emoji. No numbered references.`;
}

async function main() {
  console.log("Fetching monitor events...\n");
  const { monitors } = await fetchMonitorEvents();

  const totalEvents = monitors.reduce((s, m) => s + m.events.length, 0);
  const criticalCount = monitors.flatMap(m => m.events).filter(e => e.severity === "critical").length;
  console.log(`Found ${totalEvents} events across ${monitors.length} monitors (${criticalCount} critical)\n`);

  const prompt = buildPrompt(monitors);
  console.log("--- PROMPT ---");
  console.log(prompt.slice(0, 500) + "...\n");

  console.log("Calling Task API (ultra-fast, text mode)...\n");

  const res = await fetch(`${BASE_URL}/v1/tasks/runs`, {
    method: "POST",
    headers: { "x-api-key": API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: prompt,
      enable_events: true,
      task_spec: {
        output_schema: {
          type: "text",
          description: "A comprehensive markdown-formatted weekly datacenter intelligence brief with headers, analysis, and inline citations.",
        },
      },
      processor: "ultra-fast",
    }),
  });

  if (!res.ok) {
    console.error(`Task API error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const task = await res.json();
  console.log(`Task created: ${task.run_id}\n`);

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < 900000) { // 15 min timeout
    await new Promise(r => setTimeout(r, 5000));

    const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${task.run_id}`, {
      headers: { "x-api-key": API_KEY! },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r  Status: ${statusData.status} (${elapsed}s)`);

    if (statusData.status === "completed") {
      console.log("\n\nFetching result...\n");

      const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${task.run_id}/result`, {
        headers: { "x-api-key": API_KEY! },
      });
      if (!resultRes.ok) {
        console.error("Failed to fetch result");
        process.exit(1);
      }

      const result = await resultRes.json();
      const content = result.output?.content || "";

      console.log("=== NEWSLETTER OUTPUT ===\n");
      console.log(content);
      console.log("\n=== END ===\n");

      // Save to file
      fs.writeFileSync("./scripts/newsletter-output.md", content);
      console.log(`Saved to scripts/newsletter-output.md (${content.length} chars)`);

      // Also save metadata
      fs.writeFileSync("./scripts/newsletter-meta.json", JSON.stringify({
        runId: task.run_id,
        issueNumber: Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000)),
        generatedAt: new Date().toISOString(),
        totalEvents,
        criticalCount,
        monitorsActive: monitors.length,
        contentLength: content.length,
      }, null, 2));

      process.exit(0);
    }

    if (statusData.status === "failed") {
      console.error("\n\nTask failed:", statusData.error);
      process.exit(1);
    }
  }

  console.error("\n\nTimeout waiting for task completion");
  process.exit(1);
}

main().catch(console.error);
