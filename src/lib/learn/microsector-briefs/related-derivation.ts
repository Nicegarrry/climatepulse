import crypto from "node:crypto";
import pool from "@/lib/db";
import { BlockType } from "./types";

/**
 * SQL-only derivation of the `related` brief-block. No LLM call.
 *
 * Signal:
 *   1. `sector_sibling` — other non-deprecated microsectors under the same sector.
 *   2. `domain_peer`    — non-deprecated microsectors under the same domain (excluding sector siblings).
 *   3. `co_mentioned`   — microsectors that co-appear in enriched_articles.microsector_ids within
 *                         the last 90 days; ranked by co-mention count.
 *
 * The three signals are unioned, deduped (taking the strongest signal per microsector), and
 * capped at `topN` per brief. Result is persisted as body_json; cadence is quarterly.
 */

export interface RelatedItem {
  microsector_id: number;
  microsector_slug: string;
  microsector_name: string;
  proximity: "sector_sibling" | "domain_peer" | "co_mentioned";
  co_mention_count: number;
}

interface DeriveOpts {
  microsectorSlug?: string;
  topN?: number;
  coMentionLookbackDays?: number;
}

interface DeriveResult {
  attempted: number;
  updated: number;
  failed: number;
}

const DEFAULT_TOP_N = 8;
const DEFAULT_LOOKBACK_DAYS = 90;

export async function deriveRelatedForBrief(
  briefId: string,
  microsectorId: number,
  topN = DEFAULT_TOP_N,
  coMentionLookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<RelatedItem[]> {
  const { rows } = await pool.query<RelatedItem>(
    `WITH target AS (
       SELECT id, sector_id,
              (SELECT ts.domain_id FROM taxonomy_sectors ts WHERE ts.id = tm.sector_id) AS domain_id
         FROM taxonomy_microsectors tm
        WHERE tm.id = $1
     ),
     sector_siblings AS (
       SELECT tm.id AS microsector_id,
              tm.slug AS microsector_slug,
              tm.name AS microsector_name,
              'sector_sibling'::TEXT AS proximity,
              0::BIGINT AS co_mention_count,
              1 AS rank
         FROM taxonomy_microsectors tm, target
        WHERE tm.sector_id = target.sector_id
          AND tm.id <> target.id
          AND tm.deprecated_at IS NULL
     ),
     domain_peers AS (
       SELECT tm.id AS microsector_id,
              tm.slug AS microsector_slug,
              tm.name AS microsector_name,
              'domain_peer'::TEXT AS proximity,
              0::BIGINT AS co_mention_count,
              2 AS rank
         FROM taxonomy_microsectors tm
         JOIN taxonomy_sectors ts ON ts.id = tm.sector_id, target
        WHERE ts.domain_id = target.domain_id
          AND tm.id <> target.id
          AND tm.sector_id <> target.sector_id
          AND tm.deprecated_at IS NULL
     ),
     co_mentioned AS (
       SELECT tm.id AS microsector_id,
              tm.slug AS microsector_slug,
              tm.name AS microsector_name,
              'co_mentioned'::TEXT AS proximity,
              COUNT(*)::BIGINT AS co_mention_count,
              3 AS rank
         FROM enriched_articles ea
         JOIN raw_articles ra ON ra.id = ea.raw_article_id
         CROSS JOIN UNNEST(ea.microsector_ids) AS peer_id
         JOIN taxonomy_microsectors tm ON tm.id = peer_id AND tm.deprecated_at IS NULL, target
        WHERE $1 = ANY(ea.microsector_ids)
          AND peer_id <> target.id
          AND ra.published_at > NOW() - ($2 || ' days')::INTERVAL
        GROUP BY tm.id, tm.slug, tm.name
     ),
     unioned AS (
       SELECT * FROM sector_siblings
       UNION ALL SELECT * FROM domain_peers
       UNION ALL SELECT * FROM co_mentioned
     ),
     best_per_microsector AS (
       SELECT DISTINCT ON (microsector_id)
              microsector_id, microsector_slug, microsector_name, proximity, co_mention_count
         FROM unioned
        ORDER BY microsector_id, rank ASC, co_mention_count DESC
     )
     SELECT * FROM best_per_microsector
      ORDER BY
        CASE proximity
          WHEN 'co_mentioned'    THEN 1
          WHEN 'sector_sibling'  THEN 2
          WHEN 'domain_peer'     THEN 3
        END ASC,
        co_mention_count DESC,
        microsector_name ASC
      LIMIT $3`,
    [microsectorId, String(coMentionLookbackDays), topN],
  );

  await persistRelatedBlock(briefId, rows, coMentionLookbackDays);
  return rows;
}

async function persistRelatedBlock(
  briefId: string,
  items: RelatedItem[],
  coMentionLookbackDays: number,
): Promise<void> {
  const bodyJson = {
    items,
    derived_at: new Date().toISOString(),
    co_mention_lookback_days: coMentionLookbackDays,
  };
  const payload = JSON.stringify(bodyJson);
  const contentHash = crypto.createHash("sha256").update(payload).digest("hex");
  const inputHash = crypto
    .createHash("sha256")
    .update(items.map((i) => `${i.microsector_id}:${i.proximity}:${i.co_mention_count}`).join("|"))
    .digest("hex");

  const { rows: existing } = await pool.query<{ version: number }>(
    `SELECT version FROM microsector_brief_blocks
      WHERE brief_id = $1 AND block_type = $2`,
    [briefId, BlockType.Related],
  );
  const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

  await pool.query(
    `INSERT INTO microsector_brief_blocks
       (brief_id, block_type, body, body_json, cadence_policy,
        last_generated_at, last_input_hash, content_hash,
        editorial_status, version)
     VALUES ($1, $2, NULL, $3::jsonb, 'quarterly',
             NOW(), $4, $5, 'ai_drafted', $6)
     ON CONFLICT (brief_id, block_type) DO UPDATE SET
       body_json         = EXCLUDED.body_json,
       last_generated_at = NOW(),
       last_input_hash   = EXCLUDED.last_input_hash,
       content_hash      = EXCLUDED.content_hash,
       version           = microsector_brief_blocks.version + 1,
       updated_at        = NOW()`,
    [briefId, BlockType.Related, payload, inputHash, contentHash, nextVersion],
  );
}

/**
 * Refresh `related` blocks across all briefs (optionally filtered by microsector slug).
 * Idempotent; safe to run on schedule. Does not consume LLM tokens.
 */
export async function deriveRelatedForAllBriefs(
  opts: DeriveOpts = {},
): Promise<DeriveResult> {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const lookback = opts.coMentionLookbackDays ?? DEFAULT_LOOKBACK_DAYS;

  const briefsQuery = opts.microsectorSlug
    ? `SELECT mb.id, mb.microsector_id
         FROM microsector_briefs mb
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
        WHERE tm.slug = $1 AND tm.deprecated_at IS NULL`
    : `SELECT mb.id, mb.microsector_id
         FROM microsector_briefs mb
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
        WHERE tm.deprecated_at IS NULL`;
  const params = opts.microsectorSlug ? [opts.microsectorSlug] : [];

  const { rows: briefs } = await pool.query<{ id: string; microsector_id: number }>(
    briefsQuery,
    params,
  );

  const result: DeriveResult = { attempted: briefs.length, updated: 0, failed: 0 };
  for (const brief of briefs) {
    try {
      await deriveRelatedForBrief(brief.id, brief.microsector_id, topN, lookback);
      result.updated++;
    } catch (err) {
      result.failed++;
      console.error(`[related-derivation] brief=${brief.id} failed:`, err);
    }
  }
  return result;
}
