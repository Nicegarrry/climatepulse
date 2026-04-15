-- Weekly Digest Pipeline: auto-generated reports + human-curated digests
-- Run after migrate-enrichment.sql and migrate-storylines.sql

BEGIN;

-- ─── Auto-generated intelligence reports (Friday 3pm) ──────────────────────

CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,                          -- 'wreport-{timestamp}'
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'superseded')),

  -- Aggregated intelligence (all JSONB)
  theme_clusters JSONB NOT NULL,                -- [{cluster_id, label, domain, articles[], entity_overlap[], sentiment_agg, key_numbers[]}]
  top_numbers JSONB,                            -- [{value, unit, context, source_article_id, delta}]
  sentiment_summary JSONB,                      -- {overall, by_domain: {domain: {positive, negative, neutral, mixed}}}
  storyline_updates JSONB,                      -- [{storyline_id, title, article_count, latest_development}]
  transmission_activity JSONB,                  -- [{channel_label, triggered_count, example_article_ids}]
  article_ids_included UUID[],

  -- Generation metadata
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(6, 4),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week
  ON weekly_reports(week_start DESC);

-- ─── Human-curated editorial digests ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_digests (
  id TEXT PRIMARY KEY,                          -- 'wdigest-{timestamp}'
  report_id TEXT REFERENCES weekly_reports(id),  -- nullable for manual-only digests
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  -- Editorial content
  headline TEXT NOT NULL,
  editor_narrative TEXT NOT NULL,               -- markdown
  weekly_number JSONB,                          -- {value, unit, label, context, trend}
  curated_stories JSONB NOT NULL,               -- [{article_id?, headline, source, url, editor_take, severity, sector, key_metric?}]
  theme_commentary JSONB,                       -- [{theme_label, commentary}]
  outlook TEXT,                                 -- "What to watch next week"

  -- Distribution tracking
  published_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  email_recipient_count INTEGER,
  linkedin_draft TEXT,
  banner_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_week
  ON weekly_digests(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_status
  ON weekly_digests(status);

COMMIT;
