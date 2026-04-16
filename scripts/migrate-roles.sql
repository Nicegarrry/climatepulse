-- User roles: reader | editor | admin
-- reader: default access (briefing, energy, markets, weekly)
-- editor: can create/publish weekly digests
-- admin: full pipeline access (discovery, categories, taxonomy, enrichment)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'reader'
  CHECK (user_role IN ('reader', 'editor', 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(user_role);

-- Seed the 5 test users as admins for dev (they already exist from migrate-onboarding.sql)
UPDATE user_profiles SET user_role = 'admin'
WHERE id IN ('test-user-1', 'test-user-2', 'test-user-3', 'test-user-4', 'test-user-5')
  AND user_role = 'reader';
