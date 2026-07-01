"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { DisplayStatus, Monitor } from "@/lib/types";
import { useDatacenters } from "@/hooks/useDatacenters";
import { useMonitors } from "@/hooks/useMonitors";
import { Header } from "@/components/Header";
import { Toolbar } from "@/components/Toolbar";
import { MonitorPanel } from "@/components/MonitorPanel";
import { DatasetTable } from "@/components/DatasetTable";
import { NewsletterSubscribe } from "@/components/NewsletterSubscribe";
import { NewsletterIssue } from "@/components/NewsletterIssue";

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
type BriefModal = "subscribe" | "preview" | null;

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [briefModal, setBriefModal] = useState<BriefModal>(null);
  const [subscription, setSubscription] = useState<{ email: string } | null>(null);

  const { filtered, counts } = useDatacenters(activeFilter, "");
  const { monitors, totalEvents, lastChecked, snapshotUpdates } = useMonitors();

  const lastCheckedStr = lastChecked.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });

  // Load subscription from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("newsletter-subscription");
      if (saved) setSubscription(JSON.parse(saved));
    } catch {}
  }, []);

  function handleSubscribed(email: string) {
    const sub = { email };
    setSubscription(sub);
    localStorage.setItem("newsletter-subscription", JSON.stringify(sub));
    setBriefModal(null);
  }

  function handleUnsubscribe() {
    setSubscription(null);
    localStorage.removeItem("newsletter-subscription");
    // Also unsubscribe on server
    if (subscription?.email) {
      fetch("/api/newsletter/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subscription.email }),
      }).catch(() => {});
    }
  }

  const handleMonitorSelect = useCallback(
    (monitor: Monitor | null) => {
      setSelectedMonitor((prev) => prev?.id === monitor?.id ? null : monitor);
    }, []
  );

  const handleLocateEvent = useCallback((lat: number, lng: number) => {
    setFocusedLocation({ lat, lng });
    setTimeout(() => setFocusedLocation(null), 2000);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Header
        monitorCount={monitors.length}
        detectedCount={totalEvents}
        lastChecked={lastCheckedStr}
        subscription={subscription}
        onBriefClick={() => setBriefModal("subscribe")}
        onPreviewIssue={() => setBriefModal("preview")}
        onUnsubscribe={handleUnsubscribe}
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

      {/* Newsletter modals */}
      {briefModal === "subscribe" && (
        <NewsletterSubscribe
          onClose={() => setBriefModal(null)}
          onSubscribed={handleSubscribed}
          onPreview={() => setBriefModal("preview")}
        />
      )}
      {briefModal === "preview" && (
        <NewsletterIssue
          onClose={() => setBriefModal(null)}
          isSubscribed={!!subscription}
          onSubscribe={() => setBriefModal("subscribe")}
        />
      )}
    </div>
  );
}
