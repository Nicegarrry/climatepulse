-- ============================================================================
-- Podcast Evolution: characters, voice profiles, formats, flagship backlog,
-- themed schedule, per-archetype/multi-variant episode keying, telemetry.
--
-- Run after: migrate-podcast.sql, migrate-tiers.sql, migrate-weekly-digest.sql
-- Paid-tier gating uses the existing user_profiles.tier column (free|launch|
-- paid|founder) via supabase/server.ts requireTier(). No new tier column.
-- Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- voice_profiles — decouple TTS voice IDs from characters
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,                          -- slug, e.g. 'gemini-aoede'
  provider TEXT NOT NULL CHECK (provider IN ('gemini','lyria','gemini-tts')),
  provider_voice_id TEXT NOT NULL,              -- e.g. 'Aoede', 'Charon'
  display_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  accent TEXT,                                  -- advisory: 'en-AU','en-GB'
  gender TEXT CHECK (gender IN ('female','male','neutral','other') OR gender IS NULL),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_provider ON voice_profiles(provider);

-- ----------------------------------------------------------------------------
-- podcast_characters — hosts + ensemble, canonical bios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS podcast_characters (
  id TEXT PRIMARY KEY,                          -- slug, e.g. 'maya-chen'
  role TEXT NOT NULL CHECK (role IN (
    'host_daily','host_flagship','ensemble','correspondent'
  )),
  display_name TEXT NOT NULL,
  short_name TEXT,                              -- used in multi-speaker prompts (e.g. 'Maya')
  bio TEXT NOT NULL,
  voice_profile_id TEXT REFERENCES voice_profiles(id) ON DELETE SET NULL,
  tone_prompt TEXT,                             -- character-specific directive
  typical_lines TEXT[] DEFAULT '{}',            -- sample lines for prompt grounding
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_characters_role ON podcast_characters(role);

-- ----------------------------------------------------------------------------
-- podcast_formats — Main Piece format registry (flagship show)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS podcast_formats (
  id TEXT PRIMARY KEY,                          -- slug: 'dinner_table','fireside',...
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  emotional_register TEXT,                      -- 'intimate','playful','conflict',...
  typical_cadence TEXT,                         -- 'monthly','quarterly','experimental'
  is_experimental BOOLEAN NOT NULL DEFAULT FALSE,
  script_prompt_template TEXT,                  -- format-specific prompt fragment
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- flagship_episodes — backlog + scheduled + published
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flagship_episodes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  concept TEXT,                                 -- longer description for backlog
  format_id TEXT REFERENCES podcast_formats(id) ON DELETE SET NULL,
  ai_suggested_format_id TEXT REFERENCES podcast_formats(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN (
    'idea','drafted','scheduled','published','archived'
  )),
  complexity SMALLINT CHECK (complexity BETWEEN 1 AND 5),
  scheduled_for DATE,
  published_at TIMESTAMPTZ,
  episode_number INTEGER,                       -- assigned on publish, sequential
  assigned_characters TEXT[] DEFAULT '{}',      -- character slugs
  production_notes TEXT,
  linked_weekly_digest_id TEXT,                 -- weekly_digests.id (soft FK — may not exist yet)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flagship_episodes_status ON flagship_episodes(status);
CREATE INDEX IF NOT EXISTS idx_flagship_episodes_scheduled ON flagship_episodes(scheduled_for) WHERE status = 'scheduled';
CREATE UNIQUE INDEX IF NOT EXISTS idx_flagship_episodes_number ON flagship_episodes(episode_number) WHERE episode_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- themed_schedule — weekly deep-dive schedule
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS themed_schedule (
  id TEXT PRIMARY KEY,                          -- slug: 'nem_monday'
  theme_slug TEXT NOT NULL UNIQUE,              -- same as id; kept for clarity
  title TEXT NOT NULL,                          -- 'NEM Monday'
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun..6=Sat
  local_time TEXT NOT NULL DEFAULT '07:00',     -- Sydney local
  cornerstone_character_id TEXT REFERENCES podcast_characters(id) ON DELETE SET NULL,
  default_ensemble_ids TEXT[] DEFAULT '{}',     -- character slugs that may drop in
  domain_filter TEXT[] DEFAULT '{}',            -- taxonomy domain slugs
  min_significance NUMERIC(5,1) DEFAULT 55.0,
  prompt_template_path TEXT,                    -- e.g. 'prompts/podcast/nem-monday.md'
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themed_schedule_dow ON themed_schedule(day_of_week) WHERE enabled = TRUE;

-- ----------------------------------------------------------------------------
-- podcast_episodes: add multi-variant keying + flagship/themed linkage
-- ----------------------------------------------------------------------------
ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'daily'
    CHECK (tier IN ('daily','themed','flagship'));

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS archetype TEXT
    CHECK (archetype IS NULL OR archetype IN ('commercial','academic','public','general'));

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS theme_slug TEXT;

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS flagship_episode_id TEXT REFERENCES flagship_episodes(id) ON DELETE SET NULL;

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS character_ids TEXT[] DEFAULT '{}';

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS music_bed_url TEXT;

ALTER TABLE podcast_episodes
  ADD COLUMN IF NOT EXISTS mix_manifest JSONB;

-- Replace old UNIQUE(briefing_date, user_id) with composite that accommodates
-- multi-variant episodes. Use a partial-expression unique INDEX with COALESCE
-- over nullable discriminators.
ALTER TABLE podcast_episodes DROP CONSTRAINT IF EXISTS podcast_episodes_briefing_date_user_id_key;

DROP INDEX IF EXISTS idx_podcast_episodes_variant_uniq;
CREATE UNIQUE INDEX idx_podcast_episodes_variant_uniq ON podcast_episodes (
  tier,
  briefing_date,
  COALESCE(archetype, ''),
  COALESCE(theme_slug, ''),
  COALESCE(flagship_episode_id, ''),
  COALESCE(user_id, '')
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_tier ON podcast_episodes(tier);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_tier_date ON podcast_episodes(tier, briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_flagship ON podcast_episodes(flagship_episode_id) WHERE flagship_episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_theme ON podcast_episodes(theme_slug) WHERE theme_slug IS NOT NULL;

-- ----------------------------------------------------------------------------
-- user_podcast_interactions — playback + engagement telemetry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_podcast_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,                        -- matches user_profiles.id (TEXT)
  podcast_episode_id TEXT NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'play','resume','complete','quit','skip_back','skip_forward'
  )),
  position_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_interactions_user ON user_podcast_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcast_interactions_episode ON user_podcast_interactions(podcast_episode_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers (lightweight — avoid reinstalling if already present)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'voice_profiles_updated_at') THEN
    CREATE TRIGGER voice_profiles_updated_at BEFORE UPDATE ON voice_profiles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'podcast_characters_updated_at') THEN
    CREATE TRIGGER podcast_characters_updated_at BEFORE UPDATE ON podcast_characters
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'podcast_formats_updated_at') THEN
    CREATE TRIGGER podcast_formats_updated_at BEFORE UPDATE ON podcast_formats
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'flagship_episodes_updated_at') THEN
    CREATE TRIGGER flagship_episodes_updated_at BEFORE UPDATE ON flagship_episodes
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'themed_schedule_updated_at') THEN
    CREATE TRIGGER themed_schedule_updated_at BEFORE UPDATE ON themed_schedule
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

COMMIT;
