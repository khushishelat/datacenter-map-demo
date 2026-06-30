"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { DisplayStatus, Monitor } from "@/lib/types";
import { useDatacenters } from "@/hooks/useDatacenters";
import { useMonitors } from "@/hooks/useMonitors";
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
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { filtered, counts } = useDatacenters(activeFilter, "");
  const { monitors, totalEvents, lastChecked, snapshotUpdates } = useMonitors();

  const lastCheckedStr = lastChecked.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const handleMonitorSelect = useCallback(
    (monitor: Monitor | null) => {
      setSelectedMonitor((prev) =>
        prev?.id === monitor?.id ? null : monitor
      );
    },
    []
  );

  const handleLocateEvent = useCallback((lat: number, lng: number) => {
    setFocusedLocation({ lat, lng });
    // Clear after flyTo initiates
    setTimeout(() => setFocusedLocation(null), 2000);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Header
        monitorCount={monitors.length}
        detectedCount={totalEvents}
        lastChecked={lastCheckedStr}
      />
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeFilter={activeFilter}
        counts={counts}
        onFilterChange={(f) => { setActiveFilter(f); setSelectedMonitor(null); }}
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
                focusedLocation={focusedLocation}
              />
            </div>
            <div className="w-[440px] shrink-0">
              <MonitorPanel
                monitors={monitors}
                selectedMonitorId={selectedMonitor?.id ?? null}
                onSelectMonitor={handleMonitorSelect}
                onLocateEvent={handleLocateEvent}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <DatasetTable datacenters={filtered} monitors={monitors} snapshotUpdates={snapshotUpdates} />
          </div>
        )}
      </div>
    </div>
  );
}
