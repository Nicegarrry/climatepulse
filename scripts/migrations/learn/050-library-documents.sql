-- Learn system — canonical library documents (IEA reports, CER guidance, etc.)
-- Depends on: 001-learn-prelude.sql (shared editorial_status + updated_at trigger)
-- Additive only. Separate from knowledge_surface_content because library docs
-- belong to no specific surface — they feed the general retrieval substrate.

BEGIN;

CREATE TABLE IF NOT EXISTS library_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,

    title               TEXT NOT NULL,
    author              TEXT,                    -- e.g. "IEA", "CER", "ARENA"
    publication         TEXT,                    -- e.g. "World Energy Outlook"
    published_year      INTEGER,
    summary             TEXT,                    -- editor abstract

    file_type           TEXT NOT NULL,            -- 'pdf' | 'markdown' | 'text' | 'html'
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

    CONSTRAINT ld_file_type_check
        CHECK (file_type IN ('pdf','markdown','text','html')),
    CONSTRAINT ld_has_source
        CHECK (blob_path IS NOT NULL OR external_url IS NOT NULL)
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

COMMENT ON TABLE library_documents IS
    'Canonical reference documents (IEA WEO, CER guidance, ARENA reports). Embeddings land in content_embeddings with content_type=report_pdf and metadata.library_document_id set. Retrieval includes them unconditionally — no surface scoping.';

COMMIT;
