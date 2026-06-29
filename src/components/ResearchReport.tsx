"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, FileText, Code } from "lucide-react";
import type { MonitorDetection, Monitor } from "@/lib/types";
import { CopyCodeBlock } from "./CopyCodeBlock";

interface ResearchReportProps {
  event: MonitorDetection;
  monitor: Monitor;
  onClose: () => void;
}

export function ResearchReport({ event, monitor, onClose }: ResearchReportProps) {
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [runId, setRunId] = useState("");
  const [showCode, setShowCode] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as content streams in
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, progress]);

  async function generateReport() {
    setStatus("running");
    setContent("");
    setProgress([]);

    // Kick off the task
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
      return;
    }

    if (data.runId) {
      setRunId(data.runId);
      // Connect to SSE stream
      const es = new EventSource(`/api/research?eventId=${encodeURIComponent(event.eventId)}&stream=true`);

      es.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data);

          if (evt.type === "report.complete") {
            setContent(evt.content);
            setStatus("completed");
            es.close();
            return;
          }

          // Progress messages
          if (evt.type === "task_run.progress_msg.search") {
            setProgress((p) => [...p.slice(-8), "Searching..."]);
          } else if (evt.type === "task_run.progress_msg.plan") {
            setProgress((p) => [...p.slice(-8), "Planning research..."]);
          } else if (evt.type === "task_run.progress_msg.result") {
            setProgress((p) => [...p.slice(-8), "Analyzing results..."]);
          } else if (evt.type === "task_run.state") {
            if (evt.run?.status === "completed" || evt.data?.status === "completed") {
              // Poll for final result
              pollForResult(event.eventId, es);
            }
          }
        } catch {
          // Raw SSE from Parallel — parse event lines
          const text = msg.data;
          if (text.includes("search")) setProgress((p) => [...p.slice(-8), "Searching..."]);
          if (text.includes("plan")) setProgress((p) => [...p.slice(-8), "Planning..."]);
        }
      };

      es.onerror = () => {
        es.close();
        // Poll for result after stream ends
        pollForResult(event.eventId, null);
      };
    }
  }

  async function pollForResult(eventId: string, es: EventSource | null) {
    // Poll every 3s until complete
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/research?eventId=${encodeURIComponent(eventId)}`);
        const data = await res.json();
        if (data.content) {
          setContent(data.content);
          setStatus("completed");
          setRunId(data.runId || "");
          clearInterval(poll);
          es?.close();
        } else if (data.status === "failed") {
          setStatus("error");
          clearInterval(poll);
          es?.close();
        }
      } catch {
        // keep polling
      }
    }, 3000);

    // Timeout after 5 min
    setTimeout(() => clearInterval(poll), 300000);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(29, 27, 22, 0.6)" }}>
      <div className="bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl w-[720px] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E5E5] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-[#FB631B]" />
              <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B]">
                Deep Research Report
              </span>
            </div>
            <h3 className="text-[16px] font-medium text-[#1D1B16] leading-[20px]">
              {event.headline}
            </h3>
            <p className="text-[13px] text-[#858483] mt-0.5">
              {monitor.name} &middot; {event.eventDate}
            </p>
          </div>
          <button onClick={onClose} className="text-[#ADADAC] hover:text-[#1D1B16] transition-colors p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          {status === "idle" && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-[#858483] mb-4">
                Generate a comprehensive research report on this event using Parallel&apos;s Task API with the ultra-fast deep research processor.
              </p>
              <button
                onClick={generateReport}
                className="font-mono uppercase text-[13px] px-6 py-2.5 bg-[#FB631B] text-white rounded-[4px] hover:bg-[#F4793F] transition-colors"
              >
                Generate Report
              </button>
            </div>
          )}

          {status === "running" && (
            <div className="px-6 py-8">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 text-[#FB631B] animate-spin" />
                <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B]">
                  Researching...
                </span>
              </div>
              {progress.length > 0 && (
                <div className="space-y-1 mb-4">
                  {progress.map((msg, i) => (
                    <div key={i} className="font-mono text-[8px] text-[#ADADAC]">
                      {msg}
                    </div>
                  ))}
                </div>
              )}
              <div className="h-1 bg-[#F6F6F6] rounded-full overflow-hidden">
                <div className="h-full bg-[#FB631B] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {status === "completed" && content && (
            <div className="px-6 py-4">
              <div className="prose prose-sm max-w-none text-[#1D1B16] leading-[22px]"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
              />
            </div>
          )}

          {status === "error" && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-[#E14942] mb-4">Failed to generate report.</p>
              <button onClick={generateReport} className="font-mono uppercase text-[13px] px-4 py-2 border border-[#E5E5E5] rounded-[4px] hover:border-[#D6D6D6] transition-colors">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E5E5E5] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase text-[8px] tracking-[0.05em] text-[#FB631B] bg-[#FCDDCF] px-1.5 py-0.5 rounded-[2px]">
              Task API
            </span>
            <span className="font-mono text-[8px] text-[#ADADAC]">
              ultra-fast &middot; text mode
              {runId && ` · ${runId}`}
            </span>
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-1 font-mono uppercase text-[8px] tracking-[0.05em] text-[#ADADAC] hover:text-[#1D1B16] transition-colors ml-auto"
            >
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
                  task_spec: {
                    output_schema: {
                      type: "text",
                      description: "Markdown-formatted research report",
                    },
                  },
                  processor: "ultra-fast",
                }, null, 2)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple markdown to HTML converter */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-medium text-[#1D1B16] mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-medium text-[#1D1B16] mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[16px] font-medium text-[#1D1B16] mt-6 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium text-[#1D1B16]">$1</strong>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#FB631B] hover:underline">$1</a>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="text-[13px] text-[#5C5B59] ml-4 list-disc">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-[13px] text-[#5C5B59] leading-[20px] mb-2">')
    // Single newlines within paragraphs
    .replace(/\n/g, "<br/>")
    // Wrap in paragraph
    .replace(/^/, '<p class="text-[13px] text-[#5C5B59] leading-[20px] mb-2">')
    .replace(/$/, "</p>");
}
