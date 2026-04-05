import { EventRegistry, QueryArticlesIter, ArticleInfoFlags, ReturnInfo, QueryItems } from "eventregistry";
import pool from "@/lib/db";
import { NEWSAPI_AI_QUERIES, NEWSAPI_AI_MAX_PER_QUERY } from "./news-queries";
import type { NewsApiRunResult } from "@/lib/types";

// Use a permissive type since the library's Article type has all fields optional
interface ERArticle {
  [key: string]: unknown;
  uri?: string;
  url?: string;
  title?: string;
  body?: string;
  date?: string;
  time?: string;
  source?: { title?: string };
  image?: string;
}

export async function fetchNewsApiAi(): Promise<NewsApiRunResult> {
  const start = Date.now();
  const apiKey = process.env.NEWSAPI_AI_KEY;

  if (!apiKey) {
    return {
      source: "NewsAPI.ai",
      new_articles: 0,
      duplicates_skipped: 0,
      full_text_stored: 0,
      errors: 1,
      duration_ms: Date.now() - start,
      error_details: [{ query: "*", error: "NEWSAPI_AI_KEY not set in .env.local" }],
    };
  }

  const er = new EventRegistry({ apiKey });
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]; // YYYY-MM-DD

  let totalNew = 0;
  let totalDups = 0;
  let totalFullText = 0;
  let totalErrors = 0;
  const errorDetails: Array<{ query: string; error: string }> = [];

  const articleInfo = new ArticleInfoFlags({
    bodyLen: -1,
    image: true,
  });
  const returnInfo = new ReturnInfo({ articleInfo });

  for (const queryKeywords of NEWSAPI_AI_QUERIES) {
    try {
      const query = new QueryArticlesIter(er, {
        keywords: QueryItems.OR(queryKeywords),
        dateStart: sevenDaysAgo,
        lang: ["eng"],
        sortBy: "date",
        maxItems: NEWSAPI_AI_MAX_PER_QUERY,
        returnInfo,
      });

      const articles: ERArticle[] = [];
      await new Promise<void>((resolve) => {
        let resolved = false;
        query.execQuery(
          (article) => {
            articles.push(article as unknown as ERArticle);
          },
          () => { if (!resolved) { resolved = true; resolve(); } },
        );
        // Timeout safety
        setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 30_000);
      });

      for (const article of articles) {
        if (!article.url || !article.title) continue;

        // Build snippet from body (first 500 chars)
        const snippet = article.body
          ? article.body.slice(0, 500).replace(/\s\S*$/, "") + (article.body.length > 500 ? "..." : "")
          : null;

        const publishedAt = article.date
          ? new Date(`${article.date}T${article.time || "00:00:00"}Z`).toISOString()
          : null;

        try {
          const res = await pool.query(
            `INSERT INTO raw_articles (title, snippet, source_name, source_url, article_url, published_at, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (article_url) DO NOTHING
             RETURNING id`,
            [article.title, snippet, "NewsAPI.ai", "https://eventregistry.org", article.url, publishedAt, now]
          );

          if (res.rows.length > 0) {
            totalNew++;

            // Store full text if available
            if (article.body && article.body.split(/\s+/).length >= 50) {
              const wordCount = article.body.split(/\s+/).length;
              await pool.query(
                `INSERT INTO full_text_articles (raw_article_id, content, word_count)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (raw_article_id) DO NOTHING`,
                [res.rows[0].id, article.body, wordCount]
              );
              totalFullText++;
            }
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
        query: queryKeywords.join(", ").slice(0, 60) + "...",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update source health
  if (totalErrors < NEWSAPI_AI_QUERIES.length) {
    await pool.query(
      `UPDATE sources SET last_polled = $1, last_successful_poll = $1, consecutive_failures = 0,
       total_articles_found = total_articles_found + $2
       WHERE name = 'NewsAPI.ai'`,
      [now, totalNew]
    ).catch(() => {});
  } else {
    await pool.query(
      `UPDATE sources SET last_polled = $1, consecutive_failures = consecutive_failures + 1
       WHERE name = 'NewsAPI.ai'`,
      [now]
    ).catch(() => {});
  }

  return {
    source: "NewsAPI.ai",
    new_articles: totalNew,
    duplicates_skipped: totalDups,
    full_text_stored: totalFullText,
    errors: totalErrors,
    duration_ms: Date.now() - start,
    error_details: errorDetails,
  };
}
