import type { MonitorEvent, EventCategory } from "./types";

interface BackfillEvent {
  headline: string;
  description: string;
  date: string;
  category: string;
  affected_facilities: string;
  source_name: string;
  source_url: string | null;
}

interface BackfillResult {
  monitorDefId: string;
  monitorName: string;
  monitorClass: string;
  region?: string;
  facilityCode?: string;
  runId: string;
  output?: {
    content?: {
      events?: BackfillEvent[];
      summary?: string;
    };
  };
}

const VALID_CATEGORIES: EventCategory[] = [
  "POWER & GRID",
  "OWNERSHIP",
  "NEW SITE",
  "PERMITS",
  "EXPANSION",
  "COMMUNITY",
  "WATER",
  "POLICY",
];

export function transformBackfillResults(
  results: BackfillResult[]
): MonitorEvent[] {
  const events: MonitorEvent[] = [];
  let eventIndex = 0;

  for (const result of results) {
    const rawEvents = result.output?.content?.events;
    if (!rawEvents || !Array.isArray(rawEvents)) continue;

    for (const raw of rawEvents) {
      eventIndex++;

      const category = VALID_CATEGORIES.includes(raw.category as EventCategory)
        ? (raw.category as EventCategory)
        : "PERMITS";

      const facilityCode =
        result.facilityCode ||
        (raw.affected_facilities?.length <= 25
          ? raw.affected_facilities
          : raw.affected_facilities?.slice(0, 25) + "...") ||
        result.monitorDefId.toUpperCase();

      const sources: { label: string; url: string }[] = [];
      if (raw.source_name) {
        sources.push({
          label: raw.source_name,
          url: raw.source_url || "#",
        });
      }

      events.push({
        id: `evt_${String(eventIndex).padStart(4, "0")}`,
        monitorId: result.monitorDefId,
        monitorName: result.monitorName,
        category,
        facilityCode,
        timestamp: raw.date
          ? new Date(raw.date).toISOString()
          : new Date().toISOString(),
        headline: raw.headline,
        description: raw.description,
        sources,
        hasTaskReport: false,
        region: result.region,
      });
    }
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}
