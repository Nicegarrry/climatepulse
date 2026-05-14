"use client";

import { useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { LeverChoice, SourceEntry } from "@/lib/automacc/v4-types";
import { LEVER_APPROACHES } from "@/lib/automacc/v4-types";
import { SOURCE_FACTOR_BY_ID } from "@/lib/automacc/factors";
import {
  DEFAULT_HORIZON_YEARS,
  DEFAULT_HURDLE_RATE,
  costPerTco2,
  flatNpv,
} from "@/lib/automacc/v4-math";

interface Props {
  levers: LeverChoice[];
  sources: SourceEntry[];
  onChangeLever: (sourceId: string, patch: Partial<LeverChoice>) => void;
}

function approachLabel(id: string | null): string {
  return LEVER_APPROACHES.find((a) => a.id === id)?.label ?? "—";
}

function sourceLabel(sources: SourceEntry[], sourceId: string): string {
  const s = sources.find((x) => x.id === sourceId);
  if (!s) return sourceId;
  return SOURCE_FACTOR_BY_ID[s.sourceId]?.label ?? s.sourceId;
}

// Recompute NPV & $/t given the editable fields.
// Convention (set in /api/automacc/macc and v4-math): positive
// lifetimeOpexDeltaAudAnnual = annual saving. Feed it straight into flatNpv as
// the annual cashflow so client and server agree on NPV sign.
function recompute(patch: {
  refinedCapexAud: number;
  lifetimeOpexDeltaAudAnnual: number;
  abatementTco2yFinal: number;
}): { npvAud: number; costPerTco2: number } {
  const npv = flatNpv(
    patch.refinedCapexAud,
    patch.lifetimeOpexDeltaAudAnnual,
    DEFAULT_HURDLE_RATE,
    DEFAULT_HORIZON_YEARS,
  );
  const cpt = costPerTco2(npv, patch.abatementTco2yFinal, DEFAULT_HORIZON_YEARS);
  return { npvAud: npv, costPerTco2: cpt };
}

const inputStyle: React.CSSProperties = {
  width: 100,
  padding: "4px 6px",
  fontFamily: FONTS.sans,
  fontSize: 12,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  textAlign: "right",
  color: COLORS.ink,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  fontWeight: 600,
  fontSize: 11,
  color: COLORS.inkSec,
  borderBottom: `1px solid ${COLORS.border}`,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const td: React.CSSProperties = {
  padding: "8px 8px",
  fontSize: 12,
  color: COLORS.ink,
  borderBottom: `1px solid ${COLORS.borderLight}`,
  verticalAlign: "middle",
};

export function MaccTable({ levers, sources, onChangeLever }: Props) {
  const handleEdit = useCallback(
    (lever: LeverChoice, key: "refinedCapexAud" | "lifetimeOpexDeltaAudAnnual" | "abatementTco2yFinal", raw: string) => {
      const num = raw === "" || raw === "-" ? 0 : Number(raw);
      if (!Number.isFinite(num)) return;
      const next = {
        refinedCapexAud: lever.refinedCapexAud ?? 0,
        lifetimeOpexDeltaAudAnnual: lever.lifetimeOpexDeltaAudAnnual ?? 0,
        abatementTco2yFinal: lever.abatementTco2yFinal ?? 0,
        [key]: num,
      };
      const recomputed = recompute(next);
      onChangeLever(lever.sourceId, {
        ...next,
        npvAud: recomputed.npvAud,
        costPerTco2: recomputed.costPerTco2,
      });
    },
    [onChangeLever],
  );

  if (levers.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: COLORS.inkSec,
          fontFamily: FONTS.sans,
        }}
      >
        No levers yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", fontFamily: FONTS.sans }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Source</th>
            <th style={th}>Approach</th>
            <th style={{ ...th, textAlign: "right" }}>Capex ($)</th>
            <th style={{ ...th, textAlign: "right" }}>Annual opex Δ ($/y)</th>
            <th style={{ ...th, textAlign: "right" }}>Abatement (tCO₂/y)</th>
            <th style={{ ...th, textAlign: "right" }}>NPV ($)</th>
            <th style={{ ...th, textAlign: "right" }}>$/tCO₂</th>
          </tr>
        </thead>
        <tbody>
          {levers.map((l) => {
            const cpt = l.costPerTco2 ?? 0;
            const cptColor = cpt < 0 ? COLORS.forest : cpt > 100 ? "#B8442C" : COLORS.ink;
            return (
              <tr key={l.sourceId}>
                <td style={td}>{sourceLabel(sources, l.sourceId)}</td>
                <td style={{ ...td, color: COLORS.inkSec }}>{approachLabel(l.approach)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <input
                    type="number"
                    style={inputStyle}
                    value={l.refinedCapexAud ?? 0}
                    onChange={(e) => handleEdit(l, "refinedCapexAud", e.target.value)}
                  />
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <input
                    type="number"
                    style={inputStyle}
                    value={l.lifetimeOpexDeltaAudAnnual ?? 0}
                    onChange={(e) => handleEdit(l, "lifetimeOpexDeltaAudAnnual", e.target.value)}
                  />
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <input
                    type="number"
                    style={inputStyle}
                    value={l.abatementTco2yFinal ?? 0}
                    onChange={(e) => handleEdit(l, "abatementTco2yFinal", e.target.value)}
                  />
                </td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(l.npvAud ?? 0).toLocaleString()}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    color: cptColor,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(cpt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
