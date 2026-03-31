-- Phase 1: Discovery tables

-- Source health tracking
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  feed_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'scrape')),
  tier INTEGER NOT NULL DEFAULT 1,
  last_polled TIMESTAMPTZ,
  last_successful_poll TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  total_articles_found INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw articles from all sources
CREATE TABLE IF NOT EXISTS raw_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  snippet TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  article_url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_articles_published ON raw_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_articles_source ON raw_articles(source_name);
CREATE INDEX IF NOT EXISTS idx_raw_articles_url ON raw_articles(article_url);
CREATE INDEX IF NOT EXISTS idx_raw_articles_fetched ON raw_articles(fetched_at DESC);
