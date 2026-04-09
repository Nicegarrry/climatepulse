-- Add major report flag to raw_articles
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS is_major_report BOOLEAN DEFAULT FALSE;

-- Update source_type constraint to include 'report'
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check
  CHECK (source_type IN ('rss', 'scrape', 'api', 'report'));
