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

-- Phase 2a: Categorisation tables

CREATE TABLE IF NOT EXISTS categorised_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id),
  primary_category TEXT NOT NULL,
  secondary_categories TEXT[] DEFAULT '{}',
  categorised_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  UNIQUE(raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_primary ON categorised_articles(primary_category);
CREATE INDEX IF NOT EXISTS idx_cat_article ON categorised_articles(raw_article_id);

-- Full text extraction

CREATE TABLE IF NOT EXISTS full_text_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id),
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_fulltext_article ON full_text_articles(raw_article_id);

ALTER TABLE sources ADD COLUMN IF NOT EXISTS fulltext_supported BOOLEAN DEFAULT NULL;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS fulltext_tested_at TIMESTAMPTZ DEFAULT NULL;
