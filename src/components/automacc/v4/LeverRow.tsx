"use client";

import { useMemo } from "react";
import type { LeverChoice, SourceEntry } from "@/lib/automacc/v4-types";
import { SOURCE_FACTOR_BY_ID } from "@/lib/automacc/factors";
import { leversForApproachAndSource } from "@/lib/automacc/levers";
import { lifetimeAvoidedCost } from "@/lib/automacc/v4-math";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { ApproachChips } from "./ApproachChips";

interface Props {
  entry: SourceEntry;
  lever: LeverChoice | undefined;
  onChange: (patch: Partial<LeverChoice>) => void;
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
  width: "100%",
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function LeverRow({ entry, lever, onChange }: Props) {
  const factor = SOURCE_FACTOR_BY_ID[entry.sourceId];
  const label = factor?.label ?? entry.sourceId;
  const unit = factor?.numerical.unit ?? entry.numericalUnit ?? "";
  const numericalDisplay =
    entry.numericalValue != null
      ? `${entry.numericalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit ? ` ${unit}` : ""}`
      : null;
  const tco2yDisplay =
    entry.tco2y != null
      ? `${entry.tco2y.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO2/y`
      : "—";

  const approach = lever?.approach ?? null;
  const capex = lever?.capexAud ?? null;
  const description = lever?.description ?? "";
  const abatementPct = lever?.abatementPct ?? 0;

  // Typical capex range from first matching lever in library.
  const typicalRange = useMemo(() => {
    if (!approach) return null;
    const matches = leversForApproachAndSource(approach, entry.sourceId);
    if (matches.length === 0) return null;
    const first = matches[0];
    return {
      low: first.typicalCapex.low,
      high: first.typicalCapex.high,
      unit: first.typicalCapex.unit,
    };
  }, [approach, entry.sourceId]);

  // Lifetime avoided cost from fuel/electricity savings.
  const lifetime = useMemo(() => {
    if (entry.numericalValue == null) return 0;
    const costPerUnit = factor?.costFactorAudPerUnit ?? 0;
    if (costPerUnit <= 0) return 0;
    return lifetimeAvoidedCost(entry.numericalValue, abatementPct, costPerUnit, 10);
  }, [entry.numericalValue, abatementPct, factor]);

  const lifetimePositive = lifetime > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 16,
        padding: 16,
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        fontFamily: FONTS.sans,
      }}
    >
      {/* Left: source identity */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.ink,
            marginBottom: 4,
            lineHeight: 1.3,
          }}
          title={label}
        >
          {label}
        </div>
        {numericalDisplay && (
          <div style={{ fontSize: 12, color: COLORS.inkSec, marginBottom: 2 }}>
            {numericalDisplay}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.forest,
          }}
        >
          {tco2yDisplay}
        </div>
      </div>

      {/* Middle: approach chips */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            marginBottom: 8,
          }}
        >
          Approach
        </div>
        <ApproachChips
          value={approach}
          onChange={(a) => {
            if (a === null) {
              // Deselect: wipe lever-specific fields but keep the row.
              onChange({ approach: null, description: "", capexAud: null, abatementPct: 0 });
            } else {
              onChange({ approach: a });
            }
          }}
        />
        {!approach && (
          <div
            style={{
              fontSize: 11,
              color: COLORS.inkMuted,
              marginTop: 8,
              fontStyle: "italic",
            }}
          >
            Skip this source if you don&apos;t plan to abate it.
          </div>
        )}
      </div>

      {/* Right: inputs (only when approach selected) */}
      <div style={{ minWidth: 0 }}>
        {approach ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  marginBottom: 4,
                }}
              >
                What would you do?
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder='e.g. "Switch electricity supply to a corporate PPA" or "Replace gas boiler with heat pump"'
                style={{ ...inputBase, resize: "vertical", lineHeight: 1.4 }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  marginBottom: 4,
                }}
              >
                Capex guess (AUD) <span style={{ color: COLORS.inkFaint, fontWeight: 500 }}>· optional</span>
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={capex ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({ capexAud: v === "" ? null : Number(v) });
                }}
                placeholder="Leave blank if you're not sure"
                style={inputBase}
              />
              {typicalRange && (
                <div
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    padding: "2px 8px",
                    background: COLORS.sageTint,
                    color: COLORS.forest,
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  title={typicalRange.unit}
                >
                  Typical: {fmtMoney(typicalRange.low)}–{fmtMoney(typicalRange.high)}
                </div>
              )}
            </div>

            <div>
              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  marginBottom: 4,
                }}
              >
                <span>% of source you'd cut</span>
                <span style={{ color: COLORS.ink, fontSize: 12, fontWeight: 600 }}>
                  {Math.round(abatementPct)}%
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={abatementPct}
                onChange={(e) => onChange({ abatementPct: Number(e.target.value) })}
                style={{ width: "100%", accentColor: COLORS.forest }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: COLORS.inkMuted,
              fontStyle: "italic",
              paddingTop: 12,
            }}
          >
            Pick an approach above to describe + size the lever.
          </div>
        )}

        {/* Footer: lifetime saving */}
        {approach && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: `1px dashed ${COLORS.borderLight}`,
              fontSize: 12,
              color: lifetimePositive ? COLORS.forest : COLORS.inkMuted,
              fontWeight: lifetimePositive ? 600 : 500,
            }}
          >
            {lifetimePositive
              ? `Lifetime avoided cost: ${fmtMoney(lifetime)} over 10 yrs`
              : "Lifetime avoided cost: — (no fuel/elec cost factor)"}
          </div>
        )}
      </div>
    </div>
  );
}
