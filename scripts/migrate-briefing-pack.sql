-- ============================================================================
-- Briefing pack — editor-specific signals for the Saturday 06:00 pack.
-- Stored as a single JSONB column on weekly_reports so we don't fragment
-- schema. The column is populated by /api/weekly/generate after the
-- existing intelligence report is assembled.
--
-- Shape (nullable until the Saturday pack generator runs):
--   {
--     "top_engaged": [{raw_article_id, headline, source, thumbs_up, saves, expands}],
--     "editor_saves": [{raw_article_id, headline, saved_at, note}],
--     "captured_picks": [{briefing_id, date, rank, headline}],
--     "captured_notes": [{briefing_id, date, rank, headline, note}],
--     "rag_retrievals": [{theme_label, sources: [{source_id, content_type, snippet}]}],
--     "suggested_angles": ["…", "…"]     // 3–5 from Gemini
--   }
--
-- Run after: migrate-weekly-digest.sql
-- Idempotent.
-- ============================================================================

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS briefing_pack JSONB;
