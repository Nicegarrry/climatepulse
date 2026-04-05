import pool from "@/lib/db";
import { NEWSAPI_ORG_QUERIES, NEWSAPI_ORG_PAGE_SIZE } from "./news-queries";
import type { NewsApiRunResult } from "@/lib/types";

interface NewsApiOrgArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null; // Truncated to 200 chars by API
}

interface NewsApiOrgResponse {
  status: string;
  totalResults: number;
  articles: NewsApiOrgArticle[];
  code?: string;
  message?: string;
}

export async function fetchNewsApiOrg(): Promise<NewsApiRunResult> {
  const start = Date.now();
  const apiKey = process.env.NEWSAPI_ORG_KEY;

  if (!apiKey) {
    return {
      source: "NewsAPI.org",
      new_articles: 0,
      duplicates_skipped: 0,
      full_text_stored: 0,
      errors: 1,
      duration_ms: Date.now() - start,
      error_details: [{ query: "*", error: "NEWSAPI_ORG_KEY not set in .env.local" }],
    };
  }

  const now = new Date().toISOString();
  // Past 24 hours only (free tier has 24h delay, so yesterday)
  const from = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let totalNew = 0;
  let totalDups = 0;
  let totalErrors = 0;
  const errorDetails: Array<{ query: string; error: string }> = [];

  for (const queryStr of NEWSAPI_ORG_QUERIES) {
    try {
      const params = new URLSearchParams({
        q: queryStr,
        searchIn: "title",
        language: "en",
        sortBy: "publishedAt",
        pageSize: String(NEWSAPI_ORG_PAGE_SIZE),
        from,
        to,
        apiKey,
      });

      const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });

      const data: NewsApiOrgResponse = await res.json();

      if (data.status !== "ok") {
        totalErrors++;
        errorDetails.push({
          query: queryStr.slice(0, 60) + "...",
          error: data.message || `API returned status: ${data.status} (${data.code})`,
        });
        continue;
      }

      for (const article of data.articles) {
        if (!article.url || !article.title) continue;
        // Skip "[Removed]" articles (NewsAPI.org returns these for paywalled content)
        if (article.title === "[Removed]") continue;

        try {
          const dbRes = await pool.query(
            `INSERT INTO raw_articles (title, snippet, source_name, source_url, article_url, published_at, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (article_url) DO NOTHING
             RETURNING id`,
            [
              article.title,
              article.description,
              "NewsAPI.org",
              "https://newsapi.org",
              article.url,
              article.publishedAt ? new Date(article.publishedAt).toISOString() : null,
              now,
            ]
          );

          if (dbRes.rows.length > 0) {
            totalNew++;
          } else {
            totalDups++;
          }
        } catch {
          totalDups++;
        }
      }
    } catch (err) {
      totalErrors++;
      errorDetails.push({
        query: queryStr.slice(0, 60) + "...",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update source health
  if (totalErrors < NEWSAPI_ORG_QUERIES.length) {
    await pool.query(
      `UPDATE sources SET last_polled = $1, last_successful_poll = $1, consecutive_failures = 0,
       total_articles_found = total_articles_found + $2
       WHERE name = 'NewsAPI.org'`,
      [now, totalNew]
    ).catch(() => {});
  } else {
    await pool.query(
      `UPDATE sources SET last_polled = $1, consecutive_failures = consecutive_failures + 1
       WHERE name = 'NewsAPI.org'`,
      [now]
    ).catch(() => {});
  }

  return {
    source: "NewsAPI.org",
    new_articles: totalNew,
    duplicates_skipped: totalDups,
    full_text_stored: 0, // NewsAPI.org truncates content
    errors: totalErrors,
    duration_ms: Date.now() - start,
    error_details: errorDetails,
  };
}
