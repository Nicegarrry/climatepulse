"use client";

import { useState, useCallback } from "react";
import { COLORS } from "@/lib/design-tokens";

type Vote = "up" | "down" | null;

export function ThumbsActions({
  articleUrl,
  storyId,
  dailyBriefingId,
  compact = false,
}: {
  articleUrl?: string;
  storyId?: string | number;
  dailyBriefingId?: string | null;
  compact?: boolean;
}) {
  const [vote, setVote] = useState<Vote>(null);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (type: "thumbs_up" | "thumbs_down") => {
      if (!articleUrl || pending) return;
      const next: Vote = type === "thumbs_up" ? "up" : "down";
      const previous = vote;
      setVote(next === vote ? null : next);
      setPending(true);
      try {
        const res = await fetch("/api/briefing/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article_url: articleUrl,
            daily_briefing_id: dailyBriefingId ?? null,
            story_id: storyId != null ? String(storyId) : null,
            type,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setVote(previous);
      } finally {
        setPending(false);
      }
    },
    [articleUrl, dailyBriefingId, storyId, vote, pending]
  );

  if (!articleUrl) return null;

  const size = compact ? 13 : 14;
  const pad = compact ? "3px 6px" : "4px 8px";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
    >
      <button
        type="button"
        onClick={() => send("thumbs_up")}
        disabled={pending}
        aria-label="Thumbs up"
        style={{
          all: "unset",
          cursor: pending ? "default" : "pointer",
          padding: pad,
          borderRadius: 4,
          fontSize: size,
          color: vote === "up" ? COLORS.forest : COLORS.inkFaint,
          background: vote === "up" ? "rgba(34,97,62,0.08)" : "transparent",
          transition: "color 120ms ease, background 120ms ease",
        }}
      >
        {"\u{1F44D}"}
      </button>
      <button
        type="button"
        onClick={() => send("thumbs_down")}
        disabled={pending}
        aria-label="Thumbs down"
        style={{
          all: "unset",
          cursor: pending ? "default" : "pointer",
          padding: pad,
          borderRadius: 4,
          fontSize: size,
          color: vote === "down" ? COLORS.plum : COLORS.inkFaint,
          background: vote === "down" ? "rgba(112,58,101,0.08)" : "transparent",
          transition: "color 120ms ease, background 120ms ease",
        }}
      >
        {"\u{1F44E}"}
      </button>
    </div>
  );
}
