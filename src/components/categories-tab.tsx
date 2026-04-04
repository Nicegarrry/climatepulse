"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Tag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TAXONOMY } from "@/lib/taxonomy";
import type { CategorisedArticle, CategoryStats } from "@/lib/types";
import type { BatchResult } from "@/lib/categorise/engine";

interface SourceOption {
  source_name: string;
  count: number;
}

interface PaginatedResponse {
  articles: CategorisedArticle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const THEME_BAR_COLORS: Record<string, string> = {
  energy: "bg-status-info",
  nature: "bg-status-success",
  policy: "bg-accent-amber",
  tech: "bg-chart-1",
};

const THEME_BADGE_COLORS: Record<string, string> = {
  energy: "bg-status-info/15 text-status-info border-status-info/30",
  nature: "bg-status-success/15 text-status-success border-status-success/30",
  policy: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  tech: "bg-chart-1/15 text-chart-1 border-chart-1/30",
};

function getCategoryMeta(id: string) {
  return TAXONOMY.find((c) => c.id === id);
}

interface RunProgress {
  batchesDone: number;
  totalBatches: number;
  articlesProcessed: number;
  totalArticles: number;
  errors: number;
  totalCost: number;
  totalDuration: number;
}

export function CategoriesTab() {
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [articles, setArticles] = useState<CategorisedArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>("__all__");
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [expandedFullText, setExpandedFullText] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [completedRun, setCompletedRun] = useState<RunProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/phase2a/stats");
    setStats(await res.json());
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/phase2a/sources");
      const data: SourceOption[] = await res.json();
      setSources(data);
    } catch {
      // Sources filter is non-critical
    }
  }, []);

  const fetchArticles = useCallback(
    async (category?: string, source?: string, pageNum: number = 1) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (source && source !== "__all__") params.set("source", source);
      params.set("page", String(pageNum));
      params.set("limit", "50");
      const res = await fetch(`/api/phase2a/results?${params}`);
      const data: PaginatedResponse = await res.json();
      setArticles(data.articles);
      setTotalPages(data.pagination.total_pages);
      setTotalArticles(data.pagination.total);
      setPage(data.pagination.page);
    },
    []
  );

  useEffect(() => {
    Promise.all([fetchStats(), fetchArticles(), fetchSources()]).then(() =>
      setLoading(false)
    );
  }, [fetchStats, fetchArticles, fetchSources]);

  async function selectCategory(id: string | null) {
    setSelectedCategory(id);
    setPage(1);
    setExpandedFullText(new Set());
    await fetchArticles(id ?? undefined, selectedSource, 1);
  }

  async function handleSourceChange(value: string) {
    setSelectedSource(value);
    setPage(1);
    setExpandedFullText(new Set());
    await fetchArticles(
      selectedCategory ?? undefined,
      value,
      1
    );
  }

  async function handlePageChange(newPage: number) {
    setExpandedFullText(new Set());
    await fetchArticles(
      selectedCategory ?? undefined,
      selectedSource,
      newPage
    );
  }

  function toggleFullText(articleId: string) {
    setExpandedFullText((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  }

  async function runCategorisation() {
    setIsRunning(true);
    setCompletedRun(null);
    setError(null);
    cancelRef.current = false;

    // First, get the count of uncategorised to know total
    const statsRes = await fetch("/api/phase2a/stats");
    const currentStats: CategoryStats = await statsRes.json();
    const totalToProcess = currentStats.uncategorised_count;

    if (totalToProcess === 0) {
      setIsRunning(false);
      setError("All articles are already categorised.");
      return;
    }

    const totalBatches = Math.ceil(totalToProcess / 20);
    const prog: RunProgress = {
      batchesDone: 0,
      totalBatches,
      articlesProcessed: 0,
      totalArticles: totalToProcess,
      errors: 0,
      totalCost: 0,
      totalDuration: 0,
    };
    setProgress({ ...prog });

    // Loop: one batch per request
    let done = false;
    while (!done && !cancelRef.current) {
      try {
        const res = await fetch("/api/phase2a/run", { method: "POST" });
        if (!res.ok) {
          const body = await res.json();
          setError(body.error || "Categorisation failed");
          break;
        }
        const batch: BatchResult = await res.json();

        prog.batchesDone++;
        prog.articlesProcessed += batch.articles_processed;
        prog.errors += batch.errors;
        prog.totalCost += batch.estimated_cost_usd;
        prog.totalDuration += batch.duration_ms;
        // Update remaining estimate from server
        prog.totalBatches = prog.batchesDone + batch.total_batches_remaining;
        prog.totalArticles = prog.articlesProcessed + batch.total_remaining;

        setProgress({ ...prog });
        done = batch.done;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        break;
      }
    }

    if (cancelRef.current) {
      setError("Categorisation stopped by user.");
    }

    setCompletedRun({ ...prog });
    setProgress(null);
    setIsRunning(false);
    await Promise.all([fetchStats(), fetchArticles(selectedCategory ?? undefined, selectedSource, 1)]);
  }

  function stopCategorisation() {
    cancelRef.current = true;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxCount = stats?.distribution.length
    ? Math.max(...stats.distribution.map((d) => d.count))
    : 1;

  const categoryList = TAXONOMY.map((cat) => {
    const dist = stats?.distribution.find((d) => d.category === cat.id);
    return { ...cat, count: dist?.count ?? 0 };
  }).sort((a, b) => b.count - a.count);

  const progressPct = progress
    ? Math.round((progress.articlesProcessed / Math.max(progress.totalArticles, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6 p-5">
      {/* ── Control bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {isRunning ? (
          <Button
            onClick={stopCategorisation}
            size="sm"
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={runCategorisation}
            disabled={isRunning}
            size="sm"
            className="gap-2"
          >
            <Tag className="h-4 w-4" />
            Run Categorisation
          </Button>
        )}

        <Select value={selectedSource} onValueChange={handleSourceChange}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.source_name} value={s.source_name}>
                {s.source_name} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          {stats && (
            <>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-status-success" />
                {stats.total_categorised} categorised
              </span>
              {stats.uncategorised_count > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-status-warning" />
                  {stats.uncategorised_count} uncategorised
                </span>
              )}
              <span className="flex items-center gap-1 font-mono">
                <DollarSign className="h-3 w-3" />
                ~${stats.estimated_cost_usd.toFixed(4)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      {progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-accent-emerald/5 px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-emerald" />
              <span>
                Batch {progress.batchesDone}/{progress.totalBatches}
                {" — "}
                <span className="font-medium text-accent-emerald">
                  {progress.articlesProcessed}
                </span>
                {" of "}
                {progress.totalArticles} articles
              </span>
            </span>
            <span className="font-mono text-muted-foreground">
              {progressPct}%
              {progress.errors > 0 && (
                <span className="ml-2 text-status-error">
                  {progress.errors} errors
                </span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-accent-emerald"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>
              {(progress.totalDuration / 1000).toFixed(1)}s elapsed
            </span>
            <span className="font-mono">
              ${progress.totalCost.toFixed(4)} cost
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Completed run banner ───────────────────────────────────── */}
      {completedRun && !progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-accent-emerald/5 px-4 py-3"
        >
          <p className="text-sm">
            Categorised{" "}
            <span className="font-medium text-accent-emerald">
              {completedRun.articlesProcessed} articles
            </span>{" "}
            in {completedRun.batchesDone} batch
            {completedRun.batchesDone !== 1 ? "es" : ""} —{" "}
            <span className="font-mono">
              {(completedRun.totalDuration / 1000).toFixed(1)}s
            </span>
            {" — "}
            <span className="font-mono">
              ${completedRun.totalCost.toFixed(4)}
            </span>
            {completedRun.errors > 0 && (
              <span className="text-status-error">
                {" "}({completedRun.errors} errors)
              </span>
            )}
          </p>
        </motion.div>
      )}

      {error && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/5 px-4 py-3">
          <p className="text-sm text-status-error">{error}</p>
        </div>
      )}

      {/* ── Distribution chart ─────────────────────────────────────── */}
      {stats && stats.total_categorised > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Category Distribution
          </h3>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="space-y-2">
                {categoryList
                  .filter((c) => c.count > 0)
                  .map((cat) => {
                    const pct = (cat.count / maxCount) * 100;
                    const barColor =
                      THEME_BAR_COLORS[cat.theme] ?? "bg-muted-foreground";
                    return (
                      <button
                        key={cat.id}
                        onClick={() =>
                          selectCategory(
                            selectedCategory === cat.id ? null : cat.id
                          )
                        }
                        className={`group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2 ${
                          selectedCategory === cat.id ? "bg-surface-2" : ""
                        }`}
                      >
                        <span className="w-40 shrink-0 truncate text-xs font-medium">
                          {cat.name}
                        </span>
                        <div className="flex-1">
                          <div className="h-4 w-full rounded-sm bg-surface-2">
                            <div
                              className={`h-full rounded-sm ${barColor} transition-all duration-300`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Category browser ───────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {selectedCategory
            ? `${getCategoryMeta(selectedCategory)?.name ?? selectedCategory} (${totalArticles})`
            : `All Categorised Articles (${totalArticles})`}
        </h3>

        {selectedCategory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectCategory(null)}
            className="mb-3 text-xs"
          >
            ← Show all categories
          </Button>
        )}

        <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
          {/* Left: category list */}
          <Card className="border-border/40 hidden lg:block">
            <CardContent className="p-2">
              <div className="space-y-0.5">
                <button
                  onClick={() => selectCategory(null)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                    selectedCategory === null ? "bg-surface-2 font-medium" : ""
                  }`}
                >
                  <span>All</span>
                  <span className="font-mono text-muted-foreground">
                    {stats?.total_categorised ?? 0}
                  </span>
                </button>
                {categoryList.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                      selectedCategory === cat.id
                        ? "bg-surface-2 font-medium"
                        : ""
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-muted-foreground">
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right: article list */}
          <div className="space-y-2">
            {articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Tag className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {stats?.total_categorised === 0
                    ? 'No articles categorised yet. Click "Run Categorisation" to start.'
                    : "No articles in this category."}
                </p>
              </div>
            ) : (
              articles.map((article) => {
                const primaryMeta = getCategoryMeta(article.primary_category);
                const primaryBadgeClass =
                  THEME_BADGE_COLORS[primaryMeta?.theme ?? "tech"] ??
                  THEME_BADGE_COLORS.tech;
                return (
                  <Card
                    key={article.id}
                    className="border-border/40 transition-colors hover:border-border"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <a
                            href={article.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium leading-snug hover:text-primary hover:underline"
                          >
                            {article.title}
                            <ExternalLink className="ml-1 inline h-3 w-3 opacity-40" />
                          </a>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${primaryBadgeClass}`}
                            >
                              {primaryMeta?.name ?? article.primary_category}
                            </Badge>
                            {article.secondary_categories.map((secId) => {
                              const secMeta = getCategoryMeta(secId);
                              return (
                                <Badge
                                  key={secId}
                                  variant="outline"
                                  className="text-[10px] opacity-60"
                                >
                                  {secMeta?.name ?? secId}
                                </Badge>
                              );
                            })}
                            {article.full_text ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-status-success/15 text-status-success border-status-success/30"
                              >
                                Full text
                                {article.full_text_word_count != null &&
                                  ` (${article.full_text_word_count.toLocaleString()} words)`}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-muted text-muted-foreground border-border"
                              >
                                No full text
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              · {article.source_name}
                            </span>
                          </div>
                          {article.snippet && (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                              {article.snippet}
                            </p>
                          )}
                          {article.full_text && (
                            <div className="mt-2">
                              <button
                                onClick={() => toggleFullText(article.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {expandedFullText.has(article.id) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Hide full text
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    Show full text
                                  </>
                                )}
                              </button>
                              {expandedFullText.has(article.id) && (
                                <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border/40 bg-surface-2/50 p-3 text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                  {article.full_text}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}

            {/* Pagination controls */}
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
