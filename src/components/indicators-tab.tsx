"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { COLORS } from "@/lib/design-tokens";
import { KNOWN_GEOGRAPHIES, type IndicatorWithHistory } from "@/lib/indicators/types";

const ALL = "__all__";

const SECTOR_LABELS: Record<string, string> = {
  "energy-generation": "Energy — Generation",
  "energy-storage": "Energy — Storage",
  "energy-grid": "Energy — Grid",
  "carbon-emissions": "Carbon & Emissions",
  transport: "Transport",
  industry: "Industry",
  "critical-minerals": "Critical Minerals",
  "built-environment": "Built Environment",
  agriculture: "Agriculture",
  finance: "Finance",
  policy: "Policy",
  "workforce-adaptation": "Workforce & Adaptation",
};

function formatValue(value: number | null, unit: string, valueType: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (valueType === "currency") {
    if (Math.abs(value) >= 1000) return value.toLocaleString("en-AU", { maximumFractionDigits: 0 });
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }
  if (valueType === "percent") return value.toFixed(1);
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// Map (current vs prior, direction_good) → trend tone
function trendTone(
  curr: number | null,
  prior: number | null,
  directionGood: "down" | "up" | "neutral"
): { dir: "up" | "down" | "flat"; good: "good" | "bad" | "neutral"; deltaPct: number | null } {
  if (curr === null || prior === null || prior === 0) {
    return { dir: "flat", good: "neutral", deltaPct: null };
  }
  const deltaPct = ((curr - prior) / Math.abs(prior)) * 100;
  const dir = curr > prior ? "up" : curr < prior ? "down" : "flat";
  let good: "good" | "bad" | "neutral" = "neutral";
  if (directionGood !== "neutral" && dir !== "flat") {
    good = dir === directionGood ? "good" : "bad";
  }
  return { dir, good, deltaPct };
}

function IndicatorCard({ indicator }: { indicator: IndicatorWithHistory }) {
  const { current_value, prior_value, unit, value_type, direction_good, history } = indicator;
  const trend = trendTone(current_value, prior_value, direction_good);
  const TrendIcon = trend.dir === "up" ? ArrowUp : trend.dir === "down" ? ArrowDown : Minus;
  const trendColor =
    trend.good === "good" ? COLORS.forest : trend.good === "bad" ? "#B9492B" : COLORS.inkMuted;

  const sparkData = history.map((h) => ({ date: h.observed_at, value: h.value }));

  return (
    <Card className="border-border/40 overflow-hidden h-full">
      <CardContent className="p-0">
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <p
                className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
                style={{ fontVariant: "small-caps" }}
              >
                {SECTOR_LABELS[indicator.sector] ?? indicator.sector}
              </p>
              <h3 className="font-display text-base leading-tight font-medium">{indicator.name}</h3>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
              {indicator.geography}
            </Badge>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tracking-tight tabular-nums">
              {formatValue(current_value, unit, value_type)}
            </span>
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>

          {trend.deltaPct !== null && (
            <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: trendColor }}>
              <TrendIcon className="h-3 w-3" />
              <span className="tabular-nums">
                {trend.deltaPct >= 0 ? "+" : ""}
                {trend.deltaPct.toFixed(1)}% vs prior
              </span>
            </div>
          )}
        </div>

        {sparkData.length >= 2 && (
          <div className="px-1 pb-1 opacity-70">
            <Sparkline
              data={sparkData}
              color={trend.good === "bad" ? "#B9492B" : "var(--accent-emerald)"}
              height={36}
            />
          </div>
        )}

        <div className="border-t border-border/30 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Updated {formatDate(indicator.last_updated_at)}</span>
          {indicator.last_source_url && (
            <a
              href={indicator.last_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-foreground"
            >
              Source <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectorSection({
  sector,
  indicators,
}: {
  sector: string;
  indicators: IndicatorWithHistory[];
}) {
  return (
    <section className="mb-8">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium">
          {SECTOR_LABELS[sector] ?? sector}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {indicators.length} indicator{indicators.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {indicators.map((ind) => (
          <IndicatorCard key={ind.id} indicator={ind} />
        ))}
      </div>
    </section>
  );
}

export function IndicatorsTab() {
  const [data, setData] = useState<IndicatorWithHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>(ALL);
  const [geoFilter, setGeoFilter] = useState<string>(ALL);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/indicators")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json.indicators ?? []);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sectors = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.map((d) => d.sector))).sort();
  }, [data]);

  const geographies = useMemo(() => {
    if (!data) return KNOWN_GEOGRAPHIES.slice();
    return Array.from(new Set(data.map((d) => d.geography))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as IndicatorWithHistory[];
    return data.filter((d) => {
      if (sectorFilter !== ALL && d.sector !== sectorFilter) return false;
      if (geoFilter !== ALL && d.geography !== geoFilter) return false;
      return true;
    });
  }, [data, sectorFilter, geoFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, IndicatorWithHistory[]>();
    for (const ind of filtered) {
      const arr = map.get(ind.sector) ?? [];
      arr.push(ind);
      map.set(ind.sector, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Couldn’t load indicators</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Indicators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantitative climate &amp; energy progress, tracked across sectors. Values are append-only
          with provenance — every update cites a source article or a direct scraper.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sectors</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>
                {SECTOR_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={geoFilter} onValueChange={setGeoFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All geographies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All geographies</SelectItem>
            {geographies.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground self-center tabular-nums">
          {filtered.length} of {data.length}
        </span>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No indicators match the current filters.</p>
      ) : (
        grouped.map(([sector, items]) => (
          <SectorSection key={sector} sector={sector} indicators={items} />
        ))
      )}
    </div>
  );
}

export default IndicatorsTab;
