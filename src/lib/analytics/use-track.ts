"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAnalytics } from "./provider";
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
} from "./events";

/**
 * Hook for tracking analytics events. Delegates to the AnalyticsProvider
 * context which handles batching and flushing.
 *
 * Usage:
 *   const track = useTrack();
 *   track("briefing.started", { edition_date: "2026-04-14", stories_count: 5, entry_point: "card" });
 */
export function useTrack() {
  const { track } = useAnalytics();
  return track;
}

/**
 * Hook that fires a tracking event once on mount.
 */
export function useTrackOnMount<E extends AnalyticsEventName>(
  eventName: E,
  properties: AnalyticsEventProperties[E]
) {
  const { track } = useAnalytics();
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      track(eventName, properties);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
