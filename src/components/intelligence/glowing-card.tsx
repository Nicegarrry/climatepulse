"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "./primitives";

export function GlowingBriefingCard({
  onStart,
  todaysRead,
  storyCount,
  briefedToday,
  streakCount,
  articlesAnalysed,
}: {
  onStart: () => void;
  todaysRead: string;
  storyCount: number;
  briefedToday?: boolean;
  streakCount?: number;
  articlesAnalysed?: number;
}) {
  return (
    <div style={{ padding: "14px 16px 18px" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onStart}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart(); } }}
        style={{
          position: "relative",
          background: COLORS.surface,
          border: `1px solid ${COLORS.sage}60`,
          borderRadius: 12,
          padding: "18px 20px",
          cursor: "pointer",
          boxShadow: `
            0 0 0 1px ${COLORS.sage}30,
            0 4px 14px rgba(30, 77, 43, 0.08),
            0 0 30px rgba(30, 77, 43, 0.04)
          `,
          transition: "box-shadow 150ms ease",
          overflow: "hidden",
          WebkitTapHighlightColor: "transparent",
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
        {articlesAnalysed != null && articlesAnalysed > 0 && (
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.inkMuted,
              margin: "0 0 8px",
              lineHeight: 1.4,
            }}
          >
            Based on {articlesAnalysed} articles analysed overnight
          </p>
        )}
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
            background: briefedToday ? `rgba(30, 77, 43, 0.08)` : COLORS.forest,
            color: briefedToday ? COLORS.forest : "#fff",
            border: briefedToday ? `1px solid ${COLORS.forest}` : "none",
            padding: "14px 18px",
            borderRadius: 10,
            position: "relative",
            minHeight: 56,
            transition: "background 300ms ease, color 300ms ease",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: briefedToday ? "transparent" : "rgba(255,255,255,0.18)",
              border: briefedToday ? `1.5px solid ${COLORS.forest}` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {briefedToday ? (
              <span style={{ fontSize: 18, color: COLORS.forest, lineHeight: 1 }}>{"\u2713"}</span>
            ) : (
              <svg width="12" height="14" viewBox="0 0 12 14">
                <polygon points="1,0.5 11,7 1,13.5" fill="#fff" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>
              {briefedToday ? "Briefing complete" : "Start my briefing"}
            </div>
            <div style={{ fontSize: 11, opacity: briefedToday ? 0.6 : 0.75, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {briefedToday
                ? `${streakCount != null && streakCount >= 3 ? `${streakCount}-day streak \u00B7 ` : ""}${storyCount}/${storyCount} stories`
                : `${storyCount} stories \u00B7 ~3 min read`}
            </div>
          </div>
          {!briefedToday && (
            <span style={{ fontSize: 22, color: "#fff", opacity: 0.9, flexShrink: 0, lineHeight: 1 }}>
              {"\u203A"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
