-- Notification preferences stored as JSONB on user_profiles.
-- Keys:
--   daily_briefing         — ping when the morning briefing is ready
--   weekly_digest          — weekly pulse email
--   high_priority_alerts   — stories with significance >= 75
--   entity_updates         — when a followed entity appears in a new story
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"daily_briefing":true,"weekly_digest":true,"high_priority_alerts":false,"entity_updates":false}';
