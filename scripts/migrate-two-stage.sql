-- ClimatePulse: Two-Stage Enrichment Pipeline Migration
-- Adds significance scoring, context quality, domain classification, and pipeline versioning

-- =============================================================================
-- Enriched Articles: New columns for two-stage pipeline
-- =============================================================================

ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS significance_scores JSONB;
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS significance_composite NUMERIC(5,1);
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS context_quality TEXT CHECK (context_quality IN ('headline_only','snippet','full_text'));
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS primary_domain TEXT;
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS secondary_domain TEXT;
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS confidence_levels JSONB;
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS quantitative_data JSONB;
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS transmission_channels_triggered TEXT[] DEFAULT '{}';
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS pipeline_version INTEGER DEFAULT 1;

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_enriched_significance ON enriched_articles(significance_composite DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_enriched_domain ON enriched_articles(primary_domain);
CREATE INDEX IF NOT EXISTS idx_enriched_pipeline_version ON enriched_articles(pipeline_version);

-- =============================================================================
-- Article Entities: Add context column for entity role description
-- =============================================================================

ALTER TABLE article_entities ADD COLUMN IF NOT EXISTS context TEXT;

-- =============================================================================
-- Enrichment Runs: Track per-stage metrics
-- =============================================================================

ALTER TABLE enrichment_runs ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'combined';
ALTER TABLE enrichment_runs ADD COLUMN IF NOT EXISTS pipeline_version INTEGER DEFAULT 1;
