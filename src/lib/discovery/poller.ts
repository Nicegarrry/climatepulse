import RSSParser from "rss-parser";
import pool from "@/lib/db";
import { RSS_SOURCES } from "@/lib/sources";
import { isMajorReport } from "./report-keywords";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.1",
  "Accept-Language": "en-US,en;q=0.9",
};

const parser = new RSSParser({
  timeout: 30_000,
  headers: FETCH_HEADERS,
});

// ClimatePulse is a forward-looking daily digest — the briefing only looks
// back 32h, so there's no value in ingesting items older than a week. Also
// prevents podcast feeds (which serve full episode history) from re-populating
// multi-year backlogs on every poll.
const MAX_ARTICLE_AGE_DAYS = 7;
const MAX_ARTICLE_AGE_MS = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, "") + "...";
}

export interface PollResult {
  feeds_polled: number;
  new_articles: number;
  duplicates_skipped: number;
  errors: number;
  error_details: Array<{ source: string; error: string }>;
}

export async function pollAllFeeds(): Promise<PollResult> {
  const result: PollResult = {
    feeds_polled: 0,
    new_articles: 0,
    duplicates_skipped: 0,
    errors: 0,
    error_details: [],
  };

  for (const source of RSS_SOURCES) {
    result.feeds_polled++;
    const now = new Date().toISOString();

    try {
      const feed = await parser.parseURL(source.feedUrl);
      let sourceNewCount = 0;

      for (const item of feed.items) {
        const articleUrl = item.link;
        if (!articleUrl) continue;

        const title = item.title?.trim() || "Untitled";
        const rawSnippet = item.contentSnippet || item.content || item.summary || "";
        const snippet = truncate(stripHtml(rawSnippet), 500);
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        const publishedAt = pubDate ? pubDate.toISOString() : null;

        // Skip items published more than MAX_ARTICLE_AGE_DAYS ago. Items with
        // no pubDate are kept (we can't tell how old they are).
        if (pubDate && Date.now() - pubDate.getTime() > MAX_ARTICLE_AGE_MS) {
          continue;
        }

        try {
          await pool.query(
            `INSERT INTO raw_articles (title, snippet, source_name, source_url, article_url, published_at, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (article_url) DO NOTHING`,
            [title, snippet || null, source.name, source.feedUrl, articleUrl, publishedAt, now]
          );

          // Check if the insert actually happened (no conflict)
          const res = await pool.query(
            `SELECT id FROM raw_articles WHERE article_url = $1 AND fetched_at = $2`,
            [articleUrl, now]
          );
          if (res.rows.length > 0) {
            sourceNewCount++;
            result.new_articles++;

            // Flag major reports
            if (isMajorReport(title)) {
              await pool.query(
                `UPDATE raw_articles SET is_major_report = TRUE WHERE article_url = $1`,
                [articleUrl]
              );
            }
          } else {
            result.duplicates_skipped++;
          }
        } catch {
          result.duplicates_skipped++;
        }
      }

      // Update source health — success
      await pool.query(
        `UPDATE sources SET last_polled = $1, last_successful_poll = $1, consecutive_failures = 0,
         total_articles_found = total_articles_found + $2
         WHERE name = $3`,
        [now, sourceNewCount, source.name]
      );
    } catch (err) {
      result.errors++;
      result.error_details.push({
        source: source.name,
        error: err instanceof Error ? err.message : String(err),
      });

      // Update source health — failure
      await pool.query(
        `UPDATE sources SET last_polled = $1, consecutive_failures = consecutive_failures + 1
         WHERE name = $2`,
        [now, source.name]
      );
    }
  }

  return result;
}
