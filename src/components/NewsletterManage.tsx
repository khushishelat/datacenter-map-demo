"use client";

import { useEffect, useRef } from "react";

interface NewsletterManageProps {
  email: string;
  onPreview: () => void;
  onUnsubscribe: () => void;
  onClose: () => void;
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function NewsletterManage({ email, onPreview, onUnsubscribe, onClose }: NewsletterManageProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-[100] w-[320px] bg-white border border-[#DBDBD9] rounded-[8px] overflow-hidden"
      style={{ boxShadow: "0 1px 1px rgba(0,0,0,.03), 0 2px 1px rgba(0,0,0,.02), 0 3px 1px rgba(0,0,0,.01)" }}>
      {/* Header */}
      <div className="px-[15px] py-[13px] border-b border-[#E5E5E5]">
        <div className="flex items-center gap-[7px] mb-[4px]">
          <span className="w-[6px] h-[6px] rounded-full bg-[#1F8A5B]" />
          <span className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#858483]">Subscribed · {email}</span>
        </div>
        <div className="text-[14px] font-medium text-[#181818]">
          Next issue {getNextMonday()} · 7:00 AM ET
        </div>
      </div>

      {/* Frequency */}
      <div className="px-[15px] py-[13px] border-b border-[#E5E5E5]">
        <div className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#A6A5A4] mb-[9px]">Frequency</div>
        <div className="flex gap-[5px]">
          <span className="font-mono text-[9px] uppercase tracking-[0.05em] px-[9px] py-[4px] rounded-[2px] bg-[#181818] text-white">Weekly</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.05em] px-[9px] py-[4px] rounded-[2px] text-[#858483] hover:bg-[#F6F6F6] cursor-pointer transition-colors">Daily digest</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.05em] px-[9px] py-[4px] rounded-[2px] text-[#858483] hover:bg-[#F6F6F6] cursor-pointer transition-colors">Critical only</span>
        </div>
      </div>

      {/* Sourced from */}
      <div className="px-[15px] py-[13px] border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-[10px]">
          <span className="font-mono uppercase text-[10.4px] tracking-[0.06em] text-[#A6A5A4]">Sourced from</span>
          <span className="font-mono text-[9px] text-[#A6A5A4]">31 monitors</span>
        </div>
        <div className="flex gap-[6px] flex-wrap">
          <span className="font-mono text-[10px] text-[#FB631B] border border-[#FB631B] rounded-[2px] px-[8px] py-[4px]">All critical events</span>
          <span className="font-mono text-[10px] text-[#858483] border border-[#E5E5E5] rounded-[2px] px-[8px] py-[4px]">All regions</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-[15px] py-[12px] flex items-center justify-between">
        <button onClick={onPreview} className="font-mono text-[10px] text-[#FB631B] hover:underline">
          Preview next issue →
        </button>
        <button onClick={onUnsubscribe} className="font-mono text-[10px] text-[#A6A5A4] hover:text-[#E14942] transition-colors">
          Unsubscribe
        </button>
      </div>
    </div>
  );
}
