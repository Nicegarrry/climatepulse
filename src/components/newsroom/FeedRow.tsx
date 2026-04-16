"use client";

import { useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { UrgencyGlyph } from "./UrgencyGlyph";
import { SectorTag } from "./SectorTag";
import { QuickActions } from "./QuickActions";
import type { NewsroomFeedRow } from "@/lib/newsroom/types";

interface Props {
  item: NewsroomFeedRow;
  authedUserId: string | null;
  onSavedChange?: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
  });
}

function recordReadOnce(rawArticleId: string) {
  // Fire-and-forget. The API is append-only so dupes are harmless, but we
  // dedupe per-tab via a Set on window to avoid pointless writes.
  const w = window as unknown as { __readSet?: Set<string> };
  if (!w.__readSet) w.__readSet = new Set();
  if (w.__readSet.has(rawArticleId)) return;
  w.__readSet.add(rawArticleId);
  fetch("/api/newsroom/interact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_article_id: rawArticleId, type: "read" }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * One wire row. Three columns: timestamp + source, headline + teaser, sector
 * tag + urgency + quick actions. No card. No shadow. Hairline divider below.
 */
export function FeedRow({ item, authedUserId, onSavedChange }: Props) {
  const isHeavy = item.urgency >= 4;
  const onClick = useCallback(() => {
    if (authedUserId) recordReadOnce(item.raw_article_id);
    window.open(item.article_url, "_blank", "noopener,noreferrer");
  }, [authedUserId, item.article_url, item.raw_article_id]);

  return (
    <article
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "84px 1fr auto",
        gap: 16,
        alignItems: "start",
        padding: "10px 16px",
        minHeight: isHeavy ? 40 : 28,
        cursor: "pointer",
        borderBottom: `1px solid ${COLORS.borderLight}`,
        background: "transparent",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Column 1 — timestamp + source */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 1 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: FONTS.sans,
            fontWeight: 500,
            letterSpacing: 0.5,
            color: COLORS.plum,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTimestamp(item.published_at)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: FONTS.sans,
            fontWeight: 500,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.source_name}
        </span>
      </div>

      {/* Column 2 — headline + teaser */}
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: FONTS.serif,
            fontSize: 15,
            lineHeight: 1.35,
            fontWeight: isHeavy ? 500 : 400,
            color: COLORS.ink,
          }}
        >
          {item.title}
        </h3>
        <p
          style={{
            margin: "2px 0 0 0",
            fontFamily: FONTS.sans,
            fontSize: 12.5,
            lineHeight: 1.45,
            color: COLORS.inkSec,
          }}
        >
          {item.teaser}
        </p>
      </div>

      {/* Column 3 — sector + urgency + quick actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 1,
        }}
      >
        <SectorTag domain={item.primary_domain} />
        <UrgencyGlyph urgency={item.urgency as 1 | 2 | 3 | 4 | 5} />
        <QuickActions
          rawArticleId={item.raw_article_id}
          isSaved={Boolean(item.is_saved)}
          disabled={!authedUserId}
          onChange={onSavedChange}
        />
      </div>
    </article>
  );
}
