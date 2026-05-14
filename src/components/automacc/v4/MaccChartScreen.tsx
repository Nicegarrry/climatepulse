"use client";

import { useMemo } from "react";
import type { MaccStore } from "@/lib/automacc/v4-store";
import type { LeverChoice } from "@/lib/automacc/v4-types";
import { LEVER_APPROACHES } from "@/lib/automacc/v4-types";
import { SOURCE_FACTOR_BY_ID } from "@/lib/automacc/factors";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { MaccHistogram } from "./MaccHistogram";
import { MaccTable } from "./MaccTable";
import "./PrintLayout.css";

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtTonnes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k tCO₂/y`;
  return `${n.toFixed(1)} tCO₂/y`;
}

function approachLabel(id: string | null): string {
  return LEVER_APPROACHES.find((a) => a.id === id)?.label ?? "—";
}

export function MaccChartScreen({ store }: { store: MaccStore }) {
  const { session, setLever } = store;
  const { levers, sources } = session;

  const ready = useMemo(
    () =>
      levers.filter(
        (l) =>
          l.costPerTco2 !== null &&
          l.abatementTco2yFinal !== null &&
          (l.abatementTco2yFinal ?? 0) > 0,
      ),
    [levers],
  );

  const totals = useMemo(() => {
    const totalCapex = levers.reduce((acc, l) => acc + (l.refinedCapexAud ?? 0), 0);
    const totalNpv = levers.reduce((acc, l) => acc + (l.npvAud ?? 0), 0);
    const totalAbatement = ready.reduce((acc, l) => acc + (l.abatementTco2yFinal ?? 0), 0);
    const baseline = sources.reduce((acc, s) => acc + (s.tco2y ?? 0), 0);
    const pct = baseline > 0 ? (totalAbatement / baseline) * 100 : 0;
    return { totalCapex, totalNpv, totalAbatement, baseline, pct };
  }, [levers, ready, sources]);

  const top3 = useMemo(() => {
    const threshold = totals.totalAbatement * 0.01;
    return [...ready]
      .filter((l) => (l.abatementTco2yFinal ?? 0) > threshold)
      .sort((a, b) => (a.costPerTco2 ?? 0) - (b.costPerTco2 ?? 0))
      .slice(0, 3);
  }, [ready, totals.totalAbatement]);

  if (levers.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          border: `1px dashed ${COLORS.border}`,
          borderRadius: 8,
          textAlign: "center",
          color: COLORS.inkSec,
          fontFamily: FONTS.sans,
        }}
      >
        <h2 style={{ marginTop: 0, color: COLORS.ink, fontFamily: FONTS.serif }}>
          Build levers on Screen 2 first
        </h2>
        <p>Once you’ve matched at least one lever and run the cost engine, the MACC will appear here.</p>
      </div>
    );
  }

  return (
    <div className="macc-print-root" style={{ fontFamily: FONTS.sans, color: COLORS.ink }}>
      {/* Header */}
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 28,
              margin: 0,
              color: COLORS.ink,
            }}
          >
            Marginal abatement cost curve
          </h1>
          <p style={{ margin: "4px 0 0", color: COLORS.inkSec, fontSize: 13 }}>
            Levers sorted cheapest first. Width = annual abatement. Height = $/tCO₂.
          </p>
        </div>
        <button
          data-print-hide="true"
          onClick={() => window.print()}
          style={{
            background: COLORS.ink,
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: 4,
            fontFamily: FONTS.sans,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Print / save PDF
        </button>
      </header>

      {/* Chart */}
      <section
        className="macc-chart-section"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <MaccHistogram levers={levers} sources={sources} />
      </section>

      {/* Top-3 */}
      {top3.length > 0 && (
        <section
          style={{
            background: COLORS.sageTint,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 20,
              margin: "0 0 4px",
              color: COLORS.forest,
            }}
          >
            Start here
          </h2>
          <p style={{ margin: "0 0 16px", color: COLORS.inkSec, fontSize: 13 }}>
            Cheapest abatement, ranked by $/tCO₂. These deliver the most carbon for the least money.
          </p>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {top3.map((l, i) => (
              <Top3Row key={l.sourceId} lever={l} rank={i + 1} sources={sources} />
            ))}
          </ol>
        </section>
      )}

      {/* Summary */}
      <section
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        <Stat label="Upfront capex" value={fmtMoney(totals.totalCapex)} />
        <Stat
          label="Lifetime NPV (10y, 8%)"
          value={fmtMoney(totals.totalNpv)}
          tone={totals.totalNpv >= 0 ? "good" : "bad"}
        />
        <Stat label="Annual abatement" value={fmtTonnes(totals.totalAbatement)} />
        <Stat
          label="% of baseline addressed"
          value={`${totals.pct.toFixed(1)}%`}
          sub={`of ${fmtTonnes(totals.baseline)}`}
        />
      </section>

      {/* Detail table */}
      <section
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 18,
            margin: "0 0 4px",
            color: COLORS.ink,
          }}
        >
          Detail (editable)
        </h2>
        <p style={{ margin: "0 0 16px", color: COLORS.inkSec, fontSize: 12 }}>
          Edit capex, annual opex delta, or annual abatement and the chart, NPV and $/t recompute live.
          Annual opex Δ uses sign convention: negative = cost saving.
        </p>
        <MaccTable levers={levers} sources={sources} onChangeLever={setLever} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  const valueColor =
    tone === "good" ? COLORS.forest : tone === "bad" ? "#B8442C" : COLORS.ink;
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: COLORS.inkSec,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 24,
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function Top3Row({
  lever,
  rank,
  sources,
}: {
  lever: LeverChoice;
  rank: number;
  sources: { id: string; sourceId: string }[];
}) {
  const src = sources.find((s) => s.id === lever.sourceId);
  const srcLabel = src ? SOURCE_FACTOR_BY_ID[src.sourceId]?.label ?? src.sourceId : "Source";
  const cpt = lever.costPerTco2 ?? 0;
  const cptColor = cpt < 0 ? COLORS.forest : COLORS.ink;
  const rationale = lever.geminiRationale?.split(/(?<=[.!?])\s/)[0] ?? "";

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1.4fr 1fr 1fr 1fr 2fr",
        gap: 12,
        padding: "12px 0",
        borderTop: rank === 1 ? "none" : `1px solid ${COLORS.borderLight}`,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 22,
          color: COLORS.forest,
          fontWeight: 600,
        }}
      >
        {rank}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{srcLabel}</div>
        <div style={{ color: COLORS.inkSec, fontSize: 11 }}>{approachLabel(lever.approach)}</div>
      </div>
      <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
        <div style={{ color: COLORS.inkSec, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>
          Capex
        </div>
        {fmtMoney(lever.refinedCapexAud ?? 0)}
      </div>
      <div style={{ fontSize: 12, color: cptColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        <div
          style={{
            color: COLORS.inkSec,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            fontWeight: 400,
          }}
        >
          $/tCO₂
        </div>
        ${Math.round(cpt).toLocaleString()}
      </div>
      <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
        <div style={{ color: COLORS.inkSec, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>
          Abatement
        </div>
        {fmtTonnes(lever.abatementTco2yFinal ?? 0)}
      </div>
      <div style={{ color: COLORS.inkSec, fontSize: 12, lineHeight: 1.4 }}>
        {rationale || lever.description || "—"}
      </div>
    </li>
  );
}
