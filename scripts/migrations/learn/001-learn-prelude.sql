-- Learn system — prelude migration
-- Adds shared enum, trigger function, additive columns on existing tables,
-- expands content_embeddings.content_type CHECK, creates generation_costs view.
--
-- SAFETY: purely additive. No data loss, no ALTER on existing column types.
-- Apply with:  psql "$DATABASE_URL" -f scripts/migrations/learn/001-learn-prelude.sql

BEGIN;

-- ============================================================================
-- 1. Shared editorial_status enum
-- ============================================================================
-- Used by: concept_cards, microsector_briefs, microsector_brief_blocks,
-- learning_paths, deep_dives.
-- Five states: editor_authored (human-written), editor_reviewed (AI draft
-- signed off), previously_reviewed_stale (decayed past 180d), ai_drafted
-- (awaiting review, default for AI output), user_generated (end-user authored).
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
END$$;

-- ============================================================================
-- 2. Shared updated_at trigger function
-- ============================================================================
-- Attached to every Learn table with an updated_at column.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Additive columns on taxonomy_microsectors (for edge-case #7 evolution)
-- ============================================================================
ALTER TABLE taxonomy_microsectors
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merged_into INTEGER REFERENCES taxonomy_microsectors(id);

-- Partial index — only scan deprecated rows when a surface evolves its scope.
CREATE INDEX IF NOT EXISTS idx_taxonomy_microsectors_deprecated
    ON taxonomy_microsectors(deprecated_at)
    WHERE deprecated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_taxonomy_microsectors_merged_into
    ON taxonomy_microsectors(merged_into)
    WHERE merged_into IS NOT NULL;

-- ============================================================================
-- 4. enrichment_runs.module for per-module cost tracking
-- ============================================================================
ALTER TABLE enrichment_runs
    ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'enrichment';

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_module
    ON enrichment_runs(module, ran_at DESC);

-- ============================================================================
-- 5. Expand content_embeddings.content_type CHECK
-- ============================================================================
-- Existing values remain valid. Adds 7 Learn-specific types.
-- The historical catch-all 'learn_content' is retained for any pre-existing
-- rows but marked deprecated in product docs.
ALTER TABLE content_embeddings
    DROP CONSTRAINT IF EXISTS content_embeddings_content_type_check;

ALTER TABLE content_embeddings
    ADD CONSTRAINT content_embeddings_content_type_check
    CHECK (content_type IN (
        -- existing types
        'article',
        'podcast',
        'daily_digest',
        'weekly_digest',
        'weekly_report',
        'report_pdf',
        'youtube_transcript',
        'learn_content',
        -- new Learn types
        'concept_card',
        'microsector_brief',
        'microsector_brief_block',
        'learning_path',
        'deep_dive',
        'surface_module',
        'uploaded_doc'
    ));

-- ============================================================================
-- 6. generation_costs view — project enrichment_runs by module
-- ============================================================================
CREATE OR REPLACE VIEW generation_costs AS
SELECT
    ran_at::date        AS day,
    module,
    stage,
    pipeline_version,
    SUM(input_tokens)           AS input_tokens,
    SUM(output_tokens)          AS output_tokens,
    SUM(estimated_cost_usd)     AS cost_usd,
    SUM(articles_processed)     AS items_processed,
    SUM(errors)                 AS errors,
    AVG(duration_ms)::INTEGER   AS avg_duration_ms,
    COUNT(*)                    AS runs
FROM enrichment_runs
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW generation_costs IS
    'Per-day, per-module cost rollup over enrichment_runs. Learn generation writes module=''learn-concept''/''learn-brief''/''learn-path''; legacy enrichment defaults to module=''enrichment''.';

COMMIT;
