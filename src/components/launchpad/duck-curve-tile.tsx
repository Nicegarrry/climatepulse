// NEM intraday "duck curve" snippet — a compact stacked-generation area chart
// with a spot-price line overlaid, mirroring the chart on /dashboard?tab=energy.
// Server component (pure SVG). Click opens the full energy dashboard.

import { PulseDot, Arrow } from "./primitives";
import type { DuckFuel } from "./data";

type DuckCurveTileProps = {
  href: string;
  timestamps: string[];
  generation: Record<string, number[]>;
  price: number[];
  fueltechs: DuckFuel[]; // stacked bottom-to-top in array order
  renewablesPct: number;
  isSample?: boolean;
};

const W = 320;
const H = 132;
const PAD = { top: 10, right: 4, bottom: 12, left: 4 };

export function DuckCurveTile({
  href,
  timestamps,
  generation,
  price,
  fueltechs,
  renewablesPct,
  isSample,
}: DuckCurveTileProps) {
  const n = timestamps.length;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // x position for sample index i
  const xAt = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * chartW);

  // Stack totals → vertical scale
  const totals = timestamps.map((_, i) =>
    fueltechs.reduce((sum, ft) => sum + Math.max(generation[ft.key]?.[i] ?? 0, 0), 0),
  );
  const maxGen = Math.max(...totals, 1);
  const genY = (v: number) => PAD.top + chartH - (v / maxGen) * chartH;

  // Build a filled area per fueltech, stacked bottom-to-top.
  const lower: number[] = new Array(n).fill(0);
  const areas: { color: string; d: string }[] = [];
  for (const ft of fueltechs) {
    const vals = generation[ft.key] ?? [];
    const upper = lower.map((b, i) => b + Math.max(vals[i] ?? 0, 0));
    // Top edge left→right, then back along the lower edge right→left.
    const top = upper.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${genY(v).toFixed(1)}`);
    const bottom: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      bottom.push(`L${xAt(i).toFixed(1)},${genY(lower[i]).toFixed(1)}`);
    }
    areas.push({ color: ft.color, d: `${top.join(" ")} ${bottom.join(" ")} Z` });
    for (let i = 0; i < n; i++) lower[i] = upper[i];
  }

  // Price line on its own scale.
  const valid = price.filter((p) => typeof p === "number" && isFinite(p));
  const minP = Math.min(...valid, 0);
  const maxP = Math.max(...valid, 50);
  const rangeP = maxP - minP || 1;
  const priceY = (v: number) => PAD.top + chartH - ((v - minP) / rangeP) * chartH;
  const priceD = price
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${priceY(p).toFixed(1)}`)
    .join(" ");

  // Legend — cap at 5 sources so the snippet stays tidy.
  const legend = fueltechs.slice(0, 5);

  return (
    <a className="lp-duck" href={href}>
      <div className="head">
        <span>
          <PulseDot /> &nbsp; NEM · generation &amp; price · 24h
        </span>
        <span>{Math.round(renewablesPct)}% RENEWABLES</span>
      </div>
      {isSample && <span className="sample-stamp">sample · open live →</span>}

      <svg
        className="lp-duck-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="NEM intraday generation stack with spot price overlay"
      >
        {/* generation areas (bottom → top) */}
        {areas.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} opacity={0.88} />
        ))}
        {/* zero price reference (negative prices dip below it) */}
        {minP < 0 && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={priceY(0)}
            y2={priceY(0)}
            stroke="#131613"
            strokeWidth="0.5"
            strokeDasharray="3,3"
            opacity={0.35}
          />
        )}
        {/* spot price line */}
        <path
          d={priceD}
          fill="none"
          stroke="#131613"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="legend">
        {legend.map((ft) => (
          <span className="lg" key={ft.key}>
            <span className="sw" style={{ background: ft.color }} />
            {ft.label}
          </span>
        ))}
        <span className="lg lg-price">
          <span className="sw sw-line" />
          Spot $/MWh
        </span>
      </div>

      <div className="foot">
        <span>Open energy dashboard</span>
        <span>
          /dashboard?tab=energy <Arrow />
        </span>
      </div>
    </a>
  );
}
