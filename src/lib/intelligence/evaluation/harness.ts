import pool from "@/lib/db";
import { EVALUATION_QUERIES } from "./queries";
import { pgvectorOnlyBackend } from "./backends/pgvector-only";
import { pgvectorCooccurrenceBackend } from "./backends/pgvector-cooccurrence";
import { pgGraphWalkBackend } from "./backends/pg-graph-walk";
import type {
  QueryDef,
  QueryResult,
  RetrievalBackend,
  RetrievedItem,
} from "./types";

export const ALL_BACKENDS: RetrievalBackend[] = [
  pgvectorOnlyBackend,
  pgvectorCooccurrenceBackend,
  pgGraphWalkBackend,
];

export interface HarnessOptions {
  limit?: number;
  /** Only run queries matching these IDs. Default: run everything. */
  queryIds?: string[];
  /** Only run these backends. Default: all three. */
  backendNames?: string[];
  /** Graph-walk hop depth. Default 2. */
  maxHops?: 1 | 2 | 3;
  /** Graph-walk min triple confidence. Default 0.6. */
  minConfidence?: number;
}

export interface HarnessReport {
  ranAt: string;
  queryCount: number;
  backendCount: number;
  totalQueries: number;
  totalErrors: number;
  results: QueryResult[];
  unresolvedSeeds: { queryId: string; missing: string[] }[];
}

/**
 * Resolve query seed entity NAMES to entities.id. Returns the resolved IDs
 * AND the list of names that didn't resolve (for the harness to surface).
 */
async function resolveSeedEntityIds(
  names: string[]
): Promise<{ ids: number[]; missing: string[] }> {
  if (names.length === 0) return { ids: [], missing: [] };

  const { rows } = await pool.query<{ id: number; canonical_name: string; aliases: string[] }>(
    `SELECT id, canonical_name, aliases FROM entities
     WHERE canonical_name = ANY($1::text[])
        OR aliases && $1::text[]`,
    [names]
  );

  const found = new Set<string>();
  const ids = new Set<number>();
  for (const r of rows) {
    ids.add(r.id);
    if (names.includes(r.canonical_name)) found.add(r.canonical_name);
    for (const alias of r.aliases ?? []) {
      if (names.includes(alias)) found.add(alias);
    }
  }

  const missing = names.filter((n) => !found.has(n));
  return { ids: Array.from(ids), missing };
}

export async function runComparison(
  opts: HarnessOptions = {}
): Promise<HarnessReport> {
  const limit = opts.limit ?? 10;
  const queries: QueryDef[] = opts.queryIds
    ? EVALUATION_QUERIES.filter((q) => opts.queryIds!.includes(q.id))
    : EVALUATION_QUERIES;
  const backends = opts.backendNames
    ? ALL_BACKENDS.filter((b) => opts.backendNames!.includes(b.name))
    : ALL_BACKENDS;

  const results: QueryResult[] = [];
  const unresolvedSeeds: { queryId: string; missing: string[] }[] = [];
  let totalErrors = 0;

  for (const query of queries) {
    const seeds = query.seedEntities ?? [];
    const { ids: seedEntityIds, missing } = await resolveSeedEntityIds(seeds);
    if (missing.length > 0) {
      unresolvedSeeds.push({ queryId: query.id, missing });
    }

    for (const backend of backends) {
      const start = Date.now();
      let items: RetrievedItem[] = [];
      let error: string | undefined;
      try {
        items = await backend.retrieve({
          query: query.query,
          seedEntityIds,
          limit,
          maxHops: opts.maxHops ?? 2,
          minConfidence: opts.minConfidence ?? 0.6,
        });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        totalErrors++;
      }
      const latencyMs = Date.now() - start;

      results.push({
        queryId: query.id,
        query: query.query,
        category: query.category,
        backend: backend.name,
        items,
        latencyMs,
        error,
      });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    queryCount: queries.length,
    backendCount: backends.length,
    totalQueries: queries.length * backends.length,
    totalErrors,
    results,
    unresolvedSeeds,
  };
}

/**
 * CSV row format suitable for hand-scoring relevance in a spreadsheet:
 *   query_id, query, category, backend, rank, content_type, source_id, title,
 *   url, similarity, combined_score, graph_hops, latency_ms, relevance_blank
 */
export function reportToCSV(report: HarnessReport): string {
  const headers = [
    "query_id",
    "query",
    "category",
    "backend",
    "rank",
    "content_type",
    "source_id",
    "title",
    "url",
    "similarity",
    "combined_score",
    "graph_hops",
    "latency_ms",
    "relevance_0_to_3",
  ];

  const lines: string[] = [headers.join(",")];

  for (const r of report.results) {
    if (r.items.length === 0) {
      lines.push(
        [
          r.queryId,
          csvEscape(r.query),
          r.category,
          r.backend,
          0,
          "",
          "",
          r.error ? csvEscape(`ERROR: ${r.error}`) : "(no results)",
          "",
          "",
          "",
          "",
          r.latencyMs,
          "",
        ].join(",")
      );
      continue;
    }
    r.items.forEach((it, i) => {
      lines.push(
        [
          r.queryId,
          csvEscape(r.query),
          r.category,
          r.backend,
          i + 1,
          it.contentType,
          it.sourceId,
          csvEscape(it.title),
          csvEscape(it.url ?? ""),
          fmt(it.similarity),
          fmt(it.combinedScore),
          it.graphHops != null ? String(it.graphHops) : "",
          r.latencyMs,
          "",
        ].join(",")
      );
    });
  }

  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(n: number | null | undefined): string {
  return n == null ? "" : n.toFixed(4);
}

export interface BackendSummary {
  name: string;
  totalQueries: number;
  totalErrors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgResultCount: number;
}

export function summariseByBackend(report: HarnessReport): BackendSummary[] {
  const byBackend = new Map<string, QueryResult[]>();
  for (const r of report.results) {
    if (!byBackend.has(r.backend)) byBackend.set(r.backend, []);
    byBackend.get(r.backend)!.push(r);
  }
  return Array.from(byBackend.entries()).map(([name, list]) => {
    const latencies = list.map((r) => r.latencyMs).sort((a, b) => a - b);
    const errors = list.filter((r) => r.error).length;
    const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1];
    const avgResults = list.reduce((a, r) => a + r.items.length, 0) / list.length;
    return {
      name,
      totalQueries: list.length,
      totalErrors: errors,
      avgLatencyMs: Math.round(avgLat),
      p95LatencyMs: p95,
      avgResultCount: Number(avgResults.toFixed(1)),
    };
  });
}
