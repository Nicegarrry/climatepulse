/**
 * Lightweight event recording for knowledge surfaces.
 *
 * Writes to knowledge_surface_analytics. Aggregate daily counts live as rows
 * with user_id NULL; per-user events carry user_id for completion tracking.
 *
 * Every recordEvent call swallows errors — analytics must never break a
 * render. Aggregation queries are read-only and may return empty state.
 */
import pool from "@/lib/db";
import type { AnalyticsMetric } from "./types";

// ─── recordEvent ──────────────────────────────────────────────────────────────

export interface RecordEventInput {
  surfaceId: string;
  metric: AnalyticsMetric;
  userId?: string | null;
  count?: number;
  value?: number | null;
  metadata?: Record<string, unknown>;
  /** Optional day override (YYYY-MM-DD); defaults to today UTC. */
  day?: string;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const day = input.day ?? new Date().toISOString().slice(0, 10);
    const count = input.count && input.count > 0 ? Math.floor(input.count) : 1;
    await pool.query(
      `INSERT INTO knowledge_surface_analytics
         (surface_id, day, metric, user_id, count, value, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.surfaceId,
        day,
        input.metric,
        input.userId ?? null,
        count,
        input.value ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (err) {
    console.error("[surfaces/analytics] recordEvent failed:", err);
  }
}

// ─── aggregateDaily ───────────────────────────────────────────────────────────

export interface DailyAggregate {
  day: string;
  views: number;
  path_starts: number;
  path_completes: number;
  item_completes: number;
  search: number;
  unique_users: number;
}

/**
 * Daily snapshot for a single day. dayISO is YYYY-MM-DD.
 *
 * Skips `export` rows whose metadata.audit = true — those are access /
 * admin-action audit entries, not engagement.
 */
export async function aggregateDaily(
  surfaceId: string,
  dayISO: string,
): Promise<DailyAggregate> {
  const { rows } = await pool.query<{
    metric: string;
    total: string;
    uniques: string;
  }>(
    `SELECT metric,
            SUM(count)::text        AS total,
            COUNT(DISTINCT user_id)::text AS uniques
       FROM knowledge_surface_analytics
      WHERE surface_id = $1 AND day = $2::date
        AND NOT (metric = 'export' AND (metadata->>'audit')::boolean IS TRUE)
      GROUP BY metric`,
    [surfaceId, dayISO],
  );

  const out: DailyAggregate = {
    day: dayISO,
    views: 0,
    path_starts: 0,
    path_completes: 0,
    item_completes: 0,
    search: 0,
    unique_users: 0,
  };
  const uniqueUserIds = new Set<string>();

  for (const row of rows) {
    const total = Number(row.total) || 0;
    switch (row.metric) {
      case "view":
        out.views += total;
        break;
      case "path_start":
        out.path_starts += total;
        break;
      case "path_complete":
        out.path_completes += total;
        break;
      case "item_complete":
        out.item_completes += total;
        break;
      case "search":
        out.search += total;
        break;
      default:
        break;
    }
  }

  // Unique users across all non-audit rows for the day.
  const { rows: uniqueRows } = await pool.query<{ user_id: string | null }>(
    `SELECT DISTINCT user_id
       FROM knowledge_surface_analytics
      WHERE surface_id = $1 AND day = $2::date
        AND user_id IS NOT NULL
        AND NOT (metric = 'export' AND (metadata->>'audit')::boolean IS TRUE)`,
    [surfaceId, dayISO],
  );
  for (const r of uniqueRows) {
    if (r.user_id) uniqueUserIds.add(r.user_id);
  }
  out.unique_users = uniqueUserIds.size;

  return out;
}

// ─── retention ────────────────────────────────────────────────────────────────

export interface RetentionSeriesRow {
  day: string;
  metric: AnalyticsMetric;
  count: number;
}

/**
 * Per-day counts by metric for the trailing `lookbackDays` days.
 * Returns one row per (day, metric) with non-zero count. Excludes audit rows.
 */
export async function retention(
  surfaceId: string,
  lookbackDays = 30,
): Promise<RetentionSeriesRow[]> {
  const clampedLookback = Math.max(1, Math.min(365, Math.floor(lookbackDays)));
  const { rows } = await pool.query<{
    day: string;
    metric: string;
    total: string;
  }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day,
            metric,
            SUM(count)::text AS total
       FROM knowledge_surface_analytics
      WHERE surface_id = $1
        AND day >= CURRENT_DATE - ($2::int - 1)
        AND NOT (metric = 'export' AND (metadata->>'audit')::boolean IS TRUE)
      GROUP BY day, metric
      ORDER BY day ASC, metric ASC`,
    [surfaceId, clampedLookback],
  );
  return rows.map((r) => ({
    day: r.day,
    metric: r.metric as AnalyticsMetric,
    count: Number(r.total) || 0,
  }));
}
