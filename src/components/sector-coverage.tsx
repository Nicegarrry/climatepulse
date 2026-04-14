"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import type { SectorCoverageData, SectorCoverageItem } from "@/lib/types";

function CoverageBar({ item }: { item: SectorCoverageItem }) {
  const pct =
    item.stories_published > 0
      ? (item.stories_read / item.stories_published) * 100
      : 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: FONTS.sans,
            fontWeight: item.stories_read === 0 ? 600 : 500,
            letterSpacing: 1,
            textTransform: "uppercase" as const,
            color: item.stories_read === 0 ? COLORS.inkSec : COLORS.inkMuted,
          }}
        >
          {item.sector_name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: COLORS.inkMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {item.stories_read}/{item.stories_published} stories
        </span>
      </div>
      {/* Bar */}
      <div
        style={{
          height: 5,
          borderRadius: 2,
          background: COLORS.borderLight,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            background: COLORS.forest,
            width: `${pct}%`,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

export function SectorCoverage({
  data,
  compact = false,
}: {
  data: SectorCoverageData;
  compact?: boolean;
}) {
  if (data.sectors.length === 0) return null;

  // In compact mode, show just bars without labels
  if (compact) {
    return (
      <div>
        {data.sectors.slice(0, 5).map((item) => {
          const pct =
            item.stories_published > 0
              ? (item.stories_read / item.stories_published) * 100
              : 0;
          return (
            <div key={item.sector_slug} style={{ marginBottom: 4 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 1.5,
                  background: COLORS.borderLight,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 1.5,
                    background: COLORS.forest,
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const totalUnread = data.sectors.reduce(
    (sum, s) => sum + Math.max(0, s.stories_published - s.stories_read),
    0
  );

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: FONTS.sans,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color: COLORS.inkMuted,
          marginBottom: 12,
        }}
      >
        Your Coverage This Week
      </div>

      {data.sectors.map((item) => (
        <CoverageBar key={item.sector_slug} item={item} />
      ))}

      {/* Summary */}
      {totalUnread > 0 && (
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            color: COLORS.inkMuted,
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalUnread} unread
        </div>
      )}

      {/* Nudge */}
      {data.nudge && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${COLORS.borderLight}`,
            fontSize: 11,
            color: COLORS.inkFaint,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              fontSize: 10,
            }}
          >
            {data.nudge.sector_name}
          </span>
          {" \u2014 "}
          {data.nudge.stories_available} stories this week
          {data.nudge.last_read_date && (
            <>
              {" \u00B7 last read: "}
              {new Date(data.nudge.last_read_date).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
