-- Full text extraction table

CREATE TABLE IF NOT EXISTS full_text_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id),
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_fulltext_article ON full_text_articles(raw_article_id);

-- Track which sources support full text extraction
ALTER TABLE sources ADD COLUMN IF NOT EXISTS fulltext_supported BOOLEAN DEFAULT NULL;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS fulltext_tested_at TIMESTAMPTZ DEFAULT NULL;
