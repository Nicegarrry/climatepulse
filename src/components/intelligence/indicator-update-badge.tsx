"use client";

import { COLORS } from "@/lib/design-tokens";
import type { EditorialStory } from "@/lib/mock-editorial";

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function IndicatorUpdateBadge({
  update,
  size = "md",
}: {
  update: NonNullable<EditorialStory["triggeredIndicatorUpdate"]>;
  size?: "sm" | "md";
}) {
  const tone =
    update.direction_good === "down"
      ? COLORS.forest
      : update.direction_good === "up"
        ? COLORS.forest
        : COLORS.inkMuted;

  return (
    <a
      href="/dashboard?tab=indicators"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        border: `1px solid ${tone}55`,
        borderRadius: 4,
        background: `${tone}10`,
        color: COLORS.inkSec,
        fontSize: size === "sm" ? 9.5 : 10.5,
        textDecoration: "none",
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ fontSize: 10, color: tone }}>↗</span>
      <span style={{ color: COLORS.inkSec }}>
        Indicator updated:{" "}
        <span style={{ color: COLORS.ink, fontWeight: 500 }}>{update.indicator_name}</span>
      </span>
      <span style={{ color: tone, fontWeight: 600 }}>
        → {formatNumber(update.new_value)} {update.unit}
      </span>
    </a>
  );
}
