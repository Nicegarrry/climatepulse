/**
 * Learn-specific retrieval helpers.
 *
 * Kept in a separate module (rather than appended to src/lib/intelligence/retriever.ts)
 * so the existing retriever stays simple and Learn extensions can evolve independently.
 * Both files are consumed together via explicit imports — no hidden coupling.
 */
import pool from "@/lib/db";
import {
  retrieveContent,
  type RetrievalFilters,
  type RetrievalOptions,
  type RetrievedContent,
} from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";
import type { EditorialStatus } from "./microsector-briefs/types";

/**
 * Content types that belong to the Learn surface.
 * These values match the CHECK constraint expanded in 001-learn-prelude.sql.
 * Cast is pragmatic: the ContentType union in retriever.ts will gain these in
 * a follow-up; until then the cast is safe because the DB accepts them.
 */
const LEARN_CONTENT_TYPES = [
  "concept_card",
  "microsector_brief",
  "microsector_brief_block",
  "learning_path",
  "deep_dive",
] as unknown as ContentType[];

export interface LearnRetrievalFilters extends RetrievalFilters {
  editorialStatusAllowlist?: EditorialStatus[];
  surfaceId?: string;
  followDeprecation?: boolean;
}

export interface LearnRetrievalOptions extends RetrievalOptions {
  /** Additive boost for editor_authored / editor_reviewed rows. Default 0.15. */
  editorialBoost?: number;
  /** Exponential half-life decay on published_at. Default null = no decay. */
  freshnessHalfLifeDays?: number | null;
}

/**
 * Learn-surface retrieval. Thin wrapper over retrieveContent with:
 *  - content_types defaulting to the 5 canonical Learn types
 *  - optional taxonomy-deprecation expansion (edge-case #7)
 *  - optional freshness decay (exp half-life)
 *  - editorialBoost + editorialStatusAllowlist wired with TODOs where
 *    editorial_status must surface through RetrievedContent (Phase 3).
 */
export async function retrieveForLearn(
  query: string,
  filters: LearnRetrievalFilters = {},
  options: LearnRetrievalOptions = {},
): Promise<RetrievedContent[]> {
  const freshnessHalfLifeDays = options.freshnessHalfLifeDays ?? null;

  const contentTypes =
    filters.content_types && filters.content_types.length > 0
      ? filters.content_types
      : LEARN_CONTENT_TYPES;

  let microsectorIds = filters.microsector_ids;
  if (filters.followDeprecation && microsectorIds?.length) {
    const { rows: successors } = await pool.query<{ id: number }>(
      `WITH RECURSIVE chain(id) AS (
         SELECT id FROM taxonomy_microsectors WHERE id = ANY($1::int[])
         UNION
         SELECT tm.id FROM taxonomy_microsectors tm
           JOIN chain c ON tm.merged_into = c.id
          WHERE tm.deprecated_at IS NOT NULL
       )
       SELECT id FROM chain`,
      [microsectorIds],
    );
    microsectorIds = successors.map((r) => r.id);
  }

  const baseFilters: RetrievalFilters = {
    ...filters,
    content_types: contentTypes,
    microsector_ids: microsectorIds,
  };

  const baseLimit = (options.limit ?? 20) * 3;
  const results = await retrieveContent(query, baseFilters, {
    ...options,
    limit: baseLimit,
  });

  const now = Date.now();
  const adjusted = results.map((item) => {
    let score = item.combined_score;
    if (freshnessHalfLifeDays != null && item.published_at) {
      const daysOld =
        (now - new Date(item.published_at).getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.exp(-daysOld / freshnessHalfLifeDays);
    }
    // TODO(Phase 3): apply editorialBoost once editorial_status surfaces in RetrievedContent.
    // TODO(Phase 4): inject surfaceId into retrieveContent filter clause.
    // TODO(Phase 3): filter by editorialStatusAllowlist once status is surfaced.
    return { ...item, combined_score: score };
  });

  adjusted.sort((a, b) => b.combined_score - a.combined_score);
  return adjusted.slice(0, options.limit ?? 20);
}
