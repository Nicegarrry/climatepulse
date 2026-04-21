-- ============================================================================
-- TEMPORARY: make 'founder' the default tier for new user_profiles rows, and
-- backfill every existing free-tier account to 'founder'.
--
-- Context: during the pre-paid testing window, new users onboarding on the
-- free tier are silently failing the 3-micro-sector cap in PUT /api/user/profile,
-- leaving them with a NULL onboarded_at and a "Briefing unavailable" loop.
-- Bumping the default to founder unblocks test users immediately. When Stripe
-- billing goes live, revert this with:
--
--   ALTER TABLE user_profiles ALTER COLUMN tier SET DEFAULT 'free';
--
-- (Existing founders stay founder — that's fine, they're our early-access cohort.)
--
-- Run after: migrate-tiers.sql. Safe to re-run.
-- ============================================================================

ALTER TABLE user_profiles ALTER COLUMN tier SET DEFAULT 'founder';

UPDATE user_profiles
SET tier = 'founder', updated_at = NOW()
WHERE tier = 'free';
