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
    enrichment: Record<string, unknown>;
    basis?: BasisEntry[];
    runId?: string;
    collectedAt?: string;
    v2RunId?: string;
    v2CollectedAt?: string;
  }
>;

export const datacenters: Datacenter[] = (rawData as Datacenter[]).map(
  (dc, i) => {
    const entry = enrichmentMap[String(i)];
    if (!entry?.enrichment) return dc;

    const e = entry.enrichment;
    const rawBasis = entry.basis || [];

    // Build per-field citations and reasoning
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

    // Apply name/operator corrections from v2
    const name =
      (e.verified_name as string) && (e.verified_name as string) !== dc.name
        ? (e.verified_name as string)
        : dc.name;
    const operator =
      (e.verified_operator as string) &&
      (e.verified_operator as string) !== dc.operator
        ? (e.verified_operator as string)
        : dc.operator;
    const owner = (e.verified_owner as string) || dc.owner;

    return {
      ...dc,
      name,
      operator,
      owner,
      powerMw:
        (e.power_capacity_mw as number) > 0
          ? (e.power_capacity_mw as number)
          : dc.powerMw,
      sqft:
        (e.total_sqft as number) > 0
          ? (e.total_sqft as number)
          : dc.sqft,
      yearOnline:
        (e.year_online as string) && (e.year_online as string) !== "unknown"
          ? (e.year_online as string)
          : dc.yearOnline,
      status: (e.verified_status as string)
        ? (e.verified_status as Datacenter["status"])
        : dc.status,
      enrichment: {
        // v1 fields
        description: (e.description as string) || "",
        verified_status: (e.verified_status as string) || "",
        power_capacity_mw: (e.power_capacity_mw as number) || 0,
        total_sqft: (e.total_sqft as number) || 0,
        year_online: (e.year_online as string) || "",
        construction_update: (e.construction_update as string) || "",
        recent_news: (e.recent_news as string) || "",
        notable_tenants: (e.notable_tenants as string) || "",
        // v2 fields
        verified_name: (e.verified_name as string) || "",
        verified_operator: (e.verified_operator as string) || "",
        verified_owner: (e.verified_owner as string) || "",
        cooling_type: (e.cooling_type as string) || "",
        tier_level: (e.tier_level as string) || "",
        fiber_providers: (e.fiber_providers as string) || "",
        num_buildings: (e.num_buildings as number) || 0,
        campus_acres: (e.campus_acres as number) || 0,
        utility_provider: (e.utility_provider as string) || "",
        tax_incentives: (e.tax_incentives as string) || "",
        natural_hazard_zone: (e.natural_hazard_zone as string) || "",
        // metadata
        citations,
        reasoning,
        enrichedAt: entry.v2CollectedAt || entry.collectedAt,
        runId: entry.v2RunId || entry.runId,
      },
    };
  }
);
