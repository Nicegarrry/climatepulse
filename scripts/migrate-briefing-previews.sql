-- ============================================================================
-- Lazy per-archetype briefing previews.
-- The digest pipeline generates a briefing in the user's own archetype only.
-- When an editor opens the archetype switcher and clicks Commercial /
-- Academic / Public / General, the /api/briefing/[id]/preview route calls
-- Claude to reframe the existing digest for that archetype, and caches the
-- result keyed on (briefing_id, archetype) so subsequent clicks are instant.
--
-- Reframing only changes wording/tone (narrative + expert_takes); stories
-- and selection stay identical to the source briefing.
--
-- Idempotent. Run after migrate-user-profiles.sql (daily_briefings exists).
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_briefing_previews (
  briefing_id   TEXT        NOT NULL REFERENCES daily_briefings(id) ON DELETE CASCADE,
  archetype     TEXT        NOT NULL
                CHECK (archetype IN ('commercial', 'academic', 'public', 'general')),
  digest        JSONB       NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used    TEXT,
  PRIMARY KEY (briefing_id, archetype)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefing_previews_generated_at
  ON daily_briefing_previews (generated_at DESC);
