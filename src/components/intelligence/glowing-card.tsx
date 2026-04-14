"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "./primitives";

export function GlowingBriefingCard({
  onStart,
  todaysRead,
  storyCount,
  briefedToday,
  streakCount,
}: {
  onStart: () => void;
  todaysRead: string;
  storyCount: number;
  briefedToday?: boolean;
  streakCount?: number;
}) {
  return (
    <div style={{ padding: "14px 16px 18px" }}>
      <div
        onClick={onStart}
        style={{
          position: "relative",
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: "18px 20px",
          cursor: "pointer",
          boxShadow: `
            0 0 0 1px ${COLORS.border},
            0 0 20px rgba(30, 77, 43, 0.06),
            0 0 40px rgba(30, 77, 43, 0.04),
            0 0 60px rgba(30, 77, 43, 0.02)
          `,
          transition: "box-shadow 150ms ease",
          overflow: "hidden",
        }}
      >
        {/* Animated glow pulse border — suppressed when briefed */}
        {!briefedToday && (
          <div
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: 12,
              border: `1.5px solid ${COLORS.forest}`,
              opacity: 0.15,
              animation: "glowPulse 3s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 20,
            right: 20,
            height: 2,
            background: `linear-gradient(90deg, ${COLORS.forest}, ${COLORS.sage}, transparent)`,
            borderRadius: "0 0 2px 2px",
            opacity: 0.4,
          }}
        />

        <Micro color={COLORS.forest} mb={8}>
          Today{"\u2019"}s Read
        </Micro>
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 14,
            color: COLORS.inkSec,
            lineHeight: 1.6,
            margin: "0 0 18px",
          }}
        >
          {todaysRead}
        </p>

        {/* Start briefing / Completed bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: briefedToday ? `rgba(30, 77, 43, 0.08)` : COLORS.ink,
            color: briefedToday ? COLORS.forest : COLORS.surface,
            border: briefedToday ? `1px solid ${COLORS.forest}` : "none",
            padding: "13px 18px",
            borderRadius: 8,
            position: "relative",
            transition: "background 300ms ease, color 300ms ease",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: briefedToday ? `1.5px solid ${COLORS.sage}` : "1.5px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {briefedToday ? (
              <span style={{ fontSize: 16, color: COLORS.forest }}>{"\u2713"}</span>
            ) : (
              <svg width="12" height="14" viewBox="0 0 12 14">
                <polygon points="1,0.5 11,7 1,13.5" fill={COLORS.surface} />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>
              {briefedToday ? "Briefing complete" : "Start my briefing"}
            </div>
            <div style={{ fontSize: 10, opacity: briefedToday ? 0.6 : 0.4, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
              {briefedToday
                ? `${streakCount != null && streakCount >= 3 ? `${streakCount}-day streak \u00B7 ` : ""}${storyCount}/${storyCount} stories`
                : `${storyCount} stories \u00B7 ~3 min read`}
            </div>
          </div>
          {!briefedToday && (
            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              {Array.from({ length: storyCount }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: 12,
                    borderRadius: 1.5,
                    background: COLORS.surface,
                    opacity: 0.15 + (i === 0 ? 0.15 : 0),
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
