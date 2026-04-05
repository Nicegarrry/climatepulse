-- Expand source_type to allow 'api'
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check
  CHECK (source_type IN ('rss', 'scrape', 'api'));

-- Seed NewsAPI sources (tier 3 — supplementary API sources)
INSERT INTO sources (name, feed_url, source_type, tier) VALUES
  ('NewsAPI.ai', 'https://eventregistry.org', 'api', 3),
  ('NewsAPI.org', 'https://newsapi.org', 'api', 3)
ON CONFLICT (name) DO NOTHING;
