-- Podcast episodes table
-- Stores generated audio digests (v1: one global episode per day, future: per-user)

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id TEXT PRIMARY KEY,
  briefing_date DATE NOT NULL,
  user_id TEXT,                            -- NULL = global v1 episode
  script JSONB NOT NULL,                   -- PodcastScript (speaker turns)
  audio_url TEXT NOT NULL,                 -- Vercel Blob CDN URL
  audio_duration_seconds INTEGER,
  audio_size_bytes INTEGER,
  audio_format TEXT NOT NULL DEFAULT 'wav',
  model_tts TEXT,
  model_script TEXT,
  generation_cost_usd NUMERIC(8,4),
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(briefing_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_date ON podcast_episodes (briefing_date DESC);
