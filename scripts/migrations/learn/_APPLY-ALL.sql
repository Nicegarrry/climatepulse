-- =====================================================================
-- ClimatePulse Learn System — consolidated migration bundle.
-- Paste this entire file into the Supabase SQL editor and Run.
-- Idempotent + additive: safe to re-run. Each file is wrapped in its own
-- BEGIN/COMMIT, so a failure halts the transaction block containing it
-- without corrupting earlier migrations.
--
-- Applies, in order:
--   001-learn-prelude.sql        (shared enum + trigger + additive cols)
--   010-concept-cards.sql         (concept_cards + candidates + rels)
--   020-microsector-briefs.sql    (briefs + blocks with per-block cadence)
--   030-learning-paths.sql        (paths + items + progress + deep_dives)
--   040-knowledge-surfaces.sql    (surfaces + private content + members)
--   050-library-documents.sql     (library_documents — canonical PDFs)
--
-- The source files still live in scripts/migrations/learn/*.sql — this
-- consolidated bundle is only for convenience when applying via the
-- Supabase SQL editor (no psql in hand). If you run psql locally:
--     for f in scripts/migrations/learn/0*.sql; do
--       psql "$DATABASE_URL" -f "$f";
--     done
-- =====================================================================

-- ─── 001-learn-prelude.sql ─────────────────────────────────────────────

-- See the file of the same name for inline commentary. This block is a
-- verbatim copy; keep in sync if the source file evolves.

BEGIN;

-- 1. Shared editorial_status enum (used by concept_cards, microsector_briefs,
--    microsector_brief_blocks, learning_paths, deep_dives, library_documents).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'editorial_status') THEN
        CREATE TYPE editorial_status AS ENUM (
            'editor_authored',
            'editor_reviewed',
            'previously_reviewed_stale',
            'ai_drafted',
            'user_generated'
        );
    END IF;
END $$;

-- 2. Shared updated_at trigger function (reused across all learn tables).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Additive columns on taxonomy_microsectors for deprecation tracking.
ALTER TABLE taxonomy_microsectors
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merged_into INTEGER REFERENCES taxonomy_microsectors(id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_microsectors_deprecated
    ON taxonomy_microsectors(deprecated_at)
    WHERE deprecated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_taxonomy_microsectors_merged_into
    ON taxonomy_microsectors(merged_into)
    WHERE merged_into IS NOT NULL;

-- 4. enrichment_runs.module for per-module cost tracking.
ALTER TABLE enrichment_runs
    ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'enrichment';

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_module
    ON enrichment_runs(module, ran_at DESC);

-- 5. Expand content_embeddings.content_type CHECK.
ALTER TABLE content_embeddings
    DROP CONSTRAINT IF EXISTS content_embeddings_content_type_check;

ALTER TABLE content_embeddings
    ADD CONSTRAINT content_embeddings_content_type_check
    CHECK (content_type IN (
        'article','podcast','daily_digest','weekly_digest','weekly_report',
        'report_pdf','youtube_transcript','learn_content',
        'concept_card','microsector_brief','microsector_brief_block',
        'learning_path','deep_dive','surface_module','uploaded_doc'
    ));

-- 6. generation_costs view — filtered projection over enrichment_runs by module.
CREATE OR REPLACE VIEW generation_costs AS
SELECT
    DATE(ran_at) AS day,
    module,
    stage,
    COUNT(*) AS runs,
    SUM(articles_processed) AS items,
    SUM(input_tokens) AS input_tokens,
    SUM(output_tokens) AS output_tokens,
    SUM(estimated_cost_usd) AS cost_usd
FROM enrichment_runs
GROUP BY DATE(ran_at), module, stage;

COMMIT;

-- ─── 010-concept-cards.sql ─────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS concept_cards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    TEXT NOT NULL,
    term                    TEXT NOT NULL,
    abbrev                  TEXT,
    disambiguation_context  TEXT NOT NULL DEFAULT '',
    inline_summary          TEXT NOT NULL,
    full_body               TEXT NOT NULL,
    key_mechanisms          JSONB,
    related_terms           TEXT[] NOT NULL DEFAULT '{}',
    visual_type             TEXT NOT NULL DEFAULT 'none',
    visual_spec             JSONB,
    uncertainty_flags       JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_citations        JSONB NOT NULL,
    primary_domain          TEXT,
    microsector_ids         INTEGER[] NOT NULL DEFAULT '{}',
    entity_ids              INTEGER[] NOT NULL DEFAULT '{}',
    editorial_status        editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by             TEXT REFERENCES user_profiles(id),
    reviewed_at             TIMESTAMPTZ,
    ai_drafted              BOOLEAN NOT NULL DEFAULT TRUE,
    version                 INTEGER NOT NULL DEFAULT 1,
    superseded_by           UUID REFERENCES concept_cards(id),
    content_hash            TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT concept_cards_slug_context_unique UNIQUE (slug, disambiguation_context),
    CONSTRAINT concept_cards_visual_type_check CHECK (visual_type IN ('none','chart','map','diagram','photo')),
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
    CONSTRAINT ccr_type_check CHECK (relationship_type IN ('prereq','related','supersedes','contrasts_with','peer')),
    CONSTRAINT ccr_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT ccr_source_type_check CHECK (source_type IN ('editor','llm','backfill')),
    CONSTRAINT ccr_not_self CHECK (subject_card_id != object_card_id),
    CONSTRAINT ccr_unique_triple UNIQUE (subject_card_id, relationship_type, object_card_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ccr_subject ON concept_card_relationships(subject_card_id);
CREATE INDEX IF NOT EXISTS idx_ccr_object ON concept_card_relationships(object_card_id);
CREATE INDEX IF NOT EXISTS idx_ccr_type ON concept_card_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_ccr_confidence ON concept_card_relationships(confidence DESC);

COMMIT;

-- ─── 020-microsector-briefs.sql ────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS microsector_briefs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microsector_id              INTEGER NOT NULL UNIQUE REFERENCES taxonomy_microsectors(id) ON DELETE RESTRICT,
    title                       TEXT NOT NULL,
    tagline                     TEXT,
    regime_change_flagged       BOOLEAN NOT NULL DEFAULT FALSE,
    regime_change_source_ids    TEXT[] NOT NULL DEFAULT '{}',
    regime_change_flagged_at    TIMESTAMPTZ,
    primary_domain              TEXT,
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

CREATE TABLE IF NOT EXISTS microsector_brief_blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id            UUID NOT NULL REFERENCES microsector_briefs(id) ON DELETE CASCADE,
    block_type          TEXT NOT NULL,
    body                TEXT,
    body_json           JSONB,
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
    CONSTRAINT mbb_unique_per_brief UNIQUE (brief_id, block_type)
);

CREATE INDEX IF NOT EXISTS idx_mbb_brief ON microsector_brief_blocks(brief_id);
CREATE INDEX IF NOT EXISTS idx_mbb_editorial_status ON microsector_brief_blocks(editorial_status);
CREATE INDEX IF NOT EXISTS idx_mbb_last_generated ON microsector_brief_blocks(last_generated_at);
CREATE INDEX IF NOT EXISTS idx_mbb_cadence ON microsector_brief_blocks(cadence_policy, last_generated_at);

DROP TRIGGER IF EXISTS trg_microsector_brief_blocks_updated_at ON microsector_brief_blocks;
CREATE TRIGGER trg_microsector_brief_blocks_updated_at
    BEFORE UPDATE ON microsector_brief_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ─── 030-learning-paths.sql ────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS learning_paths (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    goal                TEXT,
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
    CONSTRAINT lp_update_policy_check CHECK (update_policy IN ('frozen','live','periodic'))
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

CREATE TABLE IF NOT EXISTS learning_path_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id                 UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    position                INTEGER NOT NULL,
    chapter                 TEXT,
    item_type               TEXT NOT NULL,
    item_id                 TEXT NOT NULL,
    item_version            INTEGER,
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

CREATE TABLE IF NOT EXISTS deep_dives (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    summary             TEXT,
    body_md             TEXT,
    primary_domain      TEXT,
    microsector_ids     INTEGER[] NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'deferred',
    editorial_status    editorial_status NOT NULL DEFAULT 'ai_drafted',
    reviewed_by         TEXT REFERENCES user_profiles(id),
    reviewed_at         TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dd_status_check CHECK (status IN ('deferred','draft','published','archived'))
);

CREATE INDEX IF NOT EXISTS idx_dd_status ON deep_dives(status);
CREATE INDEX IF NOT EXISTS idx_dd_primary_domain ON deep_dives(primary_domain);
CREATE INDEX IF NOT EXISTS idx_dd_microsectors ON deep_dives USING GIN (microsector_ids);

DROP TRIGGER IF EXISTS trg_deep_dives_updated_at ON deep_dives;
CREATE TRIGGER trg_deep_dives_updated_at
    BEFORE UPDATE ON deep_dives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ─── 040-knowledge-surfaces.sql ────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_surfaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    template            TEXT NOT NULL,
    scope               JSONB NOT NULL DEFAULT '{}'::jsonb,
    access              JSONB NOT NULL DEFAULT '{}'::jsonb,
    overlay             JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout              JSONB NOT NULL DEFAULT '{}'::jsonb,
    branding            JSONB NOT NULL DEFAULT '{}'::jsonb,
    lifecycle           TEXT NOT NULL DEFAULT 'draft',
    owner_user_id       TEXT NOT NULL REFERENCES user_profiles(id),
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at        TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    CONSTRAINT ks_template_check CHECK (template IN ('hub','course')),
    CONSTRAINT ks_lifecycle_check CHECK (lifecycle IN ('draft','preview','published','archived'))
);

CREATE INDEX IF NOT EXISTS idx_ks_owner ON knowledge_surfaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ks_lifecycle ON knowledge_surfaces(lifecycle);
CREATE INDEX IF NOT EXISTS idx_ks_template ON knowledge_surfaces(template);
CREATE INDEX IF NOT EXISTS idx_ks_scope_microsectors
    ON knowledge_surfaces USING GIN ((scope->'microsector_ids'));
CREATE INDEX IF NOT EXISTS idx_ks_scope_domains
    ON knowledge_surfaces USING GIN ((scope->'domain_slugs'));

DROP TRIGGER IF EXISTS trg_knowledge_surfaces_updated_at ON knowledge_surfaces;
CREATE TRIGGER trg_knowledge_surfaces_updated_at
    BEFORE UPDATE ON knowledge_surfaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS knowledge_surface_content (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surface_id          UUID NOT NULL REFERENCES knowledge_surfaces(id) ON DELETE CASCADE,
    content_kind        TEXT NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT,
    body_json           JSONB,
    blob_url            TEXT,
    blob_path           TEXT,
    confidentiality     TEXT NOT NULL DEFAULT 'private',
    created_by          TEXT REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT ksc_kind_check CHECK (content_kind IN ('uploaded_doc','custom_module','custom_quiz')),
    CONSTRAINT ksc_confidentiality_check CHECK (confidentiality IN ('private','public_within_surface')),
    CONSTRAINT ksc_uploaded_doc_has_blob CHECK (content_kind != 'uploaded_doc' OR blob_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ksc_surface ON knowledge_surface_content(surface_id);
CREATE INDEX IF NOT EXISTS idx_ksc_kind ON knowledge_surface_content(content_kind);
CREATE INDEX IF NOT EXISTS idx_ksc_not_deleted ON knowledge_surface_content(surface_id)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_ksc_updated_at ON knowledge_surface_content;
CREATE TRIGGER trg_ksc_updated_at
    BEFORE UPDATE ON knowledge_surface_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS knowledge_surface_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surface_id      UUID NOT NULL REFERENCES knowledge_surfaces(id) ON DELETE CASCADE,
    user_id         TEXT REFERENCES user_profiles(id),
    email           TEXT,
    domain          TEXT,
    access_level    TEXT NOT NULL DEFAULT 'viewer',
    redeemed_via_code BOOLEAN NOT NULL DEFAULT FALSE,
    granted_by      TEXT REFERENCES user_profiles(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT ksm_access_level_check CHECK (access_level IN ('viewer','contributor','admin')),
    CONSTRAINT ksm_identifier_present CHECK (user_id IS NOT NULL OR email IS NOT NULL OR domain IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ksm_unique_active_user
    ON knowledge_surface_members(surface_id, user_id)
    WHERE user_id IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ksm_unique_active_email
    ON knowledge_surface_members(surface_id, email)
    WHERE email IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ksm_unique_active_domain
    ON knowledge_surface_members(surface_id, domain)
    WHERE domain IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ksm_user ON knowledge_surface_members(user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ksm_email ON knowledge_surface_members(email)
    WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_surface_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surface_id      UUID NOT NULL REFERENCES knowledge_surfaces(id) ON DELETE CASCADE,
    day             DATE NOT NULL,
    metric          TEXT NOT NULL,
    user_id         TEXT REFERENCES user_profiles(id),
    count           INTEGER NOT NULL DEFAULT 1,
    value           NUMERIC,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ksa_metric_check CHECK (metric IN ('view','path_start','path_complete','item_complete',
                                                  'quiz_score','search','export')),
    CONSTRAINT ksa_count_positive CHECK (count > 0)
);

CREATE INDEX IF NOT EXISTS idx_ksa_surface_day_metric
    ON knowledge_surface_analytics(surface_id, day, metric);
CREATE INDEX IF NOT EXISTS idx_ksa_surface_user
    ON knowledge_surface_analytics(surface_id, user_id)
    WHERE user_id IS NOT NULL;

COMMIT;

-- ─── 050-library-documents.sql ─────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS library_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    author              TEXT,
    publication         TEXT,
    published_year      INTEGER,
    summary             TEXT,
    file_type           TEXT NOT NULL,
    blob_url            TEXT,
    blob_path           TEXT,
    external_url        TEXT,
    byte_size           BIGINT,
    primary_domain      TEXT,
    microsector_ids     INTEGER[] NOT NULL DEFAULT '{}',
    jurisdictions       TEXT[] NOT NULL DEFAULT '{}',
    tags                TEXT[] NOT NULL DEFAULT '{}',
    indexed_at          TIMESTAMPTZ,
    indexed_chunks      INTEGER NOT NULL DEFAULT 0,
    indexing_error      TEXT,
    indexing_skipped    BOOLEAN NOT NULL DEFAULT FALSE,
    editorial_status    editorial_status NOT NULL DEFAULT 'editor_authored',
    uploaded_by         TEXT REFERENCES user_profiles(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT ld_file_type_check CHECK (file_type IN ('pdf','markdown','text','html')),
    CONSTRAINT ld_has_source CHECK (blob_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ld_slug ON library_documents(slug);
CREATE INDEX IF NOT EXISTS idx_ld_primary_domain ON library_documents(primary_domain);
CREATE INDEX IF NOT EXISTS idx_ld_microsectors ON library_documents USING GIN (microsector_ids);
CREATE INDEX IF NOT EXISTS idx_ld_tags ON library_documents USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_ld_indexed ON library_documents(indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ld_active ON library_documents(uploaded_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_library_documents_updated_at ON library_documents;
CREATE TRIGGER trg_library_documents_updated_at
    BEFORE UPDATE ON library_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =====================================================================
-- Done. Quick smoke check:
--   SELECT COUNT(*) FROM concept_cards;
--   SELECT COUNT(*) FROM microsector_briefs;
--   SELECT COUNT(*) FROM learning_paths;
--   SELECT COUNT(*) FROM knowledge_surfaces;
--   SELECT COUNT(*) FROM library_documents;
-- All should return 0 on a fresh apply. Reload /learn and /teaching.
-- =====================================================================
