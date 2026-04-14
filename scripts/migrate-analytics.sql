-- ============================================================================
-- Analytics Events — Gamification & Tracking Foundation
-- Run after: migrate-user-profiles.sql
-- ============================================================================

-- Partitioned analytics events table (by month on created_at)
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL,
  user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current + upcoming months
CREATE TABLE IF NOT EXISTS analytics_events_2026_04 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_05 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_06 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes for querying by user and event type
CREATE INDEX IF NOT EXISTS idx_events_user_time ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events (session_id);
