// Historical Google News RSS fetcher.
//
// Sibling of src/lib/newsroom/google-news-fetch.ts, but scoped to a
// user-supplied date window via the `after:` / `before:` search operators.
// Used exclusively by scripts/backfill-historical.ts to seed the pgvector
// corpus with ~6-12 months of prior coverage. NOT wired into any cron.
//
// Dedup strategy relies on the same two layers the live pipeline uses:
//   1. raw_articles.article_url UNIQUE constraint — drops URL duplicates
//   2. raw_articles.title_hash partial-unique index — drops cross-source
//      duplicates where the URLs differ but the normalised headline collides

import crypto from "crypto";
import RSSParser from "rss-parser";
import type { PoolClient } from "pg";
import pool from "@/lib/db";

const SOURCE_NAME = "Google News";
const SOURCE_URL = "https://news.google.com";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.1",
  "Accept-Language": "en-AU,en;q=0.9",
};

const parser = new RSSParser({ timeout: 30_000, headers: REQUEST_HEADERS });

export interface HistoricalWindow {
  afterISO: string; // YYYY-MM-DD inclusive
  beforeISO: string; // YYYY-MM-DD exclusive
}

export interface HistoricalFetchResult {
  window: HistoricalWindow;
  keywords: string[];
  seen: number;
  inserted: number;
  url_duplicates: number;
  title_hash_duplicates: number;
  skipped_out_of_window: number;
  error?: string;
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleHash(title: string): string {
  const normalised = normaliseTitle(title);
  if (!normalised) return "";
  return crypto.createHash("sha1").update(normalised).digest("hex").slice(0, 16);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, "") + "...";
}

function buildHistoricalUrl(
  keywords: string[],
  window: HistoricalWindow
): string {
  // Google News search supports `after:YYYY-MM-DD before:YYYY-MM-DD` inline.
  // Quote each keyword so multi-word phrases stay intact; OR-join to broaden.
  const orJoined = keywords.map((k) => `"${k}"`).join(" OR ");
  const q = `${orJoined} after:${window.afterISO} before:${window.beforeISO}`;
  const params = new URLSearchParams({
    q,
    hl: "en-AU",
    gl: "AU",
    ceid: "AU:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * Ensure the "Google News" source row exists so that
 * raw_articles rows we insert have a valid source_name that joins cleanly
 * against other tables (prefetchFullText, source-tier lookups, etc.).
 */
export async function ensureGoogleNewsSource(): Promise<void> {
  await pool.query(
    `INSERT INTO sources (name, feed_url, source_type, tier, fulltext_supported, is_active)
     VALUES ($1, $2, 'api', 3, false, true)
     ON CONFLICT (name) DO NOTHING`,
    [SOURCE_NAME, SOURCE_URL]
  );
}

/**
 * Fetch Google News RSS for `keywords` inside `window` and insert results
 * into raw_articles with full dedup (URL + title_hash). Safe to call
 * repeatedly for the same (window, keywords) pair.
 */
export async function fetchHistoricalWindow(
  keywords: string[],
  window: HistoricalWindow
): Promise<HistoricalFetchResult> {
  const url = buildHistoricalUrl(keywords, window);
  const now = new Date().toISOString();
  const res: HistoricalFetchResult = {
    window,
    keywords,
    seen: 0,
    inserted: 0,
    url_duplicates: 0,
    title_hash_duplicates: 0,
    skipped_out_of_window: 0,
  };

  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (err) {
    res.error = err instanceof Error ? err.message : String(err);
    return res;
  }

  // Window bounds for safety — Google sometimes returns items just outside
  // the requested range.
  const afterMs = new Date(`${window.afterISO}T00:00:00Z`).getTime();
  const beforeMs = new Date(`${window.beforeISO}T00:00:00Z`).getTime();

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    for (const item of feed.items) {
      if (!item.link || !item.title) continue;
      res.seen++;

      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      if (publishedAt) {
        const t = publishedAt.getTime();
        if (Number.isFinite(t) && (t < afterMs || t >= beforeMs)) {
          res.skipped_out_of_window++;
          continue;
        }
      }

      // Google News titles are " Headline - Source Name". Strip the suffix
      // for a clean title and keep the source for attribution.
      const rawTitle = item.title.trim();
      const sepIndex = rawTitle.lastIndexOf(" - ");
      const cleanedTitle =
        sepIndex > 0 ? rawTitle.slice(0, sepIndex).trim() : rawTitle;
      const articleSource =
        sepIndex > 0 ? rawTitle.slice(sepIndex + 3).trim() : SOURCE_NAME;

      const snippet = truncate(
        stripHtml(item.contentSnippet || item.content || ""),
        400
      );

      const hash = titleHash(cleanedTitle);

      // Layer 1 — URL uniqueness.
      const urlInsert = await client.query<{ id: string }>(
        `INSERT INTO raw_articles
           (title, snippet, source_name, source_url, article_url, published_at, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (article_url) DO NOTHING
         RETURNING id`,
        [
          cleanedTitle,
          snippet || null,
          articleSource,
          SOURCE_URL,
          item.link,
          publishedAt ? publishedAt.toISOString() : null,
          now,
        ]
      );

      if (urlInsert.rows.length === 0) {
        res.url_duplicates++;
        continue;
      }

      // Layer 2 — title_hash uniqueness. If the hash is already owned by
      // another row we treat this freshly-inserted row as the loser and
      // delete it, keeping the older canonical copy.
      if (!hash) continue;
      try {
        await client.query(
          `UPDATE raw_articles SET title_hash = $1 WHERE id = $2`,
          [hash, urlInsert.rows[0].id]
        );
        res.inserted++;
      } catch {
        // Unique-partial index collision → another row already owns this
        // title_hash. Roll back this specific insert so it doesn't pollute
        // enrichment queues downstream.
        await client.query(`DELETE FROM raw_articles WHERE id = $1`, [
          urlInsert.rows[0].id,
        ]);
        res.title_hash_duplicates++;
      }
    }
  } finally {
    if (client) client.release();
  }

  return res;
}

/**
 * Split a date range into N-day windows ending at `endISO` (exclusive).
 * Returns the windows in chronological order (oldest first).
 */
export function makeWindows(
  monthsBack: number,
  windowDays: number = 7,
  endISO?: string
): HistoricalWindow[] {
  const end = endISO
    ? new Date(`${endISO}T00:00:00Z`)
    : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - monthsBack);

  const windows: HistoricalWindow[] = [];
  let cursor = new Date(start);
  while (cursor.getTime() < end.getTime()) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + windowDays);
    const bounded = next.getTime() > end.getTime() ? end : next;
    windows.push({
      afterISO: cursor.toISOString().slice(0, 10),
      beforeISO: bounded.toISOString().slice(0, 10),
    });
    cursor = bounded;
  }
  return windows;
}
