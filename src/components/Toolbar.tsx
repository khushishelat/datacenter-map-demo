"use client";

import clsx from "clsx";
import type { DisplayStatus } from "@/lib/types";
import { FilterPills } from "./FilterPills";
import { SearchInput } from "./SearchInput";

type Tab = "map" | "dataset";
type FilterKey = DisplayStatus | "all";

interface ToolbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  activeFilter: FilterKey;
  counts: Record<FilterKey, number>;
  onFilterChange: (filter: FilterKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  trackedCount: number;
}

export function Toolbar({
  activeTab,
  onTabChange,
  activeFilter,
  counts,
  onFilterChange,
  searchQuery,
  onSearchChange,
  trackedCount,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between px-12 py-2 border-b border-[#E5E5E5] bg-white shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-0.5 border border-[#E5E5E5] rounded-[4px] p-0.5">
          {(["map", "dataset"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={clsx(
                "font-mono uppercase text-[13px] leading-[16px] rounded-[2px] px-3 py-1 transition-colors",
                activeTab === tab
                  ? "bg-[#1D1B16] text-white"
                  : "text-[#858483] hover:text-[#1D1B16]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-[#858483]">
          {trackedCount.toLocaleString()} facilities in dataset
        </span>
      </div>

      <div className="flex items-center gap-4">
        <FilterPills
          active={activeFilter}
          counts={counts}
          onChange={onFilterChange}
        />
        <SearchInput value={searchQuery} onChange={onSearchChange} />
      </div>
    </div>
  );
}
