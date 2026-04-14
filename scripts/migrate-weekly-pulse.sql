-- ============================================================================
-- Weekly User Summaries — Weekly Pulse
-- Run after: migrate-streaks.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_user_summaries (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,

  -- Reading stats
  stories_read INTEGER NOT NULL DEFAULT 0,
  briefings_completed INTEGER NOT NULL DEFAULT 0,
  total_reading_time_seconds INTEGER,
  sectors_covered INTEGER NOT NULL DEFAULT 0,
  sectors_subscribed INTEGER NOT NULL DEFAULT 0,

  -- Streak snapshot
  current_streak INTEGER NOT NULL DEFAULT 0,

  -- Cohort comparison (NULL until real user base ≥ 20)
  stories_read_percentile INTEGER,
  briefings_completed_percentile INTEGER,
  cohort_size INTEGER,
  cohort_avg_stories NUMERIC(5,1),

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user
  ON weekly_user_summaries (user_id, week_start DESC);
