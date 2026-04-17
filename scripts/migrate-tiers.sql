-- ============================================================================
-- User tiers: founder | launch | paid | free
-- Launch scope: founder (first 30 users, full access) + free (everyone else).
-- launch / paid slots are reserved for post-launch Stripe wiring.
-- Run after: migrate-user-profiles.sql
-- Safe to re-run.
-- ============================================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('founder','launch','paid','free'));

-- Stripe + trial placeholders (nullable, wired up post-launch)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- Dev test users get founder tier so they bypass the 3-sector cap in local testing.
UPDATE user_profiles SET tier = 'founder'
WHERE id IN ('test-user-1','test-user-2','test-user-3','test-user-4','test-user-5')
  AND tier = 'free';
