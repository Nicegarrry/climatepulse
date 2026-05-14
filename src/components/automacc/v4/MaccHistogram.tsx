"use client";

import { useMemo, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { LeverChoice, SourceEntry } from "@/lib/automacc/v4-types";
import { LEVER_APPROACHES } from "@/lib/automacc/v4-types";
import { SOURCE_FACTOR_BY_ID } from "@/lib/automacc/factors";

interface HistogramBar {
  lever: LeverChoice;
  x0: number;
  x1: number;
  cost: number;
  abatement: number;
  label: string;
}

interface Props {
  levers: LeverChoice[];
  sources: SourceEntry[];
  width?: number;
  height?: number;
}

const approachLabel = (id: string | null) =>
  LEVER_APPROACHES.find((a) => a.id === id)?.label ?? "—";

function sourceLabel(sources: SourceEntry[], sourceId: string): string {
  const s = sources.find((x) => x.id === sourceId);
  if (!s) return "Source";
  return SOURCE_FACTOR_BY_ID[s.sourceId]?.label ?? s.sourceId;
}

function colorFor(cost: number): string {
  if (cost <= -50) return "#1E6B3A";
  if (cost < 0) return COLORS.forestMid;
  if (cost < 50) return COLORS.inkFaint;
  if (cost < 200) return "#D98237";
  return "#B8442C";
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(step) || 1)));
  const niceStep = Math.ceil(step / mag) * mag;
  const out: number[] = [];
  const start = Math.floor(min / niceStep) * niceStep;
  for (let v = start; v <= max + niceStep / 2; v += niceStep) out.push(v);
  return out;
}

export function MaccHistogram({ levers, sources, width = 980, height = 420 }: Props) {
  const [hover, setHover] = useState<{ bar: HistogramBar; x: number; y: number } | null>(null);

  const data = useMemo(() => {
    const eligible = levers.filter(
      (l) => l.costPerTco2 !== null && l.abatementTco2yFinal !== null && (l.abatementTco2yFinal ?? 0) > 0,
    );
    const sorted = [...eligible].sort((a, b) => (a.costPerTco2 ?? 0) - (b.costPerTco2 ?? 0));
    let cum = 0;
    const bars: HistogramBar[] = sorted.map((l) => {
      const abatement = l.abatementTco2yFinal ?? 0;
      const cost = l.costPerTco2 ?? 0;
      const x0 = cum;
      cum += abatement;
      return { lever: l, x0, x1: cum, cost, abatement, label: sourceLabel(sources, l.sourceId) };
    });
    const costs = bars.map((b) => b.cost);
    return {
      bars,
      totalAbatement: cum,
      yMin: Math.min(0, ...costs),
      yMax: Math.max(0, ...costs),
    };
  }, [levers, sources]);

  if (data.bars.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: COLORS.inkSec, fontFamily: FONTS.sans, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
        No levers with computed cost-per-tonne yet.
      </div>
    );
  }

  const m = { top: 24, right: 24, bottom: 56, left: 76 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const yRange = data.yMax - data.yMin || 1;
  const yPad = yRange * 0.08;
  const yMin = data.yMin - (data.yMin < 0 ? yPad : 0);
  const yMax = data.yMax + (data.yMax > 0 ? yPad : 0);
  const xScale = (v: number) => m.left + (v / (data.totalAbatement || 1)) * plotW;
  const yScale = (v: number) => m.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = niceTicks(0, data.totalAbatement, 5);
  const zeroY = yScale(0);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: width }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto"
        style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.ink }}
        onMouseLeave={() => setHover(null)}>
        {/* Gridlines */}
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={m.left} x2={m.left + plotW} y1={yScale(t)} y2={yScale(t)} stroke={COLORS.borderLight} strokeWidth={1} />
        ))}
        {/* Bars */}
        {data.bars.map((b, i) => {
          const x = xScale(b.x0);
          const w = Math.max(1, xScale(b.x1) - xScale(b.x0));
          const top = yScale(Math.max(0, b.cost));
          const h = Math.max(1, yScale(Math.min(0, b.cost)) - top);
          return (
            <rect key={`bar-${i}`} x={x} y={top} width={w} height={h}
              fill={colorFor(b.cost)} stroke={COLORS.surface} strokeWidth={0.5}
              style={{ cursor: "pointer" }}
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement as SVGSVGElement;
                const rect = svg.getBoundingClientRect();
                setHover({
                  bar: b,
                  x: (x + w / 2) * (rect.width / width),
                  y: (top - 8) * (rect.height / height),
                });
              }} />
          );
        })}
        {/* Zero reference line */}
        <line x1={m.left} x2={m.left + plotW} y1={zeroY} y2={zeroY} stroke={COLORS.ink} strokeWidth={1} strokeDasharray="4 3" />
        <text x={m.left + plotW - 4} y={zeroY - 4} textAnchor="end" fill={COLORS.inkSec} fontSize={10}>$0/t</text>
        {/* Y axis */}
        <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + plotH} stroke={COLORS.inkFaint} />
        {yTicks.map((t) => (
          <text key={`yt-${t}`} x={m.left - 8} y={yScale(t) + 3} textAnchor="end" fill={COLORS.inkSec} fontSize={10}>
            ${Math.round(t)}
          </text>
        ))}
        {/* X axis */}
        <line x1={m.left} x2={m.left + plotW} y1={m.top + plotH} y2={m.top + plotH} stroke={COLORS.inkFaint} />
        {xTicks.map((t) => (
          <g key={`xt-${t}`}>
            <line x1={xScale(t)} x2={xScale(t)} y1={m.top + plotH} y2={m.top + plotH + 4} stroke={COLORS.inkFaint} />
            <text x={xScale(t)} y={m.top + plotH + 16} textAnchor="middle" fill={COLORS.inkSec} fontSize={10}>
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}
        {/* Axis labels */}
        <text x={m.left + plotW / 2} y={height - 12} textAnchor="middle" fill={COLORS.inkSec} fontSize={11}>
          Cumulative abatement (tCO₂ / year)
        </text>
        <text transform={`translate(16, ${m.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fill={COLORS.inkSec} fontSize={11}>
          Cost ($AUD per tCO₂ abated)
        </text>
      </svg>

      {hover && (
        <div style={{
          position: "absolute", left: hover.x, top: hover.y,
          transform: "translate(-50%, -100%)",
          background: COLORS.ink, color: "#fff",
          fontFamily: FONTS.sans, fontSize: 11,
          padding: "8px 10px", borderRadius: 6,
          pointerEvents: "none", whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 10,
        }}>
          <div style={{ fontWeight: 600 }}>{hover.bar.label}</div>
          <div style={{ opacity: 0.85 }}>
            {approachLabel(hover.bar.lever.approach)} · {hover.bar.abatement.toFixed(1)} tCO₂/y
          </div>
          <div style={{ opacity: 0.85 }}>${Math.round(hover.bar.cost).toLocaleString()} / tCO₂</div>
        </div>
      )}
    </div>
  );
}
