import * as cheerio from "cheerio";
import pool from "@/lib/db";
import { SCRAPE_TARGETS, type ScrapeTarget } from "@/lib/sources";

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, "") + "...";
}

interface ScrapedItem {
  title: string;
  snippet: string | null;
  articleUrl: string;
  publishedAt: string | null;
}

function extractItems(target: ScrapeTarget, html: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $(target.articleSelector).each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find(target.linkSelector).first();
    const href = linkEl.attr("href");
    if (!href) return;

    const articleUrl = resolveUrl(href, target.url);
    const title = $el.find(target.titleSelector).first().text().trim();
    if (!title) return;

    const snippet = target.snippetSelector
      ? truncate($el.find(target.snippetSelector).first().text().trim(), 500)
      : null;

    const dateText = target.dateSelector
      ? $el.find(target.dateSelector).first().text().trim()
      : null;
    let publishedAt: string | null = null;
    if (dateText) {
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
    }

    items.push({ title, snippet, articleUrl, publishedAt });
  });

  return items;
}

async function scrapeTarget(target: ScrapeTarget): Promise<{
  newCount: number;
  dupCount: number;
}> {
  const html = await fetchPage(target.url);
  const items = extractItems(target, html);
  const now = new Date().toISOString();
  let newCount = 0;
  let dupCount = 0;

  for (const item of items) {
    try {
      const res = await pool.query(
        `INSERT INTO raw_articles (title, snippet, source_name, source_url, article_url, published_at, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (article_url) DO NOTHING
         RETURNING id`,
        [item.title, item.snippet, target.name, target.url, item.articleUrl, item.publishedAt, now]
      );
      if (res.rows.length > 0) {
        newCount++;
      } else {
        dupCount++;
      }
    } catch {
      dupCount++;
    }
  }

  // Update source health
  await pool.query(
    `UPDATE sources SET last_polled = $1, last_successful_poll = $1, consecutive_failures = 0,
     total_articles_found = total_articles_found + $2
     WHERE name = $3`,
    [now, newCount, target.name]
  );

  return { newCount, dupCount };
}

export interface ScrapeResult {
  sites_scraped: number;
  new_articles: number;
  duplicates_skipped: number;
  errors: number;
  error_details: Array<{ source: string; error: string }>;
}

export async function scrapeAllTargets(): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    sites_scraped: 0,
    new_articles: 0,
    duplicates_skipped: 0,
    errors: 0,
    error_details: [],
  };

  for (const target of SCRAPE_TARGETS) {
    result.sites_scraped++;
    try {
      const { newCount, dupCount } = await scrapeTarget(target);
      result.new_articles += newCount;
      result.duplicates_skipped += dupCount;
    } catch (err) {
      result.errors++;
      result.error_details.push({
        source: target.name,
        error: err instanceof Error ? err.message : String(err),
      });

      const now = new Date().toISOString();
      await pool.query(
        `UPDATE sources SET last_polled = $1, consecutive_failures = consecutive_failures + 1
         WHERE name = $2`,
        [now, target.name]
      ).catch(() => {});
    }
  }

  return result;
}
