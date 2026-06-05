// src/lib/digest/public-digest.ts
//
// Zero-login generic daily board: the day's highest-significance climate,
// energy and transition signals, NOT personalised. Read-only — no AI
// generation, no per-visitor cost — so /today can be cached and shared
// publicly. The AI-written, sector-personalised briefing stays a logged-in
// benefit and is the conversion hook.

import pool from "@/lib/db";
import { sydneyDateString } from "@/lib/podcast/date";

export interface PublicStory {
  title: string;
  source_name: string | null;
  article_url: string;
  published_at: string | null;
  primary_domain: string | null;
  signal_type: string | null;
  sentiment: string | null;
  snippet: string | null;
  microsector_slugs: string[];
}

export interface PublicDigest {
  date: string; // Sydney calendar date
  stories: PublicStory[];
  signals_tracked: number;
}

const MAX_STORIES = 12;

export async function getPublicDigest(): Promise<PublicDigest> {
  const date = sydneyDateString();

  try {
    const { rows } = await pool.query(
      `SELECT
         ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at,
         ea.primary_domain, ea.signal_type, ea.sentiment,
         COALESCE(
           (SELECT array_agg(tm.slug)
              FROM taxonomy_microsectors tm
             WHERE tm.id = ANY(ea.microsector_ids)), '{}'
         ) AS microsector_slugs
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ra.published_at >= NOW() - INTERVAL '32 hours'
         AND ea.significance_composite IS NOT NULL
       ORDER BY ea.significance_composite DESC
       LIMIT $1`,
      [MAX_STORIES]
    );

    const stories: PublicStory[] = rows.map((r) => ({
      title: r.title,
      source_name: r.source_name,
      article_url: r.article_url,
      published_at: r.published_at ? new Date(r.published_at).toISOString() : null,
      primary_domain: r.primary_domain,
      signal_type: r.signal_type,
      sentiment: r.sentiment,
      snippet: r.snippet,
      microsector_slugs: r.microsector_slugs ?? [],
    }));

    let signals_tracked = stories.length;
    try {
      const { rows: countRows } = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n
           FROM enriched_articles ea
           JOIN raw_articles ra ON ra.id = ea.raw_article_id
          WHERE ra.published_at >= NOW() - INTERVAL '32 hours'
            AND ea.significance_composite IS NOT NULL`
      );
      signals_tracked = countRows[0]?.n ?? stories.length;
    } catch {
      /* non-critical — fall back to the shown count */
    }

    return { date, stories, signals_tracked };
  } catch (err) {
    console.warn("[public-digest] query failed:", err);
    return { date, stories: [], signals_tracked: 0 };
  }
}
