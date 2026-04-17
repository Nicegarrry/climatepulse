-- ============================================================================
-- Founder seeding
--
-- Marks specific users as `tier = 'founder'` — full product access, free forever,
-- first ~30 signups per the UX plan. Edit the email list before running.
--
-- Run after: migrate-tiers.sql
-- Idempotent: safe to re-run.
-- ============================================================================

UPDATE user_profiles
SET tier = 'founder', updated_at = NOW()
WHERE email IN (
  'sapphire.advisory@icloud.com',
  'npinidiya@gmail.com'
)
  AND tier <> 'founder';

-- Report rows affected so the operator can confirm the list matched real users.
SELECT id, email, tier FROM user_profiles WHERE tier = 'founder' ORDER BY created_at;
