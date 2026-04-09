# Daily Pipeline Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sequential daily pipeline orchestrator that runs Ingest -> Full Text -> Enrichment -> Digest as a single cron-triggered API route.

**Architecture:** A POST route at `/api/pipeline/run` calls four step functions sequentially. Each step returns a `StepResult`. If a step fails, the pipeline stops and records the failure. Results are persisted to a `pipeline_runs` table. A `extractAllFullText()` function is added to fulltext.ts for bulk extraction.

**Tech Stack:** Next.js 16 API Routes, PostgreSQL (`pg` driver), existing discovery/enrichment/digest libs.

---

### Task 1: Database Migration — pipeline_runs table

**Files:**
- Create: `scripts/migrate-pipeline.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/migrate-pipeline.sql
-- Pipeline orchestrator: tracks daily pipeline runs

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  trigger TEXT NOT NULL DEFAULT 'cron',
  steps JSONB NOT NULL DEFAULT '[]',
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);
```

- [ ] **Step 2: Run the migration**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); const fs=require('fs'); p.query(fs.readFileSync('scripts/migrate-pipeline.sql','utf8')).then(()=>{console.log('OK');p.end()}).catch(e=>{console.error(e.message);p.end()})"`

Expected: `OK`

- [ ] **Step 3: Verify table exists**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pipeline_runs' ORDER BY ordinal_position\").then(r=>{console.log(r.rows);p.end()}).catch(e=>{console.error(e.message);p.end()})"`

Expected: 7 columns — id, started_at, completed_at, status, trigger, steps, error

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-pipeline.sql
git commit -m "feat(pipeline): add pipeline_runs migration"
```

---

### Task 2: Pipeline Types

**Files:**
- Create: `src/lib/pipeline/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/pipeline/types.ts

export type StepName = "ingest" | "fulltext" | "enrichment" | "digest";

export type StepStatus = "completed" | "failed" | "skipped";

export type PipelineStatus = "running" | "completed" | "failed" | "partial";

export type PipelineTrigger = "cron" | "manual";

export interface StepResult {
  name: StepName;
  status: StepStatus;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  result: Record<string, unknown>;
  error: string | null;
}

export interface PipelineRunResult {
  id: string;
  started_at: string;
  completed_at: string;
  status: PipelineStatus;
  trigger: PipelineTrigger;
  steps: StepResult[];
  error: string | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/pipeline/types.ts 2>&1 | head -20`

Expected: No errors (or Next.js path alias issues which are fine — the file is pure types)

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/types.ts
git commit -m "feat(pipeline): add pipeline type definitions"
```

---

### Task 3: Bulk Full Text Extraction Function

**Files:**
- Modify: `src/lib/discovery/fulltext.ts` — export `fetchAndExtract`, add `extractAllFullText()`

- [ ] **Step 1: Export the existing `fetchAndExtract` function**

In `src/lib/discovery/fulltext.ts`, change line 8 from:

```typescript
async function fetchAndExtract(url: string): Promise<string | null> {
```

to:

```typescript
export async function fetchAndExtract(url: string): Promise<string | null> {
```

- [ ] **Step 2: Add `extractAllFullText()` function**

Append to the end of `src/lib/discovery/fulltext.ts`:

```typescript
/**
 * Bulk-extract full text for all raw_articles missing from full_text_articles.
 * Processes in batches of 10 with concurrency 5, respects a time budget.
 */
export async function extractAllFullText(
  timeBudgetMs: number = 3 * 60 * 1000
): Promise<{
  processed: number;
  successes: number;
  failures: number;
  remaining: number;
  budget_exceeded: boolean;
}> {
  const deadline = Date.now() + timeBudgetMs;
  let processed = 0;
  let successes = 0;
  let failures = 0;
  const BATCH_SIZE = 10;
  const CONCURRENCY = 5;

  while (Date.now() < deadline) {
    // Fetch next batch of articles without full text
    const batch = await pool.query(
      `SELECT ra.id, ra.article_url, ra.source_name
       FROM raw_articles ra
       LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
       WHERE ft.id IS NULL
       ORDER BY ra.fetched_at DESC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (batch.rows.length === 0) {
      // All articles have full text
      return { processed, successes, failures, remaining: 0, budget_exceeded: false };
    }

    // Process batch with concurrency limit
    const articles = batch.rows as Array<{
      id: string;
      article_url: string;
      source_name: string;
    }>;

    for (let i = 0; i < articles.length; i += CONCURRENCY) {
      if (Date.now() >= deadline) {
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM raw_articles ra
           LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
           WHERE ft.id IS NULL`
        );
        const remaining = parseInt(countResult.rows[0].cnt, 10);
        return { processed, successes, failures, remaining, budget_exceeded: true };
      }

      const chunk = articles.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (article) => {
          const text = await fetchAndExtract(article.article_url);
          if (text) {
            const wordCount = text.split(/\s+/).length;
            await pool.query(
              `INSERT INTO full_text_articles (raw_article_id, content, word_count)
               VALUES ($1, $2, $3)
               ON CONFLICT (raw_article_id) DO UPDATE SET
                 content = EXCLUDED.content,
                 word_count = EXCLUDED.word_count,
                 extracted_at = NOW()`,
              [article.id, text, wordCount]
            );
            return true;
          }
          return false;
        })
      );

      for (const r of results) {
        processed++;
        if (r.status === "fulfilled" && r.value) {
          successes++;
        } else {
          failures++;
        }
      }
    }
  }

  // Budget exceeded — count remaining
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM raw_articles ra
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     WHERE ft.id IS NULL`
  );
  const remaining = parseInt(countResult.rows[0].cnt, 10);
  return { processed, successes, failures, remaining, budget_exceeded: true };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep fulltext | head -10`

Expected: No errors related to fulltext.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/discovery/fulltext.ts
git commit -m "feat(pipeline): add extractAllFullText() bulk extraction"
```

---

### Task 4: Pipeline Step Functions

**Files:**
- Create: `src/lib/pipeline/steps.ts`

This file contains the four step functions. Each wraps existing library calls, handles errors, and returns a `StepResult`.

- [ ] **Step 1: Create steps.ts with step1Ingest**

```typescript
// src/lib/pipeline/steps.ts

import type { StepResult } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function elapsed(start: number): number {
  return Date.now() - start;
}

async function runStep(
  name: StepResult["name"],
  fn: () => Promise<Record<string, unknown>>
): Promise<StepResult> {
  const started_at = now();
  const t0 = Date.now();
  try {
    const result = await fn();
    return {
      name,
      status: "completed",
      started_at,
      completed_at: now(),
      duration_ms: elapsed(t0),
      result,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "failed",
      started_at,
      completed_at: now(),
      duration_ms: elapsed(t0),
      result: {},
      error: message,
    };
  }
}

// ─── Step 1: Ingest ─────────────────────────────────────────────────────────

export async function step1Ingest(): Promise<StepResult> {
  return runStep("ingest", async () => {
    const { pollAllFeeds } = await import("@/lib/discovery/poller");
    const { scrapeAllTargets } = await import("@/lib/discovery/scraper");
    const { fetchNewsApiAi } = await import("@/lib/discovery/newsapi-ai");
    const { fetchNewsApiOrg } = await import("@/lib/discovery/newsapi-org");

    const results = await Promise.allSettled([
      pollAllFeeds(),
      scrapeAllTargets(),
      fetchNewsApiAi(),
      fetchNewsApiOrg(),
    ]);

    let new_articles = 0;
    let duplicates_skipped = 0;
    let source_errors = 0;
    let sources_succeeded = 0;
    const error_details: Array<{ source: string; error: string }> = [];

    const labels = ["rss", "scrape", "newsapi_ai", "newsapi_org"];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        sources_succeeded++;
        new_articles += r.value.new_articles;
        duplicates_skipped += r.value.duplicates_skipped;
        source_errors += r.value.errors;
        if (r.value.error_details) {
          for (const d of r.value.error_details) {
            error_details.push({ source: labels[i], error: d.error ?? d.source ?? String(d) });
          }
        }
      } else {
        error_details.push({ source: labels[i], error: r.reason?.message ?? String(r.reason) });
      }
    }

    // Fail if ALL sources errored
    if (sources_succeeded === 0) {
      throw new Error(
        `All 4 ingestion sources failed: ${error_details.map((d) => `${d.source}: ${d.error}`).join("; ")}`
      );
    }

    return {
      new_articles,
      duplicates_skipped,
      source_errors,
      sources_succeeded,
      sources_failed: results.length - sources_succeeded,
      error_details,
    };
  });
}

// ─── Step 2: Full Text Extraction ───────────────────────────────────────────

export async function step2FullText(): Promise<StepResult> {
  return runStep("fulltext", async () => {
    const { extractAllFullText } = await import("@/lib/discovery/fulltext");

    const result = await extractAllFullText(3 * 60 * 1000); // 3-minute budget

    // Fail if success rate < 20% and we processed at least 5 articles
    if (result.processed >= 5 && result.successes / result.processed < 0.2) {
      throw new Error(
        `Full text extraction success rate too low: ${result.successes}/${result.processed} (${Math.round((result.successes / result.processed) * 100)}%)`
      );
    }

    return {
      processed: result.processed,
      successes: result.successes,
      failures: result.failures,
      remaining: result.remaining,
      budget_exceeded: result.budget_exceeded,
    };
  });
}

// ─── Step 3: Enrichment ─────────────────────────────────────────────────────

export async function step3Enrich(): Promise<StepResult> {
  return runStep("enrichment", async () => {
    const { runEnrichmentBatch } = await import("@/lib/enrichment/pipeline");

    const TIME_BUDGET_MS = 8 * 60 * 1000; // 8 minutes
    const deadline = Date.now() + TIME_BUDGET_MS;

    let total_processed = 0;
    let total_errors = 0;
    let total_input_tokens = 0;
    let total_output_tokens = 0;
    let total_cost = 0;
    let total_entities_created = 0;
    let total_entities_matched = 0;
    let remaining = 0;
    let iterations = 0;

    while (Date.now() < deadline) {
      const batch = await runEnrichmentBatch();
      iterations++;

      total_processed += batch.articles_processed;
      total_errors += batch.errors;
      total_input_tokens += batch.input_tokens;
      total_output_tokens += batch.output_tokens;
      total_cost += batch.estimated_cost_usd;
      total_entities_created += batch.entities_created;
      total_entities_matched += batch.entities_matched;
      remaining = batch.total_remaining;

      // First batch failed entirely — abort
      if (iterations === 1 && batch.articles_processed === 0 && batch.errors > 0) {
        throw new Error(
          `First enrichment batch failed: 0 processed, ${batch.errors} errors`
        );
      }

      if (batch.done) break;

      // If no articles were processed and no errors, nothing left
      if (batch.articles_processed === 0 && batch.errors === 0) break;
    }

    return {
      total_processed,
      total_errors,
      total_input_tokens,
      total_output_tokens,
      estimated_cost_usd: Math.round(total_cost * 10000) / 10000,
      entities_created: total_entities_created,
      entities_matched: total_entities_matched,
      remaining,
      iterations,
      budget_exceeded: Date.now() >= deadline && remaining > 0,
    };
  });
}

// ─── Step 4: Digest Generation ──────────────────────────────────────────────

export async function step4Digest(): Promise<StepResult> {
  return runStep("digest", async () => {
    const pool = (await import("@/lib/db")).default;

    // Fetch all user profiles
    const usersResult = await pool.query(
      `SELECT id, name FROM user_profiles ORDER BY id`
    );
    const users = usersResult.rows as Array<{ id: string; name: string }>;

    if (users.length === 0) {
      return { users_found: 0, successes: 0, failures: 0, details: [] };
    }

    let successes = 0;
    let failures = 0;
    const details: Array<{ user_id: string; name: string; status: string; error?: string; story_count?: number }> = [];

    for (const user of users) {
      try {
        // Call the digest endpoint internally via fetch on localhost
        // This reuses all the existing logic (personalisation, web context, Claude)
        const port = process.env.PORT || "3000";
        const res = await fetch(
          `http://localhost:${port}/api/digest/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          }
        );

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }

        const briefing = await res.json();
        successes++;
        details.push({
          user_id: user.id,
          name: user.name,
          status: "ok",
          story_count: briefing.stories?.length ?? 0,
        });

        console.log(`[pipeline:digest] ${user.name} (${user.id}): ${briefing.stories?.length ?? 0} stories`);
      } catch (err) {
        failures++;
        const message = err instanceof Error ? err.message : String(err);
        details.push({ user_id: user.id, name: user.name, status: "failed", error: message });
        console.error(`[pipeline:digest] ${user.name} (${user.id}) failed:`, message);
      }
    }

    // Fail only if ALL users failed
    if (successes === 0 && failures > 0) {
      throw new Error(`Digest generation failed for all ${failures} users`);
    }

    return { users_found: users.length, successes, failures, details };
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -E 'pipeline|steps' | head -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/steps.ts
git commit -m "feat(pipeline): add four sequential step functions"
```

---

### Task 5: Pipeline Orchestrator

**Files:**
- Create: `src/lib/pipeline/orchestrator.ts`

- [ ] **Step 1: Create orchestrator.ts**

```typescript
// src/lib/pipeline/orchestrator.ts

import pool from "@/lib/db";
import { step1Ingest, step2FullText, step3Enrich, step4Digest } from "./steps";
import type { StepResult, PipelineRunResult, PipelineTrigger, StepName } from "./types";

const STEP_FUNCTIONS: Record<StepName, () => Promise<StepResult>> = {
  ingest: step1Ingest,
  fulltext: step2FullText,
  enrichment: step3Enrich,
  digest: step4Digest,
};

const STEP_ORDER: StepName[] = ["ingest", "fulltext", "enrichment", "digest"];

export async function runPipeline(opts?: {
  trigger?: PipelineTrigger;
  singleStep?: StepName;
  dry?: boolean;
}): Promise<PipelineRunResult> {
  const trigger = opts?.trigger ?? "manual";
  const runId = `pipeline-${Date.now()}`;
  const started_at = new Date().toISOString();
  const steps: StepResult[] = [];

  // Determine which steps to run
  const stepsToRun = opts?.singleStep ? [opts.singleStep] : STEP_ORDER;

  // Persist initial record
  await pool.query(
    `INSERT INTO pipeline_runs (id, started_at, status, trigger, steps)
     VALUES ($1, $2, 'running', $3, '[]')`,
    [runId, started_at, trigger]
  ).catch((err) => console.warn("[pipeline] Failed to persist start:", err.message));

  if (opts?.dry) {
    console.log(`[pipeline] DRY RUN — would execute: ${stepsToRun.join(" → ")}`);
    const result: PipelineRunResult = {
      id: runId,
      started_at,
      completed_at: new Date().toISOString(),
      status: "completed",
      trigger,
      steps: stepsToRun.map((name) => ({
        name,
        status: "skipped",
        started_at,
        completed_at: started_at,
        duration_ms: 0,
        result: { dry_run: true },
        error: null,
      })),
      error: null,
    };
    await persistResult(runId, result);
    return result;
  }

  let failedStep: StepResult | null = null;

  for (const stepName of stepsToRun) {
    console.log(`[pipeline:${stepName}] Starting...`);

    const stepFn = STEP_FUNCTIONS[stepName];
    const stepResult = await stepFn();
    steps.push(stepResult);

    if (stepResult.status === "failed") {
      console.error(`[pipeline:${stepName}] FAILED: ${stepResult.error}`);
      failedStep = stepResult;
      break;
    }

    console.log(
      `[pipeline:${stepName}] Completed in ${stepResult.duration_ms}ms`,
      JSON.stringify(stepResult.result)
    );
  }

  const completed_at = new Date().toISOString();
  const status = failedStep
    ? "failed"
    : steps.length < stepsToRun.length
      ? "partial"
      : "completed";

  const result: PipelineRunResult = {
    id: runId,
    started_at,
    completed_at,
    status,
    trigger,
    steps,
    error: failedStep?.error ?? null,
  };

  await persistResult(runId, result);
  return result;
}

async function persistResult(
  runId: string,
  result: PipelineRunResult
): Promise<void> {
  try {
    await pool.query(
      `UPDATE pipeline_runs
       SET completed_at = $1, status = $2, steps = $3, error = $4
       WHERE id = $5`,
      [result.completed_at, result.status, JSON.stringify(result.steps), result.error, runId]
    );
  } catch (err) {
    console.error("[pipeline] Failed to persist result:", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep orchestrator | head -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/orchestrator.ts
git commit -m "feat(pipeline): add sequential orchestrator with persistence"
```

---

### Task 6: Pipeline API Route

**Files:**
- Create: `src/app/api/pipeline/run/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/pipeline/run/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { StepName } from "@/lib/pipeline/types";

// Allow up to 15 minutes for the full pipeline
export const maxDuration = 900;

const VALID_STEPS: StepName[] = ["ingest", "fulltext", "enrichment", "digest"];

export async function POST(req: NextRequest) {
  // TODO(deploy): Add CRON_SECRET auth check before deploying to production
  // See docs/BACKLOG.md for details

  const singleStep = req.nextUrl.searchParams.get("step") as StepName | null;
  const dry = req.nextUrl.searchParams.get("dry") === "true";

  if (singleStep && !VALID_STEPS.includes(singleStep)) {
    return NextResponse.json(
      { error: `Invalid step: ${singleStep}. Valid: ${VALID_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  console.log(
    `[pipeline] Starting${singleStep ? ` (step=${singleStep})` : ""}${dry ? " (DRY RUN)" : ""}`
  );

  const result = await runPipeline({
    trigger: "cron",
    singleStep: singleStep ?? undefined,
    dry,
  });

  const httpStatus = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep 'pipeline/run' | head -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pipeline/run/route.ts
git commit -m "feat(pipeline): add POST /api/pipeline/run route"
```

---

### Task 7: Vercel Cron Configuration

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json with cron config**

```json
{
  "crons": [
    {
      "path": "/api/pipeline/run",
      "schedule": "0 19 * * *"
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('vercel.json','utf8')))"`

Expected: Parsed object with crons array

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(pipeline): add daily cron at 19:00 UTC (05:00 AEST)"
```

---

### Task 8: Integration Test — Manual Pipeline Run

**Files:** None (manual verification)

- [ ] **Step 1: Test dry run mode**

Run: `curl -s 'http://localhost:3030/api/pipeline/run?dry=true' -X POST | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify({id:d.id,status:d.status,steps:d.steps.map(s=>s.name+':'+s.status)},null,2))"`

Expected: All 4 steps with status "skipped", overall status "completed"

- [ ] **Step 2: Test single step — ingest only**

Run: `curl -s 'http://localhost:3030/api/pipeline/run?step=ingest' -X POST | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify({id:d.id,status:d.status,step:d.steps[0]?.name,articles:d.steps[0]?.result?.new_articles,duration:d.steps[0]?.duration_ms},null,2))"`

Expected: One step "ingest" with status "completed" and new_articles count

- [ ] **Step 3: Test single step — fulltext only**

Run: `curl -s 'http://localhost:3030/api/pipeline/run?step=fulltext' -X POST | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify({id:d.id,status:d.status,step:d.steps[0]?.name,result:d.steps[0]?.result},null,2))"`

Expected: One step "fulltext" with status "completed"

- [ ] **Step 4: Test invalid step parameter**

Run: `curl -s 'http://localhost:3030/api/pipeline/run?step=invalid' -X POST -w '\n%{http_code}'`

Expected: 400 status with error message

- [ ] **Step 5: Verify pipeline_runs table has records**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query('SELECT id, status, trigger, steps::text FROM pipeline_runs ORDER BY started_at DESC LIMIT 3').then(r=>{console.log(JSON.stringify(r.rows,null,2));p.end()}).catch(e=>{console.error(e.message);p.end()})"`

Expected: 2-3 records from the tests above

- [ ] **Step 6: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "feat(pipeline): verify integration, all steps operational"
```

---

### Task 9: Full Pipeline End-to-End Test

**Files:** None (manual verification)

This is the full pipeline run. It will take several minutes due to enrichment time budget.

- [ ] **Step 1: Run the full pipeline**

Run: `curl -s 'http://localhost:3030/api/pipeline/run' -X POST --max-time 900 | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify({id:d.id,status:d.status,error:d.error,steps:d.steps.map(s=>({name:s.name,status:s.status,duration_ms:s.duration_ms,error:s.error,...(s.name==='ingest'?{new_articles:s.result.new_articles}:s.name==='fulltext'?{successes:s.result.successes,remaining:s.result.remaining}:s.name==='enrichment'?{processed:s.result.total_processed,remaining:s.result.remaining}:s.name==='digest'?{successes:s.result.successes,failures:s.result.failures}:{})}))},null,2))"`

Expected: Status "completed" with all 4 steps showing "completed". Ingest shows new_articles, enrichment shows total_processed, digest shows successes for each user.

- [ ] **Step 2: Verify pipeline run persisted**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(\"SELECT id, status, started_at, completed_at, error FROM pipeline_runs WHERE status != 'running' ORDER BY started_at DESC LIMIT 1\").then(r=>{const row=r.rows[0]; console.log('Status:', row.status); console.log('Duration:', Math.round((new Date(row.completed_at)-new Date(row.started_at))/1000)+'s'); console.log('Error:', row.error); p.end()}).catch(e=>{console.error(e.message);p.end()})"`

Expected: Status "completed", duration in seconds, no error
