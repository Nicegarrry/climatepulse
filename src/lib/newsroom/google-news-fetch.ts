// Google News RSS search fetcher.
//
// Uses the keyless RSS search endpoint at news.google.com/rss/search.
// Pattern: https://news.google.com/rss/search?q=<encoded>&hl=en-AU&gl=AU&ceid=AU:en
//
// Throttled to ~1 request per second to avoid rate-limit pressure.
// Reuses the standard ON CONFLICT (article_url) DO NOTHING dedup against
// raw_articles, the same convention as poller.ts.

import RSSParser from "rss-parser";
import pool from "@/lib/db";
import { NEWSAPI_AI_QUERIES } from "@/lib/discovery/news-queries";

const SOURCE_NAME = "Google News";
const SOURCE_URL = "https://news.google.com";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.1",
  "Accept-Language": "en-AU,en;q=0.9",
};

const parser = new RSSParser({ timeout: 20_000, headers: REQUEST_HEADERS });

function buildQueryUrl(keywords: string[]): string {
  // Google News supports rough boolean: terms separated by OR (case-sensitive).
  // when:1h restricts to the last hour — perfect for the 30-min cron cadence.
  const orJoined = keywords.map((k) => `"${k}"`).join(" OR ");
  const q = `${orJoined} when:1h`;
  const params = new URLSearchParams({
    q,
    hl: "en-AU",
    gl: "AU",
    ceid: "AU:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, "") + "...";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GoogleNewsResult {
  source: "Google News";
  new_articles: number;
  duplicates_skipped: number;
  errors: number;
  duration_ms: number;
  error_details: Array<{ query: string; error: string }>;
}

/**
 * Fetch the Google News RSS search feed for each keyword group and insert
 * fresh items into raw_articles. Items older than ~60 minutes are skipped
 * (one cycle's safety margin past the 30-min cron interval).
 */
export async function fetchGoogleNews(): Promise<GoogleNewsResult> {
  const start = Date.now();
  const result: GoogleNewsResult = {
    source: "Google News",
    new_articles: 0,
    duplicates_skipped: 0,
    errors: 0,
    duration_ms: 0,
    error_details: [],
  };

  const cutoff = Date.now() - 60 * 60 * 1000;
  const now = new Date().toISOString();

  for (let i = 0; i < NEWSAPI_AI_QUERIES.length; i++) {
    const keywords = NEWSAPI_AI_QUERIES[i];
    const url = buildQueryUrl(keywords);

    try {
      const feed = await parser.parseURL(url);

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
        if (publishedAt && publishedAt.getTime() < cutoff) continue;

        // Google News titles include " - Source Name" suffix. Strip it but
        // capture the real source name for accurate attribution.
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

        try {
          const dbRes = await pool.query(
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

          if (dbRes.rows.length > 0) {
            result.new_articles++;
          } else {
            result.duplicates_skipped++;
          }
        } catch {
          result.duplicates_skipped++;
        }
      }
    } catch (err) {
      result.errors++;
      result.error_details.push({
        query: keywords.join(", ").slice(0, 60),
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Throttle: avoid hammering Google News.
    if (i < NEWSAPI_AI_QUERIES.length - 1) await sleep(1000);
  }

  result.duration_ms = Date.now() - start;
  return result;
}
