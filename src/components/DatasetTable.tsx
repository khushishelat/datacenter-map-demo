"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import type { Datacenter, DisplayStatus, Monitor } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, STATE_TO_MONITOR, CA_SPLIT_LAT } from "@/lib/constants";
import { toDisplayStatus, formatPower, formatSqft } from "@/lib/utils";
import { ChevronUp, ChevronDown, Radio } from "lucide-react";
import { BasisPopover } from "./BasisPopover";

interface DatasetTableProps {
  datacenters: Datacenter[];
  monitors: Monitor[];
}

type SortField =
  | "name"
  | "operator"
  | "state"
  | "status"
  | "type"
  | "powerMw"
  | "sqft"
  | "yearOnline";

const PAGE_SIZE = 50;

function getMonitorForDc(dc: Datacenter, monitors: Monitor[]): Monitor | null {
  let monId = STATE_TO_MONITOR[dc.state];
  if (dc.state === "CA" && dc.lat < CA_SPLIT_LAT) monId = "region-socal";
  if (!monId) return null;
  return monitors.find((m) => m.id === monId) || null;
}

function getBasisReasoning(
  dc: Datacenter,
  field: string
): string | undefined {
  return dc.enrichment?.reasoning?.[field];
}

export function DatasetTable({ datacenters, monitors }: DatasetTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    return [...datacenters].sort((a, b) => {
      const aVal = a[sortField as keyof Datacenter];
      const bVal = b[sortField as keyof Datacenter];
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [datacenters, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalPowerMw = datacenters.reduce((s, d) => s + d.powerMw, 0);
  const totalSqft = datacenters.reduce((s, d) => s + d.sqft, 0);
  const operatorCount = new Set(
    datacenters.map((d) => d.operator).filter(Boolean)
  ).size;
  const enrichedCount = datacenters.filter((d) => d.enrichment).length;

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "powerMw" || field === "sqft" ? "desc" : "asc");
    }
    setPage(0);
  }

  const COLUMNS: {
    key: SortField;
    label: string;
    align?: "right";
    enriched?: boolean;
  }[] = [
    { key: "name", label: "Facility" },
    { key: "operator", label: "Operator" },
    { key: "state", label: "State" },
    { key: "status", label: "Status", enriched: true },
    { key: "type", label: "Type" },
    { key: "powerMw", label: "Power", align: "right", enriched: true },
    { key: "sqft", label: "Size", align: "right", enriched: true },
    { key: "yearOnline", label: "Year", align: "right", enriched: true },
    // Enrichment-only columns rendered manually after these
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Summary bar */}
      <div className="flex items-center gap-6 px-6 py-2.5 border-b border-[#E5E5E5] bg-[#F9F8F4] shrink-0">
        <Stat label="Facilities" value={datacenters.length.toLocaleString()} />
        <Stat label="Operators" value={operatorCount.toLocaleString()} />
        <Stat label="Total power" value={formatPower(totalPowerMw)} />
        <Stat label="Total footprint" value={formatSqft(totalSqft)} />
        {enrichedCount > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">
              Task API
            </span>
            <span className="font-mono text-[8px] text-[#858483]">
              {enrichedCount.toLocaleString()} enriched
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-[13px] leading-[16px]">
          <thead className="sticky top-0 bg-[#F6F6F6] z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={clsx(
                    "px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] cursor-pointer hover:text-[#1D1B16] select-none border-b border-[#E5E5E5] whitespace-nowrap",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.enriched && enrichedCount > 0 && (
                      <span className="inline-block w-1 h-1 rounded-full bg-[#FB631B]" />
                    )}
                    {sortField === col.key &&
                      (sortDir === "asc" ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      ))}
                  </span>
                </th>
              ))}
              {/* Enrichment-only columns */}
              <th className="px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] border-b border-[#E5E5E5] text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  Tenants
                  <span className="inline-block w-1 h-1 rounded-full bg-[#FB631B]" />
                </span>
              </th>
              <th className="px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] border-b border-[#E5E5E5] text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  Latest Update
                  <span className="inline-block w-1 h-1 rounded-full bg-[#FB631B]" />
                </span>
              </th>
              {/* Monitor signals column */}
              <th className="px-4 py-2.5 font-mono font-medium text-[#858483] uppercase tracking-[0.05em] text-[8px] border-b border-[#E5E5E5] text-right whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  Signals
                  <Radio className="w-2.5 h-2.5 text-[#FB631B]" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F6F6F6]">
            {pageData.map((dc, i) => {
              const display = toDisplayStatus(dc.status);
              const e = dc.enrichment;
              const citations = e?.citations || [];
              const monitor = getMonitorForDc(dc, monitors);
              const monitorEvents = monitor?.events || [];

              return (
                <tr
                  key={`row-${dc.lat}-${dc.lng}-${i}`}
                  className="hover:bg-[#F9F8F4] transition-colors group"
                >
                  {/* Facility name — clicking shows description basis */}
                  <td className="px-4 py-2 font-medium text-[#1D1B16] max-w-[280px]">
                    {e ? (
                      <BasisPopover
                        field="description"
                        value={e.description}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "description")}
                      >
                        <span className="truncate block">{dc.name}</span>
                      </BasisPopover>
                    ) : (
                      <span className="truncate block">{dc.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[#5C5B59]">{dc.operator}</td>
                  <td className="px-4 py-2 text-[#5C5B59]">{dc.state}</td>
                  {/* Status — enriched, clickable */}
                  <td className="px-4 py-2">
                    {e ? (
                      <BasisPopover
                        field="verified_status"
                        value={STATUS_LABELS[display]}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "verified_status")}
                      >
                        <StatusBadge status={display} />
                      </BasisPopover>
                    ) : (
                      <StatusBadge status={display} />
                    )}
                  </td>
                  <td className="px-4 py-2 text-[#5C5B59] capitalize">
                    {dc.type}
                  </td>
                  {/* Power — enriched, clickable even when empty */}
                  <td className="px-4 py-2 text-[#5C5B59] text-right font-mono tabular-nums">
                    {e ? (
                      <BasisPopover
                        field="power_capacity_mw"
                        value={dc.powerMw > 0 ? formatPower(dc.powerMw) : "Not found"}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "power_capacity_mw")}
                      >
                        <span className={dc.powerMw > 0 ? "" : "text-[#D6D6D6]"}>
                          {dc.powerMw > 0 ? formatPower(dc.powerMw) : "\u2014"}
                        </span>
                      </BasisPopover>
                    ) : (
                      <span className="text-[#D6D6D6]">{dc.powerMw > 0 ? formatPower(dc.powerMw) : "\u2014"}</span>
                    )}
                  </td>
                  {/* Size — enriched, clickable even when empty */}
                  <td className="px-4 py-2 text-[#5C5B59] text-right font-mono tabular-nums">
                    {e ? (
                      <BasisPopover
                        field="total_sqft"
                        value={dc.sqft > 0 ? formatSqft(dc.sqft) : "Not found"}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "total_sqft")}
                      >
                        <span className={dc.sqft > 0 ? "" : "text-[#D6D6D6]"}>
                          {dc.sqft > 0 ? formatSqft(dc.sqft) : "\u2014"}
                        </span>
                      </BasisPopover>
                    ) : (
                      <span className="text-[#D6D6D6]">{dc.sqft > 0 ? formatSqft(dc.sqft) : "\u2014"}</span>
                    )}
                  </td>
                  {/* Year — enriched, clickable even when empty */}
                  <td className="px-4 py-2 text-[#5C5B59] text-right font-mono tabular-nums">
                    {e ? (
                      <BasisPopover
                        field="year_online"
                        value={dc.yearOnline !== "unknown" ? dc.yearOnline : "Not found"}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "year_online")}
                      >
                        <span className={dc.yearOnline !== "unknown" ? "" : "text-[#D6D6D6]"}>
                          {dc.yearOnline !== "unknown" ? dc.yearOnline : "\u2014"}
                        </span>
                      </BasisPopover>
                    ) : (
                      <span className="text-[#D6D6D6]">{dc.yearOnline !== "unknown" ? dc.yearOnline : "\u2014"}</span>
                    )}
                  </td>
                  {/* Tenants — enriched, clickable even when empty */}
                  <td className="px-4 py-2 text-[#5C5B59] max-w-[160px]">
                    {e ? (
                      <BasisPopover
                        field="notable_tenants"
                        value={e.notable_tenants || "Not found"}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, "notable_tenants")}
                      >
                        <span className={e.notable_tenants ? "truncate block text-[13px]" : "text-[#D6D6D6]"}>
                          {e.notable_tenants || "\u2014"}
                        </span>
                      </BasisPopover>
                    ) : (
                      <span className="text-[#D6D6D6]">&mdash;</span>
                    )}
                  </td>
                  {/* Latest Update — enriched, clickable even when empty */}
                  <td className="px-4 py-2 text-[#5C5B59] max-w-[220px]">
                    {e ? (
                      <BasisPopover
                        field={e.recent_news ? "recent_news" : "construction_update"}
                        value={e.recent_news || e.construction_update || "No recent updates found"}
                        facilityName={dc.name}
                        citations={citations}
                        reasoning={getBasisReasoning(dc, e.recent_news ? "recent_news" : "construction_update")}
                      >
                        {e.recent_news ? (
                          <span className="truncate block text-[13px] text-[#FB631B]">
                            {e.recent_news.slice(0, 60)}
                            {e.recent_news.length > 60 ? "..." : ""}
                          </span>
                        ) : e.construction_update ? (
                          <span className="truncate block text-[13px]">
                            {e.construction_update.slice(0, 60)}
                            {e.construction_update.length > 60 ? "..." : ""}
                          </span>
                        ) : (
                          <span className="text-[#D6D6D6]">&mdash;</span>
                        )}
                      </BasisPopover>
                    ) : (
                      <span className="text-[#D6D6D6]">&mdash;</span>
                    )}
                  </td>
                  {/* Monitor signals */}
                  <td className="px-4 py-2 text-right">
                    {monitor && monitorEvents.length > 0 ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FB631B] animate-pulse" />
                        <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#FB631B]">
                          {monitorEvents.length}
                        </span>
                      </div>
                    ) : monitor ? (
                      <span className="font-mono text-[8px] text-[#E5E5E5]">
                        &mdash;
                      </span>
                    ) : (
                      <span className="font-mono text-[8px] text-[#E5E5E5]">
                        &mdash;
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-2.5 border-t border-[#E5E5E5] bg-[#F6F6F6] text-[13px] text-[#858483] shrink-0">
        <span className="font-mono text-[8px] uppercase tracking-[0.02em]">
          Showing {page * PAGE_SIZE + 1}&ndash;
          {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{" "}
          {sorted.length.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-mono uppercase text-[13px] px-3 py-1 border border-[#E5E5E5] rounded-[4px] bg-white hover:border-[#D6D6D6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="font-mono text-[8px] uppercase tracking-[0.02em] text-[#ADADAC]">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-mono uppercase text-[13px] px-3 py-1 border border-[#E5E5E5] rounded-[4px] bg-white hover:border-[#D6D6D6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[#5C5B59]">{STATUS_LABELS[status]}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#858483]">
        {label}
      </span>
      <span className="text-[13px] font-medium text-[#1D1B16] font-mono tabular-nums">
        {value}
      </span>
    </div>
  );
}
