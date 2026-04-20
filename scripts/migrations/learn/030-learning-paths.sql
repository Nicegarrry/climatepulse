-- Learn system — learning paths + items + progress + deep dives (schema only)
-- Depends on: 001-learn-prelude.sql, 010-concept-cards.sql, 020-microsector-briefs.sql
-- Additive only.

BEGIN;

-- ============================================================================
-- learning_paths — sequenced reading experiences
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_paths (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    goal                TEXT,

    -- Structured scope — matches intent parser output shape
    -- {in_scope_microsectors: int[], learning_level, orientation, time_budget, audience_context}
    scope               JSONB NOT NULL DEFAULT '{}'::jsonb,

    update_policy       TEXT NOT NULL,
    intent              JSONB,

    editorial_status    editorial_status NOT NULL DEFAULT 'user_generated',
    author_user_id      TEXT REFERENCES user_profiles(id),
    reviewed_by         TEXT REFERENCES user_profiles(id),
    reviewed_at         TIMESTAMPTZ,

    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lp_update_policy_check
        CHECK (update_policy IN ('frozen','live','periodic'))
);

CREATE INDEX IF NOT EXISTS idx_lp_author ON learning_paths(author_user_id);
CREATE INDEX IF NOT EXISTS idx_lp_editorial_status ON learning_paths(editorial_status);
CREATE INDEX IF NOT EXISTS idx_lp_update_policy ON learning_paths(update_policy);
CREATE INDEX IF NOT EXISTS idx_lp_scope_microsectors
    ON learning_paths USING GIN ((scope->'in_scope_microsectors'));

DROP TRIGGER IF EXISTS trg_learning_paths_updated_at ON learning_paths;
CREATE TRIGGER trg_learning_paths_updated_at
    BEFORE UPDATE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE learning_paths IS
    'Sequenced reading experiences. Update policy frozen=pinned (default for user-generated), live=follow-canonical (default for editor seed paths), periodic=new row per period (default for auto "week in X" paths).';

-- ============================================================================
-- learning_path_items — ordered polymorphic references
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_path_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id                 UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    position                INTEGER NOT NULL,
    chapter                 TEXT,

    item_type               TEXT NOT NULL,
    item_id                 TEXT NOT NULL,    -- UUID-as-text for uniformity; resolver picks table by item_type
    item_version            INTEGER,          -- required for concept_card + microsector_brief_block (version pins)

    completion_required     BOOLEAN NOT NULL DEFAULT TRUE,
    note                    TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lpi_item_type_check
        CHECK (item_type IN ('concept_card','microsector_brief','microsector_brief_block',
                             'briefing','deep_dive','podcast','quiz')),
    CONSTRAINT lpi_position_positive CHECK (position >= 0),
    CONSTRAINT lpi_version_pin_required
        CHECK (item_type NOT IN ('concept_card','microsector_brief_block') OR item_version IS NOT NULL),
    CONSTRAINT lpi_unique_position UNIQUE (path_id, position)
);

CREATE INDEX IF NOT EXISTS idx_lpi_path ON learning_path_items(path_id, position);
CREATE INDEX IF NOT EXISTS idx_lpi_item_lookup ON learning_path_items(item_type, item_id);

COMMENT ON TABLE learning_path_items IS
    'Ordered items in a learning path. Polymorphic via (item_type, item_id). Version pinning required for concept_card + microsector_brief_block — enables drift detection against current canonical version at render time.';

-- ============================================================================
-- learning_path_progress — per-user completion tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_path_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    path_id         UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES learning_path_items(id) ON DELETE CASCADE,

    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dwell_seconds   INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT lpp_unique_user_item UNIQUE (user_id, item_id),
    CONSTRAINT lpp_dwell_nonneg CHECK (dwell_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lpp_user_path ON learning_path_progress(user_id, path_id);
CREATE INDEX IF NOT EXISTS idx_lpp_completed_at ON learning_path_progress(completed_at DESC);

COMMENT ON TABLE learning_path_progress IS
    'Per-user completion tracking. One row per completed item per user per path. dwell_seconds capped server-side to avoid client-reported abuse.';

-- ============================================================================
-- deep_dives — schema only; generation pipeline deferred
-- ============================================================================
CREATE TABLE IF NOT EXISTS deep_dives (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    summary             TEXT,
    body_md             TEXT,                     -- nullable until authored

    primary_domain      TEXT,
    microsector_ids     INTEGER[] NOT NULL DEFAULT '{}',

    status              TEXT NOT NULL DEFAULT 'deferred',
    editorial_status    editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by         TEXT REFERENCES user_profiles(id),
    reviewed_at         TIMESTAMPTZ,

    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT dd_status_check
        CHECK (status IN ('deferred','draft','published','archived'))
);

CREATE INDEX IF NOT EXISTS idx_dd_status ON deep_dives(status);
CREATE INDEX IF NOT EXISTS idx_dd_primary_domain ON deep_dives(primary_domain);
CREATE INDEX IF NOT EXISTS idx_dd_microsectors ON deep_dives USING GIN (microsector_ids);

DROP TRIGGER IF EXISTS trg_deep_dives_updated_at ON deep_dives;
CREATE TRIGGER trg_deep_dives_updated_at
    BEFORE UPDATE ON deep_dives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE deep_dives IS
    'Editorial long-form. Schema-only in Phase 1 — no generation pipeline. Default status=deferred. Ready to populate when editorial commissioning exists.';

COMMIT;
