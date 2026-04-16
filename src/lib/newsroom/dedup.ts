// Two-layer dedup:
// (1) Compute a normalised title hash and write it to raw_articles. The
//     UNIQUE partial index on title_hash will reject same-story-different-URL
//     duplicates at the DB layer for us — we just catch the conflict.
// (2) For rows that survive (1), do a soft pg_trgm similarity match against
//     other recent titles (24h) and write a duplicate_of_id link if matched.
//     We do NOT delete the row; preserving it lets the UI show source diversity.

import crypto from "crypto";
import pool from "@/lib/db";

const SOFT_MATCH_SIMILARITY = 0.82;
const SOFT_MATCH_LOOKBACK_HOURS = 24;
const DEDUP_LOOKBACK_MINUTES = 60;

export interface DedupResult {
  hashed: number;
  hash_collisions: number;
  soft_duplicates: number;
}

/**
 * Normalise a title to a stable hash for cross-source dedup.
 *  - lowercase
 *  - strip non-alphanumeric runs
 *  - collapse whitespace
 *  - trim
 *  - SHA-1 first 16 hex chars
 */
export function titleHash(title: string): string {
  const normalised = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalised) return "";
  return crypto.createHash("sha1").update(normalised).digest("hex").slice(0, 16);
}

/**
 * Compute and persist title_hash for any raw_articles rows fetched in the
 * last DEDUP_LOOKBACK_MINUTES that still have a NULL title_hash. Then run a
 * pg_trgm soft-match pass against other recent titles to populate
 * duplicate_of_id where applicable.
 *
 * The function is idempotent and safe to call from every cron tick.
 */
export async function dedupPendingBatch(): Promise<DedupResult> {
  const result: DedupResult = {
    hashed: 0,
    hash_collisions: 0,
    soft_duplicates: 0,
  };

  // Step 1 — assign title_hash for newly-fetched rows.
  const pending = await pool.query<{ id: string; title: string }>(
    `SELECT id, title
       FROM raw_articles
      WHERE title_hash IS NULL
        AND fetched_at > NOW() - ($1 || ' minutes')::interval
      ORDER BY fetched_at DESC
      LIMIT 500`,
    [String(DEDUP_LOOKBACK_MINUTES)]
  );

  for (const row of pending.rows) {
    const hash = titleHash(row.title);
    if (!hash) continue;
    try {
      await pool.query(
        `UPDATE raw_articles SET title_hash = $1 WHERE id = $2`,
        [hash, row.id]
      );
      result.hashed++;
    } catch {
      // Hit the unique-partial index: another row already owns this hash.
      result.hash_collisions++;
    }
  }

  // Step 2 — soft-dedup pass on Newsroom items only. Look at recently
  // classified items lacking a duplicate_of_id and find a similar earlier
  // item from the same lookback window.
  const softMatches = await pool.query<{
    id: string;
    duplicate_of_id: string;
  }>(
    `WITH candidates AS (
       SELECT ni.id, ni.published_at, ra.title
         FROM newsroom_items ni
         JOIN raw_articles ra ON ra.id = ni.raw_article_id
        WHERE ni.duplicate_of_id IS NULL
          AND ni.classified_at > NOW() - ($1 || ' hours')::interval
     )
     SELECT c.id, m.id AS duplicate_of_id
       FROM candidates c
       JOIN LATERAL (
         SELECT ni2.id
           FROM newsroom_items ni2
           JOIN raw_articles ra2 ON ra2.id = ni2.raw_article_id
          WHERE ni2.id <> c.id
            AND ni2.duplicate_of_id IS NULL
            AND ni2.classified_at < (
              SELECT classified_at FROM newsroom_items WHERE id = c.id
            )
            AND ni2.classified_at > NOW() - ($1 || ' hours')::interval
            AND similarity(ra2.title, c.title) > $2
          ORDER BY similarity(ra2.title, c.title) DESC
          LIMIT 1
       ) m ON TRUE`,
    [String(SOFT_MATCH_LOOKBACK_HOURS), SOFT_MATCH_SIMILARITY]
  );

  for (const m of softMatches.rows) {
    await pool.query(
      `UPDATE newsroom_items SET duplicate_of_id = $1 WHERE id = $2 AND duplicate_of_id IS NULL`,
      [m.duplicate_of_id, m.id]
    );
    result.soft_duplicates++;
  }

  return result;
}
