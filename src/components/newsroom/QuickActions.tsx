"use client";

import { useState } from "react";
import { HandThumbUpIcon, HandThumbDownIcon, BookmarkIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { COLORS } from "@/lib/design-tokens";

interface Props {
  rawArticleId: string;
  isSaved: boolean;
  disabled?: boolean;
  onChange?: () => void;
}

type ActionState = "idle" | "pending" | "ok" | "error";

/**
 * Inline thumbs-up / thumbs-down / save buttons. Optimistic UI: clicks
 * apply immediately and roll back on server failure. Disabled when no
 * authenticated user (passed via `disabled`).
 */
export function QuickActions({ rawArticleId, isSaved, disabled, onChange }: Props) {
  const [thumbs, setThumbs] = useState<-1 | 0 | 1>(0);
  const [saved, setSaved] = useState(isSaved);
  const [state, setState] = useState<ActionState>("idle");

  async function postInteraction(type: string) {
    setState("pending");
    try {
      const res = await fetch("/api/newsroom/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_article_id: rawArticleId, type }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("ok");
    } catch {
      setState("error");
    }
  }

  async function postSave(next: boolean) {
    setState("pending");
    try {
      const res = await fetch("/api/newsroom/save", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_article_id: rawArticleId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(next);
      setState("ok");
      onChange?.();
    } catch {
      setState("error");
    }
  }

  const tone = (active: boolean): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    padding: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    color: active ? COLORS.forest : COLORS.inkMuted,
    display: "inline-flex",
    alignItems: "center",
    transition: "color 120ms ease",
  });

  return (
    <span
      style={{ display: "inline-flex", gap: 2, alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
      data-quick-actions
      aria-disabled={disabled || state === "pending"}
    >
      <button
        title="Thumbs up"
        aria-pressed={thumbs === 1}
        disabled={disabled || state === "pending"}
        onClick={() => {
          if (disabled) return;
          setThumbs(1);
          void postInteraction("thumbs_up");
        }}
        style={tone(thumbs === 1)}
      >
        <HandThumbUpIcon style={{ width: 14, height: 14 }} />
      </button>
      <button
        title="Thumbs down"
        aria-pressed={thumbs === -1}
        disabled={disabled || state === "pending"}
        onClick={() => {
          if (disabled) return;
          setThumbs(-1);
          void postInteraction("thumbs_down");
        }}
        style={tone(thumbs === -1)}
      >
        <HandThumbDownIcon style={{ width: 14, height: 14 }} />
      </button>
      <button
        title={saved ? "Remove from saved" : "Save"}
        aria-pressed={saved}
        disabled={disabled || state === "pending"}
        onClick={() => {
          if (disabled) return;
          void postSave(!saved);
        }}
        style={tone(saved)}
      >
        {saved ? (
          <BookmarkSolid style={{ width: 14, height: 14 }} />
        ) : (
          <BookmarkIcon style={{ width: 14, height: 14 }} />
        )}
      </button>
    </span>
  );
}
