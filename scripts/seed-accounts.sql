-- ============================================================================
-- Seed admin + editorial accounts
--
-- Run AFTER both users have signed in (Supabase magic link) and completed
-- onboarding, so their user_profiles rows exist.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- Admin account: full pipeline access (discovery, categories, taxonomy, enrichment)
UPDATE user_profiles
SET user_role = 'admin', updated_at = NOW()
WHERE email = 'sapphire.advisory@icloud.com';

-- Editorial account: can create/publish weekly digests + all reader access
UPDATE user_profiles
SET user_role = 'editor', updated_at = NOW()
WHERE email = 'npinidiya@gmail.com';

-- Verify
SELECT id, email, user_role, onboarded_at
FROM user_profiles
WHERE email IN ('sapphire.advisory@icloud.com', 'npinidiya@gmail.com')
ORDER BY email;
