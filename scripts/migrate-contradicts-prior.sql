-- ClimatePulse: contradicts_prior signal
--
-- Adds a boolean flag + supporting array to enriched_articles, set by
-- Stage 2 enrichment when a newly-embedded article has high cosine
-- similarity + opposing sentiment vs. prior coverage of the same
-- entities within the last 30 days. Used by personalisation to boost
-- a story's relevance score (contradictory coverage is a stronger
-- signal to a professional audience).

BEGIN;

ALTER TABLE enriched_articles
  ADD COLUMN IF NOT EXISTS contradicts_prior BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contradicted_source_ids TEXT[] DEFAULT '{}';

-- Partial index so selectBriefingStories can cheaply find flagged stories.
CREATE INDEX IF NOT EXISTS idx_enriched_contradicts_prior
  ON enriched_articles (contradicts_prior)
  WHERE contradicts_prior = TRUE;

COMMIT;
