-- ============================================================================
-- User Profiles & Daily Briefings
-- Run after: migrate-enrichment.sql, migrate-two-stage.sql
-- ============================================================================

-- User profiles (hardcoded test user for now — no auth per CLAUDE.md)
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role_lens TEXT NOT NULL DEFAULT 'general'
    CHECK (role_lens IN ('investor','corporate_sustainability','policy_analyst','project_developer','board_director','researcher','general')),
  primary_sectors TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  followed_entities TEXT[] DEFAULT '{}',
  followed_storylines TEXT[] DEFAULT '{}',
  triage_history JSONB DEFAULT '{}',
  accordion_opens JSONB DEFAULT '{}',
  story_ring_taps JSONB DEFAULT '{}',
  briefing_depth TEXT NOT NULL DEFAULT 'standard'
    CHECK (briefing_depth IN ('quick','standard','deep')),
  digest_time TEXT DEFAULT '06:30',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed test user matching MOCK_USER_PROFILE from mock-digest.ts
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, briefing_depth)
VALUES (
  'test-user-1',
  'Alex Chen',
  'alex@climatepulse.dev',
  'investor',
  ARRAY['eu-ets','lithium-ion-grid-bess','esg-disclosure-reporting'],
  ARRAY['australia','eu'],
  ARRAY['CBAM','Origin Energy'],
  'standard'
)
ON CONFLICT (id) DO NOTHING;

-- Daily briefings persistence
CREATE TABLE IF NOT EXISTS daily_briefings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  date DATE NOT NULL,
  stories JSONB NOT NULL,
  digest JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_briefings_user_date ON daily_briefings(user_id, date DESC);
