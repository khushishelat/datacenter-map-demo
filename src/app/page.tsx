"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { DisplayStatus, Monitor } from "@/lib/types";
import { useDatacenters } from "@/hooks/useDatacenters";
import { useMonitors } from "@/hooks/useMonitors";
import { useLiveTimer } from "@/hooks/useLiveTimer";
import { Header } from "@/components/Header";
import { Toolbar } from "@/components/Toolbar";
import { MonitorPanel } from "@/components/MonitorPanel";
import { DatasetTable } from "@/components/DatasetTable";

const MapPanel = dynamic(() => import("@/components/MapPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#F9F8F4] text-[13px] font-mono text-[#ADADAC]">
      Loading map...
    </div>
  ),
});

type Tab = "map" | "dataset";
type FilterKey = DisplayStatus | "all";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);

  const { filtered, counts } = useDatacenters(activeFilter, searchQuery);
  const { monitors, totalEvents, refetch } = useMonitors();

  const handleTick = useCallback(() => {
    refetch();
  }, [refetch]);

  const { timeStr, countdown } = useLiveTimer(handleTick);

  const handleMonitorSelect = useCallback(
    (monitor: Monitor | null) => {
      setSelectedMonitor((prev) =>
        prev?.id === monitor?.id ? null : monitor
      );
    },
    []
  );

  return (
    <div className="flex flex-col h-screen">
      <Header
        monitorCount={monitors.length}
        detectedCount={totalEvents}
        lastChecked={timeStr}
        countdown={countdown}
      />
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeFilter={activeFilter}
        counts={counts}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        trackedCount={filtered.length}
      />

      <div className="flex-1 flex min-h-0">
        {activeTab === "map" ? (
          <>
            <div className="flex-1 relative">
              <MapPanel
                datacenters={filtered}
                counts={counts}
                selectedMonitor={selectedMonitor}
              />
            </div>
            <div className="w-[420px] shrink-0">
              <MonitorPanel
                monitors={monitors}
                selectedMonitorId={selectedMonitor?.id ?? null}
                onSelectMonitor={handleMonitorSelect}
              />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <DatasetTable datacenters={filtered} monitors={monitors} />
          </div>
        )}
      </div>
    </div>
  );
}
