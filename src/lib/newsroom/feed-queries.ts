// Read-side queries that power the Newsroom feed and the saved-articles
// archive. Centralised here so the UI components and the API routes share
// one definition of "what is on a user's feed".

import pool from "@/lib/db";
import type { NewsroomFeedRow } from "./types";

export interface FeedQueryOptions {
  userId: string | null;
  threshold: number;        // 1-5 inclusive
  sectorSlugs: string[];    // empty = all
  cursor: string | null;    // ISO published_at of last row in previous page
  limit: number;
}

/**
 * Build a personalised Newsroom feed query.
 *
 * Behaviour:
 *  - `duplicate_of_id IS NULL` — soft-deduped items are filtered out.
 *  - `urgency >= threshold` — applies the user's chosen floor.
 *  - When `sectorSlugs` is non-empty, the item's primary_domain must be one
 *    of those slugs OR one of the expanded microsector domains derived from
 *    the user's selections. We expand at the call site and pass slugs.
 *  - Cursor pagination by `published_at` (stable secondary sort by id).
 *  - When `userId` is provided, joins user_saved_articles to surface
 *    `is_saved` so the UI can render the save-state without a second query.
 */
export async function fetchFeed(opts: FeedQueryOptions): Promise<NewsroomFeedRow[]> {
  const { userId, threshold, sectorSlugs, cursor, limit } = opts;

  const params: unknown[] = [Math.max(1, Math.min(5, threshold))];
  let domainClause = "";
  if (sectorSlugs.length > 0) {
    params.push(sectorSlugs);
    domainClause = `AND ni.primary_domain = ANY($${params.length})`;
  }

  let cursorClause = "";
  if (cursor) {
    params.push(cursor);
    cursorClause = `AND ni.published_at < $${params.length}`;
  }

  let savedSelect = "FALSE AS is_saved";
  let savedJoin = "";
  if (userId) {
    params.push(userId);
    savedSelect = `EXISTS (
      SELECT 1 FROM user_saved_articles usa
       WHERE usa.user_id = $${params.length}
         AND usa.raw_article_id = ni.raw_article_id
    ) AS is_saved`;
    savedJoin = "";
  }

  params.push(Math.max(1, Math.min(200, limit)));

  const sql = `
    SELECT
      ni.id,
      ni.raw_article_id,
      ni.primary_domain,
      ni.urgency,
      ni.teaser,
      ni.classifier_model,
      ni.classifier_version,
      ni.classified_at,
      ni.published_at,
      ni.source_name,
      ni.duplicate_of_id,
      ni.editor_override,
      ra.title,
      ra.article_url,
      ${savedSelect}
    FROM newsroom_items ni
    JOIN raw_articles ra ON ra.id = ni.raw_article_id
    ${savedJoin}
    WHERE ni.duplicate_of_id IS NULL
      AND ni.urgency >= $1
      ${domainClause}
      ${cursorClause}
    ORDER BY ni.published_at DESC, ni.id DESC
    LIMIT $${params.length}
  `;

  const { rows } = await pool.query<NewsroomFeedRow>(sql, params);
  return rows;
}

/**
 * Fetch a user's saved-article archive, newest first, optional sector and
 * note-search filters.
 */
export async function fetchSaved(opts: {
  userId: string;
  sectorSlugs: string[];
  search: string | null;
  cursor: string | null;
  limit: number;
}): Promise<Array<NewsroomFeedRow & { saved_at: string; note: string | null }>> {
  const { userId, sectorSlugs, search, cursor, limit } = opts;
  const params: unknown[] = [userId];

  let domainClause = "";
  if (sectorSlugs.length > 0) {
    params.push(sectorSlugs);
    domainClause = `AND COALESCE(ni.primary_domain, '') = ANY($${params.length})`;
  }

  let searchClause = "";
  if (search && search.trim().length > 0) {
    params.push(search.trim());
    searchClause = `AND (
      ra.title ILIKE '%' || $${params.length} || '%'
      OR usa.note ILIKE '%' || $${params.length} || '%'
    )`;
  }

  let cursorClause = "";
  if (cursor) {
    params.push(cursor);
    cursorClause = `AND usa.saved_at < $${params.length}`;
  }

  params.push(Math.max(1, Math.min(200, limit)));

  const sql = `
    SELECT
      COALESCE(ni.id, gen_random_uuid()) AS id,
      usa.raw_article_id,
      COALESCE(ni.primary_domain, '') AS primary_domain,
      COALESCE(ni.urgency, 0)::SMALLINT AS urgency,
      COALESCE(ni.teaser, '') AS teaser,
      COALESCE(ni.classifier_model, '') AS classifier_model,
      COALESCE(ni.classifier_version, '') AS classifier_version,
      COALESCE(ni.classified_at, usa.saved_at) AS classified_at,
      COALESCE(ni.published_at, ra.published_at, usa.saved_at) AS published_at,
      COALESCE(ni.source_name, ra.source_name) AS source_name,
      ni.duplicate_of_id,
      ni.editor_override,
      ra.title,
      ra.article_url,
      TRUE AS is_saved,
      usa.saved_at,
      usa.note
    FROM user_saved_articles usa
    JOIN raw_articles ra ON ra.id = usa.raw_article_id
    LEFT JOIN newsroom_items ni ON ni.raw_article_id = usa.raw_article_id
    WHERE usa.user_id = $1
      ${domainClause}
      ${searchClause}
      ${cursorClause}
    ORDER BY usa.saved_at DESC
    LIMIT $${params.length}
  `;

  const { rows } = await pool.query(sql, params);
  return rows as Array<
    NewsroomFeedRow & { saved_at: string; note: string | null }
  >;
}
