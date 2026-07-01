"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface NewsletterIssueProps {
  onClose: () => void;
  isSubscribed: boolean;
  onSubscribe?: () => void;
}

export function NewsletterIssue({ onClose, isSubscribed, onSubscribe }: NewsletterIssueProps) {
  const [status, setStatus] = useState<"loading" | "not_found" | "generating" | "ready">("loading");
  const [content, setContent] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [issueNumber, setIssueNumber] = useState(0);

  useEffect(() => {
    fetchIssue();
  }, []);

  async function fetchIssue() {
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/preview");
      const data = await res.json();
      if (data.status === "found" && data.content) {
        setContent(data.content);
        setEmailHtml(data.emailHtml || "");
        setIssueNumber(data.issueNumber);
        setStatus("ready");
      } else {
        setIssueNumber(data.issueNumber || 0);
        setStatus("not_found");
      }
    } catch {
      setStatus("not_found");
    }
  }

  async function handleGenerate() {
    setStatus("generating");

    // Kick off generation (fire and forget — it takes 3-5 min)
    fetch("/api/newsletter/generate", { method: "POST" }).catch(() => {});

    // Poll for completion every 10s
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/newsletter/preview");
        const data = await res.json();
        if (data.status === "found" && data.content) {
          clearInterval(pollInterval);
          setContent(data.content);
          setEmailHtml(data.emailHtml || "");
          setIssueNumber(data.issueNumber);
          setStatus("ready");
        }
      } catch {}
    }, 10000);

    // Timeout after 6 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (status === "generating") setStatus("not_found");
    }, 360000);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(29, 27, 22, 0.6)" }}>
      <div className="bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl w-[680px] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-[14px] py-[9px] border-b border-[#E5E5E5] bg-[#F6F6F6] shrink-0">
          <span className="font-mono uppercase text-[8px] tracking-[0.06em] text-[#A6A5A4]">Preview · weekly brief</span>
          <div className="flex items-center gap-3">
            {issueNumber > 0 && <span className="font-mono text-[9px] text-[#A6A5A4]">Issue {issueNumber}</span>}
            <button onClick={onClose} className="text-[#A6A5A4] hover:text-[#181818] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#FCFBFA]">
          {status === "loading" && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-4 h-4 text-[#FB631B] animate-spin" />
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.05em] text-[#A6A5A4]">Loading issue...</span>
            </div>
          )}

          {status === "not_found" && (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#A6A5A4] mb-3">No issue generated yet</div>
              <p className="text-[14px] text-[#858483] mb-6 max-w-[400px]">
                Generate this week&apos;s brief from your monitor events. Uses Parallel&apos;s ultra deep research processor.
              </p>
              <button
                onClick={handleGenerate}
                className="font-mono uppercase text-[13px] px-6 py-2.5 bg-[#FB631B] text-white rounded-[6px] hover:bg-[#F4793F] transition-colors"
              >
                Generate this week&apos;s brief
              </button>
              <span className="font-mono text-[9px] text-[#A6A5A4] mt-3">Takes 3-5 minutes</span>
            </div>
          )}

          {status === "generating" && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-[#FB631B] animate-spin mb-3" />
              <span className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#FB631B] mb-1">Generating brief...</span>
              <span className="font-mono text-[9px] text-[#A6A5A4]">Deep-researching critical events across all monitors</span>
            </div>
          )}

          {status === "ready" && emailHtml && (
            <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
          )}

          {status === "ready" && !emailHtml && content && (
            <div className="px-[30px] py-[24px]">
              <div className="prose prose-sm max-w-none text-[14px] text-[#5C5B59] leading-[22px] whitespace-pre-wrap">
                {content}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isSubscribed && status === "ready" && (
          <div className="px-[14px] py-[10px] border-t border-[#E5E5E5] bg-white shrink-0 flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#A6A5A4]">Get this in your inbox every Monday</span>
            <button onClick={onSubscribe} className="font-mono uppercase text-[11px] px-4 py-1.5 bg-[#1D1B16] text-white rounded-[6px] hover:bg-[#434343] transition-colors">
              Subscribe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
