"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import type { EditorialStory } from "@/lib/mock-editorial";
import { SECTOR_SEVERITY_MAP } from "@/lib/mock-editorial";
import { Micro, SourceTag, SectorArt } from "./primitives";

const DURATION = 15000;

export function StoriesOverlay({
  stories,
  startIndex,
  onClose,
  phase,
}: {
  stories: EditorialStory[];
  startIndex: number;
  onClose: () => void;
  phase: "entering" | "active";
}) {
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const story = stories[current];
  const sev =
    SEVERITY[story.severity] ||
    SEVERITY[SECTOR_SEVERITY_MAP[story.sector]] ||
    SEVERITY.watch;

  const navigate = useCallback(
    (dir: number) => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      const next = current + dir;
      if (next < 0) return;
      if (next >= stories.length) {
        onClose();
        return;
      }
      setSlideDir(dir > 0 ? "left" : "right");
      setTimeout(() => {
        setCurrent(next);
        setContentKey((k) => k + 1);
        setSlideDir(null);
      }, 150);
    },
    [current, stories.length, onClose]
  );

  const startTimer = useCallback(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / DURATION, 1);
      setProgress(pct);
      if (pct < 1) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        if (current < stories.length - 1) navigate(1);
        else onClose();
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [current, stories.length, onClose, navigate]);

  useEffect(() => {
    setProgress(0);
    startTimer();
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [current, startTimer]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: COLORS.ink,
        animation:
          phase === "entering"
            ? "expandIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Progress bars */}
      <div
        style={{
          display: "flex",
          gap: 3,
          padding: "10px 14px 0",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {stories.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2.5,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 1,
                background:
                  i < current
                    ? "rgba(255,255,255,0.6)"
                    : i === current
                      ? COLORS.surface
                      : "transparent",
                width:
                  i < current ? "100%" : i === current ? `${progress * 100}%` : "0%",
                transition: i === current ? "none" : "width 0.3s ease",
              }}
            />
          </div>
        ))}
      </div>

      {/* Sector + close */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px 4px",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: FONTS.sans,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {story.sector}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {current + 1}/{stories.length}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 6,
            lineHeight: 1,
          }}
        >
          {"\u00D7"}
        </button>
      </div>

      {/* Story content */}
      <div
        key={contentKey}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          animation:
            slideDir === null
              ? "contentEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
              : slideDir === "left"
                ? "contentExit 0.15s ease forwards"
                : "contentExitReverse 0.15s ease forwards",
        }}
      >
        <SectorArt sector={story.sector} height={130} />

        <div
          style={{
            flex: 1,
            background: COLORS.surface,
            borderRadius: "14px 14px 0 0",
            marginTop: -12,
            padding: "22px 22px 32px",
            position: "relative",
          }}
          className="paper-grain"
        >
          {/* Floating number badge */}
          {story.number && (
            <div
              style={{
                position: "absolute",
                top: -20,
                right: 22,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "7px 16px",
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: COLORS.ink,
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: FONTS.sans,
                }}
              >
                {story.number}
              </span>
              <span style={{ fontSize: 11, color: COLORS.inkMuted }}>
                {story.unit}
              </span>
            </div>
          )}

          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 23,
              fontWeight: 400,
              color: COLORS.ink,
              lineHeight: 1.25,
              margin: "0 0 18px",
              paddingRight: story.number ? 90 : 0,
            }}
          >
            {story.headline}
          </h2>

          {story.body.split("\n\n").map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: 14,
                fontFamily: FONTS.serif,
                color: COLORS.inkSec,
                lineHeight: 1.7,
                margin: "0 0 12px",
              }}
            >
              {para}
            </p>
          ))}

          {/* Why it matters */}
          <div
            style={{
              background: COLORS.sageTint,
              borderLeft: `2px solid ${COLORS.forest}`,
              padding: "10px 14px",
              borderRadius: "0 8px 8px 0",
              marginTop: 6,
              marginBottom: 14,
            }}
          >
            <Micro color={COLORS.forest} mb={4}>
              Why it matters
            </Micro>
            <p
              style={{
                fontSize: 13,
                fontFamily: FONTS.serif,
                color: COLORS.ink,
                lineHeight: 1.55,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              {story.whyItMatters}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Micro color={COLORS.inkFaint}>Sources</Micro>
            {story.sources.map((s, i) => (
              <SourceTag key={i} name={s} type={story.sourceTypes?.[i]} />
            ))}
          </div>
        </div>
      </div>

      {/* Tap zones */}
      <div
        onClick={() => navigate(-1)}
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          bottom: 0,
          width: "28%",
          cursor: "pointer",
          zIndex: 10,
        }}
      />
      <div
        onClick={() => navigate(1)}
        style={{
          position: "absolute",
          top: 50,
          right: 0,
          bottom: 0,
          width: "72%",
          cursor: "pointer",
          zIndex: 10,
        }}
      />
    </div>
  );
}
