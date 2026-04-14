"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import type { EnergyDashboardData, PriceSummary } from "@/lib/energy/openelectricity";
import { Micro, WobblyRule } from "./primitives";

// ─── Fuel tech colour overrides for editorial palette ───────────────────────

const FUELTECH_EDITORIAL: Record<string, string> = {
  energy_solar: "#D4A017",
  energy_wind: "#4A7C59",
  energy_hydro: "#94A88A",
  energy_coal: "#8C8C8C",
  energy_gas: "#B3B3B3",
  energy_battery_discharging: "#6B4A6B",
};

function getFtColor(key: string, original: string): string {
  return FUELTECH_EDITORIAL[key] || original;
}

// ─── Intraday Generation + Price Chart ──────────────────────────────────────

function IntradayChart({
  timestamps,
  generation,
  price,
  fueltechs,
}: {
  timestamps: string[];
  generation: Record<string, number[]>;
  price: number[];
  fueltechs: { key: string; label: string; color: string }[];
}) {
  if (timestamps.length < 2) return null;

  const W = 280;
  const H = 120;
  const PAD = { top: 4, right: 28, bottom: 14, left: 0 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barCount = timestamps.length;
  const barW = chartW / barCount;

  const ftReversed = [...fueltechs].reverse();
  const stacks = ftReversed.map((ft) => ({
    key: ft.key,
    color: getFtColor(ft.key, ft.color),
    values: generation[ft.key] ?? timestamps.map(() => 0),
  }));

  const maxGen = Math.max(
    ...timestamps.map((_, i) => stacks.reduce((sum, s) => sum + s.values[i], 0)),
    1
  );

  // Price overlay
  const validPrices = price.filter((p) => p !== null && isFinite(p));
  const minPrice = Math.min(...validPrices, 0);
  const maxPrice = Math.max(...validPrices, 100);
  const priceRange = maxPrice - minPrice || 1;
  const priceY = (v: number) => PAD.top + chartH - ((v - minPrice) / priceRange) * chartH;

  const pricePath = price
    .map((p, i) => {
      const x = PAD.left + (i / (price.length - 1)) * chartW;
      const y = priceY(p);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Time labels — show 4 evenly spaced
  const labelIndices = [0, Math.floor(barCount / 3), Math.floor((2 * barCount) / 3), barCount - 1];

  // Fueltech totals for legend
  const ftTotals = new Map<string, number>();
  for (const s of stacks) {
    ftTotals.set(s.key, s.values.reduce((a, b) => a + b, 0));
  }
  const grandTotal = Array.from(ftTotals.values()).reduce((a, b) => a + b, 1);

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: COLORS.inkMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Generation + Price {"\u2014"} 24h
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* Generation bars */}
        {timestamps.map((_, i) => {
          let cumulative = 0;
          return (
            <g key={i}>
              {stacks.map((stack) => {
                const val = stack.values[i];
                const barH = (val / maxGen) * chartH;
                const y = PAD.top + chartH - cumulative - barH;
                cumulative += barH;
                if (barH < 0.3) return null;
                return (
                  <rect
                    key={stack.key}
                    x={PAD.left + i * barW + 0.15}
                    y={y}
                    width={Math.max(barW - 0.3, 0.3)}
                    height={barH}
                    fill={stack.color}
                    opacity={0.8}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Price line overlay */}
        <path d={pricePath} fill="none" stroke={COLORS.ink} strokeWidth="1.2" opacity={0.6} />

        {/* Price labels on right axis */}
        <text x={W - 2} y={priceY(maxPrice) + 3} textAnchor="end" fontSize="7" fill={COLORS.inkFaint}>
          ${Math.round(maxPrice)}
        </text>
        <text x={W - 2} y={priceY(minPrice) - 1} textAnchor="end" fontSize="7" fill={COLORS.inkFaint}>
          ${Math.round(minPrice)}
        </text>

        {/* Time labels */}
        {labelIndices.map((idx) => {
          if (idx >= timestamps.length) return null;
          const t = new Date(timestamps[idx]);
          const label = t.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
          return (
            <text
              key={idx}
              x={PAD.left + idx * barW + barW / 2}
              y={H - 2}
              textAnchor="middle"
              fontSize="6"
              fill={COLORS.inkFaint}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 4 }}>
        {fueltechs
          .filter((ft) => ((ftTotals.get(ft.key) ?? 0) / grandTotal) * 100 > 2)
          .map((ft) => (
            <div key={ft.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 3, borderRadius: 1, background: getFtColor(ft.key, ft.color) }} />
              <span style={{ fontSize: 8, color: COLORS.inkMuted }}>{ft.label}</span>
            </div>
          ))}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 8, height: 1.5, background: COLORS.ink, opacity: 0.6 }} />
          <span style={{ fontSize: 8, color: COLORS.inkMuted }}>Price</span>
        </div>
      </div>
    </div>
  );
}

// ─── State Prices Chart ─────────────────────────────────────────────────────

function StatePricesChart({ priceSummaries }: { priceSummaries: PriceSummary[] }) {
  if (priceSummaries.length === 0) return null;

  const maxPrice = Math.max(...priceSummaries.map((p) => p.latest_price ?? 0), 100);

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: COLORS.inkMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Wholesale by State {"\u2014"} $/MWh
      </div>
      {priceSummaries.map((p) => {
        const latest = p.latest_price ?? 0;
        const barPct = Math.min((Math.abs(latest) / maxPrice) * 100, 100);
        const isNegative = latest < 0;
        return (
          <div
            key={p.region}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: COLORS.inkMuted,
                width: 24,
                fontVariantNumeric: "tabular-nums",
                fontFamily: FONTS.sans,
              }}
            >
              {p.region}
            </span>
            <div
              style={{
                flex: 1,
                height: 5,
                background: COLORS.borderLight,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  width: `${barPct}%`,
                  background: isNegative ? COLORS.forest : latest > 150 ? COLORS.ink : COLORS.sage,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: isNegative ? COLORS.forest : COLORS.ink,
                width: 32,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${Math.round(latest)}
            </span>
            {/* Min/max range */}
            <span
              style={{
                fontSize: 8,
                color: COLORS.inkFaint,
                width: 48,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {p.min_24h != null && p.max_24h != null
                ? `${Math.round(p.min_24h)}\u2013${Math.round(p.max_24h)}`
                : ""}
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <span style={{ fontSize: 8, color: COLORS.inkFaint }}>
          Now {"\u00B7"} 24h range
        </span>
        <span style={{ fontSize: 8, color: COLORS.inkFaint }}>
          Avg ${Math.round(
            priceSummaries.reduce((sum, p) => sum + (p.avg_24h ?? 0), 0) / priceSummaries.length
          )}/MWh
        </span>
      </div>
    </div>
  );
}

// ─── Generation Mix Donut ───────────────────────────────────────────────────

function GenerationMix({
  mix,
}: {
  mix: { fueltech: string; label: string; color: string; share_pct: number; type: string }[];
}) {
  if (mix.length === 0) return null;

  const renewablePct = mix
    .filter((m) => m.type === "renewable")
    .reduce((sum, m) => sum + m.share_pct, 0);

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: COLORS.inkMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Generation Mix {"\u2014"} 7 Day
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        {mix
          .filter((m) => m.share_pct > 0.5)
          .map((m) => (
            <div
              key={m.fueltech}
              style={{
                width: `${m.share_pct}%`,
                background: getFtColor(m.fueltech, m.color),
                opacity: 0.85,
              }}
            />
          ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
        {mix
          .filter((m) => m.share_pct > 1)
          .map((m) => (
            <div key={m.fueltech} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 3, borderRadius: 1, background: getFtColor(m.fueltech, m.color) }} />
              <span style={{ fontSize: 8, color: COLORS.inkMuted }}>
                {m.label} {m.share_pct.toFixed(0)}%
              </span>
            </div>
          ))}
      </div>

      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 18, fontFamily: FONTS.serif, fontWeight: 300, color: COLORS.forest, fontVariantNumeric: "tabular-nums" }}>
          {renewablePct.toFixed(1)}%
        </span>
        <span style={{ fontSize: 9, color: COLORS.inkMuted }}>renewables</span>
      </div>
    </div>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────────────────────

export function EnergySidebar({ data }: { data: EnergyDashboardData | null }) {
  if (!data) {
    return (
      <div>
        <Micro color={COLORS.forest}>Energy Snapshot</Micro>
        <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 10 }}>Loading energy data...</p>
      </div>
    );
  }

  return (
    <div>
      <Micro color={COLORS.forest}>Energy Snapshot</Micro>

      {/* Intraday generation + price */}
      {data.intraday && data.intraday.timestamps.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <IntradayChart
            timestamps={data.intraday.timestamps}
            generation={data.intraday.generation}
            price={data.intraday.price}
            fueltechs={data.intraday.fueltechs}
          />
        </div>
      )}

      {/* State prices */}
      {data.price_summaries.length > 0 && (
        <StatePricesChart priceSummaries={data.price_summaries} />
      )}

      {/* Generation mix */}
      {data.generation_mix.length > 0 && (
        <GenerationMix mix={data.generation_mix} />
      )}

      <WobblyRule color={COLORS.borderLight} />
      <div style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
        {data.fetched_at
          ? `Updated ${new Date(data.fetched_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}. AEMO via OpenElectricity.`
          : "Data: AEMO via OpenElectricity."}
      </div>
    </div>
  );
}
