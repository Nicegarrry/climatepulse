import pool from "@/lib/db";

/** Fetch 30-day price history from Yahoo Finance for a single ticker */
export async function fetchPriceHistory(ticker: string): Promise<number> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.AX?range=30d&interval=1d`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return 0;

    const timestamps: number[] = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? {};
    let stored = 0;

    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
      const open = quotes.open?.[i];
      const close = quotes.close?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const volume = quotes.volume?.[i];

      if (close == null) continue;

      const prevClose = i > 0 ? quotes.close?.[i - 1] : null;
      const changePct = prevClose
        ? ((close - prevClose) / prevClose) * 100
        : 0;

      await pool.query(
        `INSERT INTO asx_prices (ticker, trade_date, open_price, close_price, day_high, day_low, volume, change_percent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (ticker, trade_date) DO NOTHING`,
        [
          ticker,
          date,
          open,
          close,
          high,
          low,
          volume,
          Math.round(changePct * 1000) / 1000,
        ],
      );
      stored++;
    }
    return stored;
  } catch {
    return 0;
  }
}

/** Backfill all active tickers with 30-day price history */
export async function backfillAllPriceHistory(): Promise<{
  tickers: number;
  prices_stored: number;
  errors: number;
}> {
  const { rows: tickers } = await pool.query(
    "SELECT ticker FROM asx_tickers WHERE is_active = true",
  );
  let totalStored = 0;
  let errors = 0;

  for (const { ticker } of tickers) {
    const stored = await fetchPriceHistory(ticker);
    if (stored === 0) errors++;
    else totalStored += stored;
    await new Promise((r) => setTimeout(r, 500));
  }

  return { tickers: tickers.length, prices_stored: totalStored, errors };
}
