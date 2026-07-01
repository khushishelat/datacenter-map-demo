"use client";

import { useState } from "react";
import { X, Check, Mail } from "lucide-react";

interface NewsletterSubscribeProps {
  onClose: () => void;
  onSubscribed: (email: string) => void;
  onPreview: () => void;
}

export function NewsletterSubscribe({ onClose, onSubscribed, onPreview }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.status === "subscribed" || data.status === "already_subscribed") {
        onSubscribed(email);
      } else {
        setError(data.error || "Failed to subscribe");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(29, 27, 22, 0.6)" }}>
      <div className="bg-white rounded-[8px] border border-[#E5E5E5] shadow-xl w-[680px] max-w-[90vw] overflow-hidden flex">
        {/* Left column: form */}
        <div className="flex-1 p-[24px_26px] flex flex-col gap-[17px]">
          <button onClick={onClose} className="absolute top-4 right-4 text-[#A6A5A4] hover:text-[#181818] transition-colors">
            <X className="w-4 h-4" />
          </button>

          <div>
            <div className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#A6A5A4] mb-[9px]">Weekly brief</div>
            <h2 className="text-[22px] leading-[27px] font-medium text-[#181818] mb-[9px]">
              Critical events, deep-researched — in your inbox.
            </h2>
            <p className="text-[14px] leading-[21px] text-[#858483]">
              Every Monday, Parallel deep-researches the week&apos;s critical datacenter developments and combines them into one brief. The signal, not the firehose.
            </p>
          </div>

          <div className="flex flex-col gap-[9px]">
            {[
              "Deep research on each critical event, fully sourced & cited",
              "Regional roundup across all monitors",
              "A by-the-numbers recap of the week",
            ].map((item) => (
              <div key={item} className="flex items-start gap-[9px]">
                <Check className="w-[13px] h-[13px] text-[#FB631B] mt-[3px] shrink-0" strokeWidth={2.5} />
                <span className="text-[14px] leading-[20px] text-[#181818]">{item}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubscribe} className="flex gap-[8px] items-stretch">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 border border-[#DBDBD9] rounded-[6px] px-[13px] py-[11px] font-mono text-[13px] text-[#181818] placeholder:text-[#A6A5A4] focus:outline-none focus:border-[#FB631B]"
              style={{ boxShadow: "0 1px 1px rgba(0,0,0,.03), 0 2px 1px rgba(0,0,0,.02)" }}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1D1B16] text-white rounded-[6px] px-[16px] font-mono text-[12px] flex items-center gap-[7px] hover:bg-[#434343] transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Subscribe"} <span className="border border-white/30 rounded-[2px] px-[4px] text-[11px]">↵</span>
            </button>
          </form>

          {error && <p className="text-[13px] text-[#E14942]">{error}</p>}

          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#A6A5A4]">Weekly · unsubscribe anytime</span>
            <button onClick={onPreview} className="font-mono text-[10px] text-[#FB631B] hover:underline">
              Preview this week&apos;s issue →
            </button>
          </div>
        </div>

        {/* Right column: mini preview */}
        <div className="w-[248px] shrink-0 bg-[#FCFBFA] border-l border-[#E5E5E5] p-[18px]">
          <div className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#A6A5A4] mb-[11px]">This week&apos;s issue</div>
          <div className="border border-[#E5E5E5] rounded-[6px] bg-white overflow-hidden" style={{ boxShadow: "0 1px 1px rgba(0,0,0,.03), 0 2px 1px rgba(0,0,0,.02)" }}>
            <div className="p-[12px_13px] border-b border-[#E5E5E5]">
              <div className="font-mono font-bold text-[11px] text-[#181818] mb-[6px]">parallel</div>
              <div className="font-mono uppercase text-[7px] tracking-[0.06em] text-[#A6A5A4]">Datacenter Signal</div>
            </div>
            <div className="p-[12px_13px]">
              <div className="font-mono uppercase text-[7px] tracking-[0.06em] text-[#A6A5A4] mb-[6px]">The week in one read</div>
              <p className="text-[11px] leading-[16px] text-[#858483] mb-[10px]">
                This week&apos;s critical datacenter developments, deep-researched with full citations and investor analysis...
              </p>
              <div className="flex items-center gap-[6px] mb-[6px]">
                <span className="font-mono uppercase text-[7px] font-medium px-[5px] py-[2px] rounded-[2px] text-white bg-[#FB631B]">Power &amp; Grid</span>
                <span className="font-mono uppercase text-[7px] text-[#A6A5A4]">N. Virginia</span>
              </div>
              <div className="text-[11px] leading-[15px] font-medium text-[#181818]">
                Critical infrastructure signals from this week&apos;s monitors...
              </div>
            </div>
            <div className="h-[30px]" style={{ background: "linear-gradient(rgba(255,255,255,0), #fff)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
