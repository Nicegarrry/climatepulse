-- Learn system — microsector briefs + blocks
-- Depends on: 001-learn-prelude.sql
-- Additive only. 1:1 with taxonomy_microsectors; independent block cadences.

BEGIN;

-- ============================================================================
-- microsector_briefs — one row per taxonomy_microsectors.id
-- ============================================================================
CREATE TABLE IF NOT EXISTS microsector_briefs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microsector_id              INTEGER NOT NULL UNIQUE
                                    REFERENCES taxonomy_microsectors(id) ON DELETE RESTRICT,

    title                       TEXT NOT NULL,
    tagline                     TEXT,

    -- Regime-change signalling — set by regime_change_detector in Phase 2
    regime_change_flagged       BOOLEAN NOT NULL DEFAULT FALSE,
    regime_change_source_ids    TEXT[] NOT NULL DEFAULT '{}',
    regime_change_flagged_at    TIMESTAMPTZ,

    -- Cross-link
    primary_domain              TEXT,

    -- Editorial state (brief-level; each block has its own)
    editorial_status            editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by                 TEXT REFERENCES user_profiles(id),
    reviewed_at                 TIMESTAMPTZ,

    version                     INTEGER NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mb_microsector ON microsector_briefs(microsector_id);
CREATE INDEX IF NOT EXISTS idx_mb_regime_change ON microsector_briefs(regime_change_flagged_at DESC)
    WHERE regime_change_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_mb_editorial_status ON microsector_briefs(editorial_status);

DROP TRIGGER IF EXISTS trg_microsector_briefs_updated_at ON microsector_briefs;
CREATE TRIGGER trg_microsector_briefs_updated_at
    BEFORE UPDATE ON microsector_briefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE microsector_briefs IS
    'Per-microsector intelligence brief. Composed of independently-versioned blocks; brief-level regime_change_flagged is set when entity_relationships surface a material policy/market shift.';

-- ============================================================================
-- microsector_brief_blocks — composable blocks with per-block cadence + status
-- ============================================================================
CREATE TABLE IF NOT EXISTS microsector_brief_blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id            UUID NOT NULL REFERENCES microsector_briefs(id) ON DELETE CASCADE,

    block_type          TEXT NOT NULL,

    body                TEXT,            -- text blocks
    body_json           JSONB,           -- structured blocks (key_mechanisms, watchlist, related)

    cadence_policy      TEXT NOT NULL,
    last_generated_at   TIMESTAMPTZ,
    last_input_hash     TEXT,
    content_hash        TEXT,

    editorial_status    editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by         TEXT REFERENCES user_profiles(id),
    reviewed_at         TIMESTAMPTZ,

    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT mbb_block_type_check
        CHECK (block_type IN ('nicks_lens','fundamentals','key_mechanisms',
                              'australian_context','current_state','whats_moving',
                              'watchlist','related')),
    CONSTRAINT mbb_cadence_check
        CHECK (cadence_policy IN ('manual','daily','weekly','quarterly','yearly')),
    CONSTRAINT mbb_nicks_lens_manual_only
        CHECK (block_type != 'nicks_lens' OR cadence_policy = 'manual'),
    CONSTRAINT mbb_unique_per_brief
        UNIQUE (brief_id, block_type)
);

CREATE INDEX IF NOT EXISTS idx_mbb_brief ON microsector_brief_blocks(brief_id);
CREATE INDEX IF NOT EXISTS idx_mbb_editorial_status ON microsector_brief_blocks(editorial_status);
CREATE INDEX IF NOT EXISTS idx_mbb_last_generated ON microsector_brief_blocks(last_generated_at);
CREATE INDEX IF NOT EXISTS idx_mbb_cadence ON microsector_brief_blocks(cadence_policy, last_generated_at);

DROP TRIGGER IF EXISTS trg_microsector_brief_blocks_updated_at ON microsector_brief_blocks;
CREATE TRIGGER trg_microsector_brief_blocks_updated_at
    BEFORE UPDATE ON microsector_brief_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE microsector_brief_blocks IS
    'Composable blocks making up a microsector brief. Each block has independent cadence (manual|daily|weekly|quarterly|yearly), editorial_status, version, and content_hash. nicks_lens is schema-enforced manual-only.';

COMMIT;
