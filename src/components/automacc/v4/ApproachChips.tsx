"use client";

import { LEVER_APPROACHES, type LeverApproach } from "@/lib/automacc/v4-types";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Props {
  value: LeverApproach | null;
  onChange: (approach: LeverApproach) => void;
}

export function ApproachChips({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
      role="radiogroup"
      aria-label="Abatement approach"
    >
      {LEVER_APPROACHES.map((chip) => {
        const selected = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={chip.blurb}
            onClick={() => onChange(chip.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: selected ? 600 : 500,
              fontFamily: FONTS.sans,
              border: `1px solid ${selected ? COLORS.forest : COLORS.border}`,
              background: selected ? COLORS.forest : "#fff",
              color: selected ? "#fff" : COLORS.ink,
              cursor: "pointer",
              transition: "background 120ms, color 120ms, border 120ms",
              letterSpacing: "0.005em",
              whiteSpace: "nowrap",
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
