-- ClimatePulse: Intelligence Layer Migration (Unified Content Model)
--
-- Creates a generic content_embeddings table keyed by (content_type, source_id, chunk_index)
-- that can hold embeddings for:
--   - Source articles (via enriched_articles.id)
--   - Podcast episode transcripts (via podcast_episodes.id)
--   - Daily digests (via daily_briefings.id, future)
--   - Weekly editorial digests (via weekly_digests.id)
--   - Weekly intelligence reports (via weekly_reports.id)
--   - Future content types (YouTube transcripts, major reports, Learn content)
--
-- Embedding model: gemini-embedding-001 at 768 dims (Matryoshka truncation from 3072).
-- Index: HNSW with cosine distance.

BEGIN;

-- =============================================================================
-- Extension: pgvector
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Drop the old column on enriched_articles (if present from prior migration)
-- =============================================================================

ALTER TABLE enriched_articles DROP COLUMN IF EXISTS embedding;
DROP INDEX IF EXISTS idx_enriched_embedding;
DROP INDEX IF EXISTS idx_enriched_has_embedding;

-- =============================================================================
-- Content Embeddings: unified table across all content types
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content identity (polymorphic reference)
  content_type TEXT NOT NULL CHECK (content_type IN (
    'article',           -- enriched_articles.id (UUID)
    'podcast',           -- podcast_episodes.id (TEXT)
    'daily_digest',      -- daily_briefings.id (TEXT) — future
    'weekly_digest',     -- weekly_digests.id (TEXT)
    'weekly_report',     -- weekly_reports.id (TEXT)
    'report_pdf',        -- future: ingested PDF reports
    'youtube_transcript',-- future: YouTube transcripts
    'learn_content'      -- future: Learn surface content
  )),
  source_id TEXT NOT NULL,         -- FK-like reference (varies by content_type)
  chunk_index INTEGER NOT NULL DEFAULT 0,  -- 0 if unchunked; 0..N for chunked long-form
  chunk_text TEXT NOT NULL,        -- The exact text that was embedded (debugging + fallback display)

  -- The embedding itself
  embedding vector(768) NOT NULL,

  -- Denormalised routing/filtering metadata (kept in sync with source content)
  primary_domain TEXT,
  microsector_ids INTEGER[] DEFAULT '{}',
  signal_type TEXT,
  sentiment TEXT,
  jurisdictions TEXT[] DEFAULT '{}',
  entity_ids INTEGER[] DEFAULT '{}',

  -- Temporal and quality metadata
  published_at TIMESTAMPTZ,
  significance_composite NUMERIC(5,1),

  -- Trust/source classification for result weighting and filtering
  -- 0 = own editorial output (digests, weekly editorials, podcast scripts)
  -- 1 = primary source (Tier 1 RSS, major reports, .gov/.edu)
  -- 2 = secondary source (Tier 2 RSS)
  -- 3 = aggregator/API (NewsAPI.ai, NewsAPI.org, low-tier RSS)
  trustworthiness_tier INTEGER DEFAULT 2,

  -- Embedding metadata
  model_used TEXT DEFAULT 'gemini-embedding-001',
  embedding_dimensions INTEGER DEFAULT 768,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_type, source_id, chunk_index)
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- HNSW for vector similarity (cosine distance via <=> operator)
CREATE INDEX IF NOT EXISTS idx_content_embeddings_hnsw
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- Structured filter indexes
CREATE INDEX IF NOT EXISTS idx_content_embeddings_type
  ON content_embeddings(content_type);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_source
  ON content_embeddings(content_type, source_id);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_domain
  ON content_embeddings(primary_domain);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_signal
  ON content_embeddings(signal_type);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_published
  ON content_embeddings(published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_significance
  ON content_embeddings(significance_composite DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_tier
  ON content_embeddings(trustworthiness_tier);

-- GIN indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_content_embeddings_microsectors
  ON content_embeddings USING gin(microsector_ids);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_entities
  ON content_embeddings USING gin(entity_ids);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_jurisdictions
  ON content_embeddings USING gin(jurisdictions);

-- =============================================================================
-- Trigger: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_content_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_embeddings_updated_at ON content_embeddings;
CREATE TRIGGER content_embeddings_updated_at
  BEFORE UPDATE ON content_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_content_embeddings_updated_at();

COMMIT;
