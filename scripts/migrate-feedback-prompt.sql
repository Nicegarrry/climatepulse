-- ============================================================================
-- Daily feedback prompt persistence
-- One row per user per day. `response` JSONB shape depends on question_type:
--   scale:  { score: 1..5 }
--   freeform: { text: "..." }
--   most_relevant: { story_id: "...", url?: "..." }
-- `dismissed` is true when the user closed without answering.
--
-- Run after: migrate-user-profiles.sql
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_daily_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('scale','freeform','most_relevant')),
  response JSONB,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_feedback_user_recent
  ON user_daily_feedback (user_id, date DESC);

-- Suppression bookkeeping. Populated by the /api/feedback/daily endpoint when
-- the user has dismissed 10 days in a row — the prompt stays hidden for 30
-- days afterwards.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS feedback_suppressed_until DATE;
