"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";

interface ActivityEntry {
  id: string;
  actor_user_id: string;
  actor_name: string | null;
  target_type: "daily_briefing" | "weekly_digest" | "source" | "assignment";
  target_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  pick_toggled: "toggled Editor's Pick",
  note_edited: "edited editor note",
  suppressed: "suppressed story",
  unsuppressed: "restored story",
  analysis_edited: "edited AI summary",
  intro_edited: "edited digest intro",
  reordered: "reordered stories",
  sector_retagged: "retagged sectors",
  story_injected: "injected story",
  regenerated: "regenerated briefing",
  published: "published digest",
  scheduled: "scheduled send",
  unscheduled: "cancelled schedule",
  assignment_created: "granted editor access",
  assignment_revoked: "revoked editor access",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  });
}

function describe(entry: ActivityEntry): string {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const rank = entry.payload?.rank;
  if (rank !== undefined) return `${label} (story #${rank})`;
  return label;
}

export function ActivityLogPanel({ targetId }: { targetId?: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const sydneyNow = new Date();
      const startOfDay = new Date(sydneyNow);
      startOfDay.setHours(0, 0, 0, 0);

      const params = new URLSearchParams();
      params.set("since", startOfDay.toISOString());
      params.set("limit", "100");
      if (targetId) {
        params.set("target_type", "daily_briefing");
        params.set("target_id", targetId);
      }

      try {
        const res = await fetch(`/api/editorial/activity?${params.toString()}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = await res.json();
        if (mounted) setEntries(body.entries ?? []);
      } catch (err) {
        console.warn("activity log load:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [targetId]);

  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        background: COLORS.surface,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Micro>Today&apos;s Activity</Micro>
        <span style={{ fontSize: 10, color: COLORS.inkFaint, fontVariantNumeric: "tabular-nums" }}>
          {loading ? "\u2026" : `${entries.length}`}
        </span>
      </div>

      {entries.length === 0 && !loading && (
        <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 10, marginBottom: 0 }}>
          No editorial actions logged today.
        </p>
      )}

      {entries.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "10px 0 0",
            maxHeight: 240,
            overflowY: "auto",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                display: "flex",
                gap: 8,
                padding: "4px 0",
                borderBottom: `1px solid ${COLORS.paperDark}`,
              }}
            >
              <span
                style={{
                  color: COLORS.inkFaint,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 42,
                }}
              >
                {formatTime(e.created_at)}
              </span>
              <span style={{ flex: 1, color: COLORS.inkSec }}>
                <strong style={{ color: COLORS.ink, fontWeight: 600 }}>
                  {e.actor_name ?? "Editor"}
                </strong>{" "}
                {describe(e)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
