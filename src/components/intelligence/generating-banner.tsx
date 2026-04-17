"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Props {
  startedAt: number;
  estimatedSeconds: number;
}

export function GeneratingBanner({ startedAt, estimatedSeconds }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const ratio = Math.min(1, elapsed / estimatedSeconds);
  // Hold at 95% once we exceed the estimate so the bar doesn't "finish" prematurely.
  const progress = ratio >= 1 ? 0.95 : 0.08 + ratio * 0.87;
  const overrun = elapsed > estimatedSeconds;

  const statusLine = overrun
    ? "Still working — final polish"
    : elapsed < 8
      ? "Reading today's stories"
      : elapsed < 22
        ? "Scoring significance"
        : elapsed < 42
          ? "Cross-checking prior coverage"
          : "Writing your briefing";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${COLORS.plum}`,
        padding: "14px 18px 16px",
        marginBottom: 16,
        fontFamily: FONTS.sans,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: COLORS.plum,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <PulsingDot />
            Building your first briefing
          </div>
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 17,
              lineHeight: 1.35,
              color: COLORS.ink,
              fontWeight: 400,
            }}
          >
            {statusLine}
            <span style={{ color: COLORS.inkFaint }}>
              <AnimatedDots />
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.inkMuted, marginTop: 6, lineHeight: 1.5 }}>
            Showing sample content below. Your personalised briefing will replace
            it automatically — usually in under a minute.
          </div>
        </div>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 28,
            fontWeight: 300,
            color: COLORS.plum,
            letterSpacing: -0.5,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {Math.floor(elapsed)}
          <span style={{ fontSize: 12, color: COLORS.inkMuted, marginLeft: 3, letterSpacing: 0 }}>s</span>
        </div>
      </div>

      {/* Progress rail */}
      <div
        style={{
          marginTop: 14,
          height: 2,
          background: COLORS.borderLight,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            background: COLORS.plum,
            transition: "width 420ms ease-out",
          }}
        />
        {/* Shimmer overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "40%",
            background: `linear-gradient(90deg, transparent, ${COLORS.plumLight}, transparent)`,
            animation: "cp-shimmer 1.8s infinite linear",
            opacity: 0.7,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes cp-shimmer {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(250%);
          }
        }
      `}</style>
    </div>
  );
}

function PulsingDot() {
  return (
    <>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: COLORS.plum,
          animation: "cp-pulse 1.4s ease-in-out infinite",
        }}
      />
      <style jsx>{`
        @keyframes cp-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

function AnimatedDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);
  return <span style={{ display: "inline-block", width: 18 }}>{".".repeat(n)}</span>;
}
