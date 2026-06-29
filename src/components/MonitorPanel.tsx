"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Monitor } from "@/lib/types";
import { MonitorCard } from "./MonitorCard";

type ClassFilter = "all" | "region" | "facility" | "discovery";

interface MonitorPanelProps {
  monitors: Monitor[];
  selectedMonitorId: string | null;
  onSelectMonitor: (monitor: Monitor | null) => void;
}

export function MonitorPanel({
  monitors,
  selectedMonitorId,
  onSelectMonitor,
}: MonitorPanelProps) {
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");

  const filtered =
    classFilter === "all"
      ? monitors
      : monitors.filter((m) => m.class === classFilter);

  const totalEvents = monitors.reduce((s, m) => s + m.events.length, 0);
  const regionCount = monitors.filter((m) => m.class === "region").length;
  const facilityCount = monitors.filter((m) => m.class === "facility").length;
  const discoveryCount = monitors.filter(
    (m) => m.class === "discovery"
  ).length;

  const classCounts: Record<ClassFilter, number> = {
    all: monitors.length,
    region: regionCount,
    facility: facilityCount,
    discovery: discoveryCount,
  };

  return (
    <div className="flex flex-col h-full border-l border-[#E5E5E5] bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FB631B]" />
            <span className="text-[13px] font-medium text-[#1D1B16] tracking-[0.02em]">
              MONITORS
            </span>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC]">
            {monitors.length} active &middot; {totalEvents} detected
          </span>
        </div>
        <p className="text-[13px] text-[#858483] leading-[20px]">
          Watching {regionCount} U.S. markets, {facilityCount} facilities, and{" "}
          {discoveryCount} discovery themes. Running every hour.
        </p>
      </div>

      {/* Class filter tabs */}
      <div className="px-6 py-2 border-b border-[#E5E5E5] shrink-0 flex gap-1.5">
        {(["all", "region", "facility", "discovery"] as const).map((cls) => (
          <button
            key={cls}
            onClick={() => setClassFilter(cls)}
            className={clsx(
              "font-mono uppercase text-[8px] tracking-[0.05em] px-2.5 py-1 rounded-[2px] transition-colors",
              classFilter === cls
                ? "bg-[#1D1B16] text-white"
                : "text-[#858483] hover:text-[#1D1B16] hover:bg-[#F6F6F6]"
            )}
          >
            {cls === "all" ? "All" : cls} {classCounts[cls]}
          </button>
        ))}
      </div>

      {/* Monitor list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((monitor) => (
          <MonitorCard
            key={monitor.id}
            monitor={monitor}
            isSelected={selectedMonitorId === monitor.id}
            onSelect={() => onSelectMonitor(monitor)}
          />
        ))}
      </div>
    </div>
  );
}
