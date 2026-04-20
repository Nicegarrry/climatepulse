import type { RetrievedContent } from "@/lib/intelligence/retriever";
import type { Intent, PathGenerationResult, Warning } from "./types";

const THIN_THRESHOLD = 5;
const MAX_MICROSECTORS = 10;

export function handleThinSubstrate(
  _intent: Intent,
  candidates: RetrievedContent[],
  threshold = THIN_THRESHOLD,
): PathGenerationResult | null {
  return candidates.length >= threshold ? null : { refused: "thin_substrate" };
}

export function handleOverBroad(intent: Intent): PathGenerationResult | null {
  return intent.in_scope_microsectors.length <= MAX_MICROSECTORS
    ? null
    : { refused: "over_broad" };
}

export function handleOverNarrow(
  intent: Intent,
  candidates: RetrievedContent[],
): PathGenerationResult | null {
  if (intent.in_scope_microsectors.length > 2) return null;
  const allCards =
    candidates.length > 0 &&
    candidates.every((c) => c.content_type === "concept_card");
  return allCards ? { refused: "over_narrow" } : null;
}

export function buildSubstrateWarnings(
  candidates: RetrievedContent[],
  threshold = THIN_THRESHOLD,
): Warning[] {
  const w: Warning[] = [];
  if (candidates.length < threshold * 2 && candidates.length >= threshold) {
    w.push({
      code: "low_substrate",
      message: `Only ${candidates.length} candidates found. Path may be limited in breadth.`,
    });
  }
  return w;
}
