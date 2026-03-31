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
