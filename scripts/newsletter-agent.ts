/**
 * Newsletter writer agent: two-step pipeline.
 *
 * Step 1: Task API (ultra-fast) deep-researches critical events → raw research
 * Step 2: Claude (sonnet) writes the newsletter with a tool for follow-up lookups
 *         via Task API (base) with interaction chaining
 *
 * Usage: PARALLEL_API_KEY=xxx ANTHROPIC_API_KEY=xxx npx tsx scripts/newsletter-agent.ts
 */

import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

const PARALLEL_KEY = process.env.PARALLEL_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!PARALLEL_KEY) { console.error("Set PARALLEL_API_KEY"); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }

const PARALLEL_BASE = "https://api.parallel.ai";

// ─── Step 0: Gather monitor events ───────────────────────────────────

async function fetchMonitorEvents() {
  const monitorsData = JSON.parse(fs.readFileSync("./src/data/monitors.json", "utf-8"));
  const allEvents: { headline: string; summary: string; category: string; severity: string; eventDate: string; affectedEntities: string; monitorName: string; citations: { title: string; url: string }[] }[] = [];

  for (const [, info] of Object.entries(monitorsData) as [string, { monitorId: string; name: string; class: string }][]) {
    try {
      const res = await fetch(`${PARALLEL_BASE}/v1/monitors/${info.monitorId}/events`, {
        headers: { "x-api-key": PARALLEL_KEY! },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const evt of data.events || []) {
        const content = evt.output?.content;
        if (!content || typeof content !== "object") continue;
        const basis = evt.output?.basis || [];
        const citations = basis.flatMap((b: { citations?: { title?: string; url?: string }[] }) =>
          (b.citations || []).map((c) => ({ title: c.title || "", url: c.url || "" }))
        ).slice(0, 3);
        allEvents.push({
          headline: content.headline || "", summary: content.summary || "",
          category: content.category || "", severity: content.severity || "informational",
          eventDate: evt.event_date || "", affectedEntities: content.affected_entities || "",
          monitorName: info.name, citations,
        });
      }
    } catch {}
  }
  return allEvents;
}

// ─── Step 1: Deep research via Task API (ultra-fast) ─────────────────

async function deepResearch(criticalEvents: typeof allEvents): Promise<{ content: string; interactionId: string }> {
  let prompt = "Provide comprehensive, fact-checked research on these critical datacenter infrastructure developments. For each event, find: exact dates, vote counts, dollar amounts, stakeholder names, regulatory filing numbers, and primary source URLs.\n\n";

  for (const evt of criticalEvents.slice(0, 5)) {
    prompt += `### ${evt.headline}\n${evt.summary}\nRegion: ${evt.monitorName}\nSources: ${evt.citations.map(c => c.url).join(", ")}\n\n`;
  }

  console.log("  Calling Task API ultra-fast for deep research...");
  const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
    method: "POST",
    headers: { "x-api-key": PARALLEL_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: prompt,
      task_spec: { output_schema: { type: "text", description: "Comprehensive factual research with specific data points, dates, numbers, and source URLs for each event." } },
      processor: "ultra-fast",
    }),
  });

  if (!res.ok) throw new Error(`Task API error: ${res.status}`);
  const task = await res.json();
  console.log(`  Run: ${task.run_id}`);

  // Poll for completion (ultra-fast can take 15-20 min on complex prompts)
  const start = Date.now();
  while (Date.now() - start < 1800000) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${task.run_id}`, { headers: { "x-api-key": PARALLEL_KEY! } });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`\r  Status: ${statusData.status} (${elapsed}s)`);

    if (statusData.status === "completed") {
      const resultRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${task.run_id}/result`, { headers: { "x-api-key": PARALLEL_KEY! } });
      const result = await resultRes.json();
      console.log(`\n  Research complete: ${result.output?.content?.length || 0} chars`);
      return { content: result.output?.content || "", interactionId: task.interaction_id };
    }
    if (statusData.status === "failed") throw new Error("Task failed");
  }
  throw new Error("Timeout");
}

// ─── Step 2: Claude agent writes the newsletter ──────────────────────

const NEWSLETTER_SYSTEM = `You are the editor of "Datacenter Signal," a weekly intelligence brief for datacenter infrastructure investors. Your job is to transform raw research into a polished, professional HTML email newsletter.

VOICE: Analytical, concise, data-anchored. Write like a Financial Times or Stratechery briefing. No hype, no speculation. Evidence and clarity. No emoji.

STRUCTURE (follow exactly):
1. MASTHEAD — already provided in the template, don't generate
2. THE WEEK IN ONE READ — 2-3 sentence executive summary of the most important theme
3. CRITICAL DEVELOPMENTS — for each critical event:
   - Category tag + region
   - Headline (bold, 18px)
   - 2-3 paragraphs of analysis: what happened, background context, implications for investors, what to watch
   - Inline source links woven into prose (e.g., "according to <a href='url'>Virginia Mercury</a>")
   - NEVER use numbered references like [1] or [27]
4. REGIONAL ROUNDUP — one line per active region, the most important headline
5. BY THE NUMBERS — 8-12 key data points as a clean list

CITATION RULES:
- Every factual claim with a number, date, or quote MUST have an inline <a> link
- Use the publication name as link text, not the article title
- If you're unsure about a fact, use the parallel_lookup tool to verify it

HTML FORMAT:
- Use inline styles only (email-safe)
- Headings: <h2 style="font-size:17px;font-weight:500;color:#1D1B16;margin:24px 0 8px;padding-bottom:5px;border-bottom:1px solid #E5E5E5">
- Body: <p style="font-size:14px;line-height:22px;color:#5C5B59;margin:0 0 10px">
- Links: <a href="url" style="color:#FB631B;text-decoration:none">
- Bold: <strong style="color:#1D1B16;font-weight:500">
- Lists: <ul style="padding-left:18px;margin:0 0 12px"><li style="font-size:14px;line-height:22px;color:#5C5B59;margin-bottom:4px">
- Category tags: <span style="font-family:'Courier New',monospace;font-size:8px;text-transform:uppercase;letter-spacing:0.05em;font-weight:500;padding:2px 6px;border-radius:2px;color:#fff;background:COLOR">CATEGORY</span>
  Colors: Power & Grid=#FB631B, Zoning & Policy=#F79A6F, Capital & Ownership=#E14942, Community=#5C5B59, Construction=#858483

OUTPUT: Return ONLY the HTML content for the body section (between masthead and footer — those are added separately). No markdown. Pure HTML with inline styles.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "parallel_lookup",
    description: "Look up a specific fact, verify a claim, or find missing information using Parallel's search API. This tool has full context from the deep research already performed. Use it for: verifying exact numbers, finding primary source URLs, checking dates, getting vote counts, confirming deal values, etc. Ask a clear, specific question.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "A specific factual question to look up, e.g., 'What was the exact vote count for the Loudoun County data center moratorium on June 30, 2026?' or 'What is the dollar amount of the NextEra-Dominion merger?'",
        },
      },
      required: ["query"],
    },
  },
];

async function callParallelLookup(query: string, interactionId: string): Promise<string> {
  console.log(`    🔍 Lookup: ${query.slice(0, 80)}...`);
  const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
    method: "POST",
    headers: { "x-api-key": PARALLEL_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: query,
      processor: "base",
      previous_interaction_id: interactionId,
    }),
  });
  if (!res.ok) return `Error: ${res.status}`;
  const task = await res.json();

  // Poll (base is fast: 15-100s)
  const start = Date.now();
  while (Date.now() - start < 120000) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${task.run_id}`, { headers: { "x-api-key": PARALLEL_KEY! } });
    if (!statusRes.ok) continue;
    const data = await statusRes.json();
    if (data.status === "completed") {
      const resultRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${task.run_id}/result`, { headers: { "x-api-key": PARALLEL_KEY! } });
      const result = await resultRes.json();
      const raw = result.output?.content;
      const text = typeof raw === "string" ? raw : JSON.stringify(raw) || "No result found.";
      console.log(`    ✓ Got ${text.length} chars`);
      return text;
    }
    if (data.status === "failed") return "Lookup failed.";
  }
  return "Lookup timed out.";
}

async function writeNewsletter(
  researchContent: string,
  interactionId: string,
  allEvents: { headline: string; summary: string; category: string; severity: string; eventDate: string; monitorName: string }[],
): Promise<string> {
  const issueNumber = Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));
  const criticalCount = allEvents.filter(e => e.severity === "critical").length;
  const regions = new Set(allEvents.map(e => e.monitorName));

  // Build the user message with all context
  const userMessage = `Write Datacenter Signal Issue ${issueNumber}.

STATS: ${allEvents.length} total events, ${criticalCount} critical, ${regions.size} markets active.

DEEP RESEARCH OUTPUT (use this as your primary source — it's already fact-checked):
${researchContent}

ALL MONITOR EVENTS (for the regional roundup — one line per region):
${Array.from(regions).map(r => {
    const regionEvents = allEvents.filter(e => e.monitorName === r);
    return `${r} (${regionEvents.length} events): ${regionEvents[0]?.headline || ""}`;
  }).join("\n")}

Write the complete HTML email body now. Use the parallel_lookup tool if you need to verify any facts or fill in missing details.`;

  console.log("\n  Calling Claude to write the newsletter...");
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY! });

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let finalHtml = "";

  // Agentic loop: Claude writes, may call tools, we respond, repeat
  for (let turn = 0; turn < 10; turn++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: NEWSLETTER_SYSTEM,
      tools: TOOLS,
      messages,
    });

    console.log(`  Turn ${turn + 1}: stop_reason=${response.stop_reason}, content blocks=${response.content.length}`);

    // Collect text and tool calls
    const toolResults: Anthropic.MessageParam[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      if (block.type === "text") {
        // Only capture text from the final turn (when there are no more tool calls)
        // Intermediate turns contain thinking/planning text, not the newsletter
        finalHtml = block.text;
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        const query = (block.input as { query: string }).query;
        const result = await callParallelLookup(query, interactionId);
        toolResults.push({
          role: "user",
          content: [{ type: "tool_result" as const, tool_use_id: block.id, content: [{ type: "text" as const, text: result }] }],
        });
      }
    }

    if (!hasToolUse || response.stop_reason === "end_turn") {
      break;
    }

    // Add assistant response + tool results for next turn
    messages = [...messages, { role: "assistant", content: response.content }, ...toolResults];
  }

  // Extract HTML from code fences if present
  const fenceMatch = finalHtml.match(/```html\s*([\s\S]*?)```/);
  if (fenceMatch) finalHtml = fenceMatch[1].trim();

  return finalHtml;
}

// ─── Main ────────────────────────────────────────────────────────────

let allEvents: Awaited<ReturnType<typeof fetchMonitorEvents>> = [];

async function main() {
  console.log("╔═══════════════════════════════════╗");
  console.log("║  Newsletter Agent                  ║");
  console.log("╚═══════════════════════════════════╝\n");

  const skipResearch = process.argv.includes("--skip-research");

  // Step 0: Gather events
  console.log("Step 0: Fetching monitor events...");
  allEvents = await fetchMonitorEvents();
  const criticalEvents = allEvents.filter(e => e.severity === "critical");
  console.log(`  ${allEvents.length} events, ${criticalEvents.length} critical\n`);

  let research: string;
  let interactionId: string;

  if (skipResearch && fs.existsSync("scripts/newsletter-research.md")) {
    // Reuse saved research (e.g., after a timeout on step 2)
    research = fs.readFileSync("scripts/newsletter-research.md", "utf-8");
    interactionId = process.env.INTERACTION_ID || "";
    console.log(`Step 1: SKIPPED — using saved research (${research.length} chars)\n`);
  } else {
    // Step 1: Deep research
    console.log("Step 1: Deep research on critical events...");
    const result = await deepResearch(criticalEvents);
    research = result.content;
    interactionId = result.interactionId;
    fs.writeFileSync("scripts/newsletter-research.md", research);
    console.log(`  Saved research to scripts/newsletter-research.md\n`);
  }

  // Step 2: Claude writes the newsletter
  console.log("Step 2: Claude writes the newsletter...");
  const bodyHtml = await writeNewsletter(research, interactionId, allEvents);

  // Wrap in email template
  const issueNumber = Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));
  const fullHtml = `<div style="max-width:644px;margin:0 auto;background:#fff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:28px 30px 18px;border-bottom:1px solid #E5E5E5;background:#FCFBFA">
<div style="font-family:'Courier New',monospace;font-weight:700;font-size:18px;color:#1D1B16;margin-bottom:14px">parallel</div>
<div style="display:flex;justify-content:space-between;align-items:baseline">
<span style="font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#1D1B16">Datacenter Signal</span>
<span style="font-family:'Courier New',monospace;font-size:9px;color:#A6A5A4">Issue ${issueNumber}</span>
</div></div>
<div style="padding:24px 30px">${bodyHtml}</div>
<div style="padding:24px 30px;background:#FCFBFA;border-top:1px solid #E5E5E5">
<div style="font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#1D1B16;opacity:0.6;margin-bottom:8px">parallel</div>
<div style="font-family:'Courier New',monospace;font-size:9px;color:#A6A5A4">hello@parallel.ai · Palo Alto, CA · <a href="#" style="color:#A6A5A4">Unsubscribe</a></div>
</div></div>`;

  // Save outputs
  fs.writeFileSync("scripts/newsletter-agent-output.html", fullHtml);
  console.log(`\n  Saved to scripts/newsletter-agent-output.html (${fullHtml.length} chars)`);
  console.log("  Done!");
}

main().catch(console.error);
