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
              <div
                style={{
                  fontSize: 10,
                  color: COLORS.inkFaint,
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {digest.curated_stories.length} stories
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
