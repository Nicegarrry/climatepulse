// AutoMACC v4 — lever library.
// Mirrors docs/automacc/lever-library.md. Used by Screen 2 for sanity-check
// pills on the student's capex guess and by /api/automacc/macc to ground
// Gemini Call 2.

import type { LeverRef, LeverApproach } from "./v4-types";

export const LEVER_LIBRARY: LeverRef[] = [];

export const LEVERS_BY_ID: Record<string, LeverRef> = Object.fromEntries(
  LEVER_LIBRARY.map((l) => [l.id, l]),
);

export function leversForApproach(approach: LeverApproach): LeverRef[] {
  return LEVER_LIBRARY.filter((l) => l.approach === approach);
}

export function leversForSource(sourceId: string): LeverRef[] {
  return LEVER_LIBRARY.filter((l) => l.appliesToSourceIds.includes(sourceId));
}

export function leversForApproachAndSource(approach: LeverApproach, sourceId: string): LeverRef[] {
  return LEVER_LIBRARY.filter(
    (l) => l.approach === approach && l.appliesToSourceIds.includes(sourceId),
  );
}
