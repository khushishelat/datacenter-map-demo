/**
 * Creates snapshot monitors for completed enrichment runs.
 * Each snapshot watches one facility's enrichment for changes.
 *
 * Usage: npx tsx scripts/create-snapshots.ts
 */

import * as fs from "fs";

const API_KEY =
  process.env.PARALLEL_API_KEY || "feQGW1NtoZC9N6XxL1j9UNIWdVeoP6I8IP4yHeeK";
const BASE_URL = "https://api.parallel.ai";

interface EnrichmentRun {
  runId: string;
  groupId: string;
  facilityIndex: number;
  facilityName: string;
}

interface EnrichmentData {
  runs: EnrichmentRun[];
}

async function createSnapshotMonitor(
  taskRunId: string,
  facilityName: string,
  facilityIndex: number
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/v1/monitors`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "snapshot",
      frequency: "1d",
      processor: "lite",
      settings: { task_run_id: taskRunId },
      metadata: {
        facility_name: facilityName.slice(0, 100),
        facility_index: String(facilityIndex),
        type: "datacenter-enrichment-snapshot",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(
      `  ✗ ${facilityName}: ${res.status} ${err.slice(0, 200)}`
    );
    return null;
  }

  const data = await res.json();
  return data.monitor_id;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const runsPath = "./src/data/enrichment-runs.json";
  if (!fs.existsSync(runsPath)) {
    console.error("No enrichment-runs.json. Run run-enrichment.ts first.");
    process.exit(1);
  }

  const data: EnrichmentData = JSON.parse(fs.readFileSync(runsPath, "utf-8"));

  // Only create snapshots for runs that have completed (check enrichments.json)
  const enrichPath = "./public/data/enrichments.json";
  if (!fs.existsSync(enrichPath)) {
    console.error(
      "No enrichments.json. Run collect-enrichments.ts first."
    );
    process.exit(1);
  }

  const enrichments = JSON.parse(fs.readFileSync(enrichPath, "utf-8"));
  const completedIndices = new Set(Object.keys(enrichments));

  const toCreate = data.runs.filter((r) =>
    completedIndices.has(String(r.facilityIndex))
  );

  console.log(
    `Creating snapshot monitors for ${toCreate.length} enriched facilities...\n`
  );

  // Load existing snapshots
  const snapshotPath = "./src/data/snapshot-monitors.json";
  let snapshots: Record<
    string,
    { monitorId: string; runId: string; facilityName: string }
  > = {};
  if (fs.existsSync(snapshotPath)) {
    snapshots = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < toCreate.length; i++) {
    const run = toCreate[i];
    const key = String(run.facilityIndex);

    // Skip if already has a snapshot
    if (snapshots[key]) {
      skipped++;
      continue;
    }

    const monitorId = await createSnapshotMonitor(
      run.runId,
      run.facilityName,
      run.facilityIndex
    );

    if (monitorId) {
      snapshots[key] = {
        monitorId,
        runId: run.runId,
        facilityName: run.facilityName,
      };
      created++;
    }

    // Save every 50
    if (created % 50 === 0 && created > 0) {
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshots, null, 2));
      process.stdout.write(
        `\r  Created: ${created}, Skipped: ${skipped}, Total: ${Object.keys(snapshots).length}`
      );
    }

    // Small delay
    await sleep(50);
  }

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshots, null, 2));
  console.log(
    `\n\nDone. ${created} snapshot monitors created, ${skipped} skipped.`
  );
  console.log(
    `Total: ${Object.keys(snapshots).length} snapshots saved to ${snapshotPath}`
  );
}

main().catch(console.error);
