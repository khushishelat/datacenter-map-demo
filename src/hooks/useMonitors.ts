"use client";

import { useState, useEffect, useCallback } from "react";
import type { Monitor } from "@/lib/types";

const POLL_INTERVAL = 30_000;

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch("/api/monitors");
      if (!res.ok) return;
      const data: Monitor[] = await res.json();
      setMonitors(data);
      setLastChecked(new Date());
    } catch {
      // keep existing data
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMonitors]);

  const totalEvents = monitors.reduce((s, m) => s + m.events.length, 0);
  const totalFacilities = monitors.reduce((s, m) => s + m.facilityCount, 0);

  return { monitors, lastChecked, totalEvents, totalFacilities, refetch: fetchMonitors };
}
