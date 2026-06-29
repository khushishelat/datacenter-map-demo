"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import type { Monitor, MonitorDetection } from "@/lib/types";
import { MonitorCard } from "./MonitorCard";
import {
  MONITOR_CATEGORY_LABELS,
  MONITOR_CATEGORY_COLORS,
  SEVERITY_COLORS,
} from "@/lib/constants";

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
  const discoveryCount = monitors.filter((m) => m.class === "discovery").length;

  // For "All" tab: flatten all events into a chronological feed
  const allEvents = useMemo(() => {
    const events: { event: MonitorDetection; monitor: Monitor }[] = [];
    for (const m of monitors) {
      for (const e of m.events) {
        events.push({ event: e, monitor: m });
      }
    }
    events.sort(
      (a, b) =>
        new Date(b.event.eventDate).getTime() -
        new Date(a.event.eventDate).getTime()
    );
    return events;
  }, [monitors]);

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {classFilter === "all" ? (
          /* Chronological event feed */
          allEvents.length > 0 ? (
            <div className="divide-y divide-[#E5E5E5]">
              {allEvents.map(({ event, monitor }) => (
                <FeedEventCard
                  key={event.eventId}
                  event={event}
                  monitor={monitor}
                />
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-[#ADADAC]">
                No events detected yet. Monitors are checking every hour.
              </p>
            </div>
          )
        ) : (
          /* Per-monitor card view */
          filtered.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              isSelected={selectedMonitorId === monitor.id}
              onSelect={() => onSelectMonitor(monitor)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Feed-style event card for the "All" chronological view */
function FeedEventCard({
  event,
  monitor,
}: {
  event: MonitorDetection;
  monitor: Monitor;
}) {
  const catLabel =
    MONITOR_CATEGORY_LABELS[event.category] || event.category;
  const catColor =
    MONITOR_CATEGORY_COLORS[event.category] || "#858483";
  const sevColor = SEVERITY_COLORS[event.severity] || "#858483";

  const validCitations = event.citations.filter(
    (c) => c.url && c.url.startsWith("http")
  );

  return (
    <div className="px-6 py-4 hover:bg-[#F9F8F4]/50 transition-colors">
      {/* Monitor source + date */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC]">
          {monitor.name} &middot; {monitor.class}
        </span>
        <span className="font-mono text-[8px] text-[#ADADAC]">
          {event.eventDate}
        </span>
      </div>

      {/* Category + severity */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="font-mono uppercase text-[8px] tracking-[0.05em] font-medium px-2 py-0.5 rounded-[2px] text-white"
          style={{ backgroundColor: catColor }}
        >
          {catLabel}
        </span>
        <span
          className="font-mono uppercase text-[8px] tracking-[0.05em] px-1.5 py-0.5 rounded-[2px] border"
          style={{ color: sevColor, borderColor: sevColor }}
        >
          {event.severity}
        </span>
      </div>

      {/* Headline */}
      <h4 className="text-[13px] font-medium text-[#1D1B16] leading-[16px] mb-1">
        {event.headline}
      </h4>

      {/* Summary */}
      <p className="text-[13px] text-[#5C5B59] leading-[20px] mb-2">
        {event.summary}
      </p>

      {/* Affected entities */}
      {event.affectedEntities && (
        <p className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC] mb-2">
          Affects: {event.affectedEntities}
        </p>
      )}

      {/* Citations */}
      {validCitations.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {validCitations.slice(0, 2).map((cite, i) => (
            <a
              key={i}
              href={cite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.02em] text-[#858483] border border-[#E5E5E5] rounded-[2px] px-2 py-1 hover:border-[#FB631B] hover:text-[#FB631B] transition-colors"
            >
              {cite.title && cite.title.length > 35
                ? cite.title.slice(0, 35) + "..."
                : cite.title || "Source"}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
