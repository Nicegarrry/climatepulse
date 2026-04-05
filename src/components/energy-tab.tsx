"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Zap,
  Leaf,
  Factory,
  TrendingDown,
  TrendingUp,
  Minus,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import type { EnergyDashboardData } from "@/lib/energy/openelectricity";

/* ──────────────────────────────────────────────────────────────────────────
   Colour maps — keyed by API series names (energy_solar, energy_coal, etc.)
   ────────────────────────────────────────────────────────────────────────── */

const FUELTECH_COLORS: Record<string, string> = {
  energy_solar: "#F59E0B",
  energy_wind: "#3B82F6",
  energy_hydro: "#06B6D4",
  energy_coal: "#57534E",
  energy_gas: "#EF4444",
  energy_bioenergy: "#22C55E",
  energy_distillate: "#A3A3A3",
  energy_battery_discharging: "#8B5CF6",
  energy_battery_charging: "#C4B5FD",
  energy_battery: "#8B5CF6",
  energy_pumps: "#7C3AED",
};

const FUELTECH_LABELS: Record<string, string> = {
  energy_solar: "Solar",
  energy_wind: "Wind",
  energy_hydro: "Hydro",
  energy_coal: "Coal",
  energy_gas: "Gas",
  energy_bioenergy: "Bioenergy",
  energy_distillate: "Distillate",
  energy_battery_discharging: "Battery",
  energy_battery_charging: "Battery (Charge)",
  energy_battery: "Battery (Net)",
  energy_pumps: "Pumped Hydro",
};

function getFueltechColor(ft: string): string {
  return FUELTECH_COLORS[ft] ?? "#9CA3AF";
}

function getFueltechLabel(ft: string): string {
  return FUELTECH_LABELS[ft] ?? ft.replace(/^energy_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ──────────────────────────────────────────────────────────────────────────
   Sparkline component (pure CSS)
   ────────────────────────────────────────────────────────────────────────── */

function Sparkline({
  data,
  color = "var(--accent-emerald)",
  height = 40,
}: {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((d.value - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Headline stat card
   ────────────────────────────────────────────────────────────────────────── */

function HeadlineStat({
  label,
  value,
  unit,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendLabel,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  sparkData?: { date: string; value: number }[];
  sparkColor?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-status-success" : trend === "down" ? "text-status-error" : "text-muted-foreground";

  return (
    <Card className="border-border/40 overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {trendLabel && <span>{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold tracking-tight">{value}</span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          </div>
        </div>
        {sparkData && sparkData.length > 2 && (
          <div className="px-1 pb-1 opacity-60">
            <Sparkline data={sparkData} color={sparkColor} height={32} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Horizontal stacked bar
   ────────────────────────────────────────────────────────────────────────── */

function StackedBar({
  segments,
}: {
  segments: { label: string; value: number; color: string; pct: number }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-8 w-full overflow-hidden rounded-md">
        {segments.map((seg) => (
          <motion.div
            key={seg.label}
            className="relative h-full transition-all"
            style={{ width: `${Math.max(seg.pct, 0.5)}%`, backgroundColor: seg.color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(seg.pct, 0.5)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            title={`${seg.label}: ${seg.pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.filter((s) => s.pct >= 1).map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-mono font-medium">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   State bar chart
   ────────────────────────────────────────────────────────────────────────── */

function StateBar({ region, pct, maxPct }: { region: string; pct: number; maxPct: number }) {
  const barWidth = maxPct > 0 ? (pct / maxPct) * 100 : 0;
  const barColor =
    pct >= 70 ? "bg-status-success" : pct >= 40 ? "bg-accent-emerald" : pct >= 20 ? "bg-accent-amber" : "bg-status-error";

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold">{region}</span>
      <div className="flex-1">
        <div className="h-7 w-full overflow-hidden rounded bg-surface-2">
          <motion.div
            className={`h-full rounded ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(barWidth, 2)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
      <span className="w-14 text-right font-mono text-sm font-semibold">{pct}%</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Daily generation stacked chart (simplified horizontal bars per day)
   ────────────────────────────────────────────────────────────────────────── */

function DailyGenerationChart({
  data,
}: {
  data: { date: string; fueltechs: Record<string, number> }[];
}) {
  if (data.length === 0) return null;

  // Get all fueltechs across all days, sorted by total
  const totals = new Map<string, number>();
  for (const day of data) {
    for (const [ft, val] of Object.entries(day.fueltechs)) {
      totals.set(ft, (totals.get(ft) ?? 0) + val);
    }
  }
  const fueltechs = Array.from(totals.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([ft]) => ft);

  const maxDaily = Math.max(...data.map((d) => Object.values(d.fueltechs).reduce((s, v) => s + v, 0)));

  return (
    <div className="space-y-1.5">
      {data.map((day) => {
        const dayTotal = Object.values(day.fueltechs).reduce((s, v) => s + v, 0);
        return (
          <div key={day.date} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}
            </span>
            <div className="flex h-5 flex-1 overflow-hidden rounded-sm">
              {fueltechs.map((ft) => {
                const val = day.fueltechs[ft] ?? 0;
                const pct = maxDaily > 0 ? (val / maxDaily) * 100 : 0;
                if (pct < 0.3) return null;
                return (
                  <div
                    key={ft}
                    className="h-full"
                    style={{ width: `${pct}%`, backgroundColor: getFueltechColor(ft) }}
                    title={`${getFueltechLabel(ft)}: ${Math.round(val / 1000)} GWh`}
                  />
                );
              })}
            </div>
            <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
              {Math.round(dayTotal / 1000)} GWh
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────────────────────────────────── */

export function EnergyTab() {
  const [data, setData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/energy/dashboard");
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to fetch energy data");
        return;
      }
      const result: EnergyDashboardData = await res.json();
      if (result.error) {
        setError(result.error);
      }
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    await fetchData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-status-error/40" />
        <p className="text-sm text-status-error">{error}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Add OPENELECTRICITY_API_KEY to .env.local and restart the dev server.
        </p>
      </div>
    );
  }

  if (!data) return null;

  // Derive trend from sparkline data
  const renewTrend = data.renewable_pct_daily.length >= 7
    ? (() => {
        const recent = data.renewable_pct_daily.slice(-3).reduce((s, d) => s + d.value, 0) / 3;
        const older = data.renewable_pct_daily.slice(-7, -4).reduce((s, d) => s + d.value, 0) / 3;
        return recent > older + 2 ? "up" as const : recent < older - 2 ? "down" as const : "flat" as const;
      })()
    : undefined;

  const maxStatePct = Math.max(...data.state_snapshots.map((s) => s.renewable_pct), 1);

  // Build stacked bar for generation mix
  const mixSegments = data.generation_mix
    .filter((m) => m.share_pct >= 0.5)
    .map((m) => ({
      label: m.label,
      value: m.energy_gwh,
      color: m.color,
      pct: m.share_pct,
    }));

  return (
    <div className="space-y-6 p-5">
      {/* ── Header + refresh ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button onClick={refresh} disabled={refreshing} size="sm" variant="outline" className="gap-2">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          <span>NEM · Last 7 days · </span>
          <span className="font-mono">
            {new Date(data.fetched_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 px-4 py-2">
          <p className="text-xs text-status-warning">Partial data: {error}</p>
        </div>
      )}

      {/* ── Headline stats ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <HeadlineStat
          label="Renewables (7d)"
          value={String(data.renewable_pct_7d)}
          unit="%"
          icon={Leaf}
          iconColor="text-status-success"
          iconBg="bg-status-success/10"
          trend={renewTrend}
          trendLabel={`${data.renewable_pct_today}% today`}
          sparkData={data.renewable_pct_daily}
          sparkColor="var(--status-success)"
        />
        <HeadlineStat
          label="Emissions Intensity"
          value={data.emissions_intensity !== null ? String(data.emissions_intensity) : "—"}
          unit="tCO₂/MWh"
          icon={Factory}
          iconColor="text-muted-foreground"
          iconBg="bg-muted"
          sparkData={data.emissions_daily}
          sparkColor="var(--status-error)"
        />
        <HeadlineStat
          label="Total Generation"
          value={String(data.total_generation_gwh_7d)}
          unit="GWh"
          icon={Zap}
          iconColor="text-accent-amber"
          iconBg="bg-accent-amber/10"
        />
        <HeadlineStat
          label="Avg Wholesale Price"
          value={
            data.price_summaries.length > 0
              ? String(
                  Math.round(
                    data.price_summaries.reduce((s, p) => s + (p.avg_24h ?? 0), 0) /
                      data.price_summaries.filter((p) => p.avg_24h !== null).length
                  )
                )
              : "—"
          }
          unit="$/MWh"
          icon={DollarSign}
          iconColor="text-status-info"
          iconBg="bg-status-info/10"
        />
      </motion.div>

      {/* ── Generation mix ─────────────────────────────────────────── */}
      {mixSegments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Generation Mix — Last 7 Days
          </h3>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <StackedBar segments={mixSegments} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── State-by-state renewables ──────────────────────────────── */}
        {data.state_snapshots.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Renewable % by State — 7 Days
            </h3>
            <Card className="border-border/40">
              <CardContent className="space-y-2 p-4">
                {data.state_snapshots.map((s) => (
                  <StateBar key={s.region} region={s.region} pct={s.renewable_pct} maxPct={maxStatePct} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Prices by region ──────────────────────────────────────── */}
        {data.price_summaries.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Wholesale Prices — Last 24h ($/MWh)
            </h3>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {data.price_summaries.map((p) => {
                    const isHigh = (p.avg_24h ?? 0) > 100;
                    const isNeg = (p.min_24h ?? 0) < 0;
                    return (
                      <div key={p.region} className="space-y-1.5">
                        <div className="text-xs font-semibold">{p.region}</div>
                        <div className={`font-mono text-xl font-bold ${isHigh ? "text-status-error" : ""}`}>
                          {p.avg_24h !== null ? `$${Math.round(p.avg_24h)}` : "—"}
                        </div>
                        <div className="space-y-0.5 text-[10px] text-muted-foreground">
                          <div>
                            Low{" "}
                            <span className={`font-mono ${isNeg ? "text-status-success" : ""}`}>
                              ${p.min_24h !== null ? Math.round(p.min_24h) : "—"}
                            </span>
                          </div>
                          <div>
                            High{" "}
                            <span className={`font-mono ${(p.max_24h ?? 0) > 200 ? "text-status-error" : ""}`}>
                              ${p.max_24h !== null ? Math.round(p.max_24h) : "—"}
                            </span>
                          </div>
                        </div>
                        {isNeg && (
                          <Badge variant="outline" className="text-[9px] bg-status-success/10 text-status-success border-status-success/30">
                            Neg prices
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* ── Daily generation chart ─────────────────────────────────── */}
      {data.generation_daily.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Daily Generation by Source
          </h3>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <DailyGenerationChart data={data.generation_daily} />
              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/40 pt-3">
                {data.generation_mix
                  .filter((m) => m.share_pct >= 2)
                  .map((m) => (
                    <div key={m.fueltech} className="flex items-center gap-1 text-[10px]">
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-muted-foreground">{m.label}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
