-- ============================================================================
-- Briefing-side per-story interactions
-- Mirrors user_newsroom_interactions. Used by /api/briefing/interact and
-- consumed by getInteractionSummary (UNION ALL across both tables) so the
-- existing personalisation.ts boost logic just works.
--
-- Run after: migrate-newsroom.sql
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_briefing_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
  daily_briefing_id TEXT REFERENCES daily_briefings(id) ON DELETE SET NULL,
  story_id TEXT,
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('read','expand','thumbs_up','thumbs_down','save','unsave')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_interactions_user_recent
  ON user_briefing_interactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_briefing_interactions_user_article
  ON user_briefing_interactions (user_id, raw_article_id);
