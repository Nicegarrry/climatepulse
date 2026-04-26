-- Indicators system — catalogue + history + review queue
-- Depends on: scripts/migrations/learn/001-learn-prelude.sql (update_updated_at_column trigger fn)
-- Additive only. No existing tables modified.
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/indicators/001-indicators.sql

BEGIN;

-- ============================================================================
-- indicators — catalogue (one row per tracked quantitative indicator)
-- ============================================================================
-- Geography is intentionally free-text (TEXT, no CHECK). KNOWN_GEOGRAPHIES in
-- src/lib/indicators/types.ts powers filter dropdowns and lints new catalogue
-- rows; the detector can still propose novel regions which then land in
-- indicator_review_queue rather than the live history.
CREATE TABLE IF NOT EXISTS indicators (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug                     TEXT NOT NULL UNIQUE,
    name                     TEXT NOT NULL,
    description              TEXT,

    -- Classification
    sector                   TEXT NOT NULL,        -- taxonomy_domains.slug (12 domains)
    geography                TEXT NOT NULL,        -- 'AU', 'Global', 'EU', 'US', etc.
    unit                     TEXT NOT NULL,        -- '$/W', '%', 'GW', 'ppm', …
    value_type               TEXT NOT NULL,        -- 'currency'|'percent'|'count'|'physical'
    direction_good           TEXT NOT NULL DEFAULT 'neutral',  -- 'down'|'up'|'neutral'

    -- State
    status                   TEXT NOT NULL DEFAULT 'live',  -- 'live'|'review'|'dormant'

    -- Latest-value cache (denormalised; trigger keeps in sync with indicator_values)
    current_value            NUMERIC,
    prior_value              NUMERIC,
    last_updated_at          TIMESTAMPTZ,
    last_source_article_id   UUID REFERENCES raw_articles(id) ON DELETE SET NULL,
    last_source_url          TEXT,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT indicators_value_type_check
        CHECK (value_type IN ('currency','percent','count','physical')),
    CONSTRAINT indicators_direction_check
        CHECK (direction_good IN ('down','up','neutral')),
    CONSTRAINT indicators_status_check
        CHECK (status IN ('live','review','dormant'))
);

CREATE INDEX IF NOT EXISTS idx_indicators_sector ON indicators(sector);
CREATE INDEX IF NOT EXISTS idx_indicators_status ON indicators(status);
CREATE INDEX IF NOT EXISTS idx_indicators_geography ON indicators(geography);

DROP TRIGGER IF EXISTS trg_indicators_updated_at ON indicators;
CREATE TRIGGER trg_indicators_updated_at
    BEFORE UPDATE ON indicators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE indicators IS
    'Catalogue of tracked climate/energy indicators. current_value/prior_value/last_updated_at are denormalised caches kept in sync by trg_indicator_values_update_cache on indicator_values inserts.';

-- ============================================================================
-- indicator_values — append-only history
-- ============================================================================
-- Every value carries provenance: source_type='article' requires an article ID
-- + evidence_quote; source_type='scraper' requires a source_scraper id.
-- Enforced by check constraint — no fabrication path possible.
CREATE TABLE IF NOT EXISTS indicator_values (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id        UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

    value               NUMERIC NOT NULL,
    unit                TEXT NOT NULL,
    geography           TEXT NOT NULL,
    observed_at         TIMESTAMPTZ NOT NULL,

    source_type         TEXT NOT NULL,        -- 'article'|'scraper'|'manual'
    source_article_id   UUID REFERENCES raw_articles(id) ON DELETE SET NULL,
    source_url          TEXT,
    source_scraper      TEXT,
    evidence_quote      TEXT,

    confidence          NUMERIC(4,3) NOT NULL DEFAULT 1.000,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT indicator_values_source_type_check
        CHECK (source_type IN ('article','scraper','manual')),
    CONSTRAINT indicator_values_confidence_range
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT indicator_values_provenance_check
        CHECK (
            (source_type = 'article'
             AND source_article_id IS NOT NULL
             AND evidence_quote IS NOT NULL
             AND length(evidence_quote) > 0)
         OR (source_type = 'scraper'
             AND source_scraper IS NOT NULL
             AND length(source_scraper) > 0)
         OR (source_type = 'manual')
        )
);

CREATE INDEX IF NOT EXISTS idx_indicator_values_indicator_observed
    ON indicator_values(indicator_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_indicator_values_article
    ON indicator_values(source_article_id)
    WHERE source_article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indicator_values_created_today
    ON indicator_values(created_at DESC);

COMMENT ON TABLE indicator_values IS
    'Append-only history. Provenance is enforced at the DB level: article rows require evidence_quote + source_article_id; scraper rows require source_scraper. No path inserts a value without provenance.';

-- ============================================================================
-- Trigger: keep indicators.current_value/prior_value/last_updated_at in sync
-- ============================================================================
CREATE OR REPLACE FUNCTION update_indicator_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- After insert: shift current → prior, set new current.
    -- We update only when the new row is the most recent observation for the
    -- indicator (avoid back-dated inserts overwriting the cache).
    UPDATE indicators i
    SET prior_value = i.current_value,
        current_value = NEW.value,
        last_updated_at = NEW.observed_at,
        last_source_article_id = NEW.source_article_id,
        last_source_url = NEW.source_url
    WHERE i.id = NEW.indicator_id
      AND (i.last_updated_at IS NULL OR i.last_updated_at <= NEW.observed_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_indicator_values_update_cache ON indicator_values;
CREATE TRIGGER trg_indicator_values_update_cache
    AFTER INSERT ON indicator_values
    FOR EACH ROW EXECUTE FUNCTION update_indicator_cache();

-- ============================================================================
-- indicator_review_queue — uncertain detections awaiting human approval
-- ============================================================================
-- Mirrors concept_card_candidates from learn/010 — same status enum + reviewer
-- columns. indicator_id is nullable: detector may propose a novel indicator
-- (proposed_indicator_slug) that doesn't yet exist in the catalogue.
CREATE TABLE IF NOT EXISTS indicator_review_queue (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    indicator_id                UUID REFERENCES indicators(id) ON DELETE CASCADE,
    proposed_indicator_slug     TEXT,
    proposed_value              NUMERIC,
    proposed_unit               TEXT,
    proposed_geography          TEXT,

    source_article_id           UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
    source_url                  TEXT,
    evidence_quote              TEXT NOT NULL,

    detector_confidence         NUMERIC(4,3) NOT NULL,
    detector_reason             TEXT,

    status                      TEXT NOT NULL DEFAULT 'pending_review',
    promoted_value_id           UUID REFERENCES indicator_values(id) ON DELETE SET NULL,
    reviewed_by                 TEXT REFERENCES user_profiles(id),
    reviewed_at                 TIMESTAMPTZ,
    review_notes                TEXT,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT irq_status_check
        CHECK (status IN ('pending_review','approved','rejected','superseded')),
    CONSTRAINT irq_confidence_range
        CHECK (detector_confidence >= 0 AND detector_confidence <= 1),
    CONSTRAINT irq_target_present
        CHECK (indicator_id IS NOT NULL OR proposed_indicator_slug IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_irq_status ON indicator_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_irq_indicator ON indicator_review_queue(indicator_id)
    WHERE indicator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_irq_article ON indicator_review_queue(source_article_id);
CREATE INDEX IF NOT EXISTS idx_irq_created ON indicator_review_queue(created_at DESC);

DROP TRIGGER IF EXISTS trg_irq_updated_at ON indicator_review_queue;
CREATE TRIGGER trg_irq_updated_at
    BEFORE UPDATE ON indicator_review_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE indicator_review_queue IS
    'Detections with confidence 0.6–0.85 (or that fail unit/geo validation) land here. Editors approve → an indicator_values row is inserted (link via promoted_value_id) and status flips to approved.';

COMMIT;
