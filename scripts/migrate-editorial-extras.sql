-- ============================================================================
-- Editorial extras:
--  1. weekly_digests.author_user_id — byline attribution (nullable; default to
--     the editor who created the draft).
--  2. weekly_digests.scheduled_for — set by the schedule picker. A dedicated
--     cron scans for rows with status='scheduled' AND scheduled_for<=NOW() and
--     flips them to published.
--  3. Relax the status check so 'scheduled' is a valid state.
--
-- Idempotent; fails safe if already applied.
-- Run after: migrate-weekly-digest.sql
-- ============================================================================

ALTER TABLE weekly_digests
  ADD COLUMN IF NOT EXISTS author_user_id TEXT REFERENCES user_profiles(id);

ALTER TABLE weekly_digests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Swap the status CHECK to include 'scheduled'. Pg has no "alter check"; drop
-- + recreate. Constraint name matches the default Postgres auto-name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_digests_status_check'
      AND conrelid = 'weekly_digests'::regclass
  ) THEN
    ALTER TABLE weekly_digests DROP CONSTRAINT weekly_digests_status_check;
  END IF;
END$$;

ALTER TABLE weekly_digests
  ADD CONSTRAINT weekly_digests_status_check
  CHECK (status IN ('draft', 'scheduled', 'published', 'archived'));

-- Help the scheduled-send cron's scan.
CREATE INDEX IF NOT EXISTS idx_weekly_digests_scheduled_pending
  ON weekly_digests (scheduled_for)
  WHERE status = 'scheduled';
