"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LineChart,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from "lucide-react";

// ─── Local types (match API responses) ────────────────────────────────────

interface TickerData {
  ticker: string;
  company_name: string;
  sub_sector: string;
  last_price: number | null;
  close_price?: number | null;
  change_percent: number | null;
  change_price: number | null;
  volume: number | null;
  day_high: number | null;
  day_low: number | null;
}

interface Announcement {
  id: number;
  ticker: string;
  title: string;
  pdf_url: string | null;
  released_at: string;
  is_market_sensitive: boolean;
}

// ─── Sub-sector config ────────────────────────────────────────────────────

const SECTOR_TABS = [
  { value: "all", label: "All" },
  { value: "utilities", label: "Utilities" },
  { value: "oil_gas", label: "Oil & Gas" },
  { value: "minerals", label: "Minerals" },
  { value: "renewables", label: "Renewables" },
  { value: "etfs", label: "ETFs" },
  { value: "infrastructure", label: "Infra" },
];

const ETF_TICKERS = ["CLNE", "ERTH", "ETHI", "ACDC"];

// ─── Mini Sparkline ───────────────────────────────────────────────────────

function MiniSparkline({
  data,
  width = 80,
  height = 24,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`
    )
    .join(" ");
  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "var(--status-success)" : "var(--status-error)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

// ─── Price Change Display ─────────────────────────────────────────────────

function PriceChange({ percent }: { percent: number | string | null }) {
  if (percent == null) return <span className="text-xs text-muted-foreground">—</span>;
  const val = typeof percent === "string" ? parseFloat(percent) : percent;
  if (isNaN(val)) return <span className="text-xs text-muted-foreground">—</span>;
  const isUp = val >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 font-mono text-xs font-medium ${
        isUp ? "text-status-success" : "text-status-error"
      }`}
    >
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(val).toFixed(1)}%
    </span>
  );
}

// ─── Index Strip ──────────────────────────────────────────────────────────

function IndexStrip({ tickers }: { tickers: TickerData[] }) {
  const etfs = tickers.filter((t) => ETF_TICKERS.includes(t.ticker));
  if (etfs.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {etfs.map((etf) => (
        <div
          key={etf.ticker}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-surface-2/60 px-3 py-2"
        >
          <span className="font-mono text-xs font-bold text-foreground">{etf.ticker}</span>
          {(etf.last_price ?? etf.close_price) != null && (
            <span className="font-mono text-xs text-muted-foreground">
              ${Number(etf.last_price ?? etf.close_price).toFixed(2)}
            </span>
          )}
          <PriceChange percent={etf.change_percent} />
        </div>
      ))}
    </div>
  );
}

// ─── Announcement Card ────────────────────────────────────────────────────

function AnnouncementCard({
  announcement,
  index,
}: {
  announcement: Announcement;
  index: number;
}) {
  const time = new Date(announcement.released_at).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
      className="rounded-xl bg-card ring-1 ring-border-subtle p-4"
    >
      <div className="flex items-start gap-3">
        <Badge
          variant="secondary"
          className="shrink-0 font-mono text-[11px] font-bold text-accent-emerald"
        >
          {announcement.ticker}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-foreground">
            {announcement.title}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{time}</span>
            {announcement.is_market_sensitive && (
              <Badge variant="outline" className="h-4 border-accent-amber/30 px-1.5 text-[9px] text-accent-amber">
                Sensitive
              </Badge>
            )}
            {announcement.pdf_url && (
              <a
                href={announcement.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-emerald hover:underline"
              >
                <FileText className="h-3 w-3" />
                ASX PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Watchlist Row ────────────────────────────────────────────────────────

function WatchlistRow({
  ticker,
  sparklineData,
}: {
  ticker: TickerData;
  sparklineData: number[];
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-0">
      <span className="w-12 shrink-0 font-mono text-xs font-bold text-accent-emerald">
        {ticker.ticker}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {ticker.company_name}
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-sm font-medium text-foreground">
        {(ticker.last_price ?? ticker.close_price) != null
          ? `$${Number(ticker.last_price ?? ticker.close_price).toFixed(2)}`
          : "—"}
      </span>
      <div className="w-14 shrink-0 text-right">
        <PriceChange percent={ticker.change_percent} />
      </div>
      <MiniSparkline data={sparklineData} width={64} height={20} />
    </div>
  );
}

// ─── Sector Movers ────────────────────────────────────────────────────────

function SectorMovers({ tickers }: { tickers: TickerData[] }) {
  const movers = [...tickers]
    .filter((t) => t.change_percent != null)
    .sort((a, b) => Math.abs(Number(b.change_percent)) - Math.abs(Number(a.change_percent)))
    .slice(0, 5);

  if (movers.length === 0) return null;

  return (
    <div className="space-y-2">
      {movers.map((m, i) => (
        <div key={m.ticker} className="flex items-center gap-3">
          <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
          <Badge variant="secondary" className="shrink-0 font-mono text-[10px] font-bold">
            {m.ticker}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {m.company_name}
          </span>
          <PriceChange percent={m.change_percent} />
        </div>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────

function MarketsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 w-40" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
      <Skeleton className="h-4 w-32" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function MarketsEmpty({
  onFetch,
  fetching,
}: {
  onFetch: () => void;
  fetching: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-emerald/10">
        <LineChart className="h-7 w-7 text-accent-emerald" />
      </div>
      <h3 className="font-display text-lg font-semibold">ASX Energy Watchlist</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Fetch ASX announcements and price data to populate the energy markets watchlist.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onFetch} disabled={fetching}>
        {fetching ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
        )}
        {fetching ? "Fetching..." : "Fetch Market Data"}
      </Button>
    </div>
  );
}

// ─── Main Markets Tab ─────────────────────────────────────────────────────

export function MarketsTab() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [activeSector, setActiveSector] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tickerRes, annRes] = await Promise.allSettled([
        fetch("/api/markets/tickers"),
        fetch("/api/markets/announcements?hours=24"),
      ]);

      if (tickerRes.status === "fulfilled" && tickerRes.value.ok) {
        const data = await tickerRes.value.json();
        const rows = data.tickers ?? data;
        if (Array.isArray(rows)) {
          setTickers(rows);
        }
      }

      if (annRes.status === "fulfilled" && annRes.value.ok) {
        const data = await annRes.value.json();
        const rows = data.announcements ?? data;
        if (Array.isArray(rows)) {
          setAnnouncements(rows);
        }
      }
    } catch (err) {
      console.error("[MarketsTab] loadData error:", err);
    }
    setLoading(false);
  }, []);

  // Lazy-load sparklines after tickers load
  useEffect(() => {
    if (tickers.length === 0) return;
    const toFetch = tickers.slice(0, 10); // only first 10 for perf
    toFetch.forEach(async (t) => {
      try {
        const res = await fetch(`/api/markets/sparkline/${t.ticker}`);
        if (res.ok) {
          const data = await res.json();
          const points = data.sparkline ?? data;
          if (Array.isArray(points)) {
            setSparklines((prev) => ({ ...prev, [t.ticker]: points }));
          }
        }
      } catch {
        // ignore
      }
    });
  }, [tickers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFetch = async () => {
    setFetching(true);
    try {
      await Promise.all([
        fetch("/api/markets/announcements/fetch", { method: "POST" }),
        fetch("/api/markets/prices/fetch", { method: "POST" }),
      ]);
      await loadData();
    } catch {
      // ignore
    }
    setFetching(false);
  };

  if (loading) return <MarketsSkeleton />;
  if (tickers.length === 0 && announcements.length === 0) {
    return <MarketsEmpty onFetch={handleFetch} fetching={fetching} />;
  }

  const filteredTickers =
    activeSector === "all"
      ? tickers
      : tickers.filter((t) => t.sub_sector === activeSector);

  return (
    <div className="p-4 sm:p-6">
      {/* Index Strip */}
      <IndexStrip tickers={tickers} />

      {/* Toolbar */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={handleFetch}
          disabled={fetching}
        >
          {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {fetching ? "Fetching..." : "Refresh"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {tickers.length} tickers &middot; {announcements.length} announcements (24h)
        </span>
      </div>

      {/* Latest Announcements */}
      {announcements.length > 0 && (
        <>
          <SectionLabel>Latest Announcements</SectionLabel>
          <div className="space-y-3">
            {announcements.slice(0, 10).map((ann, i) => (
              <AnnouncementCard key={ann.id} announcement={ann} index={i} />
            ))}
          </div>
        </>
      )}

      {/* Watchlist */}
      <SectionLabel>Watchlist</SectionLabel>
      <div className="mb-3 flex flex-wrap gap-1">
        {SECTOR_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveSector(tab.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeSector === tab.value
                ? "bg-accent-emerald/10 text-accent-emerald"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Card className="border-border/40">
        <CardContent className="p-3">
          {filteredTickers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tickers in this sector
            </p>
          ) : (
            filteredTickers.map((t) => (
              <WatchlistRow
                key={t.ticker}
                ticker={t}
                sparklineData={sparklines[t.ticker] ?? []}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Sector Movers */}
      <SectionLabel>Sector Movers</SectionLabel>
      <Card className="border-border/40">
        <CardContent className="p-4">
          <SectorMovers tickers={tickers} />
          {tickers.filter((t) => t.change_percent != null).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No price data yet — fetch prices to see movers
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
