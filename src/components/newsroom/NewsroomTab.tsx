"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/design-tokens";
import { FeedHeader } from "./FeedHeader";
import { FeedList } from "./FeedList";
import { PushOptIn } from "./PushOptIn";
import type { NewsroomFeedRow } from "@/lib/newsroom/types";

const PAGE_SIZE = 60;

interface FeedResponse {
  items: NewsroomFeedRow[];
  cursor: string | null;
  threshold: number;
  sectors: string[];
}

export function NewsroomTab() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [items, setItems] = useState<NewsroomFeedRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [threshold, setThreshold] = useState(3);
  const [sectors, setSectors] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initialised, setInitialised] = useState(false);

  const buildUrl = useCallback(
    (cur: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("threshold", String(threshold));
      if (sectors.length > 0) params.set("sectors", sectors.join(","));
      if (cur) params.set("cursor", cur);
      return `/api/newsroom/feed?${params.toString()}`;
    },
    [threshold, sectors]
  );

  const load = useCallback(
    async (mode: "reset" | "append") => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const cur = mode === "append" ? cursor : null;
        const res = await fetch(buildUrl(cur));
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as FeedResponse;

        if (mode === "reset") {
          setItems(data.items);
          // Server reflects whatever pref it computed — sync once on first load
          // so a user with a saved threshold/sectors sees their preferences.
          if (!initialised) {
            setThreshold(data.threshold);
            setSectors(data.sectors);
            setInitialised(true);
          }
        } else {
          setItems((prev) => [...prev, ...data.items]);
        }
        setCursor(data.cursor);
        setHasMore(data.cursor !== null);
        setLastUpdated(new Date());
      } catch (err) {
        console.warn("[Newsroom] feed load failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildUrl, cursor, isLoading, initialised]
  );

  // Initial load + reload when filters change.
  useEffect(() => {
    void load("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, sectors.join(",")]);

  // Periodic refresh while the tab is mounted (every 2 min).
  useEffect(() => {
    const id = setInterval(() => {
      void load("reset");
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts: r = refresh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void load("reset");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        minHeight: "100%",
      }}
    >
      <FeedHeader
        threshold={threshold}
        sectors={sectors}
        lastUpdated={lastUpdated}
        isRefreshing={isLoading && items.length === 0}
        onChangeThreshold={setThreshold}
        onChangeSectors={setSectors}
        onRefresh={() => load("reset")}
      />
      {userId && (
        <div style={{ padding: "10px 16px 0 16px" }}>
          <PushOptIn />
        </div>
      )}
      <FeedList
        items={items}
        authedUserId={userId}
        hasMore={hasMore}
        isLoading={isLoading && items.length > 0}
        onLoadMore={() => load("append")}
        onSavedChange={() => load("reset")}
      />
    </div>
  );
}
