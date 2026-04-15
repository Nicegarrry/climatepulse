import * as cheerio from "cheerio";
import pool from "@/lib/db";

/**
 * Fetch a page and extract the main article text content.
 * Strips nav, footer, sidebar, ads, scripts, styles, etc.
 */
export async function fetchAndExtract(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove noise elements
  $(
    "script, style, nav, footer, header, aside, .sidebar, .ad, .ads, .advertisement, " +
    ".social-share, .share-buttons, .related-posts, .comments, .comment-section, " +
    ".newsletter-signup, .cookie-banner, .popup, noscript, iframe, svg, figure figcaption, " +
    "[role='navigation'], [role='banner'], [role='contentinfo'], [aria-hidden='true']"
  ).remove();

  // Try common article selectors in priority order
  const selectors = [
    "article .entry-content",
    "article .post-content",
    "article .article-body",
    "article .story-body",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".story-content",
    "[itemprop='articleBody']",
    ".prose",              // Canary Media, CTVC (Ghost CMS)
    ".gutenberg-simple",   // Bellona
    ".mainC",              // Carbon Brief
    "article",
    "main",
    ".content",
    "#content",
  ];

  let text = "";
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const candidate = el.text().replace(/\s+/g, " ").trim();
      if (candidate.split(/\s+/).length >= 100) {
        text = candidate;
        break;
      }
      // Keep first match as fallback, but try better selectors
      if (!text) text = candidate;
    }
  }

  // Fallback: body
  if (!text) {
    text = $("body").text();
  }

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Must have meaningful content (at least 100 words)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 100) return null;

  return text;
}

export interface FulltextTestResult {
  source_name: string;
  success: boolean;
  article_title: string | null;
  article_url: string | null;
  word_count: number;
  error: string | null;
}

/**
 * Test full text extraction for each source by picking one random article per source.
 */
export async function testFullTextBySources(): Promise<FulltextTestResult[]> {
  // Get one random article per source (prefer articles without full text already)
  const { rows: sources } = await pool.query<{
    source_name: string;
    article_id: string;
    article_url: string;
    title: string;
  }>(
    `SELECT DISTINCT ON (ra.source_name)
       ra.source_name,
       ra.id as article_id,
       ra.article_url,
       ra.title
     FROM raw_articles ra
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     WHERE ft.id IS NULL
     ORDER BY ra.source_name, RANDOM()`
  );

  // If all articles already have full text for some sources, fall back to any article
  const { rows: allSources } = await pool.query<{ name: string }>(
    `SELECT DISTINCT source_name as name FROM raw_articles`
  );

  const coveredSources = new Set(sources.map((s) => s.source_name));
  const missingSources = allSources.filter((s) => !coveredSources.has(s.name));

  if (missingSources.length > 0) {
    const { rows: fallback } = await pool.query<{
      source_name: string;
      article_id: string;
      article_url: string;
      title: string;
    }>(
      `SELECT DISTINCT ON (ra.source_name)
         ra.source_name,
         ra.id as article_id,
         ra.article_url,
         ra.title
       FROM raw_articles ra
       WHERE ra.source_name = ANY($1)
       ORDER BY ra.source_name, RANDOM()`,
      [missingSources.map((s) => s.name)]
    );
    sources.push(...fallback);
  }

  // Test each source in parallel (with concurrency limit of 5)
  const results: FulltextTestResult[] = [];
  const chunks: typeof sources[] = [];
  for (let i = 0; i < sources.length; i += 5) {
    chunks.push(sources.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (source) => {
        try {
          const content = await fetchAndExtract(source.article_url);
          const wordCount = content ? content.split(/\s+/).length : 0;

          if (content) {
            // Store the full text
            await pool.query(
              `INSERT INTO full_text_articles (raw_article_id, content, word_count)
               VALUES ($1, $2, $3)
               ON CONFLICT (raw_article_id) DO UPDATE SET content = $2, word_count = $3, extracted_at = NOW()`,
              [source.article_id, content, wordCount]
            );
          }

          // Update source fulltext status
          await pool.query(
            `UPDATE sources SET fulltext_supported = $1, fulltext_tested_at = NOW()
             WHERE name = $2`,
            [!!content, source.source_name]
          );

          return {
            source_name: source.source_name,
            success: !!content,
            article_title: source.title,
            article_url: source.article_url,
            word_count: wordCount,
            error: content ? null : "Could not extract meaningful content (< 100 words)",
          };
        } catch (err) {
          // Update source as not supported
          await pool.query(
            `UPDATE sources SET fulltext_supported = false, fulltext_tested_at = NOW()
             WHERE name = $1`,
            [source.source_name]
          ).catch(() => {});

          return {
            source_name: source.source_name,
            success: false,
            article_title: source.title,
            article_url: source.article_url,
            word_count: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Bulk-extract full text for all raw_articles missing from full_text_articles.
 * Processes in batches of 10 with concurrency 5, respects a time budget.
 */
export async function extractAllFullText(
  timeBudgetMs: number = 3 * 60 * 1000,
  maxAgeHours: number = 48
): Promise<{
  processed: number;
  successes: number;
  failures: number;
  remaining: number;
  budget_exceeded: boolean;
}> {
  const deadline = Date.now() + timeBudgetMs;
  let processed = 0;
  let successes = 0;
  let failures = 0;
  const BATCH_SIZE = 10;
  const CONCURRENCY = 5;
  const attempted = new Set<string>(); // Track attempted IDs to avoid re-processing

  while (Date.now() < deadline) {
    // Fetch next batch of recent articles without full text
    // Only process articles ingested within maxAgeHours to skip stale URLs
    const excludeIds = Array.from(attempted);
    const batch = await pool.query(
      `SELECT ra.id, ra.article_url, ra.source_name
       FROM raw_articles ra
       LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
       WHERE ft.id IS NULL
         AND ra.fetched_at > NOW() - INTERVAL '1 hour' * $2
         ${excludeIds.length > 0 ? `AND ra.id != ALL($3::uuid[])` : ""}
       ORDER BY ra.fetched_at DESC
       LIMIT $1`,
      excludeIds.length > 0
        ? [BATCH_SIZE, maxAgeHours, excludeIds]
        : [BATCH_SIZE, maxAgeHours]
    );

    if (batch.rows.length === 0) {
      // All articles have full text
      return { processed, successes, failures, remaining: 0, budget_exceeded: false };
    }

    // Process batch with concurrency limit
    const articles = batch.rows as Array<{
      id: string;
      article_url: string;
      source_name: string;
    }>;

    for (let i = 0; i < articles.length; i += CONCURRENCY) {
      if (Date.now() >= deadline) {
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM raw_articles ra
           LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
           WHERE ft.id IS NULL
             AND ra.fetched_at > NOW() - INTERVAL '1 hour' * $1`,
          [maxAgeHours]
        );
        const remaining = parseInt(countResult.rows[0].cnt, 10);
        return { processed, successes, failures, remaining, budget_exceeded: true };
      }

      const chunk = articles.slice(i, i + CONCURRENCY);
      // Track all attempted articles to avoid re-fetching failures
      for (const a of chunk) attempted.add(a.id);
      const results = await Promise.allSettled(
        chunk.map(async (article) => {
          const text = await fetchAndExtract(article.article_url);
          if (text) {
            const wordCount = text.split(/\s+/).length;
            await pool.query(
              `INSERT INTO full_text_articles (raw_article_id, content, word_count)
               VALUES ($1, $2, $3)
               ON CONFLICT (raw_article_id) DO UPDATE SET
                 content = EXCLUDED.content,
                 word_count = EXCLUDED.word_count,
                 extracted_at = NOW()`,
              [article.id, text, wordCount]
            );
            return true;
          }
          return false;
        })
      );

      for (const r of results) {
        processed++;
        if (r.status === "fulfilled" && r.value) {
          successes++;
        } else {
          failures++;
        }
      }
    }
  }

  // Budget exceeded — count remaining
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM raw_articles ra
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     WHERE ft.id IS NULL
       AND ra.fetched_at > NOW() - INTERVAL '1 hour' * $1`,
    [maxAgeHours]
  );
  const remaining = parseInt(countResult.rows[0].cnt, 10);
  return { processed, successes, failures, remaining, budget_exceeded: true };
}
