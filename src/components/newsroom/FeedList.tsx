"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { FeedRow } from "./FeedRow";
import type { NewsroomFeedRow } from "@/lib/newsroom/types";

interface Props {
  items: NewsroomFeedRow[];
  authedUserId: string | null;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onSavedChange?: () => void;
}

/**
 * Renders the wire-feed list with native scroll. Uses a hidden sentinel +
 * IntersectionObserver to trigger pagination — no react-window needed at
 * the volumes we expect (sub-1000 items per session).
 */
export function FeedList({
  items,
  authedUserId,
  hasMore,
  isLoading,
  onLoadMore,
  onSavedChange,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [observerActive, setObserverActive] = useState(false);

  useEffect(() => {
    setObserverActive(true);
  }, []);

  useEffect(() => {
    if (!observerActive || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: "200px 0px 0px 0px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [observerActive, hasMore, isLoading, onLoadMore]);

  if (items.length === 0 && !isLoading) {
    return (
      <div
        style={{
          padding: "40px 16px",
          textAlign: "center",
          color: COLORS.inkMuted,
          fontFamily: FONTS.sans,
          fontSize: 13,
        }}
      >
        No items match these filters yet. The next sweep runs every 30 minutes.
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <FeedRow
          key={item.id}
          item={item}
          authedUserId={authedUserId}
          onSavedChange={onSavedChange}
        />
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />

      {isLoading && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.inkFaint,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          Loading…
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            fontFamily: FONTS.sans,
            fontSize: 10,
            color: COLORS.inkFaint,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          End of feed
        </div>
      )}
    </div>
  );
}
