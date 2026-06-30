"use client";

import { useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import type { Datacenter, DisplayStatus, Monitor, MonitorDetection } from "@/lib/types";
import type { SnapshotUpdate } from "@/hooks/useMonitors";
import {
  STATUS_COLORS, STATUS_LABELS, STATE_TO_MONITOR, CA_SPLIT_LAT,
  MONITOR_CATEGORY_LABELS, MONITOR_CATEGORY_COLORS, SEVERITY_COLORS,
} from "@/lib/constants";
import { toDisplayStatus, formatPower, formatSqft, timeAgo } from "@/lib/utils";
import { ChevronUp, ChevronDown, X, RefreshCw } from "lucide-react";
import { BasisPanel, type BasisPanelData } from "./BasisPanel";

interface DatasetTableProps {
  datacenters: Datacenter[];
  monitors: Monitor[];
  snapshotUpdates?: Record<string, SnapshotUpdate>;
}

const PAGE_SIZE = 50;

function getMonitorForDc(dc: Datacenter, monitors: Monitor[]): Monitor | null {
  let monId = STATE_TO_MONITOR[dc.state];
  if (dc.state === "CA" && dc.lat < CA_SPLIT_LAT) monId = "region-socal";
  if (!monId) return null;
  return monitors.find((m) => m.id === monId) || null;
}

/** Build severity strip colors from events */
function getSeverityStrip(events: MonitorDetection[]): string[] {
  const sevs = new Set(events.map((e) => e.severity));
  const strip: string[] = [];
  if (sevs.has("critical")) strip.push(SEVERITY_COLORS.critical);
  if (sevs.has("notable")) strip.push(SEVERITY_COLORS.notable);
  if (sevs.has("informational")) strip.push(SEVERITY_COLORS.informational);
  return strip;
}

export function DatasetTable({ datacenters, monitors, snapshotUpdates = {} }: DatasetTableProps) {
  const [sortField, setSortField] = useState("signals");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [activityWindow, setActivityWindow] = useState<"24h" | "7d" | "30d">("7d");
  const [signalModal, setSignalModal] = useState<{
    monitor: Monitor | null;
    facilityName: string;
    facilityIndex: number;
    snapshot: SnapshotUpdate | null;
  } | null>(null);
  const [basisData, setBasisData] = useState<BasisPanelData | null>(null);
  const [hoveredDiff, setHoveredDiff] = useState<{ field: string; idx: number } | null>(null);

  const openBasis = useCallback((dc: Datacenter, field: string, value: string, facilityIndex: number) => {
    const e = dc.enrichment;
    if (!e) return;
    setBasisData({
      field, value: value || "Not found", facilityName: dc.name, facilityIndex,
      citations: e.citations || [], reasoning: e.reasoning?.[field],
    });
  }, []);

  const enrichedRows = useMemo(() => {
    return datacenters.map((dc, originalIndex) => {
      const monitor = getMonitorForDc(dc, monitors);
      const events = monitor?.events || [];
      const snapshot = snapshotUpdates[String(originalIndex)];
      const newestEvent = events.length > 0
        ? events.reduce((a, b) => new Date(b.eventDate) > new Date(a.eventDate) ? b : a) : null;
      const severityStrip = getSeverityStrip(events);
      return { dc, monitor, events, newestEvent, originalIndex, snapshot, severityStrip };
    });
  }, [datacenters, monitors, snapshotUpdates]);

  const sorted = useMemo(() => {
    return [...enrichedRows].sort((a, b) => {
      let cmp: number;
      if (sortField === "signals") {
        const aTotal = a.events.length + (a.snapshot ? 1 : 0);
        const bTotal = b.events.length + (b.snapshot ? 1 : 0);
        cmp = aTotal - bTotal;
        if (cmp === 0 && a.newestEvent && b.newestEvent)
          cmp = new Date(a.newestEvent.eventDate).getTime() - new Date(b.newestEvent.eventDate).getTime();
      } else {
        const aVal = a.dc[sortField as keyof Datacenter];
        const bVal = b.dc[sortField as keyof Datacenter];
        cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal || "").localeCompare(String(bVal || ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [enrichedRows, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const enrichedCount = datacenters.filter((d) => d.enrichment).length;

  function handleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "powerMw" || field === "sqft" || field === "signals" ? "desc" : "asc"); }
    setPage(0);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Stats strip */}
        <div className="flex items-center gap-6 px-4 py-2 border-b border-[#E5E5E5] bg-[#F9F8F4] shrink-0">
          <Stat label="Facilities" value={datacenters.length.toLocaleString()} />
          <Stat label="Total power" value={formatPower(datacenters.reduce((s, d) => s + d.powerMw, 0))} />
          {enrichedCount > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">Task API</span>
              <span className="font-mono text-[8px] text-[#858483]">{enrichedCount.toLocaleString()} enriched</span>
            </div>
          )}
        </div>

        {/* Legend bar (8a) */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#E5E5E5] bg-[#FCFBFA] shrink-0 flex-wrap text-[9px]">
          <span className="font-mono uppercase text-[8px] tracking-[0.06em] text-[#A6A5A4]">Monitors</span>
          {/* Severity swatches */}
          <span className="inline-flex items-center gap-1.5">
            <span className="flex gap-[1.5px]">
              <span className="w-[7px] h-[5px] rounded-[1px]" style={{ background: "#E14942" }} />
              <span className="w-[7px] h-[5px] rounded-[1px]" style={{ background: "#FB631B" }} />
              <span className="w-[7px] h-[5px] rounded-[1px]" style={{ background: "#858483" }} />
            </span>
            <span className="font-mono text-[9px] text-[#858483]">Event signal (news)</span>
          </span>
          {/* Snapshot */}
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="w-[11px] h-[11px] text-[#FB631B]" />
            <span className="font-mono text-[9px] text-[#858483]">Snapshot re-verify</span>
          </span>
          <span className="w-px h-[13px] bg-[#E5E5E5]" />
          {/* Cell changed */}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#FB631B] text-[10px]">▲</span>
            <span className="font-mono text-[9px] text-[#858483]">Cell value changed this run</span>
          </span>
          {/* Activity window */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="font-mono uppercase text-[8px] tracking-[0.06em] text-[#A6A5A4]">Activity window</span>
            {(["24h", "7d", "30d"] as const).map((w) => (
              <button key={w} onClick={() => setActivityWindow(w)} className={clsx(
                "font-mono text-[8px] uppercase tracking-[0.05em] px-[7px] py-[3px] rounded-[2px] transition-colors",
                activityWindow === w ? "bg-[#1D1B16] text-white" : "text-[#858483] hover:bg-[#F6F6F6]"
              )}>{w === "7d" ? "7 days" : w === "30d" ? "30 days" : w}</button>
            ))}
          </div>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto">
          <table className="text-[13px] leading-[16px] w-max">
            <thead className="sticky top-0 bg-[#F6F6F6] z-10">
              <tr>
                <TH f="name" l="Facility" s={sortField} d={sortDir} o={handleSort} sticky />
                <TH f="signals" l="Monitors" s={sortField} d={sortDir} o={handleSort} />
                <TH f="operator" l="Operator" s={sortField} d={sortDir} o={handleSort} e />
                <TH f="owner" l="Owner" s={sortField} d={sortDir} o={handleSort} e />
                <TH f="state" l="State" s={sortField} d={sortDir} o={handleSort} />
                <TH f="status" l="Status" s={sortField} d={sortDir} o={handleSort} e />
                <TH f="type" l="Type" s={sortField} d={sortDir} o={handleSort} />
                <TH f="powerMw" l="Power" s={sortField} d={sortDir} o={handleSort} a="right" e />
                <TH f="sqft" l="Size" s={sortField} d={sortDir} o={handleSort} a="right" e />
                <TH f="yearOnline" l="Year" s={sortField} d={sortDir} o={handleSort} a="right" e />
                <THE l="Description" />
                <THE l="Tenants" />
                <THE l="Latest Update" />
                <THE l="Utility" />
                <THE l="Cooling" />
                <THE l="Tier" />
                <THE l="Fiber" />
                <THE l="Buildings" />
                <THE l="Acres" />
                <THE l="Hazard Zone" />
                <THE l="Tax Incentives" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F6F6]">
              {pageData.map(({ dc, monitor, events, originalIndex, snapshot, severityStrip }, i) => {
                const display = toDisplayStatus(dc.status);
                const e = dc.enrichment;
                const update = e?.recent_news || e?.construction_update || "";
                const changedFields = snapshot?.changedFields || [];

                return (
                  <tr key={`${dc.lat}-${dc.lng}-${i}`} className="hover:bg-[#F9F8F4] transition-colors">
                    {/* Facility — sticky */}
                    <td className="px-4 py-2 font-medium text-[#1D1B16] max-w-[240px] sticky left-0 bg-white z-[5] border-r border-[#E5E5E5]">
                      <Cell dc={dc} field="verified_name" value={dc.name} onClick={openBasis} facilityIndex={originalIndex} className="truncate block font-medium text-[#1D1B16]" />
                    </td>

                    {/* Monitors cell (8a design) */}
                    <td className="px-3 py-[7px] whitespace-nowrap border-b border-[#F1F0EC]">
                      {events.length > 0 || snapshot ? (
                        <button
                          onClick={() => setSignalModal({ monitor: monitor || null, facilityName: dc.name, facilityIndex: originalIndex, snapshot: snapshot || null })}
                          className="inline-flex flex-col gap-[3px] cursor-pointer"
                        >
                          {events.length > 0 && (
                            <>
                              <div className="flex items-center gap-[6px]">
                                <span className="font-mono text-[9px] text-[#181818] tracking-[0.04em]">{events.length} signals</span>
                                {events[0] && <span className="font-mono text-[8px] text-[#A6A5A4]">{timeAgo(events[0].eventDate)}</span>}
                              </div>
                              {/* Severity strip */}
                              <div className="flex gap-[2px]">
                                {severityStrip.map((color, si) => (
                                  <span key={si} className="w-[16px] h-[5px] rounded-[1px]" style={{ background: color }} />
                                ))}
                              </div>
                            </>
                          )}
                          {snapshot && (
                            <div className="flex items-center gap-[4px]">
                              <RefreshCw className="w-[10px] h-[10px] text-[#FB631B]" />
                              <span className="font-mono text-[8.5px] text-[#FB631B]">{snapshot.changedFields.length} fields re-verified</span>
                            </div>
                          )}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-[#E5E5E5]">&mdash;</span>
                      )}
                    </td>

                    <EC className="max-w-[160px]" changed={changedFields.includes("verified_operator")} field="verified_operator" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="verified_operator" value={dc.operator} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" />
                    </EC>
                    <EC className="max-w-[160px]" changed={changedFields.includes("verified_owner")} field="verified_owner" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="verified_owner" value={dc.owner} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" />
                    </EC>
                    <td className="px-4 py-2 text-[#5C5B59] whitespace-nowrap">{dc.state}</td>
                    <EC changed={changedFields.includes("verified_status")} field="verified_status" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="verified_status" value={STATUS_LABELS[display]} onClick={openBasis} facilityIndex={originalIndex} displayValue={<StatusBadge status={display} />} />
                    </EC>
                    <td className="px-4 py-2 text-[#5C5B59] capitalize whitespace-nowrap">{dc.type}</td>
                    <EC className="text-right font-mono tabular-nums whitespace-nowrap" changed={changedFields.includes("power_capacity_mw")} field="power_capacity_mw" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="power_capacity_mw" value={dc.powerMw > 0 ? formatPower(dc.powerMw) : ""} onClick={openBasis} facilityIndex={originalIndex} />
                    </EC>
                    <EC className="text-right font-mono tabular-nums whitespace-nowrap" changed={changedFields.includes("total_sqft")} field="total_sqft" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="total_sqft" value={dc.sqft > 0 ? formatSqft(dc.sqft) : ""} onClick={openBasis} facilityIndex={originalIndex} />
                    </EC>
                    <EC className="text-right font-mono tabular-nums whitespace-nowrap max-w-[80px]" changed={changedFields.includes("year_online")} field="year_online" snapshot={snapshot} hoveredDiff={hoveredDiff} setHoveredDiff={setHoveredDiff} idx={originalIndex}>
                      <Cell dc={dc} field="year_online" value={dc.yearOnline !== "unknown" ? dc.yearOnline : ""} onClick={openBasis} facilityIndex={originalIndex} truncate={8} className="truncate block" />
                    </EC>
                    <EC className="max-w-[200px]"><Cell dc={dc} field="description" value={e?.description || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" truncate={60} /></EC>
                    <EC className="max-w-[140px]"><Cell dc={dc} field="notable_tenants" value={e?.notable_tenants || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                    <EC className="max-w-[180px]"><Cell dc={dc} field={e?.recent_news ? "recent_news" : "construction_update"} value={update} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" truncate={50} /></EC>
                    <EC className="max-w-[140px]"><Cell dc={dc} field="utility_provider" value={e?.utility_provider || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                    <EC><Cell dc={dc} field="cooling_type" value={e?.cooling_type && e.cooling_type !== "unknown" ? e.cooling_type : ""} onClick={openBasis} facilityIndex={originalIndex} /></EC>
                    <EC className="max-w-[100px]"><Cell dc={dc} field="tier_level" value={e?.tier_level || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                    <EC className="max-w-[160px]"><Cell dc={dc} field="fiber_providers" value={e?.fiber_providers || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                    <EC className="text-right font-mono tabular-nums"><Cell dc={dc} field="num_buildings" value={e?.num_buildings && e.num_buildings > 0 ? String(e.num_buildings) : ""} onClick={openBasis} facilityIndex={originalIndex} /></EC>
                    <EC className="text-right font-mono tabular-nums"><Cell dc={dc} field="campus_acres" value={e?.campus_acres && e.campus_acres > 0 ? String(e.campus_acres) : ""} onClick={openBasis} facilityIndex={originalIndex} /></EC>
                    <EC className="max-w-[160px]"><Cell dc={dc} field="natural_hazard_zone" value={e?.natural_hazard_zone || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                    <EC className="max-w-[180px]"><Cell dc={dc} field="tax_incentives" value={e?.tax_incentives || ""} onClick={openBasis} facilityIndex={originalIndex} className="truncate block" /></EC>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#E5E5E5] bg-[#F6F6F6] shrink-0">
          <span className="font-mono text-[8px] uppercase tracking-[0.02em] text-[#858483]">
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="font-mono text-[11px] border border-[#E5E5E5] rounded-[4px] bg-white px-[10px] py-[3px] text-[#A6A5A4] disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#181818] transition-colors">Prev</button>
            <span className="font-mono text-[8px] text-[#A6A5A4]">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="font-mono text-[11px] border border-[#E5E5E5] rounded-[4px] bg-white px-[10px] py-[3px] text-[#181818] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Basis side panel */}
      {basisData && (
        <div className="fixed top-0 right-0 h-screen z-[50] shadow-xl">
          <BasisPanel data={basisData} onClose={() => setBasisData(null)} />
        </div>
      )}

      {/* Monitor detail modal */}
      {signalModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(29, 27, 22, 0.5)" }}>
          <div className="bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] shrink-0">
              <div>
                <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#A6A5A4] mb-1">Monitors for facility</div>
                <div className="text-[16px] font-medium text-[#181818]">{signalModal.facilityName}</div>
              </div>
              <button onClick={() => setSignalModal(null)} className="text-[#A6A5A4] hover:text-[#181818] transition-colors p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {signalModal.snapshot && (
                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">Snapshot</span>
                    <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#181818]">Row-level monitor</span>
                    <span className="font-mono text-[8px] text-[#A6A5A4] ml-auto">{signalModal.snapshot.timestamp}</span>
                  </div>
                  <p className="text-[13px] text-[#858483] mb-3">
                    Hourly snapshot detected changes in {signalModal.snapshot.changedFields.length} field{signalModal.snapshot.changedFields.length !== 1 ? "s" : ""}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {signalModal.snapshot.changedFields.map((field) => (
                      <span key={field} className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#FB631B] border border-[#FCDDCF] bg-[#FCDDCF]/30 px-2 py-0.5 rounded-[2px]">
                        {field.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {signalModal.monitor && signalModal.monitor.events.length > 0 && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-white bg-[#5C5B59] px-1.5 py-0.5 rounded-[2px]">Region</span>
                    <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#181818]">{signalModal.monitor.name}</span>
                    <span className="font-mono text-[8px] text-[#A6A5A4] ml-auto">{signalModal.monitor.events.length} event{signalModal.monitor.events.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-3">
                    {signalModal.monitor.events.map((evt) => <EvtCard key={evt.eventId} event={evt} />)}
                  </div>
                </div>
              )}
              {!signalModal.snapshot && (!signalModal.monitor || signalModal.monitor.events.length === 0) && (
                <div className="px-6 py-12 text-center"><p className="text-[13px] text-[#A6A5A4]">No monitor events for this facility yet.</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Enriched cell with optional change indicator */
function EC({ children, className, changed, field, snapshot, hoveredDiff, setHoveredDiff, idx }: {
  children: React.ReactNode; className?: string; changed?: boolean; field?: string;
  snapshot?: SnapshotUpdate | null; hoveredDiff?: { field: string; idx: number } | null;
  setHoveredDiff?: (v: { field: string; idx: number } | null) => void; idx?: number;
}) {
  const isHovered = hoveredDiff?.field === field && hoveredDiff?.idx === idx;

  return (
    <td
      className={clsx("px-4 py-2 border-l border-[#FCDDCF]/30 whitespace-nowrap relative", className)}
      onMouseEnter={() => changed && field && setHoveredDiff?.({ field, idx: idx || 0 })}
      onMouseLeave={() => changed && setHoveredDiff?.(null)}
    >
      {/* Orange left edge for changed cells */}
      {changed && <span className="absolute left-0 top-[5px] bottom-[5px] w-[2px] bg-[#FB631B]" />}
      <span className="flex items-center gap-1">
        {children}
        {changed && <span className="text-[#FB631B] text-[9px] shrink-0">▲</span>}
      </span>
      {/* Hover popover for changed cell */}
      {isHovered && changed && field && snapshot && (
        <div className="absolute top-[calc(100%+3px)] left-0 z-30 w-[212px] bg-white border border-[#E5E5E5] rounded-[6px] p-[11px_12px] text-left whitespace-normal" style={{ boxShadow: "0 1px 1px rgba(0,0,0,.03), 0 2px 1px rgba(0,0,0,.02), 0 3px 1px rgba(0,0,0,.01)" }}>
          <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#A6A5A4] mb-[7px]">Snapshot · {field.replace(/_/g, " ")}</div>
          <div className="font-mono text-[9px] text-[#A6A5A4] leading-[14px]">
            Re-verified {timeAgo(snapshot.timestamp)} by the hourly snapshot monitor · Task API
          </div>
        </div>
      )}
    </td>
  );
}

function Cell({ dc, field, value, onClick, className, displayValue, truncate: trunc, facilityIndex }: {
  dc: Datacenter; field: string; value: string; onClick: (dc: Datacenter, field: string, value: string, idx: number) => void;
  className?: string; displayValue?: React.ReactNode; truncate?: number; facilityIndex: number;
}) {
  const e = dc.enrichment;
  const isEmpty = !value || value === "0" || value === "unknown";
  const shown = trunc && value && value.length > trunc ? value.slice(0, trunc) + "..." : value;
  if (!e) return <span className={clsx(isEmpty ? "text-[#D6D6D6]" : "text-[#5C5B59]", className)}>{isEmpty ? "\u2014" : (displayValue || shown)}</span>;
  return (
    <button onClick={(ev) => { ev.stopPropagation(); onClick(dc, field, value, facilityIndex); }} className={clsx("text-left w-full group cursor-pointer", className)}>
      <span className="flex items-center gap-1">
        <span className={isEmpty ? "text-[#D6D6D6]" : "text-[#5C5B59]"}>{isEmpty ? "\u2014" : (displayValue || shown)}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 font-mono text-[8px] text-[#FB631B]">&middot;</span>
      </span>
    </button>
  );
}

function EvtCard({ event }: { event: MonitorDetection }) {
  const catColor = MONITOR_CATEGORY_COLORS[event.category] || "#858483";
  return (
    <div className="border border-[#E5E5E5] rounded-[4px] px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono uppercase text-[8px] tracking-[0.05em] font-medium px-2 py-0.5 rounded-[2px] text-white" style={{ backgroundColor: catColor }}>{MONITOR_CATEGORY_LABELS[event.category] || event.category}</span>
        <span className="font-mono text-[8px] text-[#A6A5A4] ml-auto">{event.eventDate}</span>
      </div>
      <h4 className="text-[13px] font-medium text-[#181818] leading-[16px] mb-1">{event.headline}</h4>
      <p className="text-[13px] text-[#5C5B59] leading-[20px]">{event.summary}</p>
    </div>
  );
}

function TH({ f, l, s, d, o, a, e, sticky }: {
  f: string; l: string; s: string; d: string; o: (f: string) => void; a?: "right"; e?: boolean; sticky?: boolean;
}) {
  return (
    <th onClick={() => o(f)} className={clsx(
      "px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] cursor-pointer hover:text-[#181818] select-none border-b border-[#E5E5E5] whitespace-nowrap",
      a === "right" ? "text-right" : "text-left",
      e && "border-l border-l-[#FCDDCF]/30",
      sticky && "sticky left-0 bg-[#F6F6F6] z-[11] border-r border-[#E5E5E5]"
    )}>
      <span className="inline-flex items-center gap-1">
        {l}{e && <span className="inline-block w-1 h-1 rounded-full bg-[#FB631B]" />}
        {s === f && (d === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

function THE({ l }: { l: string }) {
  return (
    <th className="px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] border-b border-[#E5E5E5] border-l border-l-[#FCDDCF]/30 text-left whitespace-nowrap">
      <span className="inline-flex items-center gap-1">{l} <span className="inline-block w-1 h-1 rounded-full bg-[#FB631B]" /></span>
    </th>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
      <span className="text-[#5C5B59]">{STATUS_LABELS[status]}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#858483]">{label}</span>
      <span className="text-[13px] font-medium text-[#181818] font-mono tabular-nums">{value}</span>
    </div>
  );
}
