import { NextResponse } from "next/server";
import { transformBackfillResults } from "@/lib/transform-events";
import * as fs from "fs";
import * as path from "path";
import type { MonitorEvent, EventCategory } from "@/lib/types";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

interface MonitorInfo {
  monitorId: string;
  name: string;
  class: string;
  query: string;
  region?: string;
  facilityCode?: string;
}

async function fetchLiveMonitorEvents(): Promise<MonitorEvent[]> {
  if (!API_KEY) return [];

  const monitorsPath = path.join(process.cwd(), "src/data/monitors.json");
  if (!fs.existsSync(monitorsPath)) return [];

  const monitors: Record<string, MonitorInfo> = JSON.parse(
    fs.readFileSync(monitorsPath, "utf-8")
  );

  const events: MonitorEvent[] = [];

  const fetches = Object.entries(monitors).map(async ([defId, info]) => {
    try {
      const res = await fetch(
        `${BASE_URL}/v1/monitors/${info.monitorId}/events`,
        { headers: { "x-api-key": API_KEY }, next: { revalidate: 30 } }
      );
      if (!res.ok) return;

      const data = await res.json();
      const rawEvents = data.events || [];

      for (const evt of rawEvents) {
        const content =
          typeof evt.output?.content === "string"
            ? evt.output.content
            : JSON.stringify(evt.output?.content || "");

        const category = classifyFromContent(content);
        const citations = evt.output?.basis?.[0]?.citations || [];

        events.push({
          id: evt.event_id,
          monitorId: defId,
          monitorName: info.name,
          category,
          facilityCode: info.facilityCode || defId.toUpperCase(),
          timestamp: evt.event_date || new Date().toISOString(),
          headline: extractHeadline(content),
          description: content,
          sources: citations.slice(0, 3).map(
            (c: { title: string; url: string }) => ({
              label: c.title?.slice(0, 50) || "Source",
              url: c.url || "#",
            })
          ),
          confidence:
            evt.output?.basis?.[0]?.confidence === "high"
              ? 0.95
              : evt.output?.basis?.[0]?.confidence === "medium"
                ? 0.8
                : 0.65,
          hasTaskReport: false,
          region: info.region,
          rawPayload: evt,
        });
      }
    } catch {
      // Skip failed monitors
    }
  });

  await Promise.all(fetches);
  return events;
}

function classifyFromContent(text: string): EventCategory {
  const lower = text.toLowerCase();
  if (lower.includes("water") || lower.includes("groundwater"))
    return "WATER";
  if (
    lower.includes("power") ||
    lower.includes("grid") ||
    lower.includes("energy") ||
    lower.includes("ercot") ||
    lower.includes("substation") ||
    lower.includes("interconnection")
  )
    return "POWER & GRID";
  if (
    lower.includes("acquisition") ||
    lower.includes("ownership") ||
    lower.includes("sale")
  )
    return "OWNERSHIP";
  if (
    lower.includes("new site") ||
    lower.includes("rumor") ||
    lower.includes("newly disclosed") ||
    lower.includes("no operator")
  )
    return "NEW SITE";
  if (
    lower.includes("moratori") ||
    lower.includes("opposition") ||
    lower.includes("community") ||
    lower.includes("residents")
  )
    return "COMMUNITY";
  if (
    lower.includes("legislation") ||
    lower.includes("regulation") ||
    lower.includes("policy") ||
    lower.includes("ordinance")
  )
    return "POLICY";
  if (
    lower.includes("permit") ||
    lower.includes("zoning") ||
    lower.includes("rezoning")
  )
    return "PERMITS";
  if (
    lower.includes("expansion") ||
    lower.includes("construction") ||
    lower.includes("build")
  )
    return "EXPANSION";
  return "PERMITS";
}

function extractHeadline(content: string): string {
  // Take the first sentence as headline
  const firstSentence = content.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 120) return firstSentence;
  if (firstSentence) return firstSentence.slice(0, 117) + "...";
  return content.slice(0, 80);
}

export async function GET() {
  try {
    // Load backfill results
    const backfillPath = path.join(
      process.cwd(),
      "src/data/backfill-results.json"
    );
    let backfillEvents: MonitorEvent[] = [];
    if (fs.existsSync(backfillPath)) {
      const raw = fs.readFileSync(backfillPath, "utf-8");
      const results = JSON.parse(raw);
      backfillEvents = transformBackfillResults(results);
    }

    // Fetch live monitor events
    const liveEvents = await fetchLiveMonitorEvents();

    // Merge: live events first (they're more recent), then backfill
    // Deduplicate by headline similarity
    const seen = new Set<string>();
    const merged: MonitorEvent[] = [];

    // Mark live events
    for (const evt of liveEvents) {
      const key = evt.headline.toLowerCase().slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ ...evt, id: `live_${evt.id}` });
      }
    }

    for (const evt of backfillEvents) {
      const key = evt.headline.toLowerCase().slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(evt);
      }
    }

    // Sort by date, most recent first
    merged.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json(merged);
  } catch (e) {
    console.error("Failed to load events:", e);
    return NextResponse.json([]);
  }
}
