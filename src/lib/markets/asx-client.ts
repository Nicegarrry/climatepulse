import pool from "@/lib/db";
import type { ASXCurrentPrice, AnnouncementFetchResult, PriceFetchResult } from "./types";

const ASX_BASE = "https://www.asx.com.au/asx/1";
const FETCH_DELAY_MS = 500;

// Keywords that indicate PDF extraction is worthwhile
const PDF_EXTRACT_KEYWORDS = [
  "acquires", "acquisition", "ppa", "power purchase", "fid", "financial close",
  "production report", "quarterly", "results", "strategy", "target",
  "partnership", "joint venture", "funding", "capital raise",
];

const PDF_SKIP_KEYWORDS = [
  "appendix", "change of director", "becoming a substantial holder",
  "section 708a", "cleansing notice", "daily share buy-back",
];

function shouldExtractPdf(title: string): boolean {
  const lower = title.toLowerCase();
  if (PDF_SKIP_KEYWORDS.some((kw) => lower.includes(kw))) return false;
  return PDF_EXTRACT_KEYWORDS.some((kw) => lower.includes(kw));
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch announcements for a single ticker from ASX API */
export async function fetchTickerAnnouncements(ticker: string): Promise<{
  announcements: Array<{
    title: string;
    url: string;
    date: string;
    is_market_sensitive: boolean;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch(
      `${ASX_BASE}/company/${ticker}/announcements?count=10&market_sensitive=true`,
      {
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "catalyst.study/1.0" },
      },
    );
    if (!res.ok) return { announcements: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    // ASX returns { data: [{ header, document_date, url, market_sensitive, ... }] }
    const items = data.data ?? [];
    return {
      announcements: items.map((item: Record<string, unknown>) => ({
        title: (item.header as string) ?? "",
        url: (item.url as string) ?? "",
        date: (item.document_date as string) ?? new Date().toISOString(),
        is_market_sensitive: (item.market_sensitive as boolean) ?? false,
      })),
    };
  } catch (err) {
    return {
      announcements: [],
      error: err instanceof Error ? err.message : "Unknown",
    };
  }
}

/** Fetch current price for a single ticker */
export async function fetchTickerPrice(
  ticker: string,
): Promise<ASXCurrentPrice | null> {
  try {
    const res = await fetch(`${ASX_BASE}/share/${ticker}`, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "catalyst.study/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ticker,
      last_price: data.last_price ?? 0,
      change_price: data.change_price ?? 0,
      change_percent: data.change_in_percent
        ? parseFloat(String(data.change_in_percent).replace("%", ""))
        : 0,
      volume: data.volume ?? 0,
      day_high: data.day_high_price ?? 0,
      day_low: data.day_low_price ?? 0,
      previous_close: data.previous_close_price ?? 0,
    };
  } catch {
    return null;
  }
}

/** Fetch and store announcements for ALL active tickers */
export async function fetchAllAnnouncements(): Promise<AnnouncementFetchResult> {
  const start = Date.now();
  const { rows: tickers } = await pool.query(
    "SELECT ticker FROM asx_tickers WHERE is_active = true",
  );

  let newAnnouncements = 0;
  let errors = 0;

  for (const { ticker } of tickers) {
    const result = await fetchTickerAnnouncements(ticker);
    if (result.error) {
      errors++;
      await delay(FETCH_DELAY_MS);
      continue;
    }

    for (const ann of result.announcements) {
      const { rowCount } = await pool.query(
        `INSERT INTO asx_announcements (ticker, title, pdf_url, released_at, is_market_sensitive, should_extract_pdf)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (ticker, released_at, title) DO NOTHING`,
        [
          ticker,
          ann.title,
          ann.url,
          ann.date,
          ann.is_market_sensitive,
          shouldExtractPdf(ann.title),
        ],
      );
      if (rowCount && rowCount > 0) {
        newAnnouncements++;
        // Also insert into raw_articles for enrichment pipeline
        await pool.query(
          `INSERT INTO raw_articles (id, title, snippet, source_name, source_url, article_url, published_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
           ON CONFLICT (article_url) DO NOTHING`,
          [
            ann.title,
            ann.title,
            `ASX:${ticker}`,
            "https://www.asx.com.au",
            ann.url || `asx://${ticker}/${ann.date}`,
            ann.date,
          ],
        );
      }
    }
    await delay(FETCH_DELAY_MS);
  }

  return {
    tickers_fetched: tickers.length,
    new_announcements: newAnnouncements,
    errors,
    duration_ms: Date.now() - start,
  };
}

/** Fetch and store current prices for all active tickers */
export async function fetchAllPrices(): Promise<PriceFetchResult> {
  const start = Date.now();
  const { rows: tickers } = await pool.query(
    "SELECT ticker FROM asx_tickers WHERE is_active = true",
  );
  let stored = 0;
  let errors = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const { ticker } of tickers) {
    const price = await fetchTickerPrice(ticker);
    if (!price) {
      errors++;
      await delay(FETCH_DELAY_MS);
      continue;
    }

    await pool.query(
      `INSERT INTO asx_prices (ticker, trade_date, open_price, close_price, day_high, day_low, volume, change_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ticker, trade_date) DO UPDATE SET
         close_price = EXCLUDED.close_price,
         day_high = EXCLUDED.day_high,
         day_low = EXCLUDED.day_low,
         volume = EXCLUDED.volume,
         change_percent = EXCLUDED.change_percent`,
      [
        ticker,
        today,
        price.last_price,
        price.last_price,
        price.day_high,
        price.day_low,
        price.volume,
        price.change_percent,
      ],
    );
    stored++;
    await delay(FETCH_DELAY_MS);
  }

  return {
    tickers_fetched: tickers.length,
    prices_stored: stored,
    errors,
    duration_ms: Date.now() - start,
  };
}
