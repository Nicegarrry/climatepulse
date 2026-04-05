"use client";

import { useCallback, useEffect, useState } from "react";
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
  Globe,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Newspaper,
} from "lucide-react";
import type { RawArticle, Source, DiscoveryStats, DiscoveryRunResult, FulltextTestResult, FulltextStatus, NewsApiRunResult } from "@/lib/types";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function sourceStatus(source: Source & { articles_today?: number }) {
  if (source.consecutive_failures > 3)
    return { color: "bg-status-error", label: "Failed" };
  if (source.consecutive_failures > 0)
    return { color: "bg-status-warning", label: "Degraded" };
  return { color: "bg-status-success", label: "Healthy" };
}

function tierBadgeClass(tier: number) {
  if (tier === 1) return "bg-status-info/15 text-status-info border-status-info/30";
  if (tier === 2) return "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30";
  return "bg-accent-amber/15 text-accent-amber border-accent-amber/30";
}

function tierBadgeClassByType(source: Source) {
  if (source.source_type === "api") return "bg-chart-3/15 text-chart-3 border-chart-3/30";
  return tierBadgeClass(source.tier);
}

function tierLabel(tier: number, sourceType?: string) {
  if (sourceType === "api") return "API";
  if (tier === 1) return "Tier 1";
  if (tier === 2) return "Tier 2";
  return "Scrape";
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────── */

export function DiscoveryTab() {
  const [articles, setArticles] = useState<RawArticle[]>([]);
  const [sources, setSources] = useState<(Source & { articles_today?: number })[]>([]);
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<DiscoveryRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoursFilter, setHoursFilter] = useState("24");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [fulltextStatus, setFulltextStatus] = useState<FulltextStatus[]>([]);
  const [isTestingFulltext, setIsTestingFulltext] = useState(false);
  const [fulltextResult, setFulltextResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [isRunningNewsApiAi, setIsRunningNewsApiAi] = useState(false);
  const [newsApiAiResult, setNewsApiAiResult] = useState<NewsApiRunResult | null>(null);
  const [isRunningNewsApiOrg, setIsRunningNewsApiOrg] = useState(false);
  const [newsApiOrgResult, setNewsApiOrgResult] = useState<NewsApiRunResult | null>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ hours: hoursFilter, limit: "200" });
    if (sourceFilter !== "all") params.set("source", sourceFilter);

    const [articlesRes, sourcesRes, statsRes, fulltextRes] = await Promise.all([
      fetch(`/api/discovery/articles?${params}`),
      fetch("/api/discovery/sources"),
      fetch("/api/discovery/stats"),
      fetch("/api/discovery/fulltext-status"),
    ]);

    setArticles(await articlesRes.json());
    setSources(await sourcesRes.json());
    setStats(await statsRes.json());
    if (fulltextRes.ok) {
      setFulltextStatus(await fulltextRes.json());
    }
    setLoading(false);
  }, [hoursFilter, sourceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function runDiscovery() {
    setIsRunning(true);
    setLastRun(null);
    try {
      const res = await fetch("/api/discovery/run", { method: "POST" });
      const result: DiscoveryRunResult = await res.json();
      setLastRun(result);
      await fetchData();
    } finally {
      setIsRunning(false);
    }
  }

  async function runFulltextTest() {
    setIsTestingFulltext(true);
    setFulltextResult(null);
    try {
      const res = await fetch("/api/discovery/test-fulltext", { method: "POST" });
      const results: FulltextTestResult[] = await res.json();
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      setFulltextResult({ succeeded, failed });
      await fetchData();
    } finally {
      setIsTestingFulltext(false);
    }
  }

  async function runNewsApiAi() {
    setIsRunningNewsApiAi(true);
    setNewsApiAiResult(null);
    try {
      const res = await fetch("/api/discovery/run-newsapi-ai", { method: "POST" });
      const result: NewsApiRunResult = await res.json();
      setNewsApiAiResult(result);
      await fetchData();
    } finally {
      setIsRunningNewsApiAi(false);
    }
  }

  async function runNewsApiOrg() {
    setIsRunningNewsApiOrg(true);
    setNewsApiOrgResult(null);
    try {
      const res = await fetch("/api/discovery/run-newsapi-org", { method: "POST" });
      const result: NewsApiRunResult = await res.json();
      setNewsApiOrgResult(result);
      await fetchData();
    } finally {
      setIsRunningNewsApiOrg(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const healthySources = sources.filter((s) => s.consecutive_failures <= 3 && s.is_active).length;
  const failedSources = sources.filter((s) => s.consecutive_failures > 3).length;

  return (
    <div className="space-y-6 p-5">
      {/* ── Control bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={runDiscovery}
          disabled={isRunning}
          size="sm"
          className="gap-2"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRunning ? "Running..." : "Run Discovery"}
        </Button>

        <Button
          onClick={runFulltextTest}
          disabled={isTestingFulltext}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {isTestingFulltext ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {isTestingFulltext ? "Testing..." : "Test Full Text"}
        </Button>

        {/* NewsAPI.ai paused — uncomment to re-enable
        <Button
          onClick={runNewsApiAi}
          disabled={isRunningNewsApiAi}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {isRunningNewsApiAi ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Newspaper className="h-4 w-4" />
          )}
          {isRunningNewsApiAi ? "Running..." : "NewsAPI.ai"}
        </Button>
        */}

        <Button
          onClick={runNewsApiOrg}
          disabled={isRunningNewsApiOrg}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {isRunningNewsApiOrg ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Newspaper className="h-4 w-4" />
          )}
          {isRunningNewsApiOrg ? "Running..." : "NewsAPI.org"}
        </Button>

        <Select value={hoursFilter} onValueChange={setHoursFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">Last 24h</SelectItem>
            <SelectItem value="48">Last 48h</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
            <SelectItem value="0">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{stats?.total_articles ?? 0} total</span>
          <span className="font-mono">{stats?.articles_last_24h ?? 0} today</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-status-success" />
            {healthySources} active
          </span>
          {failedSources > 0 && (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-status-error" />
              {failedSources} failed
            </span>
          )}
        </div>
      </div>

      {/* ── Last run result ─────────────────────────────────────────── */}
      {lastRun && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-accent-emerald/5 px-4 py-3"
        >
          <p className="text-sm">
            Discovery complete in{" "}
            <span className="font-mono font-medium">
              {(lastRun.duration_ms / 1000).toFixed(1)}s
            </span>
            {" — "}
            <span className="font-medium text-accent-emerald">
              {lastRun.new_articles} new
            </span>
            {", "}
            {lastRun.duplicates_skipped} duplicates
            {lastRun.errors > 0 && (
              <span className="text-status-error">
                , {lastRun.errors} errors
              </span>
            )}
          </p>
        </motion.div>
      )}

      {/* ── Full text test result ────────────────────────────────────── */}
      {fulltextResult && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-status-info/5 px-4 py-3"
        >
          <p className="text-sm">
            Full text test complete{" — "}
            <span className="font-medium text-accent-emerald">
              {fulltextResult.succeeded} succeeded
            </span>
            {fulltextResult.failed > 0 && (
              <span className="text-status-error">
                , {fulltextResult.failed} failed
              </span>
            )}
          </p>
        </motion.div>
      )}

      {/* ── NewsAPI.ai result ──────────────────────────────────────── */}
      {newsApiAiResult && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-chart-3/30 bg-chart-3/5 px-4 py-3"
        >
          <p className="text-sm">
            <span className="font-medium">NewsAPI.ai</span> complete in{" "}
            <span className="font-mono font-medium">
              {(newsApiAiResult.duration_ms / 1000).toFixed(1)}s
            </span>
            {" — "}
            <span className="font-medium text-accent-emerald">
              {newsApiAiResult.new_articles} new
            </span>
            {", "}
            {newsApiAiResult.duplicates_skipped} duplicates
            {newsApiAiResult.full_text_stored > 0 && (
              <span className="text-status-info">
                , {newsApiAiResult.full_text_stored} with full text
              </span>
            )}
            {newsApiAiResult.errors > 0 && (
              <span className="text-status-error">
                , {newsApiAiResult.errors} errors
                {newsApiAiResult.error_details.length > 0 && (
                  <span className="text-xs"> — {newsApiAiResult.error_details[0].error}</span>
                )}
              </span>
            )}
          </p>
        </motion.div>
      )}

      {/* ── NewsAPI.org result ──────────────────────────────────────── */}
      {newsApiOrgResult && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-status-info/30 bg-status-info/5 px-4 py-3"
        >
          <p className="text-sm">
            <span className="font-medium">NewsAPI.org</span> complete in{" "}
            <span className="font-mono font-medium">
              {(newsApiOrgResult.duration_ms / 1000).toFixed(1)}s
            </span>
            {" — "}
            <span className="font-medium text-accent-emerald">
              {newsApiOrgResult.new_articles} new
            </span>
            {", "}
            {newsApiOrgResult.duplicates_skipped} duplicates
            {newsApiOrgResult.errors > 0 && (
              <span className="text-status-error">
                , {newsApiOrgResult.errors} errors
                {newsApiOrgResult.error_details.length > 0 && (
                  <span className="text-xs"> — {newsApiOrgResult.error_details[0].error}</span>
                )}
              </span>
            )}
          </p>
        </motion.div>
      )}

      {/* ── Source health grid ──────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Source Health
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sources.map((source) => {
            const status = sourceStatus(source);
            const ftStatus = fulltextStatus.find((fs) => fs.name === source.name);
            const ftSupported = ftStatus?.fulltext_supported;
            return (
              <Card
                key={source.id}
                className="border-border/40 transition-colors hover:border-border"
              >
                <CardContent className="flex items-start gap-3 p-3">
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${status.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {source.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${tierBadgeClassByType(source)}`}
                      >
                        {tierLabel(source.tier, source.source_type)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(source.last_polled)}
                      </span>
                      <span className="font-mono">
                        {source.articles_today ?? 0} today
                      </span>
                      {ftSupported === true && (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-emerald" />
                          Full text ✓
                        </Badge>
                      )}
                      {ftSupported === false && (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] bg-status-error/10 text-status-error border-status-error/30">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-error" />
                          No full text
                        </Badge>
                      )}
                      {ftSupported === null && (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] bg-muted text-muted-foreground border-border">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          Untested
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Article feed ────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Articles ({articles.length})
        </h3>
        {articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No articles yet. Click &quot;Run Discovery&quot; to fetch from sources.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((article) => {
              const isExpanded = expandedArticles.has(article.id);
              const source = sources.find((s) => s.name === article.source_name);
              const tier = source?.tier ?? 1;

              return (
                <Card
                  key={article.id}
                  className="border-border/40 transition-colors hover:border-border"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <a
                            href={article.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium leading-snug hover:text-primary hover:underline"
                          >
                            {article.title}
                            <ExternalLink className="ml-1 inline h-3 w-3 opacity-40" />
                          </a>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${tierBadgeClass(tier)}`}
                          >
                            {article.source_name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {relativeTime(article.published_at || article.fetched_at)}
                          </span>
                        </div>
                        {article.snippet && (
                          <div className="mt-2">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {isExpanded
                                ? article.snippet
                                : article.snippet.slice(0, 150) +
                                  (article.snippet.length > 150 ? "..." : "")}
                            </p>
                            {article.snippet.length > 150 && (
                              <button
                                onClick={() => toggleExpanded(article.id)}
                                className="mt-1 flex items-center gap-0.5 text-xs text-primary hover:underline"
                              >
                                {isExpanded ? (
                                  <>
                                    Less <ChevronUp className="h-3 w-3" />
                                  </>
                                ) : (
                                  <>
                                    More <ChevronDown className="h-3 w-3" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
