# Daily Pipeline Orchestrator

**Date:** 2026-04-08
**Status:** Approved

## Overview

A single API route (`POST /api/pipeline/run`) that executes four steps sequentially: Ingest, Full Text Extraction, Enrichment, Digest Generation. Triggered by cron at 05:00 AEST (19:00 UTC). Each step must succeed before the next begins. Results are logged to a `pipeline_runs` table for observability.

## Architecture

```
vercel.json cron (19:00 UTC daily)
  -> POST /api/pipeline/run
    -> Step 1: Ingest (RSS + scrape + NewsAPI)
    -> Step 2: Bulk full text extraction (loop until all done or 3-min budget)
    -> Step 3: Enrichment (loop until done or 8-min budget)
    -> Step 4: Digest generation (all users, sequential)
  -> Write pipeline_run record with per-step results
```

## API Route

**`POST /api/pipeline/run`**

- No auth for now (see BACKLOG.md for deployment auth requirement)
- Query params:
  - `step=<1|2|3|4>` -- run only a single step (for manual testing/recovery)
  - `dry=true` -- log what would run without executing
- Response: `PipelineRunResult` with per-step status, durations, counts, and errors

## Step Details

### Step 1 -- Ingest

- Call `pollAllFeeds()` and `scrapeAllTargets()` from existing discovery lib
- Call `fetchNewsApiAi()` and `fetchNewsApiOrg()` for API sources
- Aggregate: total new articles, duplicates skipped, errors
- **Fail condition:** all four source types error (partial success is fine -- some sources may be down)

### Step 2 -- Bulk Full Text Extraction

- New function `extractAllFullText()` in `src/lib/discovery/fulltext.ts`
- Queries `raw_articles` that have no corresponding entry in `full_text_articles`
- Processes in batches of 10, concurrency limit of 5 per batch
- Loops until all processed or 3-minute time budget exceeded
- Returns: articles processed, successes, failures, remaining
- **Fail condition:** extraction success rate < 20% (indicates systemic fetch issue, e.g. network down)

### Step 3 -- Enrichment

- Calls the existing two-stage pipeline logic (`runEnrichmentBatch()` from `pipeline.ts`) in a loop
- Each iteration: Stage 1 classifies batch of 10 articles, Stage 2 enriches individually
- Continues until `done === true` or 8-minute time budget exceeded
- If budget exceeded with articles remaining, logs count (next cron run picks them up)
- Returns: total processed, errors, tokens used, estimated cost, remaining count
- **Fail condition:** first batch fails entirely (0 articles processed with errors > 0)

### Step 4 -- Digest Generation

- Queries all rows from `user_profiles` table
- For each user, runs digest generation logic (personalisation, web context pre-pass, Claude Sonnet synthesis)
- Each briefing is upserted to `daily_briefings` table (same-day regeneration overwrites)
- Returns: users processed, successes, failures
- **Fail condition:** Claude API unavailable for all users (partial success is fine -- individual user failures are logged but don't stop others)

## Data Model

New table `pipeline_runs`:

```sql
CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed | partial
  trigger TEXT NOT NULL DEFAULT 'cron',     -- cron | manual
  steps JSONB NOT NULL DEFAULT '[]',
  error TEXT
);

CREATE INDEX idx_pipeline_runs_started ON pipeline_runs (started_at DESC);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs (status);
```

Each step in the `steps` JSONB array:

```json
{
  "name": "ingest",
  "status": "completed",
  "started_at": "2026-04-08T19:00:00.000Z",
  "completed_at": "2026-04-08T19:01:23.456Z",
  "duration_ms": 83456,
  "result": {
    "new_articles": 142,
    "duplicates_skipped": 38,
    "errors": 1
  },
  "error": null
}
```

## Types

```typescript
interface StepResult {
  name: 'ingest' | 'fulltext' | 'enrichment' | 'digest';
  status: 'completed' | 'failed' | 'skipped';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  result: Record<string, unknown>;
  error: string | null;
}

interface PipelineRunResult {
  id: string;
  started_at: string;
  completed_at: string;
  status: 'completed' | 'failed' | 'partial';
  trigger: 'cron' | 'manual';
  steps: StepResult[];
  error: string | null;
}
```

## File Structure

```
src/
  app/api/pipeline/
    run/route.ts            -- POST handler, cron entry point
  lib/pipeline/
    orchestrator.ts         -- runPipeline() sequential orchestrator
    steps.ts                -- step1Ingest(), step2FullText(), step3Enrich(), step4Digest()
    types.ts                -- PipelineRunResult, StepResult, etc.
  lib/discovery/
    fulltext.ts             -- add extractAllFullText() alongside existing functions
scripts/
  migrate-pipeline.sql      -- pipeline_runs table
```

## Cron Configuration

In `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/pipeline/run",
    "schedule": "0 19 * * *"
  }]
}
```

This fires at 19:00 UTC = 05:00 AEST, giving the pipeline time to complete before users' earliest `digest_time` (typically 06:30).

## Future Queue Swap

The orchestrator calls each step as an async function returning `StepResult`. To swap in Vercel Queues later:

1. Each step function becomes a queue consumer/handler
2. The orchestrator becomes a workflow that enqueues step N+1 on completion of step N
3. The `StepResult` interface stays the same
4. Pipeline_runs table continues to track overall progress

No changes needed to step internals -- only the orchestration layer changes.

## Error Handling

- Each step is wrapped in try/catch
- On step failure: log error, record step result with `status: 'failed'`, write pipeline_run as `status: 'failed'`, stop execution (do not continue to next step)
- Partial success within a step (e.g., 3/15 RSS feeds fail) is not a pipeline failure -- the step succeeds with error counts logged
- The `step` query param allows manual re-running of individual steps for recovery

## Observability

- Each step logs to console with structured prefix: `[pipeline:step_name]`
- Pipeline run record persisted to DB with full step-by-step results
- Future: expose pipeline_runs via a GET endpoint for the dashboard
