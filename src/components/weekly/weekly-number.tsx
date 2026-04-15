"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";

interface WeeklyNumberData {
  value: string;
  unit: string;
  label: string;
  context: string;
  trend: string | null;
}

export function WeeklyNumber({ data }: { data: WeeklyNumberData }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.plum}`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <Micro color={COLORS.plum}>Number of the Week</Micro>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
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
          {data.value}
        </span>
        <span style={{ fontSize: 14, color: COLORS.plumMid, fontWeight: 500 }}>
          {data.unit}
        </span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSec, marginTop: 6, lineHeight: 1.4 }}>
        {data.label}
      </div>
      <div style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
        {data.context}
      </div>
      {data.trend && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px solid ${COLORS.borderLight}`,
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.forest,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.trend}
        </div>
      )}
    </div>
  );
}
