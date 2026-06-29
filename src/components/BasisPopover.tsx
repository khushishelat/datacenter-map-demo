"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

interface BasisPopoverProps {
  field: string;
  value: string;
  facilityName: string;
  citations: { field: string; url: string; title: string }[];
  reasoning?: string;
  children: React.ReactNode;
}

export function BasisPopover({
  field,
  value,
  facilityName,
  citations,
  reasoning,
  children,
}: BasisPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Filter citations relevant to this field
  const fieldCitations = citations.filter(
    (c) => c.field === field || c.field === ""
  );
  const uniqueCitations = Array.from(
    new Map(fieldCitations.map((c) => [c.url, c])).values()
  ).slice(0, 6);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const hasBasis = uniqueCitations.length > 0 || reasoning;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasBasis) setOpen(!open);
        }}
        className={`text-left w-full group ${
          hasBasis ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="flex items-center gap-1">
          {children}
          {hasBasis && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 inline-flex items-center gap-0.5 font-mono text-[8px] text-[#FB631B]">
              {uniqueCitations.length} cit.
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(29, 27, 22, 0.5)" }}
        >
          <div className="bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl w-[560px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] shrink-0">
              <div>
                <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] mb-1">
                  {field} / {facilityName}
                </div>
                <div className="text-[16px] font-medium text-[#1D1B16]">
                  {value || "\u2014"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#ADADAC] hover:text-[#1D1B16] transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Reasoning */}
              {reasoning && (
                <div className="mb-4">
                  <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] mb-1">
                    Reasoning
                  </div>
                  <p className="text-[13px] text-[#5C5B59] leading-[20px]">
                    {reasoning}
                  </p>
                </div>
              )}

              {/* Citations */}
              {uniqueCitations.length > 0 && (
                <div>
                  <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] mb-2">
                    Citations ({uniqueCitations.length})
                  </div>
                  <div className="space-y-2">
                    {uniqueCitations.map((cite, i) => (
                      <a
                        key={i}
                        href={cite.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-3 py-2.5 rounded-[4px] border border-[#E5E5E5] hover:border-[#FB631B] transition-colors group"
                      >
                        <span className="font-mono text-[8px] text-[#ADADAC] mt-0.5 shrink-0">
                          [{i + 1}]
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[#1D1B16] leading-[16px] group-hover:text-[#FB631B] transition-colors truncate">
                            {cite.title}
                          </div>
                          <div className="font-mono text-[8px] text-[#ADADAC] truncate mt-0.5">
                            {cite.url}
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-[#ADADAC] group-hover:text-[#FB631B] shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#E5E5E5] shrink-0">
              <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">
                Enriched by Task API
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
