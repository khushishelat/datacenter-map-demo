"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Monitor } from "@/lib/types";

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch("/api/monitors", { cache: "no-store" });
      if (!res.ok) return;
      const data: Monitor[] = await res.json();
      setMonitors(data);
      setLastChecked(new Date());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchMonitors();

    // Connect to SSE for real-time webhook events
    const es = new EventSource("/api/webhook");
    eventSourceRef.current = es;

    es.onmessage = () => {
      // A new event came in via webhook — refetch monitors to get fresh data
      fetchMonitors();
    };

    es.onerror = () => {
      // SSE reconnects automatically, but also poll as fallback
    };

    // Fallback poll every 60s in case SSE disconnects
    const fallback = setInterval(fetchMonitors, 60_000);

    return () => {
      es.close();
      clearInterval(fallback);
    };
  }, [fetchMonitors]);

  const totalEvents = monitors.reduce((s, m) => s + m.events.length, 0);
  const totalFacilities = monitors.reduce((s, m) => s + m.facilityCount, 0);

  return { monitors, lastChecked, totalEvents, totalFacilities, loading, refetch: fetchMonitors };
}
