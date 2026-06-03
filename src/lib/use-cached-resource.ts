"use client";

import { useCallback, useEffect, useState } from "react";

// Lightweight stale-while-revalidate cache shared across the app.
//
// Why: dashboard tabs unmount when you switch away and refetch from scratch on
// return, which makes flicking between them feel slow. This keeps the last
// successful result in a module-level store for a short TTL so a re-mount
// renders instantly from cache, then revalidates in the background if stale.
//
// Deliberately tiny (no deps). For richer needs, graduate to SWR/react-query.

type Entry<T> = { data: T; ts: number };

const cache = new Map<string, Entry<unknown>>();

/** Imperative read — returns cached data if still within `ttlMs`, else null. */
export function readCachedResource<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key) as Entry<T> | undefined;
  if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
  return null;
}

export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 120_000,
) {
  // Seed from cache in the initializers so the first render already shows
  // cached data (no spinner flash) and stays SSR/CSR consistent.
  const [data, setData] = useState<T | null>(() => {
    const entry = cache.get(key) as Entry<T> | undefined;
    return entry ? entry.data : null;
  });
  const [loading, setLoading] = useState<boolean>(() => !cache.has(key));
  const [error, setError] = useState<string | null>(null);

  const revalidate = useCallback(async () => {
    try {
      const result = await fetcher();
      cache.set(key, { data: result, ts: Date.now() });
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
    // `fetcher` is recreated each render by callers; `key` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const entry = cache.get(key) as Entry<T> | undefined;
    if (entry) {
      // Serve cached immediately; only hit the network if it's gone stale.
      setData(entry.data);
      setLoading(false);
      if (Date.now() - entry.ts >= ttlMs) void revalidate();
    } else {
      setData(null);
      setLoading(true);
      void revalidate();
    }
  }, [key, ttlMs, revalidate]);

  return { data, loading, error, revalidate };
}
