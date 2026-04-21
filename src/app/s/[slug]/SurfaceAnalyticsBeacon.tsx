"use client";

/**
 * Fire-and-forget `view` beacon for the surface route.
 *
 * Runs once on mount. Uses `keepalive` so the request survives a quick
 * navigation away. Failures are silently swallowed — analytics must never
 * surface as a UI error. The /api/s/[slug]/analytics route is owned by
 * Team R; we tolerate 404s until it ships.
 */
import { useEffect, useRef } from "react";

export function SurfaceAnalyticsBeacon({ slug }: { slug: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    try {
      fetch(`/api/s/${encodeURIComponent(slug)}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: "view" }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // no-op
    }
  }, [slug]);

  return null;
}
