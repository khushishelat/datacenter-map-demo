import { useMemo } from "react";
import { datacenters } from "@/data/datacenters";
import type { Datacenter, DisplayStatus } from "@/lib/types";
import { toDisplayStatus } from "@/lib/utils";

interface UseDatacentersResult {
  filtered: Datacenter[];
  counts: Record<DisplayStatus | "all", number>;
}

export function useDatacenters(
  activeFilter: DisplayStatus | "all",
  searchQuery: string
): UseDatacentersResult {
  return useMemo(() => {
    const counts: Record<DisplayStatus | "all", number> = {
      all: 0,
      operational: 0,
      construction: 0,
      planned: 0,
      unknown: 0,
      decommissioned: 0,
    };

    const query = searchQuery.toLowerCase().trim();

    const filtered = datacenters.filter((dc) => {
      const display = toDisplayStatus(dc.status);

      // Count all (pre-search-filter) for status pills
      counts[display]++;
      counts.all++;

      // Apply status filter
      if (activeFilter !== "all" && display !== activeFilter) return false;

      // Apply search
      if (query) {
        const searchable = `${dc.name} ${dc.operator} ${dc.owner} ${dc.city} ${dc.state} ${dc.region}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      return true;
    });

    return { filtered, counts };
  }, [activeFilter, searchQuery]);
}
