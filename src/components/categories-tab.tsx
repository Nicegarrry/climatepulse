"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ExternalLink,
  Loader2,
  BarChart3,
  Tag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { TAXONOMY } from "@/lib/taxonomy";
import type { CategorisedArticle, CategoryStats } from "@/lib/types";
import type { CategoriseRunResult } from "@/lib/categorise/engine";

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

export function CategoriesTab() {
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [articles, setArticles] = useState<CategorisedArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<CategoriseRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/phase2a/stats");
    setStats(await res.json());
  }, []);

  const fetchArticles = useCallback(async (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const res = await fetch(`/api/phase2a/results?${params}`);
    setArticles(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchArticles()]).then(() => setLoading(false));
  }, [fetchStats, fetchArticles]);

  async function selectCategory(id: string | null) {
    setSelectedCategory(id);
    await fetchArticles(id ?? undefined);
  }

  async function runCategorisation() {
    setIsRunning(true);
    setLastRun(null);
    setError(null);
    try {
      const res = await fetch("/api/phase2a/run", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Categorisation failed");
        return;
      }
      const result: CategoriseRunResult = await res.json();
      setLastRun(result);
      await Promise.all([fetchStats(), fetchArticles(selectedCategory ?? undefined)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
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

  // Build full category list with counts (including zero-count categories)
  const categoryList = TAXONOMY.map((cat) => {
    const dist = stats?.distribution.find((d) => d.category === cat.id);
    return { ...cat, count: dist?.count ?? 0 };
  }).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6 p-5">
      {/* ── Control bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={runCategorisation}
          disabled={isRunning}
          size="sm"
          className="gap-2"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Tag className="h-4 w-4" />
          )}
          {isRunning ? "Categorising..." : "Run Categorisation"}
        </Button>

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

      {/* ── Run result banner ──────────────────────────────────────── */}
      {lastRun && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-accent-emerald/5 px-4 py-3"
        >
          <p className="text-sm">
            Categorised{" "}
            <span className="font-medium text-accent-emerald">
              {lastRun.articles_processed} articles
            </span>{" "}
            in {lastRun.batches_sent} batch{lastRun.batches_sent !== 1 ? "es" : ""} —{" "}
            <span className="font-mono">
              {(lastRun.duration_ms / 1000).toFixed(1)}s
            </span>
            {" — "}
            <span className="font-mono">
              ${lastRun.estimated_cost_usd.toFixed(4)}
            </span>
            {lastRun.errors > 0 && (
              <span className="text-status-error">
                {" "}({lastRun.errors} errors)
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
            ? `${getCategoryMeta(selectedCategory)?.name ?? selectedCategory} (${articles.length})`
            : `All Categorised Articles (${articles.length})`}
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
                            <span className="text-[10px] text-muted-foreground">
                              · {article.source_name}
                            </span>
                          </div>
                          {article.snippet && (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                              {article.snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
