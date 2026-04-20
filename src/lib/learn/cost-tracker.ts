import pool from "@/lib/db";

export type LearnModule =
  | "learn-concept"
  | "learn-brief"
  | "learn-path"
  | "learn-regime";

// Gemini Flash pricing as of 2026-Q1 — matches existing stage2-enricher formula.
const GEMINI_INPUT_USD_PER_M = 0.15;
const GEMINI_OUTPUT_USD_PER_M = 0.6;

// Claude Sonnet 4 pricing (approx) — used when the editorial-critical path picks Sonnet.
const CLAUDE_SONNET_INPUT_USD_PER_M = 3.0;
const CLAUDE_SONNET_OUTPUT_USD_PER_M = 15.0;

type ModelTier = "gemini-flash" | "claude-sonnet";

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  model: ModelTier = "gemini-flash",
): number {
  const rates =
    model === "claude-sonnet"
      ? { in: CLAUDE_SONNET_INPUT_USD_PER_M, out: CLAUDE_SONNET_OUTPUT_USD_PER_M }
      : { in: GEMINI_INPUT_USD_PER_M, out: GEMINI_OUTPUT_USD_PER_M };
  return (inputTokens * rates.in + outputTokens * rates.out) / 1_000_000;
}

export interface CostLogEntry {
  module: LearnModule;
  stage: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  itemsProcessed?: number;
  errors?: number;
  model?: ModelTier;
  pipelineVersion?: number;
}

/**
 * Log a Learn generation run to enrichment_runs (extended with module column
 * in 001-learn-prelude.sql). Swallows errors — logging must never block the
 * caller's success path.
 */
export async function logGeneration(entry: CostLogEntry): Promise<void> {
  const cost = estimateCostUsd(
    entry.inputTokens,
    entry.outputTokens,
    entry.model ?? "gemini-flash",
  );
  try {
    await pool.query(
      `INSERT INTO enrichment_runs
         (batch_size, articles_processed, errors, duration_ms,
          input_tokens, output_tokens, estimated_cost_usd,
          stage, pipeline_version, module)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.itemsProcessed ?? 1,
        entry.itemsProcessed ?? 1,
        entry.errors ?? 0,
        entry.durationMs,
        entry.inputTokens,
        entry.outputTokens,
        cost,
        entry.stage,
        entry.pipelineVersion ?? 1,
        entry.module,
      ],
    );
  } catch (err) {
    console.error("[learn/cost-tracker] log insert failed:", err);
  }
}
