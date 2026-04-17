-- ============================================================================
-- Daily editorial overrides — post-publish edits
-- Editor picks / suppresses / rewrites stories without regenerating the
-- digest. Overrides are merged on read; no draft→publish window.
--
-- editorial_overrides shape (keyed by story_id/rank as string):
--   {
--     "1": {
--       "editors_pick": true,
--       "editorial_note": "string",
--       "analysis_override": "string"
--     }
--   }
--
-- Run after: migrate-user-profiles.sql
-- Safe to re-run.
-- ============================================================================

ALTER TABLE daily_briefings
  ADD COLUMN IF NOT EXISTS editorial_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE daily_briefings
  ADD COLUMN IF NOT EXISTS suppressed_story_ids TEXT[] NOT NULL DEFAULT '{}'::text[];

-- When an editor last touched this briefing (for "edited" affordance in UI).
ALTER TABLE daily_briefings
  ADD COLUMN IF NOT EXISTS editorially_updated_at TIMESTAMPTZ;
