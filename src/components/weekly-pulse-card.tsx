"use client";

import { useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { WeeklyPulse } from "@/lib/types";

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${fmt(start)}\u2013${fmt(end)} ${start.getFullYear()}`;
}

export function WeeklyPulseCard({ pulse }: { pulse: WeeklyPulse }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const weekRange = formatWeekRange(pulse.week_start);
  const hasPercentile =
    pulse.stories_read_percentile != null && (pulse.cohort_size ?? 0) >= 20;

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.plum}`,
        borderRadius: 8,
        padding: "16px 18px",
        position: "relative",
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          background: "none",
          border: "none",
          color: COLORS.inkFaint,
          fontSize: 14,
          cursor: "pointer",
          padding: "2px 6px",
          lineHeight: 1,
        }}
      >
        {"\u00D7"}
      </button>

      {/* Header */}
      <div
        style={{
          fontSize: 10,
          fontFamily: FONTS.sans,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color: COLORS.plum,
          marginBottom: 12,
        }}
      >
        Your Week {"\u2014"} {weekRange}
      </div>

      {/* Hero number: stories read */}
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: FONTS.serif,
            fontSize: 36,
            fontWeight: 300,
            color: COLORS.plum,
            letterSpacing: -1,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pulse.stories_read}
        </span>
        <span
          style={{
            fontSize: 13,
            color: COLORS.inkSec,
            marginLeft: 8,
          }}
        >
          stories read
        </span>
      </div>

      {/* Percentile or plain text */}
      {hasPercentile ? (
        <div
          style={{
            fontSize: 13,
            color: COLORS.inkSec,
            marginBottom: 14,
          }}
        >
          More than{" "}
          <span style={{ fontWeight: 600, color: COLORS.forest }}>
            {pulse.stories_read_percentile}%
          </span>{" "}
          of professionals in your sectors
        </div>
      ) : (
        pulse.cohort_size != null &&
        pulse.cohort_size < 20 && (
          <div
            style={{
              fontSize: 11,
              color: COLORS.inkFaint,
              marginBottom: 14,
              fontStyle: "italic",
            }}
          >
            Comparison available when more professionals join
          </div>
        )
      )}

      {/* Stats rows */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.borderLight}`,
          paddingTop: 10,
        }}
      >
        <StatRow
          label="Briefings completed"
          value={`${pulse.briefings_completed}/7 days`}
        />
        <StatRow
          label="Streak"
          value={
            pulse.current_streak >= 3 ? `${pulse.current_streak} days` : "\u2014"
          }
          highlight={pulse.current_streak >= 10}
        />
        <StatRow
          label="Sectors covered"
          value={`${pulse.sectors_covered}/${pulse.sectors_subscribed}`}
        />
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: `1px solid ${COLORS.borderLight}`,
      }}
    >
      <span style={{ fontSize: 12, color: COLORS.inkMuted }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: highlight ? COLORS.forest : COLORS.ink,
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
