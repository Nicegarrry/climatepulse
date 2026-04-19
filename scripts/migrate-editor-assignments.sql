-- ============================================================================
-- Guest editor assignments — time-boxed editor access for guest editors.
-- A user whose user_profiles.user_role is 'reader' is treated as an editor
-- for the duration of any row in editor_assignments where
--   week_start <= sydney(today) <= week_end.
-- Admins always have editor privileges regardless.
--
-- Each assignment represents a full week (Mon–Sun in Sydney local time) that
-- the editor owns — they can compose the weekly editorial and intervene on
-- daily briefings during that window.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS editor_assignments (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  week_end     DATE        NOT NULL,
  assigned_by  TEXT        NOT NULL REFERENCES user_profiles(id),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT editor_assignments_range_valid CHECK (week_start <= week_end)
);

CREATE INDEX IF NOT EXISTS idx_editor_assignments_user
  ON editor_assignments (user_id, week_start);

CREATE INDEX IF NOT EXISTS idx_editor_assignments_window
  ON editor_assignments (week_start, week_end);

-- One active assignment per user per week (no overlapping duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_editor_assignments_user_week
  ON editor_assignments (user_id, week_start);
