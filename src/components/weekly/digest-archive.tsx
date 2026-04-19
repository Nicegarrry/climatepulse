"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import type { WeeklyDigest } from "@/lib/types";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const startStr = start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${startStr} \u2013 ${endStr}`;
}

function summarise(narrative: string, maxLen = 140): string {
  const trimmed = narrative.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut) + "\u2026";
}

export function DigestArchive({
  digests,
  currentId,
  onSelect,
}: {
  digests: WeeklyDigest[];
  currentId: string | null;
  onSelect: (digest: WeeklyDigest) => void;
}) {
  if (digests.length === 0) return null;

  return (
    <div>
      <Micro color={COLORS.inkMuted} mb={10}>
        Past Editions
      </Micro>
      <WobblyRule color={COLORS.borderLight} />
      <div style={{ marginTop: 10 }}>
        {digests.map((digest) => {
          const isActive = digest.id === currentId;
          return (
            <div
              key={digest.id}
              onClick={() => onSelect(digest)}
              style={{
                padding: "12px 14px",
                background: isActive ? COLORS.paperDark : COLORS.surface,
                border: `1px solid ${isActive ? COLORS.border : COLORS.borderLight}`,
                borderRadius: 6,
                marginBottom: 6,
                cursor: "pointer",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  marginBottom: 4,
                }}
              >
                {formatWeekRange(digest.week_start, digest.week_end)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: FONTS.serif,
                  fontWeight: 500,
                  color: COLORS.ink,
                  lineHeight: 1.35,
                }}
              >
                {digest.headline}
              </div>
              {digest.editor_narrative && (
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.inkSec,
                    marginTop: 6,
                    lineHeight: 1.45,
                  }}
                >
                  {summarise(digest.editor_narrative)}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "baseline",
                  fontSize: 10,
                  color: COLORS.inkFaint,
                  marginTop: 6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {digest.author_name && (
                  <span style={{ color: COLORS.inkMuted, fontStyle: "italic" }}>
                    by {digest.author_name}
                  </span>
                )}
                <span>{digest.curated_stories.length} stories</span>
                {digest.published_at && (
                  <span>
                    {new Date(digest.published_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
