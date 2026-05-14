"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: COLORS.inkSec,
  marginBottom: 6,
  fontFamily: FONTS.sans,
};

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              style={{
                padding: "7px 12px",
                background: active ? COLORS.forest : "#fff",
                color: active ? "#fff" : COLORS.ink,
                border: `1px solid ${active ? COLORS.forest : COLORS.border}`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONTS.sans,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
