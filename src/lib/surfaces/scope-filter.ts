/**
 * Scope filter — bounds every substrate query a knowledge surface runs.
 *
 * Responsibilities:
 *  1. Translate SurfaceScope → RetrievalFilters (for retrieveContent /
 *     retrieveForLearn). Only microsectors / domains / entities / time-window
 *     / source_types / editor_status pass through; surface-private content
 *     types are additive in Phase 4.
 *  2. Expand deprecated microsectors to their successors (edge-case #7).
 *  3. Enforce surface-private-content isolation: a surface's upload_doc /
 *     surface_module rows must only ever be retrievable inside that surface.
 *     We implement this via a SQL clause the caller stitches onto
 *     `content_embeddings` queries.
 */
import pool from "@/lib/db";
import type { RetrievalFilters } from "@/lib/intelligence/retriever";
import type { KnowledgeSurface, SurfaceScope } from "./types";

export interface ScopedRetrievalFilters extends RetrievalFilters {
  /**
   * SQL fragment + params that the caller appends to any `content_embeddings`
   * query. Ensures uploaded_doc / surface_module rows are scoped to this
   * surface; excludes all other surfaces' private content.
   */
  privateContentClause?: { sql: string; params: unknown[] };
}

/**
 * Expand the microsector_ids list: for any deprecated row, walk `merged_into`
 * successors (one hop — deeper chains are uncommon; call recursively if the
 * taxonomy ever needs it).
 */
async function expandDeprecatedMicrosectors(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return ids;
  const { rows } = await pool.query<{ id: number }>(
    `WITH RECURSIVE chain(id) AS (
       SELECT id FROM taxonomy_microsectors WHERE id = ANY($1::int[])
       UNION
       SELECT tm.id FROM taxonomy_microsectors tm
         JOIN chain c ON tm.merged_into = c.id
        WHERE tm.deprecated_at IS NOT NULL
     )
     SELECT DISTINCT id FROM chain`,
    [ids],
  );
  return rows.map((r) => r.id);
}

export interface ScopeFilterOptions {
  /** When true (default) walks `merged_into` to pick up successor microsectors. */
  followDeprecation?: boolean;
  /**
   * Override the query's freshness window using scope.time_window. If the
   * scope carries a `rolling_days` or absolute from/to, they win over
   * caller-supplied date_from / date_to.
   */
  overrideTimeWindow?: boolean;
}

/**
 * Translate a surface's scope into retrieval filters + a private-content SQL
 * clause. Compose with caller-supplied filters via shallow merge.
 */
export async function buildScopedFilters(
  surface: KnowledgeSurface,
  base: RetrievalFilters = {},
  opts: ScopeFilterOptions = {},
): Promise<ScopedRetrievalFilters> {
  const scope: SurfaceScope = surface.scope ?? {};
  const followDeprecation = opts.followDeprecation ?? true;
  const overrideTimeWindow = opts.overrideTimeWindow ?? true;

  const out: ScopedRetrievalFilters = { ...base };

  // Microsector intersection. Empty scope microsectors = no restriction.
  if (scope.microsector_ids && scope.microsector_ids.length > 0) {
    let ids = scope.microsector_ids;
    if (followDeprecation) ids = await expandDeprecatedMicrosectors(ids);
    out.microsector_ids = intersect(out.microsector_ids, ids);
    if (out.microsector_ids.length === 0) {
      // Caller passed microsectors that don't intersect with scope — surface
      // content can't possibly include those. Signal an empty filter shape
      // that will return no results.
      out.microsector_ids = [-1];
    }
  }

  if (scope.entity_ids && scope.entity_ids.length > 0) {
    out.entity_ids = intersect(out.entity_ids, scope.entity_ids);
    if (out.entity_ids.length === 0) out.entity_ids = [-1];
  }

  if (scope.domain_slugs && scope.domain_slugs.length > 0) {
    out.domains = intersect(out.domains, scope.domain_slugs);
    if (out.domains.length === 0) out.domains = ["__never__"];
  }

  if (overrideTimeWindow && scope.time_window) {
    const tw = scope.time_window;
    if (tw.rolling_days && tw.rolling_days > 0) {
      const from = new Date(Date.now() - tw.rolling_days * 24 * 60 * 60 * 1000);
      out.date_from = from.toISOString();
      out.date_to = undefined;
    } else {
      if (tw.from) out.date_from = tw.from;
      if (tw.to) out.date_to = tw.to;
    }
  }

  out.privateContentClause = buildPrivateContentClause(surface.id);
  return out;
}

function intersect<T>(a?: T[], b?: T[]): T[] {
  if (!a || a.length === 0) return b ? [...b] : [];
  if (!b || b.length === 0) return [...a];
  const bSet = new Set<T>(b);
  return a.filter((x) => bSet.has(x));
}

/**
 * SQL clause to stitch onto any content_embeddings query to enforce
 * surface-private-content isolation.
 *
 * Intent:
 *   - `uploaded_doc` / `surface_module` rows are only ever returned when
 *     they carry `metadata->>'surface_id' = <current surface>`.
 *   - All other content types are unrestricted by this clause.
 *
 * Caller appends: `AND (<clause>)`. Two params returned: the surface_id
 * (twice).
 */
function buildPrivateContentClause(surfaceId: string): {
  sql: string;
  params: unknown[];
} {
  // Using `metadata ->> 'surface_id'` keeps the filter index-friendly with a
  // functional index if we need one later. For Phase 4 the call volume is
  // small and a seq-scan filter is fine.
  const sql = `(
    ce.content_type NOT IN ('uploaded_doc','surface_module')
    OR ce.metadata->>'surface_id' = $SURFACE_ID$
  )`;
  return { sql, params: [surfaceId] };
}

/**
 * Determine the effective `content_types` filter set for a surface.
 * Hubs see canonical + surface-private; Courses see the same. Cohort /
 * Presentation templates (deferred) could narrow further.
 */
export function defaultContentTypes(surface: KnowledgeSurface): string[] {
  const base = [
    "concept_card",
    "microsector_brief",
    "microsector_brief_block",
    "learning_path",
    "deep_dive",
    "article",
    "daily_digest",
    "weekly_digest",
    "podcast",
    // Surface-private:
    "uploaded_doc",
    "surface_module",
  ];
  if (surface.template === "course") {
    // Courses are more focused — skip live news tickers.
    return base.filter((t) => !["article", "daily_digest"].includes(t));
  }
  return base;
}
