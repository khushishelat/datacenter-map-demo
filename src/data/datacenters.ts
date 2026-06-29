import type { Datacenter } from "@/lib/types";
import rawData from "../../public/data/datacenters.json";
import compactData from "../../public/data/enrichments-compact.json";

const compactMap = compactData as Record<string, Record<string, unknown>>;

export const datacenters: Datacenter[] = (rawData as Datacenter[]).map(
  (dc, i) => {
    const e = compactMap[String(i)];
    if (!e) return dc;

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
      powerMw: (e.power_capacity_mw as number) > 0 ? (e.power_capacity_mw as number) : dc.powerMw,
      sqft: (e.total_sqft as number) > 0 ? (e.total_sqft as number) : dc.sqft,
      yearOnline: (e.year_online as string) && (e.year_online as string) !== "unknown" ? (e.year_online as string) : dc.yearOnline,
      status: (e.verified_status as string) ? (e.verified_status as Datacenter["status"]) : dc.status,
      enrichment: {
        description: (e.description as string) || "",
        verified_status: (e.verified_status as string) || "",
        power_capacity_mw: (e.power_capacity_mw as number) || 0,
        total_sqft: (e.total_sqft as number) || 0,
        year_online: (e.year_online as string) || "",
        construction_update: (e.construction_update as string) || "",
        recent_news: (e.recent_news as string) || "",
        notable_tenants: (e.notable_tenants as string) || "",
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
        // Citations/reasoning loaded on demand from blob
        citations: [],
        reasoning: {},
        enrichedAt: "",
        runId: "",
      },
    };
  }
);
