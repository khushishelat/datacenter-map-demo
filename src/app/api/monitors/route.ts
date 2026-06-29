import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { Monitor, MonitorDetection, MonitorCategory } from "@/lib/types";
import { STATE_TO_MONITOR, CA_SPLIT_LAT } from "@/lib/constants";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

interface MonitorInfo {
  monitorId: string;
  name: string;
  class: "region" | "facility" | "discovery";
  query: string;
  frequency: string;
  region?: string;
  facilityCode?: string;
  states?: string[];
}

/** Count how many datacenters each monitor covers */
function computeFacilityCounts(): Record<string, number> {
  const dcPath = path.join(process.cwd(), "public/data/datacenters.json");
  if (!fs.existsSync(dcPath)) return {};

  const dcs: { state: string; lat: number; operator: string; city: string }[] =
    JSON.parse(fs.readFileSync(dcPath, "utf-8"));

  const counts: Record<string, number> = {};

  for (const dc of dcs) {
    let monitorId = STATE_TO_MONITOR[dc.state];

    // CA: split by latitude
    if (dc.state === "CA" && dc.lat < CA_SPLIT_LAT) {
      monitorId = "region-socal";
    }

    if (monitorId) {
      counts[monitorId] = (counts[monitorId] || 0) + 1;
    }
  }

  return counts;
}

const VALID_CATEGORIES: MonitorCategory[] = [
  "POWER_GRID",
  "ZONING_POLICY",
  "COMMUNITY",
  "WATER",
  "LAND_SUPPLY",
  "TENANT_DEMAND",
  "CAPITAL_OWNERSHIP",
  "CONSTRUCTION",
];

async function fetchMonitorEvents(
  monitorId: string
): Promise<MonitorDetection[]> {
  if (!API_KEY) return [];

  try {
    const res = await fetch(
      `${BASE_URL}/v1/monitors/${monitorId}/events`,
      {
        headers: { "x-api-key": API_KEY },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const rawEvents = data.events || [];
    const detections: MonitorDetection[] = [];

    for (const evt of rawEvents) {
      const output = evt.output || {};
      const content = output.content;
      const citations =
        output.basis?.[0]?.citations ||
        output.basis?.flatMap(
          (b: { citations?: { title: string; url: string }[] }) =>
            b.citations || []
        ) ||
        [];

      // Handle structured output (from output_schema)
      if (content && typeof content === "object" && content.category) {
        detections.push({
          eventId: evt.event_id,
          eventDate: evt.event_date || new Date().toISOString(),
          category: VALID_CATEGORIES.includes(content.category)
            ? content.category
            : "ZONING_POLICY",
          headline: content.headline || "",
          summary: content.summary || "",
          severity: content.severity || "informational",
          affectedEntities: content.affected_entities || "",
          citations: citations.slice(0, 4),
          rawPayload: evt,
        });
      }
      // Handle unstructured text output (from old monitors)
      else if (content && typeof content === "string") {
        detections.push({
          eventId: evt.event_id,
          eventDate: evt.event_date || new Date().toISOString(),
          category: "ZONING_POLICY",
          headline:
            content.split(/[.!?]/)[0]?.trim().slice(0, 120) || "New signal",
          summary: content,
          severity: "notable",
          affectedEntities: "",
          citations: citations.slice(0, 4),
          rawPayload: evt,
        });
      }
    }

    return detections;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const monitorsPath = path.join(process.cwd(), "src/data/monitors.json");
    if (!fs.existsSync(monitorsPath)) {
      return NextResponse.json([]);
    }

    const monitorsData: Record<string, MonitorInfo> = JSON.parse(
      fs.readFileSync(monitorsPath, "utf-8")
    );

    const facilityCounts = computeFacilityCounts();

    // Fetch events for all monitors in parallel
    const entries = Object.entries(monitorsData);
    const eventResults = await Promise.all(
      entries.map(([, info]) => fetchMonitorEvents(info.monitorId))
    );

    const monitors: Monitor[] = entries.map(([defId, info], i) => ({
      id: defId,
      monitorId: info.monitorId,
      name: info.name,
      class: info.class,
      query: info.query,
      frequency: info.frequency || "1h",
      region: info.region,
      facilityCode: info.facilityCode,
      states: info.states,
      facilityCount: facilityCounts[defId] || 0,
      events: eventResults[i],
    }));

    // Sort: monitors with events first, then by class (region, facility, discovery)
    const classOrder = { region: 0, facility: 1, discovery: 2 };
    monitors.sort((a, b) => {
      if (a.events.length > 0 && b.events.length === 0) return -1;
      if (a.events.length === 0 && b.events.length > 0) return 1;
      return classOrder[a.class] - classOrder[b.class];
    });

    return NextResponse.json(monitors);
  } catch (e) {
    console.error("Failed to load monitors:", e);
    return NextResponse.json([]);
  }
}
