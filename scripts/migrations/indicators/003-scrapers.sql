-- Scraper telemetry — small ops table that mirrors pipeline_runs for the
-- direct-scraper bypass path (AEMO, BNEF, etc).
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/indicators/003-scrapers.sql

BEGIN;

CREATE TABLE IF NOT EXISTS scraper_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraper         TEXT NOT NULL,            -- e.g. 'aemo_grid_mix'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'running',  -- running|completed|failed
    rows_written    INTEGER NOT NULL DEFAULT 0,
    error           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT scraper_runs_status_check
        CHECK (status IN ('running','completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_completed
    ON scraper_runs(scraper, completed_at DESC NULLS LAST);

COMMENT ON TABLE scraper_runs IS
    'Telemetry for direct-scraper indicator updates (bypass path). Mirrors pipeline_runs shape but scoped to a single scraper per row.';

COMMIT;
