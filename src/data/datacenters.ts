import type { Datacenter, DatacenterEnrichment } from "@/lib/types";
import rawData from "../../public/data/datacenters.json";
import enrichmentData from "../../public/data/enrichments.json";

interface BasisEntry {
  field?: string;
  reasoning?: string;
  citations?: { url?: string; title?: string; excerpts?: string[] }[];
  confidence?: string;
}

const enrichmentMap = enrichmentData as Record<
  string,
  {
    enrichment: DatacenterEnrichment;
    basis?: BasisEntry[];
    runId?: string;
    collectedAt?: string;
  }
>;

export const datacenters: Datacenter[] = (rawData as Datacenter[]).map(
  (dc, i) => {
    const entry = enrichmentMap[String(i)];
    if (!entry?.enrichment) return dc;

    const e = entry.enrichment;
    const rawBasis = entry.basis || [];

    // Build per-field citations
    const citations: { field: string; url: string; title: string }[] = [];
    const reasoning: Record<string, string> = {};

    for (const b of rawBasis) {
      const field = b.field || "";
      if (b.reasoning) reasoning[field] = b.reasoning;
      if (b.citations) {
        for (const c of b.citations) {
          if (c.url) {
            citations.push({ field, url: c.url, title: c.title || "Source" });
          }
        }
      }
    }

    return {
      ...dc,
      powerMw: e.power_capacity_mw > 0 ? e.power_capacity_mw : dc.powerMw,
      sqft: e.total_sqft > 0 ? e.total_sqft : dc.sqft,
      yearOnline:
        e.year_online && e.year_online !== "unknown"
          ? e.year_online
          : dc.yearOnline,
      status: e.verified_status
        ? (e.verified_status as Datacenter["status"])
        : dc.status,
      enrichment: {
        ...e,
        citations,
        reasoning,
        enrichedAt: entry.collectedAt,
        runId: entry.runId,
      },
    };
  }
);
