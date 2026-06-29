import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

interface SnapshotMonitor {
  monitorId: string;
  runId: string;
  facilityName: string;
}

export interface SnapshotUpdate {
  facilityIndex: string;
  facilityName: string;
  monitorId: string;
  timestamp: string;
  changedFields: string[];
  changes: Record<string, { from: unknown; to: unknown }>;
}

async function fetchSnapshotEvents(monitorId: string): Promise<{
  hasChanges: boolean;
  timestamp: string;
  changedFields: string[];
  changes: Record<string, { from: unknown; to: unknown }>;
}> {
  if (!API_KEY) return { hasChanges: false, timestamp: "", changedFields: [], changes: {} };

  try {
    const res = await fetch(
      `${BASE_URL}/v1/monitors/${monitorId}/events`,
      { headers: { "x-api-key": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return { hasChanges: false, timestamp: "", changedFields: [], changes: {} };

    const data = await res.json();
    const events = data.events || [];

    if (events.length === 0) {
      return { hasChanges: false, timestamp: "", changedFields: [], changes: {} };
    }

    // Get the most recent snapshot event
    const latest = events[0];
    const changedContent = latest.changed_output?.content || {};
    const previousContent = latest.previous_output?.content || {};
    const changedFields = Object.keys(changedContent);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of changedFields) {
      changes[field] = {
        from: previousContent[field],
        to: changedContent[field],
      };
    }

    return {
      hasChanges: true,
      timestamp: latest.event_date || "",
      changedFields,
      changes,
    };
  } catch {
    return { hasChanges: false, timestamp: "", changedFields: [], changes: {} };
  }
}

export async function GET() {
  try {
    // Load snapshot monitor IDs
    let snapshots: Record<string, SnapshotMonitor> = {};
    try {
      const snapshotPath = path.join(process.cwd(), "src/data/snapshot-monitors.json");
      if (fs.existsSync(snapshotPath)) {
        snapshots = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      }
    } catch {
      // Try static import as fallback for Vercel
    }

    if (Object.keys(snapshots).length === 0) {
      return NextResponse.json({ updates: [], total: 0 });
    }

    // Check a batch of snapshot monitors for changes (limit to avoid timeout)
    // Only check monitors that are likely to have changes (random sample + recent)
    const entries = Object.entries(snapshots);
    const BATCH_SIZE = 50; // Check 50 at a time to stay within timeout

    const updates: SnapshotUpdate[] = [];

    // Check first batch
    const batch = entries.slice(0, BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ([facilityIndex, snap]) => {
        const result = await fetchSnapshotEvents(snap.monitorId);
        if (result.hasChanges) {
          return {
            facilityIndex,
            facilityName: snap.facilityName,
            monitorId: snap.monitorId,
            timestamp: result.timestamp,
            changedFields: result.changedFields,
            changes: result.changes,
          };
        }
        return null;
      })
    );

    for (const r of results) {
      if (r) updates.push(r);
    }

    return NextResponse.json({
      updates,
      total: Object.keys(snapshots).length,
      checked: batch.length,
    });
  } catch (e) {
    console.error("Failed to check snapshots:", e);
    return NextResponse.json({ updates: [], total: 0 });
  }
}
