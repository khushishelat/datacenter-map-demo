"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, FileText, Code, Search, BookOpen, Brain, Globe } from "lucide-react";
import type { MonitorDetection, Monitor } from "@/lib/types";
import { CopyCodeBlock } from "./CopyCodeBlock";

interface ResearchReportProps {
  event: MonitorDetection;
  monitor: Monitor;
  onClose: () => void;
  existingState?: { status: "running" | "completed"; content?: string; runId?: string };
  onStatusChange?: (eventId: string, status: "running" | "completed", content?: string, runId?: string) => void;
}

interface StreamMessage {
  type: string;
  icon: "search" | "plan" | "result" | "status" | "stats";
  text: string;
  timestamp?: string;
}

export function ResearchReport({ event, monitor, onClose, existingState, onStatusChange }: ResearchReportProps) {
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">(
    existingState?.status || "idle"
  );
  const [content, setContent] = useState(existingState?.content || "");
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [stats, setStats] = useState<{ considered: number; read: number; progress: number }>({ considered: 0, read: 0, progress: 0 });
  const [runId, setRunId] = useState("");
  const [showCode, setShowCode] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, content]);

  const startPolling = useCallback((eid: string, rid?: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({ eventId: eid });
        if (rid) params.set("runId", rid);
        const res = await fetch(`/api/research?${params}`);
        const data = await res.json();
        if (data.content) {
          setContent(data.content);
          setStatus("completed");
          setRunId(data.runId || rid || "");
          onStatusChange?.(eid, "completed", data.content, data.runId);
          clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setStatus("error");
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 3000);
    setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); }, 300000);
  }, [onStatusChange]);

  // If existing state says running, reconnect to the stream
  useEffect(() => {
    if (existingState?.status === "running" && existingState.runId) {
      setRunId(existingState.runId);
      setStatus("running");
      const es = connectToStream(event.eventId, existingState.runId);
      return () => { es.close(); if (pollRef.current) clearInterval(pollRef.current); };
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.eventId, existingState?.runId]);

  function connectToStream(eid: string, rid: string) {
    const es = new EventSource(`/api/research?eventId=${encodeURIComponent(eid)}&runId=${encodeURIComponent(rid)}&stream=true`);
    es.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data);
        if (d.type === "report.complete") {
          setContent(d.content);
          setStatus("completed");
          onStatusChange?.(eid, "completed", d.content, rid);
          es.close();
        } else if (d.type?.includes("search")) {
          addMessage("search", d.message, d.timestamp);
        } else if (d.type?.includes("plan")) {
          addMessage("plan", d.message, d.timestamp);
        } else if (d.type?.includes("result") && !d.type?.includes("stats")) {
          addMessage("result", d.message, d.timestamp);
        } else if (d.type?.includes("exec_status")) {
          addMessage("status", d.message, d.timestamp);
        } else if (d.type?.includes("progress_stats")) {
          setStats({
            considered: d.source_stats?.num_sources_considered || 0,
            read: d.source_stats?.num_sources_read || 0,
            progress: d.progress_meter || 0,
          });
        } else if (d.type === "task_run.state" && d.run?.status === "completed") {
          startPolling(eid, rid);
          es.close();
        }
      } catch {}
    };
    es.onerror = () => { es.close(); startPolling(eid, rid); };
    return es;
  }

  async function generateReport() {
    setStatus("running");
    setContent("");
    setMessages([]);
    setStats({ considered: 0, read: 0, progress: 0 });

    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.eventId,
        headline: event.headline,
        summary: event.summary,
        monitorName: monitor.name,
      }),
    });

    const data = await res.json();

    if (data.content) {
      setContent(data.content);
      setRunId(data.runId || "");
      setStatus("completed");
      onStatusChange?.(event.eventId, "completed", data.content, data.runId);
      return;
    }

    if (data.runId) {
      onStatusChange?.(event.eventId, "running", undefined, data.runId);
      setRunId(data.runId);

      // Connect to SSE (event names stripped by proxy, all come through onmessage)
      connectToStream(event.eventId, data.runId);
    }
  }

  function addMessage(icon: StreamMessage["icon"], text: string, timestamp?: string) {
    setMessages((prev) => [...prev.slice(-30), { type: icon, icon, text, timestamp }]);
  }

  const iconMap = {
    search: <Search className="w-3 h-3 text-[#8FB6CC]" />,
    plan: <Brain className="w-3 h-3 text-[#FB631B]" />,
    result: <BookOpen className="w-3 h-3 text-[#69BE78]" />,
    status: <Globe className="w-3 h-3 text-[#858483]" />,
    stats: <Globe className="w-3 h-3 text-[#858483]" />,
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(29, 27, 22, 0.6)" }}>
      <div className={`bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col ${status === "completed" ? "w-[900px]" : "w-[760px]"}`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E5E5] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-[#FB631B]" />
              <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B]">Deep Research Report</span>
            </div>
            <h3 className="text-[16px] font-medium text-[#1D1B16] leading-[20px]">{event.headline}</h3>
            <p className="text-[13px] text-[#858483] mt-0.5">{monitor.name} &middot; {event.eventDate}</p>
          </div>
          <button onClick={onClose} className="text-[#ADADAC] hover:text-[#1D1B16] transition-colors p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" ref={streamRef}>
          {status === "idle" && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-[#858483] mb-4">
                Generate a comprehensive research report using Parallel&apos;s ultra deep research processor.
              </p>
              <button onClick={generateReport} className="font-mono uppercase text-[13px] px-6 py-2.5 bg-[#FB631B] text-white rounded-[4px] hover:bg-[#F4793F] transition-colors">
                Generate Report
              </button>
            </div>
          )}

          {status === "running" && (
            <div className="px-6 py-4">
              {/* Stats bar */}
              {stats.considered > 0 && (
                <div className="flex items-center gap-4 mb-4 py-2 px-3 bg-[#F9F8F4] rounded-[4px] border border-[#E5E5E5]">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[16px] font-medium text-[#1D1B16] tabular-nums">{stats.considered}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC]">sources found</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[16px] font-medium text-[#1D1B16] tabular-nums">{stats.read}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#ADADAC]">pages read</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-[#E5E5E5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#FB631B] rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.progress, 100)}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-[8px] text-[#ADADAC] tabular-nums">{Math.round(stats.progress)}%</span>
                </div>
              )}

              {/* Stream messages */}
              <div className="space-y-1.5">
                {messages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <span className="shrink-0 mt-0.5">{iconMap[msg.icon]}</span>
                    <span className="text-[13px] text-[#5C5B59] leading-[18px]">{msg.text}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="w-3 h-3 text-[#FB631B] animate-spin shrink-0" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.05em] text-[#FB631B]">Researching...</span>
                </div>
              </div>
            </div>
          )}

          {status === "completed" && content && (
            <ReportContent content={content} />
          )}

          {status === "error" && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-[#E14942] mb-4">Failed to generate report.</p>
              <button onClick={generateReport} className="font-mono uppercase text-[13px] px-4 py-2 border border-[#E5E5E5] rounded-[4px] hover:border-[#D6D6D6] transition-colors">Retry</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E5E5E5] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">Task API</span>
            <span className="font-mono text-[8px] text-[#ADADAC]">
              ultra &middot; text mode{runId && ` · ${runId}`}
            </span>
            <button onClick={() => setShowCode(!showCode)} className="flex items-center gap-1 font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] hover:text-[#1D1B16] transition-colors ml-auto">
              <Code className="w-2.5 h-2.5" />
              {showCode ? "Hide code" : "View code"}
            </button>
          </div>
          {showCode && (
            <div className="mt-2">
              <CopyCodeBlock
                label="POST /v1/tasks/runs"
                code={JSON.stringify({
                  input: `Produce a comprehensive research report on: ${event.headline}`,
                  interaction_id: event.eventId,
                  enable_events: true,
                  task_spec: { output_schema: { type: "text", description: "Markdown-formatted research report" } },
                  processor: "ultra",
                }, null, 2)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportContent({ content }: { content: string }) {
  // Extract headings for TOC
  const headings: { level: number; text: string; id: string }[] = [];
  content.replace(/^(#{1,3}) (.+)$/gm, (_, hashes, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    headings.push({ level: hashes.length, text, id });
    return "";
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* TOC sidebar — sticky */}
      {headings.length > 2 && (
        <div className="w-[200px] shrink-0 border-r border-[#E5E5E5] overflow-y-auto py-4 px-4 sticky top-0 self-start h-full">
          <div className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] mb-3">
            Contents
          </div>
          <nav className="space-y-1">
            {headings.map((h, i) => (
              <a
                key={i}
                href={`#report-${h.id}`}
                className={`block text-[11px] leading-[16px] text-[#858483] hover:text-[#FB631B] transition-colors truncate ${
                  h.level === 1 ? "font-medium text-[#1D1B16]" : h.level === 2 ? "pl-2" : "pl-4 text-[#ADADAC]"
                }`}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </div>
      )}
      {/* Report body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tables: detect pipe-delimited rows
  html = html.replace(
    /((?:^\|.+\|$\n?)+)/gm,
    (tableBlock) => {
      const rows = tableBlock.trim().split("\n").filter((r) => r.trim());
      if (rows.length < 2) return tableBlock;

      // Check if second row is separator (|---|---|)
      const isSep = (r: string) => /^\|[\s-:|]+\|$/.test(r);
      const hasSep = rows.length >= 2 && isSep(rows[1]);

      let out = '<div class="overflow-x-auto my-3"><table class="w-full text-[12px] border border-[#E5E5E5] rounded-[4px]">';

      rows.forEach((row, i) => {
        if (hasSep && i === 1) return; // skip separator row
        const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1).map((c) => c.trim());
        const isHeader = hasSep && i === 0;
        const tag = isHeader ? "th" : "td";
        const cellClass = isHeader
          ? 'class="px-3 py-2 text-left font-mono uppercase text-[8px] tracking-[0.05em] text-[#858483] bg-[#F6F6F6] border-b border-[#E5E5E5]"'
          : 'class="px-3 py-2 text-[#5C5B59] border-b border-[#F6F6F6]"';
        out += "<tr>" + cells.map((c) => `<${tag} ${cellClass}>${c}</${tag}>`).join("") + "</tr>";
      });

      out += "</table></div>";
      return out;
    }
  );

  // Headers with IDs for TOC
  html = html.replace(/^### (.+)$/gm, (_, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<h3 id="report-${id}" class="text-[14px] font-medium text-[#1D1B16] mt-5 mb-1.5">${t}</h3>`;
  });
  html = html.replace(/^## (.+)$/gm, (_, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<h2 id="report-${id}" class="text-[15px] font-medium text-[#1D1B16] mt-6 mb-2 pb-1 border-b border-[#E5E5E5]">${t}</h2>`;
  });
  html = html.replace(/^# (.+)$/gm, (_, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<h1 id="report-${id}" class="text-[16px] font-medium text-[#1D1B16] mt-6 mb-2 pb-1 border-b border-[#E5E5E5]">${t}</h1>`;
  });

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium text-[#1D1B16]">$1</strong>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#FB631B] hover:underline">$1</a>');

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li class="text-[13px] text-[#5C5B59] ml-4 list-disc mb-1">$1</li>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-[13px] text-[#5C5B59] ml-4 list-decimal mb-1">$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="text-[13px] text-[#5C5B59] leading-[20px] mb-2">');
  html = html.replace(/\n/g, "<br/>");
  html = '<p class="text-[13px] text-[#5C5B59] leading-[20px] mb-2">' + html + "</p>";

  return html;
}
