import { logGeneration } from "@/lib/learn/cost-tracker";
import { parseIntentWithUsage } from "./intent-parser";
import { selectCandidates } from "./substrate-selector";
import { walkPrerequisites } from "./prereq-walker";
import { sequence } from "./sequencer";
import { coherencePass } from "./coherence-pass";
import {
  handleThinSubstrate,
  handleOverBroad,
  handleOverNarrow,
  buildSubstrateWarnings,
} from "./handlers";
import type { PathGenerationResult } from "./types";

export interface GeneratePathOptions {
  userId?: string;
  thinThreshold?: number;
  maxCandidates?: number;
}

/**
 * End-to-end path generation. Gated on LEARN_GENERATION_ENABLED.
 * 8 steps: parse intent → over-broad guard → select candidates →
 * thin+over-narrow guards → walk prereqs → sequence → coherence → log.
 */
export async function generatePath(
  freeText: string,
  opts: GeneratePathOptions = {},
): Promise<PathGenerationResult> {
  if (process.env.LEARN_GENERATION_ENABLED !== "true") {
    throw new Error("LEARN_GENERATION_ENABLED is not 'true'");
  }
  const t0 = Date.now();

  const {
    intent: parseResult,
    inputTokens: intentIn,
    outputTokens: intentOut,
  } = await parseIntentWithUsage(freeText);
  if ("clarification_needed" in parseResult) {
    await logGeneration({
      module: "learn-path",
      stage: "intent",
      inputTokens: intentIn,
      outputTokens: intentOut,
      durationMs: Date.now() - t0,
      itemsProcessed: 1,
      errors: 1,
    });
    return { refused: "off_topic" };
  }
  const intent = parseResult;

  const overBroad = handleOverBroad(intent);
  if (overBroad) return overBroad;

  const candidates = await selectCandidates(intent, {
    maxCandidates: opts.maxCandidates ?? 60,
  });

  const thin = handleThinSubstrate(intent, candidates, opts.thinThreshold ?? 5);
  if (thin) return thin;
  const narrow = handleOverNarrow(intent, candidates);
  if (narrow) return narrow;

  const warnings = buildSubstrateWarnings(candidates, opts.thinThreshold ?? 5);

  const cardIds = candidates
    .filter((c) => c.content_type === "concept_card")
    .map((c) => c.source_id);
  const { items: prereqs, foundationsSummary } = await walkPrerequisites(cardIds);

  let plan = sequence(candidates, prereqs, intent);
  if (foundationsSummary && plan.items.length > 0) {
    const first = plan.items.find((i) => i.chapter === "Foundations");
    if (first) first.note = foundationsSummary;
  }

  const {
    plan: coherentPlan,
    revisions,
    warnings: coherenceWarnings,
    inputTokens: coherenceIn,
    outputTokens: coherenceOut,
  } = await coherencePass(plan, intent);
  plan = coherentPlan;

  const allWarnings = [...warnings, ...coherenceWarnings];
  if (revisions.length > 0) {
    allWarnings.push({
      code: "coherence_revised",
      message: `Path revised: ${revisions.map((r) => r.description).join("; ")}`,
    });
  }

  await logGeneration({
    module: "learn-path",
    stage: "generate",
    inputTokens: intentIn + coherenceIn,
    outputTokens: intentOut + coherenceOut,
    durationMs: Date.now() - t0,
    itemsProcessed: 1,
  });

  return { plan, warnings: allWarnings };
}
