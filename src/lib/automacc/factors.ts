// AutoMACC v4 — emission source factor table.
// Mirrors docs/automacc/source-factors.md. Single source of truth for
// arithmetic in Screen 1 and the /api/automacc/normalise route.
//
// Citations: NGER Determination (AU), AEMO grid intensity, IEA upstream
// defaults, IPCC AR6 for agriculture and nature. See the .md for full notes.

import type { SourceFactor } from "./v4-types";

export const SOURCE_FACTORS: SourceFactor[] = [];

export const SOURCE_FACTOR_BY_ID: Record<string, SourceFactor> = Object.fromEntries(
  SOURCE_FACTORS.map((f) => [f.id, f]),
);

export function factorsForBucket(bucket: string): SourceFactor[] {
  return SOURCE_FACTORS.filter((f) => f.bucket === bucket);
}
