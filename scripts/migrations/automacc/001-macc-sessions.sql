-- AutoMACC v4 — per-user session persistence
-- One row per user, full MaccSession stored as JSONB. RLS-restricted to owner.
-- Applied via the standard Supabase migration flow.

BEGIN;

-- ============================================================================
-- macc_sessions — one row per user, JSONB payload (MaccSession v4 shape)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.macc_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payload     JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT macc_sessions_user_unique UNIQUE (user_id)
);

-- updated_at desc — supports future analytics ("recently active sessions").
-- user_id is already covered by the unique constraint.
CREATE INDEX IF NOT EXISTS idx_macc_sessions_updated_at
    ON public.macc_sessions(updated_at DESC);

COMMENT ON TABLE public.macc_sessions IS
    'AutoMACC v4 per-user session state. One row per user; full MaccSession (version 4) lives in payload JSONB. Client mirrors localStorage; server is source of truth across devices.';

-- ============================================================================
-- updated_at trigger — reuse shared fn if it exists, else create local
-- ============================================================================
-- update_updated_at_column() is defined in scripts/migrations/learn/001-learn-prelude.sql.
-- This block redefines it idempotently so this migration is self-contained.
CREATE OR REPLACE FUNCTION public.update_macc_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_macc_sessions_updated_at ON public.macc_sessions;
CREATE TRIGGER trg_macc_sessions_updated_at
    BEFORE UPDATE ON public.macc_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_macc_sessions_updated_at();

-- ============================================================================
-- Row-level security — owner-only access
-- ============================================================================
ALTER TABLE public.macc_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macc_sessions select own" ON public.macc_sessions;
CREATE POLICY "macc_sessions select own"
    ON public.macc_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "macc_sessions insert own" ON public.macc_sessions;
CREATE POLICY "macc_sessions insert own"
    ON public.macc_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "macc_sessions update own" ON public.macc_sessions;
CREATE POLICY "macc_sessions update own"
    ON public.macc_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMIT;
