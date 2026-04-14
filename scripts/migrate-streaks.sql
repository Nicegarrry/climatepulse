-- ============================================================================
-- Briefing Completions & Streak Tracking
-- Run after: migrate-analytics.sql
-- ============================================================================

-- Record each daily briefing completion
CREATE TABLE IF NOT EXISTS briefing_completions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  edition_date DATE NOT NULL,
  stories_viewed INTEGER NOT NULL,
  stories_total INTEGER NOT NULL,
  total_view_time_seconds INTEGER,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, edition_date)
);

CREATE INDEX IF NOT EXISTS idx_completions_user_date
  ON briefing_completions (user_id, edition_date DESC);

-- Denormalised streak cache (updated on each completion)
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  streak_started_date DATE,
  grace_days_used_this_week INTEGER NOT NULL DEFAULT 0,
  grace_week_start DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
