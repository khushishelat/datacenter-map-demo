"use client";

interface HeaderProps {
  monitorCount: number;
  detectedCount: number;
  lastChecked: string;
  countdown: number;
}

export function Header({
  monitorCount,
  detectedCount,
  lastChecked,
  countdown,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-12 py-3 border-b border-[#E5E5E5] bg-white shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[16px] font-medium tracking-tight text-[#1D1B16] font-mono">
          parallel
        </span>
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-medium tracking-[0.08em] uppercase text-[#1D1B16]">
            Datacenter Monitor
          </h1>
          <span className="text-[13px] text-[#858483] border border-[#E5E5E5] rounded-[2px] px-2 py-0.5 font-mono">
            Powered by Parallel &middot; Monitor API
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[13px] font-mono text-[#858483]">
        <span className="inline-block w-2 h-2 rounded-full bg-[#69BE78]" />
        <span className="text-[#1D1B16]">{monitorCount} monitors</span>
        <span>&middot;</span>
        <span>
          {detectedCount > 0 ? (
            <span className="text-[#FB631B]">
              {detectedCount} event{detectedCount !== 1 ? "s" : ""} detected
            </span>
          ) : (
            "no events yet"
          )}
        </span>
        <span>&middot;</span>
        <span>last checked {lastChecked}</span>
        <span>&middot;</span>
        <span>next check {countdown}s</span>
      </div>
    </header>
  );
}
