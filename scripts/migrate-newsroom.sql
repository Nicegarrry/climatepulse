-- ============================================================================
-- Newsroom — Live Updates Feature
-- Run after: migrate.sql, migrate-enrichment.sql, migrate-user-profiles.sql,
--            migrate-onboarding.sql, migrate-roles.sql, migrate-notifications.sql
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT throughout)
-- ============================================================================

-- ─── 1. Newsroom items: lightly-classified wire records ─────────────────────

CREATE TABLE IF NOT EXISTS newsroom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
  primary_domain TEXT NOT NULL,                    -- one of 12 domain slugs
  urgency SMALLINT NOT NULL CHECK (urgency BETWEEN 1 AND 5),
  teaser TEXT NOT NULL,                            -- ≤160 chars, one sentence
  classifier_model TEXT NOT NULL,
  classifier_version TEXT NOT NULL DEFAULT 'v1',
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NOT NULL,               -- denormalized for fast feed windowing
  source_name TEXT NOT NULL,                       -- denormalized for join-free queries
  duplicate_of_id UUID REFERENCES newsroom_items(id) ON DELETE SET NULL,
  editor_override JSONB,                           -- reserved for WS4 (pin, suppress, promote)
  UNIQUE (raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_newsroom_items_published_desc
  ON newsroom_items (published_at DESC)
  WHERE duplicate_of_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_newsroom_items_domain_urgency
  ON newsroom_items (primary_domain, urgency, published_at DESC)
  WHERE duplicate_of_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_newsroom_items_urgency5
  ON newsroom_items (classified_at DESC)
  WHERE urgency = 5 AND duplicate_of_id IS NULL;

-- ─── 2. Title-hash dedup on raw_articles (additive) ─────────────────────────

ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS title_hash TEXT;

-- Title-hash uniqueness across all rows where it is set. We only populate
-- title_hash for newly-fetched articles in the Newsroom dedup pass, so the
-- index stays naturally bounded. (Postgres won't allow NOW() in a partial
-- index predicate — the predicate must be IMMUTABLE.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_articles_title_hash
  ON raw_articles (title_hash)
  WHERE title_hash IS NOT NULL;

-- ─── 3. Saved articles (profile archive) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_saved_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
  newsroom_item_id UUID REFERENCES newsroom_items(id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  UNIQUE (user_id, raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user_date
  ON user_saved_articles (user_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_user_note_search
  ON user_saved_articles USING gin (to_tsvector('english', coalesce(note, '')));

-- ─── 4. Interactions (append-only — preserves history for calibration) ──────

CREATE TABLE IF NOT EXISTS user_newsroom_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('read','expand','thumbs_up','thumbs_down','save','unsave')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_user_recent
  ON user_newsroom_interactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_user_article
  ON user_newsroom_interactions (user_id, raw_article_id);

-- ─── 5. Push subscriptions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_user
  ON user_push_subscriptions (user_id) WHERE failure_count < 5;

-- ─── 6. Push send log (rate limiting + audit) ───────────────────────────────

CREATE TABLE IF NOT EXISTS newsroom_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  newsroom_item_id UUID NOT NULL REFERENCES newsroom_items(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('sent','rate_limited','failed','expired'))
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_recent
  ON newsroom_push_log (user_id, sent_at DESC);

-- ─── 7. Newsroom user prefs — extend existing notification_prefs JSONB ──────
-- Existing keys (from migrate-notifications.sql):
--   daily_briefing, weekly_digest, high_priority_alerts, entity_updates
-- New keys added by Newsroom:
--   urgency5_push (boolean)         — opt-in to push for urgency-5 items
--   newsroom_threshold (integer)    — minimum urgency to show on feed (default 3)
--
-- Backfill defaults onto existing rows that don't have these keys yet.
UPDATE user_profiles
   SET notification_prefs = notification_prefs
       || jsonb_build_object('urgency5_push', false)
 WHERE NOT (notification_prefs ? 'urgency5_push');

UPDATE user_profiles
   SET notification_prefs = notification_prefs
       || jsonb_build_object('newsroom_threshold', 3)
 WHERE NOT (notification_prefs ? 'newsroom_threshold');

-- ─── 8. Cost/run telemetry (mirrors enrichment_runs pattern) ────────────────

CREATE TABLE IF NOT EXISTS newsroom_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL,                           -- 'cron' | 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INT,
  ingested INT NOT NULL DEFAULT 0,
  deduped INT NOT NULL DEFAULT 0,
  classified INT NOT NULL DEFAULT 0,
  urgency5_pushes INT NOT NULL DEFAULT 0,
  cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  skipped_reason TEXT,                             -- 'outside-hours' | NULL
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsroom_runs_started
  ON newsroom_runs (started_at DESC);
