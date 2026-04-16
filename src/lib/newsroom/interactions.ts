// Read-side helpers that aggregate Newsroom interaction history into the
// shape consumed by personalisation.ts at digest-generation time.
//
// Two layers of signal:
//   - byArticle: direct (read/thumbs/save) per raw_article_id
//   - byEntity:  softer signal that propagates from Newsroom items the user
//                interacted with onto enriched stories that share entities.
//                This bridges the wire-vs-briefing UUID gap (a wire item
//                yesterday and an enriched briefing story today are
//                different DB rows).

import pool from "@/lib/db";
import type { InteractionSummary } from "./types";

const LOOKBACK_DAYS = 14;
const MIN_ENTITY_LENGTH = 3;

const ENTITY_STOP_LIST = new Set<string>([
  "climate",
  "energy",
  "policy",
  "report",
  "sector",
  "industry",
  "market",
  "global",
  "australian",
  "australia",
  "company",
]);

interface ArticleAgg {
  raw_article_id: string;
  reads: string;
  thumbs: number;
  saved: boolean;
}

interface EntityAgg {
  name: string;
  reads: string;
  positive: string;
  negative: string;
  saves: string;
}

/**
 * Build an InteractionSummary for the given user. Both maps are returned
 * together so callers run a single coordinated query (cheaper than
 * round-tripping per story).
 */
export async function getInteractionSummary(
  userId: string
): Promise<InteractionSummary> {
  const byArticle = new Map<
    string,
    { reads: number; thumbs: -1 | 0 | 1; saved: boolean }
  >();
  const byEntity = new Map<
    string,
    { reads: number; positive: number; negative: number; saves: number }
  >();

  if (!userId) return { byArticle, byEntity };

  // ── Per-article aggregation ──────────────────────────────────────────────
  const articles = await pool.query<ArticleAgg>(
    `SELECT raw_article_id,
            COUNT(*) FILTER (WHERE interaction_type IN ('read','expand'))                        AS reads,
            MAX(CASE interaction_type WHEN 'thumbs_up' THEN 1
                                      WHEN 'thumbs_down' THEN -1
                                      ELSE 0 END)                                                AS thumbs,
            BOOL_OR(interaction_type = 'save')                                                   AS saved
       FROM user_newsroom_interactions
      WHERE user_id = $1
        AND created_at > NOW() - ($2 || ' days')::interval
      GROUP BY raw_article_id`,
    [userId, String(LOOKBACK_DAYS)]
  );

  for (const row of articles.rows) {
    const rawThumbs = Number(row.thumbs ?? 0);
    const thumbs = rawThumbs === 1 ? 1 : rawThumbs === -1 ? -1 : 0;
    byArticle.set(row.raw_article_id, {
      reads: Number(row.reads ?? 0),
      thumbs,
      saved: Boolean(row.saved),
    });
  }

  // ── Entity-level aggregation ─────────────────────────────────────────────
  // Bridge from raw_article_id → enriched_articles via FK, then to entities
  // via article_entities. We only count entities the user actually touched
  // (i.e., the article's entities, not the entire entity universe).
  const entities = await pool.query<EntityAgg>(
    `WITH actions AS (
       SELECT raw_article_id, interaction_type
         FROM user_newsroom_interactions
        WHERE user_id = $1
          AND created_at > NOW() - ($2 || ' days')::interval
     ),
     story_entities AS (
       SELECT a.raw_article_id, a.interaction_type, e.canonical_name AS name
         FROM actions a
         JOIN enriched_articles ea ON ea.raw_article_id = a.raw_article_id
         JOIN article_entities ae ON ae.enriched_article_id = ea.id
         JOIN entities e ON e.id = ae.entity_id
        WHERE LENGTH(e.canonical_name) >= $3
     )
     SELECT LOWER(name) AS name,
            COUNT(*) FILTER (WHERE interaction_type IN ('read','expand'))   AS reads,
            COUNT(*) FILTER (WHERE interaction_type = 'thumbs_up')          AS positive,
            COUNT(*) FILTER (WHERE interaction_type = 'thumbs_down')        AS negative,
            COUNT(*) FILTER (WHERE interaction_type = 'save')               AS saves
       FROM story_entities
      GROUP BY LOWER(name)`,
    [userId, String(LOOKBACK_DAYS), MIN_ENTITY_LENGTH]
  );

  for (const row of entities.rows) {
    const key = row.name;
    if (ENTITY_STOP_LIST.has(key)) continue;
    byEntity.set(key, {
      reads: Number(row.reads ?? 0),
      positive: Number(row.positive ?? 0),
      negative: Number(row.negative ?? 0),
      saves: Number(row.saves ?? 0),
    });
  }

  return { byArticle, byEntity };
}
