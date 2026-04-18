-- ============================================================================
-- Editorial activity log — append-only audit trail of editor interventions.
-- Feeds the "Activity log for today" panel on the Today's Briefing section
-- and the Saturday 06:00 briefing-pack generator (captures week's notes/picks).
--
-- One row per discrete editor action. Keep payload small — just the diff.
--
-- target_type enumerates the kind of artifact the action touched:
--   daily_briefing | weekly_digest | source | assignment
--
-- action enumerates the verb:
--   pick_toggled | note_edited | suppressed | unsuppressed | analysis_edited |
--   intro_edited | reordered | sector_retagged | story_injected |
--   regenerated | published | scheduled | unscheduled | assignment_created |
--   assignment_revoked
--
-- Run after: migrate-daily-editorial.sql
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS editorial_activity_log (
  id             BIGSERIAL PRIMARY KEY,
  actor_user_id  TEXT        NOT NULL,
  target_type    TEXT        NOT NULL,
  target_id      TEXT        NOT NULL,
  action         TEXT        NOT NULL,
  payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editorial_activity_log_created_at
  ON editorial_activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_activity_log_target
  ON editorial_activity_log (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_activity_log_actor
  ON editorial_activity_log (actor_user_id, created_at DESC);
