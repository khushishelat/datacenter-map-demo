import { NextResponse } from "next/server";
import snapshotData from "@/data/snapshot-monitors.json";

export const dynamic = "force-dynamic";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

const snapshotMonitors = snapshotData as Record<string, { monitorId: string; runId: string; facilityName: string }>;

export interface SnapshotUpdate {
  facilityIndex: string;
  facilityName: string;
  monitorId: string;
  timestamp: string;
  changedFields: string[];
  changes: Record<string, { from: unknown; to: unknown }>;
}

// Cache results for 30s
let cachedUpdates: SnapshotUpdate[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

async function fetchSnapshotEvents(monitorId: string) {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/monitors/${monitorId}/events`,
      { headers: { "x-api-key": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const events = data.events || [];
    if (events.length === 0) return null;

    const latest = events[0];
    const changedContent = latest.changed_output?.content || {};
    const previousContent = latest.previous_output?.content || {};
    const changedFields = Object.keys(changedContent);
    if (changedFields.length === 0) return null;

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of changedFields) {
      changes[field] = { from: previousContent[field], to: changedContent[field] };
    }

    return { timestamp: latest.event_date || "", changedFields, changes };
  } catch {
    return null;
  }
}

export async function GET() {
  if (!API_KEY) return NextResponse.json({ updates: [], total: 0 });

  if (cachedUpdates && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({ updates: cachedUpdates, total: Object.keys(snapshotMonitors).length, cached: true });
  }

  try {
    const entries = Object.entries(snapshotMonitors);
    if (entries.length === 0) return NextResponse.json({ updates: [], total: 0 });

    const BATCH = 30;
    const updates: SnapshotUpdate[] = [];

    for (let i = 0; i < entries.length && i < 300; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async ([idx, snap]) => {
          const result = await fetchSnapshotEvents(snap.monitorId);
          if (!result) return null;
          return {
            facilityIndex: idx,
            facilityName: snap.facilityName,
            monitorId: snap.monitorId,
            timestamp: result.timestamp,
            changedFields: result.changedFields,
            changes: result.changes,
          };
        })
      );
      for (const r of results) {
        if (r) updates.push(r);
      }
    }

    cachedUpdates = updates;
    cacheTime = Date.now();

    return NextResponse.json({ updates, total: entries.length, checked: Math.min(entries.length, 300) });
  } catch (e) {
    console.error("Snapshots error:", e);
    return NextResponse.json({ updates: [], total: 0 });
  }
}
