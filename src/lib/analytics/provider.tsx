"use client";

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  QueuedEvent,
} from "./events";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface AnalyticsContextValue {
  track: <E extends AnalyticsEventName>(
    eventName: E,
    properties: AnalyticsEventProperties[E]
  ) => void;
  flush: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  track: () => {},
  flush: () => {},
});

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 10;

interface AnalyticsProviderProps {
  userId: string | null;
  children: ReactNode;
}

export function AnalyticsProvider({ userId, children }: AnalyticsProviderProps) {
  const queueRef = useRef<QueuedEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>("");

  // Initialise session ID (persists across renders, resets on full page load)
  useEffect(() => {
    if (typeof window !== "undefined") {
      let sid = sessionStorage.getItem("cp_session_id");
      if (!sid) {
        sid = generateId();
        sessionStorage.setItem("cp_session_id", sid);
      }
      sessionIdRef.current = sid;
    }
  }, []);

  const doFlush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (queueRef.current.length === 0 || !userId) return;

    const batch = queueRef.current.splice(0);

    // Fire-and-forget — analytics should never block UI
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, events: batch }),
      keepalive: true, // survive page unload
    }).catch(() => {
      // Silently drop on failure — analytics is best-effort
    });
  }, [userId]);

  // Flush on page hide / beforeunload
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        doFlush();
      }
    }
    function onBeforeUnload() {
      doFlush();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      doFlush();
    };
  }, [doFlush]);

  const track = useCallback(
    <E extends AnalyticsEventName>(
      eventName: E,
      properties: AnalyticsEventProperties[E]
    ) => {
      queueRef.current.push({
        event_name: eventName,
        properties: properties as Record<string, unknown>,
        session_id: sessionIdRef.current,
        timestamp: new Date().toISOString(),
      });

      if (queueRef.current.length >= FLUSH_THRESHOLD) {
        doFlush();
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(doFlush, FLUSH_INTERVAL_MS);
      }
    },
    [doFlush]
  );

  return (
    <AnalyticsContext value={{ track, flush: doFlush }}>
      {children}
    </AnalyticsContext>
  );
}
