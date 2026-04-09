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
