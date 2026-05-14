-- AutoMACC v4 — multi-session-per-user upgrade
-- Changes macc_sessions from one-row-per-user to many-rows-per-user, keyed by
-- (user_id, session_id). session_id is the client-generated MaccSession.id.
-- Idempotent: safe to re-run.

BEGIN;

-- ============================================================================
-- 1. Add session_id column with a temporary default so the NOT NULL is safe
--    against any pre-existing rows.
-- ============================================================================
ALTER TABLE public.macc_sessions
    ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT '';

-- ============================================================================
-- 2. Backfill any rows that still have the empty-string default. Existing
--    single-row-per-user installs get a stable id of 'default' so the client
--    can keep referencing them.
-- ============================================================================
UPDATE public.macc_sessions
   SET session_id = 'default'
 WHERE session_id = '';

-- ============================================================================
-- 3. Drop the default — new rows must specify session_id explicitly.
-- ============================================================================
ALTER TABLE public.macc_sessions
    ALTER COLUMN session_id DROP DEFAULT;

-- ============================================================================
-- 4. Drop the old single-row-per-user uniqueness constraint.
-- ============================================================================
ALTER TABLE public.macc_sessions
    DROP CONSTRAINT IF EXISTS macc_sessions_user_unique;

-- ============================================================================
-- 5. Add the composite uniqueness constraint that powers ON CONFLICT upserts.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'macc_sessions_user_session_unique'
           AND conrelid = 'public.macc_sessions'::regclass
    ) THEN
        ALTER TABLE public.macc_sessions
            ADD CONSTRAINT macc_sessions_user_session_unique
            UNIQUE (user_id, session_id);
    END IF;
END$$;

-- ============================================================================
-- 6. Listing index — supports `WHERE user_id = $1 ORDER BY updated_at DESC`.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_macc_sessions_user_updated
    ON public.macc_sessions(user_id, updated_at DESC);

-- ============================================================================
-- 7. Refresh table comment to reflect the new multi-row shape.
-- ============================================================================
COMMENT ON TABLE public.macc_sessions IS
    'AutoMACC v4 session state. Many rows per user, keyed by (user_id, session_id) where session_id is the client-generated MaccSession.id. Full MaccSession (version 4) lives in payload JSONB. Client mirrors localStorage; server is source of truth across devices.';

-- ============================================================================
-- 8. RLS policies from 001 already check `auth.uid() = user_id` per row, which
--    is correct for multi-row ownership. No changes needed here.
-- ============================================================================

COMMIT;
