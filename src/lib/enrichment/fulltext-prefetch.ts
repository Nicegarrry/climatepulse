import * as cheerio from "cheerio";
import pool from "@/lib/db";

/**
 * Fetch a page and extract the main article text content.
 * Strips nav, footer, sidebar, ads, scripts, styles, etc.
 */
async function fetchAndExtract(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
    "article",
    "main",
    ".content",
    "#content",
  ];

  let text = "";
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      break;
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

/**
 * Prefetch full text for articles that don't have it yet,
 * targeting sources that support full text extraction.
 * Processes in chunks of 5 for concurrency control.
 */
export async function prefetchFullText(
  limit: number = 50
): Promise<{ fetched: number; failed: number }> {
  const { rows: articles } = await pool.query<{
    id: string;
    article_url: string;
  }>(
    `SELECT ra.id, ra.article_url FROM raw_articles ra
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     JOIN sources src ON src.name = ra.source_name
     WHERE ft.id IS NULL AND src.fulltext_supported = true
     ORDER BY ra.fetched_at DESC
     LIMIT $1`,
    [limit]
  );

  if (articles.length === 0) {
    return { fetched: 0, failed: 0 };
  }

  let fetched = 0;
  let failed = 0;

  // Process in chunks of 5
  const chunks: (typeof articles)[] = [];
  for (let i = 0; i < articles.length; i += 5) {
    chunks.push(articles.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (article) => {
        try {
          const content = await fetchAndExtract(article.article_url);
          if (!content) return false;

          const wordCount = content.split(/\s+/).length;
          await pool.query(
            `INSERT INTO full_text_articles (raw_article_id, content, word_count)
             VALUES ($1, $2, $3)
             ON CONFLICT (raw_article_id) DO UPDATE SET content = $2, word_count = $3, extracted_at = NOW()`,
            [article.id, content, wordCount]
          );
          return true;
        } catch (err) {
          console.error(
            `Full text fetch failed for ${article.article_url}:`,
            err instanceof Error ? err.message : err
          );
          return false;
        }
      })
    );

    for (const ok of results) {
      if (ok) fetched++;
      else failed++;
    }
  }

  return { fetched, failed };
}
