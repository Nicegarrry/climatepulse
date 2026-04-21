-- Learn system — knowledge surfaces (microsite primitive)
-- Depends on: 001-learn-prelude.sql
-- Additive only. Access control logic lives in Phase 4 application code.

BEGIN;

-- ============================================================================
-- knowledge_surfaces — the microsite primitive
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_surfaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,

    template            TEXT NOT NULL,

    -- Scope: which substrate slice this surface shows
    -- {microsector_ids: int[], entity_ids: int[], domain_slugs: text[],
    --  time_window: {from?, to?, rolling_days?},
    --  source_types: text[], editor_status_filter: text[]}
    scope               JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Access control config (interpreted by Phase 4 access.ts):
    -- {kind: 'public'|'unlisted'|'authenticated'|'email_allowlist'|'domain_allowlist'|'cohort_code',
    --  emails?: text[], domains?: text[], cohort_code_hash?: text}
    access              JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Overlay: introduction, editor notes, custom modules, custom quizzes,
    -- external links, pinned_versions (for edge-case #6 canonical overrides)
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

    CONSTRAINT ks_template_check
        CHECK (template IN ('hub','course')),    -- cohort/companion/briefing deferred
    CONSTRAINT ks_lifecycle_check
        CHECK (lifecycle IN ('draft','preview','published','archived'))
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

COMMENT ON TABLE knowledge_surfaces IS
    'Microsite primitive. Template selects layout (hub|course in Phase 4). Scope bounds substrate queries. Overlay adds introduction, editor notes, custom modules, pinned versions. Access control enforced at the application layer via scope filter.';

-- ============================================================================
-- knowledge_surface_content — surface-private content
-- ============================================================================
-- Uploaded docs, custom modules, custom quizzes. Isolated from canonical
-- retrieval via scope filter (Phase 4). Hard-deletable on client request.
CREATE TABLE IF NOT EXISTS knowledge_surface_content (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surface_id          UUID NOT NULL REFERENCES knowledge_surfaces(id) ON DELETE CASCADE,

    content_kind        TEXT NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT,
    body_json           JSONB,

    -- Uploaded doc specifics (null for module/quiz)
    blob_url            TEXT,
    blob_path           TEXT,

    confidentiality     TEXT NOT NULL DEFAULT 'private',

    created_by          TEXT REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT ksc_kind_check
        CHECK (content_kind IN ('uploaded_doc','custom_module','custom_quiz')),
    CONSTRAINT ksc_confidentiality_check
        CHECK (confidentiality IN ('private','public_within_surface')),
    CONSTRAINT ksc_uploaded_doc_has_blob
        CHECK (content_kind != 'uploaded_doc' OR blob_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ksc_surface ON knowledge_surface_content(surface_id);
CREATE INDEX IF NOT EXISTS idx_ksc_kind ON knowledge_surface_content(content_kind);
CREATE INDEX IF NOT EXISTS idx_ksc_not_deleted ON knowledge_surface_content(surface_id)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_ksc_updated_at ON knowledge_surface_content;
CREATE TRIGGER trg_ksc_updated_at
    BEFORE UPDATE ON knowledge_surface_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE knowledge_surface_content IS
    'Surface-private content. Embedded into content_embeddings with content_type uploaded_doc or surface_module and metadata.surface_id set. Canonical retrieval excludes these rows via scope filter. Hard delete purges Blob + embeddings + row.';

-- ============================================================================
-- knowledge_surface_members — access roster
-- ============================================================================
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

    CONSTRAINT ksm_access_level_check
        CHECK (access_level IN ('viewer','contributor','admin')),
    CONSTRAINT ksm_identifier_present
        CHECK (user_id IS NOT NULL OR email IS NOT NULL OR domain IS NOT NULL)
);

-- Partial unique constraints: one active row per identifier per surface
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

COMMENT ON TABLE knowledge_surface_members IS
    'Access roster. Members are identified by user_id (already-registered users), email (pre-registration invite), or domain (bulk org access). One active row per identifier per surface; revoked_at tombstones rather than deletes for audit.';

-- ============================================================================
-- knowledge_surface_analytics — daily aggregate + per-user events
-- ============================================================================
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

    CONSTRAINT ksa_metric_check
        CHECK (metric IN ('view','path_start','path_complete','item_complete',
                          'quiz_score','search','export')),
    CONSTRAINT ksa_count_positive CHECK (count > 0)
);

CREATE INDEX IF NOT EXISTS idx_ksa_surface_day_metric
    ON knowledge_surface_analytics(surface_id, day, metric);
CREATE INDEX IF NOT EXISTS idx_ksa_surface_user
    ON knowledge_surface_analytics(surface_id, user_id)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE knowledge_surface_analytics IS
    'Per-surface engagement. Aggregate rows (user_id NULL) for counts; per-user rows for completion events. Per-user rows carry transparency obligation — disclosure at signup.';

COMMIT;
