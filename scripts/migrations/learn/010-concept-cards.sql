-- Learn system — concept cards + candidates + relationships
-- Depends on: 001-learn-prelude.sql (editorial_status enum, updated_at trigger)
-- Additive only. No existing tables modified.

BEGIN;

-- ============================================================================
-- concept_cards — canonical term definitions (MLF, REZ, Safeguard Mechanism…)
-- ============================================================================
CREATE TABLE IF NOT EXISTS concept_cards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug                    TEXT NOT NULL,
    term                    TEXT NOT NULL,
    abbrev                  TEXT,
    disambiguation_context  TEXT NOT NULL DEFAULT '',

    -- Reader-facing content
    inline_summary          TEXT NOT NULL,   -- ~60 words; tooltip + list contexts
    full_body               TEXT NOT NULL,   -- ~200 words; full card page
    key_mechanisms          JSONB,           -- [{title, body}]
    related_terms           TEXT[] NOT NULL DEFAULT '{}',

    -- Visual asset
    visual_type             TEXT NOT NULL DEFAULT 'none',
    visual_spec             JSONB,

    -- Provenance & quality
    uncertainty_flags       JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_citations        JSONB NOT NULL,  -- [{type,ref,title,quote?,accessed_at}]

    -- Cross-link to substrate
    primary_domain          TEXT,            -- taxonomy_domains.slug (denormalised)
    microsector_ids         INTEGER[] NOT NULL DEFAULT '{}',
    entity_ids              INTEGER[] NOT NULL DEFAULT '{}',

    -- Editorial state
    editorial_status        editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by             TEXT REFERENCES user_profiles(id),
    reviewed_at             TIMESTAMPTZ,
    ai_drafted              BOOLEAN NOT NULL DEFAULT TRUE,

    -- Versioning
    version                 INTEGER NOT NULL DEFAULT 1,
    superseded_by           UUID REFERENCES concept_cards(id),
    content_hash            TEXT NOT NULL,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT concept_cards_slug_context_unique UNIQUE (slug, disambiguation_context),
    CONSTRAINT concept_cards_visual_type_check
        CHECK (visual_type IN ('none','chart','map','diagram','photo')),
    CONSTRAINT concept_cards_version_positive CHECK (version >= 1),
    CONSTRAINT concept_cards_not_self_superseded CHECK (superseded_by IS NULL OR superseded_by != id)
);

CREATE INDEX IF NOT EXISTS idx_concept_cards_slug ON concept_cards(slug);
CREATE INDEX IF NOT EXISTS idx_concept_cards_domain ON concept_cards(primary_domain);
CREATE INDEX IF NOT EXISTS idx_concept_cards_editorial_status ON concept_cards(editorial_status);
CREATE INDEX IF NOT EXISTS idx_concept_cards_reviewed_at ON concept_cards(reviewed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_concept_cards_microsectors ON concept_cards USING GIN (microsector_ids);
CREATE INDEX IF NOT EXISTS idx_concept_cards_entities ON concept_cards USING GIN (entity_ids);
CREATE INDEX IF NOT EXISTS idx_concept_cards_related_terms ON concept_cards USING GIN (related_terms);
CREATE INDEX IF NOT EXISTS idx_concept_cards_superseded_by
    ON concept_cards(superseded_by) WHERE superseded_by IS NOT NULL;

DROP TRIGGER IF EXISTS trg_concept_cards_updated_at ON concept_cards;
CREATE TRIGGER trg_concept_cards_updated_at
    BEFORE UPDATE ON concept_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE concept_cards IS
    'Reader-facing definitions of terms. Orthogonal to entities — a card may reference entity_ids but does not replace them. Versioned via monotonic version INT + content_hash for drift detection on pinned references.';

-- ============================================================================
-- concept_card_candidates — extraction review queue
-- ============================================================================
-- AI-extracted or manually-proposed concept candidates. Editor reviews before
-- generation runs promote them to concept_cards.
CREATE TABLE IF NOT EXISTS concept_card_candidates (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    term                        TEXT NOT NULL,
    abbrev                      TEXT,
    disambiguation_context      TEXT NOT NULL DEFAULT '',
    proposed_inline_summary     TEXT,

    extraction_source           TEXT NOT NULL,
    source_refs                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    signal_count                INTEGER NOT NULL DEFAULT 1,
    dedupe_group_id             UUID,

    status                      TEXT NOT NULL DEFAULT 'pending_review',
    promoted_to                 UUID REFERENCES concept_cards(id),
    reviewed_by                 TEXT REFERENCES user_profiles(id),
    reviewed_at                 TIMESTAMPTZ,
    review_notes                TEXT,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT concept_card_candidates_source_check
        CHECK (extraction_source IN ('briefing_corpus','entity_registry','manual_seed','canonical_source')),
    CONSTRAINT concept_card_candidates_status_check
        CHECK (status IN ('pending_review','approved','rejected','promoted'))
);

CREATE INDEX IF NOT EXISTS idx_ccc_status ON concept_card_candidates(status);
CREATE INDEX IF NOT EXISTS idx_ccc_dedupe_group ON concept_card_candidates(dedupe_group_id)
    WHERE dedupe_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ccc_signal_count ON concept_card_candidates(signal_count DESC);
CREATE INDEX IF NOT EXISTS idx_ccc_term_trgm ON concept_card_candidates
    USING GIN (term gin_trgm_ops);

COMMENT ON TABLE concept_card_candidates IS
    'Review queue for proposed concept cards. Populated by extractors from 4 sources (briefings, entities, manual seeds, canonical sources). Promoted rows link via promoted_to and flip status to promoted.';

-- ============================================================================
-- concept_card_relationships — typed edges between cards
-- ============================================================================
-- Mirrors the entity_relationships shape (subject/object/predicate, confidence,
-- evidence, observation tracking, source metadata, metadata JSONB).
CREATE TABLE IF NOT EXISTS concept_card_relationships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_card_id     UUID NOT NULL REFERENCES concept_cards(id) ON DELETE CASCADE,
    object_card_id      UUID NOT NULL REFERENCES concept_cards(id) ON DELETE CASCADE,
    relationship_type   TEXT NOT NULL,

    confidence          NUMERIC(3,2) NOT NULL,
    evidence            TEXT,

    source_type         TEXT NOT NULL,
    source_id           TEXT,

    first_observed      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observation_count   INTEGER NOT NULL DEFAULT 1,

    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ccr_type_check
        CHECK (relationship_type IN ('prereq','related','supersedes','contrasts_with','peer')),
    CONSTRAINT ccr_confidence_range
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT ccr_source_type_check
        CHECK (source_type IN ('editor','llm','backfill')),
    CONSTRAINT ccr_not_self
        CHECK (subject_card_id != object_card_id),
    CONSTRAINT ccr_unique_triple
        UNIQUE (subject_card_id, relationship_type, object_card_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ccr_subject ON concept_card_relationships(subject_card_id);
CREATE INDEX IF NOT EXISTS idx_ccr_object ON concept_card_relationships(object_card_id);
CREATE INDEX IF NOT EXISTS idx_ccr_type ON concept_card_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_ccr_confidence ON concept_card_relationships(confidence DESC);

COMMENT ON TABLE concept_card_relationships IS
    'Typed edges between concept cards. Mirrors entity_relationships shape. Supports prereq/related/supersedes/contrasts_with/peer with confidence scoring + evidence + observation tracking.';

COMMIT;
