-- ============================================================================
-- Share tracking
-- Logs every outbound share click through /share/story and captures inbound
-- referrals (ref=) at signup time.
--
-- Run after: migrate-user-profiles.sql
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  article_url TEXT NOT NULL,
  raw_article_id UUID REFERENCES raw_articles(id) ON DELETE SET NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ref_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_clicks_user_date
  ON share_clicks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_clicks_date
  ON share_clicks (created_at DESC);

-- Inbound referral attribution — incremented when a referred visitor signs up.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referred_users_count INTEGER NOT NULL DEFAULT 0;

-- Short deterministic hash of user_id used in share URLs as `?ref=`.
-- Populated lazily on first share so we never expose the raw Supabase user id
-- in public links. Unique so lookup on signup is a single index hit.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ref_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_ref_hash
  ON user_profiles (ref_hash)
  WHERE ref_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_count
  ON user_profiles (referred_users_count DESC);
