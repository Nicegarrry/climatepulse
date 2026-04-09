-- ASX Markets schema
-- Run: psql $DATABASE_URL -f scripts/migrate-markets.sql

-- ASX Watchlist tickers
CREATE TABLE IF NOT EXISTS asx_tickers (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  sub_sector TEXT NOT NULL CHECK (sub_sector IN ('utilities', 'oil_gas', 'minerals', 'renewables', 'etfs', 'infrastructure')),
  entity_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASX announcements
CREATE TABLE IF NOT EXISTS asx_announcements (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  title TEXT NOT NULL,
  pdf_url TEXT,
  released_at TIMESTAMPTZ NOT NULL,
  is_market_sensitive BOOLEAN DEFAULT FALSE,
  should_extract_pdf BOOLEAN DEFAULT FALSE,
  raw_article_id UUID,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, released_at, title)
);

-- Price history (daily EOD)
CREATE TABLE IF NOT EXISTS asx_prices (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  trade_date DATE NOT NULL,
  open_price NUMERIC(10,4),
  close_price NUMERIC(10,4),
  day_high NUMERIC(10,4),
  day_low NUMERIC(10,4),
  volume BIGINT,
  change_percent NUMERIC(6,3),
  UNIQUE(ticker, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_asx_announcements_ticker ON asx_announcements(ticker);
CREATE INDEX IF NOT EXISTS idx_asx_announcements_released ON asx_announcements(released_at DESC);
CREATE INDEX IF NOT EXISTS idx_asx_prices_ticker_date ON asx_prices(ticker, trade_date DESC);
