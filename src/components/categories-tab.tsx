"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Loader2,
  BarChart3,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Square,
  ChevronRight,
  Layers,
  Zap,
  Globe2,
  Users,
  Sparkles,
  ArrowUpDown,
  RotateCcw,
  Play,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useDevLogger } from "@/lib/dev-logger";
import type {
  EnrichedArticle,
  TaxonomyTreeNode,
  SignalType,
  Sentiment,
} from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnrichmentStatsResponse {
  total_enriched: number;
  unenriched_count: number;
  domain_distribution: { domain: string; count: number }[];
  signal_distribution: { signal: string; count: number }[];
  sentiment_distribution: { sentiment: string; count: number }[];
  entity_count: number;
  estimated_cost_usd: number;
  significance: {
    avg: number;
    histogram: Record<string, number>;
  };
  pipeline_versions: { version: number; count: number }[];
}

interface EnrichedPaginatedResponse {
  articles: EnrichedArticle[];
  total: number;
  page: number;
  limit: number;
}

interface RunProgress {
  batchesDone: number;
  totalBatches: number;
  articlesProcessed: number;
  totalArticles: number;
  errors: number;
  totalCost: number;
  totalDuration: number;
  entitiesCreated: number;
  entitiesMatched: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SIGNAL_COLORS: Record<SignalType, string> = {
  market_move: "bg-blue-500",
  policy_change: "bg-amber-500",
  project_milestone: "bg-emerald-500",
  corporate_action: "bg-purple-500",
  data_release: "bg-cyan-500",
  enforcement: "bg-red-500",
  personnel: "bg-slate-500",
  technology_advance: "bg-indigo-500",
  international: "bg-orange-500",
  community_social: "bg-pink-500",
};

const SIGNAL_BADGE_COLORS: Record<SignalType, string> = {
  market_move: "bg-blue-500/10 text-blue-500",
  policy_change: "bg-amber-500/10 text-amber-500",
  project_milestone: "bg-emerald-500/10 text-emerald-500",
  corporate_action: "bg-purple-500/10 text-purple-500",
  data_release: "bg-cyan-500/10 text-cyan-500",
  enforcement: "bg-red-500/10 text-red-500",
  personnel: "bg-slate-500/10 text-slate-500",
  technology_advance: "bg-indigo-500/10 text-indigo-500",
  international: "bg-orange-500/10 text-orange-500",
  community_social: "bg-pink-500/10 text-pink-500",
};

const SENTIMENT_BADGE_COLORS: Record<Sentiment, string> = {
  positive: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  negative: "bg-red-500/10 text-red-600 border-red-500/20",
  neutral: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  mixed: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  neutral: "bg-gray-400",
  mixed: "bg-amber-500",
};

const SIGNIFICANCE_BUCKET_COLORS: Record<string, string> = {
  "0-20": "bg-gray-300 dark:bg-gray-600",
  "20-40": "bg-blue-300 dark:bg-blue-600",
  "40-60": "bg-amber-400 dark:bg-amber-500",
  "60-80": "bg-orange-500",
  "80-100": "bg-red-500",
};

function formatSignalType(signal: string | null | undefined): string {
  if (!signal) return "Unknown";
  return signal
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function significanceColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-red-500 font-bold";
  if (score >= 60) return "text-orange-500 font-semibold";
  if (score >= 40) return "text-amber-500 font-medium";
  if (score >= 20) return "text-blue-500";
  return "text-gray-400";
}

function significanceBg(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-red-500";
  if (score >= 60) return "bg-orange-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-blue-400";
  return "bg-gray-300 dark:bg-gray-600";
}

type SortMode = "date" | "significance";

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function CategoriesTab() {
  const { log } = useDevLogger();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<EnrichmentStatsResponse | null>(null);
  const [treeData, setTreeData] = useState<TaxonomyTreeNode[]>([]);
  const [articles, setArticles] = useState<EnrichedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<string>("__all__");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("__all__");
  const [sortMode, setSortMode] = useState<SortMode>("significance");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [articlesLoading, setArticlesLoading] = useState(false);

  // ── Sidebar state ───────────────────────────────────────────────────────────
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [selectedSector, setSelectedSector] = useState<number | null>(null);

  // ── Run state ───────────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [completedRun, setCompletedRun] = useState<RunProgress | null>(null);
  const cancelRef = useRef(false);

  // ── Microsector lookup ─────────────────────────────────────────────────────
  const microsectorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const node of treeData) {
      for (const s of node.sectors) {
        for (const ms of s.microsectors) {
          map.set(ms.id, ms.name);
        }
      }
    }
    return map;
  }, [treeData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Data fetching
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/enrichment/stats");
      if (!res.ok) return;
      setStats(await res.json());
    } catch (err) {
      log("warn", "Failed to fetch enrichment stats", err);
    }
  }, [log]);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/taxonomy/tree");
      if (!res.ok) return;
      const json = await res.json();
      const rawDomains = json.domains ?? json;
      const domains: TaxonomyTreeNode[] = rawDomains.map((d: any) => ({
        domain: {
          id: d.id,
          slug: d.slug,
          name: d.name,
          description: d.description,
          sort_order: d.sort_order,
          article_count: d.article_count ?? 0,
        },
        sectors: (d.sectors ?? []).map((s: any) => ({
          sector: {
            id: s.id,
            domain_id: d.id,
            slug: s.slug,
            name: s.name,
            description: s.description,
            sort_order: s.sort_order,
            article_count: s.article_count ?? 0,
          },
          microsectors: (s.microsectors ?? []).map((m: any) => ({
            id: m.id,
            sector_id: s.id,
            slug: m.slug,
            name: m.name,
            description: m.description,
            keywords: m.keywords ?? [],
            sort_order: m.sort_order,
            article_count: m.article_count ?? 0,
          })),
        })),
      }));
      setTreeData(domains);
    } catch (err) {
      log("warn", "Failed to fetch taxonomy tree", err);
    }
  }, [log]);

  const fetchArticles = useCallback(
    async (
      domain?: string | null,
      signal?: string,
      sentiment?: string,
      sort?: SortMode,
      pageNum: number = 1,
    ) => {
      setArticlesLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageNum));
        params.set("limit", "50");
        if (domain) params.set("domain", domain);
        if (signal && signal !== "__all__") params.set("signal_type", signal);
        if (sentiment && sentiment !== "__all__") params.set("sentiment", sentiment);
        if (sort === "significance") params.set("sort", "significance");
        const res = await fetch(`/api/enrichment/results?${params}`);
        if (!res.ok) throw new Error("Failed to fetch articles");
        const data: EnrichedPaginatedResponse = await res.json();
        setArticles(data.articles ?? []);
        setTotalPages(Math.ceil((data.total ?? 0) / (data.limit ?? 50)));
        setTotalArticles(data.total ?? 0);
        setPage(data.page ?? 1);
      } catch (err) {
        log("error", "Failed to fetch articles", err);
      } finally {
        setArticlesLoading(false);
      }
    },
    [log],
  );

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      await Promise.all([fetchStats(), fetchTree(), fetchArticles(null, "__all__", "__all__", "significance")]);
      setLoading(false);
    }
    init();
  }, [fetchStats, fetchTree, fetchArticles]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Enrichment run
  // ═══════════════════════════════════════════════════════════════════════════

  async function runEnrichment(reenrich = false) {
    setIsRunning(true);
    setCompletedRun(null);
    setError(null);
    cancelRef.current = false;

    const currentStats = await fetch("/api/enrichment/stats").then((r) => r.json());
    const totalToProcess = reenrich
      ? currentStats.total_enriched + currentStats.unenriched_count
      : currentStats.unenriched_count;

    if (totalToProcess === 0) {
      setIsRunning(false);
      setError("All articles are already enriched.");
      return;
    }

    const totalBatches = Math.ceil(totalToProcess / 5);
    const prog: RunProgress = {
      batchesDone: 0,
      totalBatches,
      articlesProcessed: 0,
      totalArticles: totalToProcess,
      errors: 0,
      totalCost: 0,
      totalDuration: 0,
      entitiesCreated: 0,
      entitiesMatched: 0,
    };
    setProgress({ ...prog });

    const queryParam = reenrich ? "?reenrich=true" : "";
    let done = false;
    while (!done && !cancelRef.current) {
      try {
        const res = await fetch(`/api/enrichment/run${queryParam}`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json();
          setError(body.error || "Enrichment failed");
          break;
        }
        const batch = await res.json();

        prog.batchesDone++;
        prog.articlesProcessed += batch.articles_processed;
        prog.errors += batch.errors;
        prog.totalCost += batch.estimated_cost_usd;
        prog.totalDuration += batch.duration_ms;
        prog.entitiesCreated += batch.entities_created ?? 0;
        prog.entitiesMatched += batch.entities_matched ?? 0;
        prog.totalBatches = prog.batchesDone + batch.total_batches_remaining;
        prog.totalArticles = prog.articlesProcessed + batch.total_remaining;

        setProgress({ ...prog });
        done = batch.done;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        break;
      }
    }

    if (cancelRef.current) setError("Enrichment stopped by user.");

    setCompletedRun({ ...prog });
    setProgress(null);
    setIsRunning(false);
    await Promise.all([
      fetchStats(),
      fetchTree(),
      fetchArticles(selectedDomain, selectedSignal, selectedSentiment, sortMode),
    ]);
    log("info", `Enrichment complete: ${prog.articlesProcessed} articles`, prog);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function selectDomain(slug: string | null) {
    setSelectedDomain(slug);
    setSelectedSector(null);
    setPage(1);
    await fetchArticles(slug, selectedSignal, selectedSentiment, sortMode, 1);
  }

  async function selectSectorFilter(sectorId: number | null, domainSlug: string) {
    setSelectedSector(sectorId);
    setSelectedDomain(domainSlug);
    setPage(1);
    await fetchArticles(domainSlug, selectedSignal, selectedSentiment, sortMode, 1);
  }

  async function handleSignalChange(value: string) {
    setSelectedSignal(value);
    setPage(1);
    await fetchArticles(selectedDomain, value, selectedSentiment, sortMode, 1);
  }

  async function handleSentimentChange(value: string) {
    setSelectedSentiment(value);
    setPage(1);
    await fetchArticles(selectedDomain, selectedSignal, value, sortMode, 1);
  }

  async function handleSortChange(value: string) {
    const mode = value as SortMode;
    setSortMode(mode);
    setPage(1);
    await fetchArticles(selectedDomain, selectedSignal, selectedSentiment, mode, 1);
  }

  async function handlePageChange(newPage: number) {
    await fetchArticles(selectedDomain, selectedSignal, selectedSentiment, sortMode, newPage);
  }

  function toggleDomainExpand(slug: string) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  // ── Client-side sector filter ──────────────────────────────────────────────
  const filteredArticles = useMemo(() => {
    if (selectedSector === null) return articles;
    const sectorMicrosectorIds = new Set<number>();
    for (const node of treeData) {
      for (const s of node.sectors) {
        if (s.sector.id === selectedSector) {
          for (const ms of s.microsectors) sectorMicrosectorIds.add(ms.id);
        }
      }
    }
    return articles.filter((a) =>
      a.microsector_ids.some((mid) => sectorMicrosectorIds.has(mid)),
    );
  }, [articles, selectedSector, treeData]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const domainBarMax = treeData.length
    ? Math.max(...treeData.map((n) => n.domain.article_count ?? 0), 1)
    : 1;

  const progressPct = progress
    ? Math.round((progress.articlesProcessed / Math.max(progress.totalArticles, 1)) * 100)
    : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {/* ── Stats cards ──────────────────────────────────────────────── */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Enriched"
            value={stats.total_enriched}
            icon={<Layers className="h-4 w-4 text-indigo-500" />}
            sub={stats.unenriched_count > 0 ? `${stats.unenriched_count} pending` : "all done"}
          />
          <StatCard
            label="Avg. Significance"
            value={stats.significance.avg.toFixed(1)}
            icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
            sub="out of 100"
          />
          <StatCard
            label="Entities"
            value={stats.entity_count}
            icon={<Users className="h-4 w-4 text-purple-500" />}
            sub="discovered"
          />
          <StatCard
            label="Domains"
            value={stats.domain_distribution.length}
            icon={<Activity className="h-4 w-4 text-emerald-500" />}
            sub={`${stats.signal_distribution.length} signal types`}
          />
          <StatCard
            label="Total Cost"
            value={`$${stats.estimated_cost_usd.toFixed(4)}`}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            sub={stats.pipeline_versions.map((v) => `v${v.version}: ${v.count}`).join(", ") || "—"}
          />
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {!isRunning ? (
          <>
            <Button
              size="sm"
              onClick={() => runEnrichment(false)}
              disabled={isRunning || (stats?.unenriched_count ?? 0) === 0}
              className="gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              Run Enrichment
              {(stats?.unenriched_count ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {stats?.unenriched_count}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runEnrichment(true)}
              disabled={isRunning || (stats?.total_enriched ?? 0) === 0}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-enrich All
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { cancelRef.current = true; }}
            className="gap-2"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            fetchStats();
            fetchTree();
            fetchArticles(selectedDomain, selectedSignal, selectedSentiment, sortMode, page);
          }}
          className="gap-2 text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      {progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              <span>
                Batch <span className="font-medium">{progress.batchesDone}</span>/{progress.totalBatches}
                {" — "}
                <span className="font-medium text-indigo-500">{progress.articlesProcessed}</span>
                {" of "}{progress.totalArticles} articles
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="font-mono">{progressPct}%</span>
              {progress.entitiesCreated > 0 && (
                <span>{progress.entitiesCreated} new entities</span>
              )}
              {progress.errors > 0 && (
                <span className="text-status-error">{progress.errors} errors</span>
              )}
              <span className="font-mono">${progress.totalCost.toFixed(4)}</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{(progress.totalDuration / 1000).toFixed(1)}s elapsed</span>
            <span>
              Stage 1 → Stage 2 pipeline
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Completed banner ──────────────────────────────────────────── */}
      {completedRun && !isRunning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-emerald/30 bg-accent-emerald/5 px-4 py-3 text-xs"
        >
          <CheckCircle2 className="h-4 w-4 text-accent-emerald" />
          <span>
            Enriched <span className="font-medium">{completedRun.articlesProcessed}</span> articles
            in {completedRun.batchesDone} batches
            ({(completedRun.totalDuration / 1000).toFixed(1)}s)
          </span>
          <span className="text-muted-foreground">·</span>
          <span>{completedRun.entitiesCreated} entities created, {completedRun.entitiesMatched} matched</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">${completedRun.totalCost.toFixed(4)}</span>
          {completedRun.errors > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-status-error">{completedRun.errors} errors</span>
            </>
          )}
        </motion.div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-status-error/30 bg-status-error/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-status-error" />
          <p className="text-sm text-status-error">{error}</p>
        </div>
      )}

      {/* ── Distribution charts ───────────────────────────────────────── */}
      {stats && stats.total_enriched > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Signal type distribution */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Signal Types
              </h4>
              <div className="space-y-1.5">
                {stats.signal_distribution.map((s) => {
                  const pct = (s.count / stats.total_enriched) * 100;
                  const color = SIGNAL_COLORS[s.signal as SignalType] ?? "bg-gray-400";
                  return (
                    <button
                      key={s.signal}
                      onClick={() => handleSignalChange(selectedSignal === s.signal ? "__all__" : s.signal)}
                      className={`group flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-2 ${
                        selectedSignal === s.signal ? "bg-surface-2" : ""
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                      <span className="flex-1 truncate text-[11px]">{formatSignalType(s.signal)}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{s.count}</span>
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sentiment distribution */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Sentiment
              </h4>
              <div className="space-y-2">
                {stats.sentiment_distribution.map((s) => {
                  const pct = (s.count / stats.total_enriched) * 100;
                  const color = SENTIMENT_COLORS[s.sentiment] ?? "bg-gray-400";
                  return (
                    <button
                      key={s.sentiment}
                      onClick={() => handleSentimentChange(selectedSentiment === s.sentiment ? "__all__" : s.sentiment)}
                      className={`group flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-2 ${
                        selectedSentiment === s.sentiment ? "bg-surface-2" : ""
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                      <span className="flex-1 text-[11px] capitalize">{s.sentiment}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{s.count}</span>
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                    </button>
                  );
                })}
              </div>

              {/* Sentiment bar */}
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
                {stats.sentiment_distribution.map((s) => {
                  const pct = (s.count / stats.total_enriched) * 100;
                  const color = SENTIMENT_COLORS[s.sentiment] ?? "bg-gray-400";
                  return (
                    <div key={s.sentiment} className={`${color} transition-all`} style={{ width: `${pct}%` }} />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Significance histogram */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Significance Distribution
              </h4>
              {stats.significance && (
                <>
                  <div className="flex items-end gap-1 h-24">
                    {Object.entries(stats.significance.histogram).map(([bucket, count]) => {
                      const maxBucket = Math.max(...Object.values(stats.significance.histogram), 1);
                      const heightPct = (count / maxBucket) * 100;
                      const color = SIGNIFICANCE_BUCKET_COLORS[bucket] ?? "bg-gray-400";
                      return (
                        <div key={bucket} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[9px] font-mono text-muted-foreground">{count}</span>
                          <div className="w-full rounded-t" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                            <div className={`h-full w-full rounded-t ${color}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-1">
                    {Object.keys(stats.significance.histogram).map((bucket) => (
                      <div key={bucket} className="flex-1 text-center text-[9px] text-muted-foreground">
                        {bucket}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-center text-[11px] text-muted-foreground">
                    Average: <span className={significanceColor(stats.significance.avg)}>{stats.significance.avg.toFixed(1)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Domain distribution ────────────────────────────────────────── */}
      {treeData.some((n) => (n.domain.article_count ?? 0) > 0) && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Domain Distribution
          </h3>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="space-y-1.5">
                {treeData
                  .filter((n) => (n.domain.article_count ?? 0) > 0)
                  .sort((a, b) => (b.domain.article_count ?? 0) - (a.domain.article_count ?? 0))
                  .map((node) => {
                    const count = node.domain.article_count ?? 0;
                    const pct = (count / domainBarMax) * 100;
                    return (
                      <button
                        key={node.domain.slug}
                        onClick={() => selectDomain(selectedDomain === node.domain.slug ? null : node.domain.slug)}
                        className={`group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2 ${
                          selectedDomain === node.domain.slug ? "bg-surface-2" : ""
                        }`}
                      >
                        <span className="w-44 shrink-0 truncate text-xs font-medium">{node.domain.name}</span>
                        <div className="flex-1">
                          <div className="h-4 w-full rounded-sm bg-surface-2">
                            <div
                              className="h-full rounded-sm bg-indigo-500/70 transition-all duration-300"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-8 text-right font-mono text-xs text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Article browser ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {selectedDomain
              ? `${treeData.find((n) => n.domain.slug === selectedDomain)?.domain.name ?? selectedDomain}${
                  selectedSector !== null
                    ? ` / ${treeData.flatMap((n) => n.sectors).find((s) => s.sector.id === selectedSector)?.sector.name ?? ""}`
                    : ""
                } (${filteredArticles.length})`
              : `All Enriched Articles (${totalArticles})`}
          </h3>

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Select value={selectedSignal} onValueChange={handleSignalChange}>
              <SelectTrigger className="h-7 w-[150px] text-[11px]">
                <SelectValue placeholder="Signal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Signals</SelectItem>
                {(stats?.signal_distribution ?? []).map((s) => (
                  <SelectItem key={s.signal} value={s.signal}>
                    {formatSignalType(s.signal)} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSentiment} onValueChange={handleSentimentChange}>
              <SelectTrigger className="h-7 w-[120px] text-[11px]">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sentiment</SelectItem>
                {(stats?.sentiment_distribution ?? []).map((s) => (
                  <SelectItem key={s.sentiment} value={s.sentiment}>
                    <span className="capitalize">{s.sentiment}</span> ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortMode} onValueChange={handleSortChange}>
              <SelectTrigger className="h-7 w-[140px] text-[11px]">
                <ArrowUpDown className="mr-1 h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="significance">By Significance</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(selectedDomain || selectedSector !== null) && (
          <Button variant="ghost" size="sm" onClick={() => selectDomain(null)} className="mb-3 text-xs">
            ← Show all domains
          </Button>
        )}

        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          {/* Left: domain > sector hierarchy */}
          <Card className="border-border/40 hidden lg:block">
            <CardContent className="p-2">
              <div className="space-y-0.5">
                <button
                  onClick={() => selectDomain(null)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                    selectedDomain === null && selectedSector === null ? "bg-surface-2 font-medium" : ""
                  }`}
                >
                  <span>All</span>
                  <span className="font-mono text-muted-foreground">{stats?.total_enriched ?? 0}</span>
                </button>

                {treeData.map((node) => {
                  const isExpanded = expandedDomains.has(node.domain.slug);
                  const isDomainSelected = selectedDomain === node.domain.slug && selectedSector === null;
                  return (
                    <div key={node.domain.slug}>
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleDomainExpand(node.domain.slug)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                        <button
                          onClick={() => selectDomain(isDomainSelected ? null : node.domain.slug)}
                          className={`flex flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                            isDomainSelected ? "bg-surface-2 font-medium" : ""
                          }`}
                        >
                          <span className="truncate">{node.domain.name}</span>
                          <span className="ml-2 shrink-0 font-mono text-muted-foreground">{node.domain.article_count ?? 0}</span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="ml-5 space-y-0.5">
                          {node.sectors.map((s) => {
                            const isSectorSelected = selectedSector === s.sector.id;
                            return (
                              <button
                                key={s.sector.id}
                                onClick={() => selectSectorFilter(isSectorSelected ? null : s.sector.id, node.domain.slug)}
                                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-surface-2 ${
                                  isSectorSelected ? "bg-surface-2 font-medium" : "text-muted-foreground"
                                }`}
                              >
                                <span className="truncate">{s.sector.name}</span>
                                <span className="ml-2 shrink-0 font-mono">{s.sector.article_count ?? 0}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right: article list */}
          <div className="space-y-2">
            {articlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {(stats?.total_enriched ?? 0) === 0
                    ? 'No articles enriched yet. Click "Run Enrichment" to start.'
                    : "No articles match the current filters."}
                </p>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  microsectorMap={microsectorMap}
                />
              ))
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub: string;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold tracking-tight">{value}</p>
          <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ArticleCard({
  article,
  microsectorMap,
}: {
  article: EnrichedArticle;
  microsectorMap: Map<number, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border/40 transition-colors hover:border-border">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Significance score pill */}
          {article.significance_composite !== null && (
            <div className="flex flex-col items-center gap-0.5 pt-0.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${significanceBg(article.significance_composite)}`}
              >
                {Math.round(article.significance_composite)}
              </div>
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground">score</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Title */}
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium leading-snug hover:text-primary hover:underline"
            >
              {article.title}
              <ExternalLink className="ml-1 inline h-3 w-3 opacity-40" />
            </a>

            {/* Source + date + domain */}
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{article.source_name}</span>
              {article.published_at && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(article.published_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
              {article.primary_domain && (
                <>
                  <span>·</span>
                  <span className="font-medium capitalize">
                    {article.primary_domain.replace(/-/g, " ")}
                  </span>
                </>
              )}
              {article.context_quality && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="text-[9px] py-0 h-4">
                    {article.context_quality.replace("_", " ")}
                  </Badge>
                </>
              )}
            </div>

            {/* Badges row */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(article.microsector_names ?? article.microsector_ids.map((mid) => microsectorMap.get(mid) ?? `#${mid}`)).map(
                (name, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                    {name}
                  </Badge>
                ),
              )}

              {article.signal_type && (
                <Badge variant="outline" className={`text-[10px] font-semibold ${SIGNAL_BADGE_COLORS[article.signal_type] ?? ""}`}>
                  {formatSignalType(article.signal_type)}
                </Badge>
              )}

              <Badge variant="outline" className={`text-[10px] ${SENTIMENT_BADGE_COLORS[article.sentiment] ?? ""}`}>
                {article.sentiment}
              </Badge>

              {article.jurisdictions.length > 0 &&
                article.jurisdictions.map((code) => (
                  <Badge key={code} variant="outline" className="text-[10px] bg-slate-500/10 text-slate-600 border-slate-500/20 font-mono">
                    <Globe2 className="mr-0.5 h-2.5 w-2.5" />
                    {code}
                  </Badge>
                ))}
            </div>

            {/* Entity mentions */}
            {article.entities && article.entities.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {article.entities.map((ent) => (
                  <Badge key={ent.id} variant="outline" className={`text-[9px] ${ent.role === "subject" ? "bg-purple-500/10 text-purple-700 border-purple-500/25" : "bg-purple-500/5 text-purple-600 border-purple-500/15"}`}>
                    {ent.name}
                    <span className="ml-0.5 opacity-50">({ent.type}{ent.role === "subject" ? " \u2022 subject" : ""})</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Snippet */}
            {article.snippet && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">{article.snippet}</p>
            )}

            {/* Expandable significance breakdown */}
            {article.significance_scores && (
              <div className="mt-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
                  Significance breakdown
                </button>
                {expanded && (
                  <div className="mt-2 grid gap-1.5 rounded-md border border-border/40 bg-surface-2/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(article.significance_scores).map(([factor, data]) => (
                      <div key={factor} className="text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="capitalize text-muted-foreground">{factor.replace(/_/g, " ")}</span>
                          <span className={`font-mono font-medium ${significanceColor(data.score * 10)}`}>
                            {data.score}/10
                          </span>
                        </div>
                        <p className="mt-0.5 text-[9px] text-muted-foreground/70 line-clamp-2">{data.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quantitative data */}
            {article.quantitative_data?.primary_metric && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span className="font-medium">
                  {article.quantitative_data.primary_metric.value} {article.quantitative_data.primary_metric.unit}
                </span>
                <span>{article.quantitative_data.primary_metric.context}</span>
                {article.quantitative_data.delta && (
                  <span className="font-mono">
                    ({article.quantitative_data.delta.value}{article.quantitative_data.delta.unit} over {article.quantitative_data.delta.period})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
