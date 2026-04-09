-- ClimatePulse: Pipeline Orchestrator Migration
-- Tracks daily pipeline runs for discovery, enrichment, and digest generation

-- =============================================================================
-- Pipeline Runs: Execution history and orchestration state
-- =============================================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'failed', 'partial'
  )),
  trigger TEXT NOT NULL DEFAULT 'cron' CHECK (trigger IN (
    'cron', 'manual', 'api'
  )),
  steps JSONB NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON pipeline_runs (created_at DESC);
