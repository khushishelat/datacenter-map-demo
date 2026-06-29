/**
 * Collect results from already-submitted backfill tasks.
 * Uses the /result endpoint which includes output.content.
 *
 * Usage: npx tsx scripts/collect-results.ts
 */

import * as fs from "fs";
import { MONITOR_DEFS } from "./monitor-configs";

const API_KEY = process.env.PARALLEL_API_KEY || "feQGW1NtoZC9N6XxL1j9UNIWdVeoP6I8IP4yHeeK";
const BASE_URL = "https://api.parallel.ai";

// Task run IDs from the successful submission
const TASK_RUN_IDS: Record<string, string> = {
  "region-nova": "trun_b133199f04d94433a63bb5e207e0229d",
  "region-atlanta": "trun_b133199f04d9443391c16440f3bab91e",
  "region-ohio": "trun_b133199f04d944339c92b3c337085696",
  "region-phoenix": "trun_b133199f04d94433b3b5942ad8ca054e",
  "region-utah": "trun_b133199f04d94433a1f578afec2fa691",
  "region-texas": "trun_b133199f04d94433b7ade210fba2fcf2",
  "region-pnw": "trun_b133199f04d944339a26e025bedffd2a",
  "region-florida": "trun_b133199f04d94433841cf55ef647814e",
  "facility-qts-cedar-rapids": "trun_b133199f04d94433ac2eecba178fe8c7",
  "facility-qts-new-albany": "trun_b133199f04d944339b0513d1fae3dd7b",
  "facility-qts-eagle-mountain": "trun_b133199f04d9443388c1e339fa8a3471",
  "facility-qts-manassas": "trun_b133199f04d9443385e9b45a48ec366e",
  "facility-qts-fayetteville": "trun_b133199f04d94433a6bc38f2d62f0621",
  "facility-qts-aurora": "trun_b133199f04d94433afa17241ad77ed18",
  "discovery-hyperscale": "trun_b133199f04d9443381917015e39da459",
  "discovery-power-markets": "trun_b133199f04d9443394877d77767675d1",
};

async function getResult(runId: string, name: string) {
  // First check status
  const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${runId}`, {
    headers: { "x-api-key": API_KEY },
  });

  if (!statusRes.ok) {
    console.error(`  ✗ ${name}: status check failed (${statusRes.status})`);
    return null;
  }

  const statusData = await statusRes.json();

  if (statusData.status !== "completed") {
    console.log(`  ⏳ ${name}: still ${statusData.status}`);
    return null;
  }

  // Get full result
  const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${runId}/result`, {
    headers: { "x-api-key": API_KEY },
  });

  if (!resultRes.ok) {
    console.error(`  ✗ ${name}: result fetch failed (${resultRes.status})`);
    return null;
  }

  const resultData = await resultRes.json();
  const output = resultData.output;
  const eventCount =
    output?.content?.events?.length ??
    (typeof output?.content === "string"
      ? JSON.parse(output.content).events?.length ?? 0
      : 0);

  console.log(`  ✓ ${name}: ${eventCount} events`);

  return {
    ...statusData,
    output,
  };
}

async function main() {
  console.log("Collecting results from backfill tasks...\n");

  const allResults: Record<string, unknown>[] = [];

  for (const [defId, runId] of Object.entries(TASK_RUN_IDS)) {
    const def = MONITOR_DEFS.find((d) => d.id === defId);
    if (!def) continue;

    const result = await getResult(runId, def.name);

    if (result) {
      allResults.push({
        monitorDefId: def.id,
        monitorName: def.name,
        monitorClass: def.class,
        region: def.region,
        facilityCode: def.facilityCode,
        runId,
        ...result,
      });
    }
  }

  const outPath = "./src/data/backfill-results.json";
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(
    `\nSaved ${allResults.length} results (${allResults.reduce((sum, r) => {
      const content = (r as Record<string, Record<string, Record<string, unknown[]>>>).output?.content;
      const events = content?.events;
      return sum + (Array.isArray(events) ? events.length : 0);
    }, 0)} total events) to ${outPath}`
  );
}

main().catch(console.error);
