"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import type { SourceEntry, SourceFactor } from "@/lib/automacc/v4-types";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Props {
  row: SourceEntry;
  factor: SourceFactor | undefined;
  onChange: (patch: Partial<SourceEntry>) => void;
  onRemove: () => void;
}

const inputBase: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: FONTS.sans,
  color: COLORS.ink,
  background: "#fff",
  outline: "none",
};

export function SourceRow({ row, factor, onChange, onRemove }: Props) {
  const label = factor?.label ?? row.sourceId;
  const unit = factor?.numerical.unit ?? row.numericalUnit ?? "";
  const hint = factor?.numerical.hint ?? "Enter a number";
  const numericalName = factor?.numerical.name ?? "Amount";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1.4fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        background: COLORS.bg,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 6,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.ink,
            fontFamily: FONTS.sans,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={label}
        >
          {label}
        </div>
        {row.tco2y != null && (
          <div
            style={{
              fontSize: 11,
              color: COLORS.forest,
              fontFamily: FONTS.sans,
              marginTop: 2,
            }}
          >
            {row.tco2y.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO2/y
            {row.confidence ? ` · ${row.confidence}` : ""}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <input
          type="number"
          step="any"
          min={0}
          value={row.numericalValue ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ numericalValue: v === "" ? null : Number(v) });
          }}
          placeholder={hint}
          aria-label={numericalName}
          style={{
            ...inputBase,
            width: "100%",
            paddingRight: unit ? 44 : 10,
          }}
        />
        {unit && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: COLORS.inkMuted,
              fontFamily: FONTS.sans,
              pointerEvents: "none",
            }}
          >
            {unit}
          </span>
        )}
      </div>

      <input
        type="text"
        value={row.freeText}
        onChange={(e) => onChange({ freeText: e.target.value })}
        placeholder="Notes / what you actually know"
        aria-label="Notes"
        style={{ ...inputBase, width: "100%" }}
      />

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          border: `1px solid ${COLORS.border}`,
          background: "#fff",
          borderRadius: 6,
          cursor: "pointer",
          color: COLORS.inkSec,
        }}
      >
        <XMarkIcon width={14} height={14} />
      </button>
    </div>
  );
}
