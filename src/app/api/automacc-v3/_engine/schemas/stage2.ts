// AutoMACC v3 — Stage 2 (lever-match) LLM output schema, EXTENDED.
// Ported from _outputs/teaching/2026-05-15-bootcamp-portal v1.1 portal.
// Pinned zod: ^4.3 (CP) — schema syntax compatible with portal's ^4.4.2.
//
// Stage 3 (deterministic NPV calc) needs addressable_t / capex_aud /
// annual_savings_aud per matched lever. Stage 2 prompt is extended at call
// time to ask the LLM to emit those fields; the schema enforces them.
// Validate-retry harness will catch failures.

import { z } from "zod";

export const Stage2LeverSchema = z.object({
  lever_id: z.string(),
  lever_name: z.string(),
  addresses_rows: z.array(z.string()),
  applicability_score: z.number().min(0).max(1),
  mutually_exclusive_with: z.array(z.string()).default([]),
  mutually_exclusive_flag: z.boolean().default(false),
  match_rationale: z.string().default(""),

  // Extended fields needed by stage3.ts.
  addressable_t: z.number().nonnegative(),         // tCO2e/yr addressable
  capex_aud: z.number().nonnegative(),             // upfront capex in AUD
  annual_savings_aud: z.number(),                  // positive = saves money/yr
  useful_life_years: z.number().int().positive().default(10),

  // v2 (H2.Q7) — confidence penalty flag. −0.2 applied to applicability_score
  // when all addressed rows are L-confidence. Stage 3 carries this flag through
  // to MaccPointV2 so Stage 4 narrative can surface caveats.
  low_confidence_penalty: z.boolean().optional(),
});

export const Stage2OutputSchema = z.object({
  matched_levers: z.array(Stage2LeverSchema).min(1),
});

export type Stage2Output = z.infer<typeof Stage2OutputSchema>;
export type Stage2Lever = z.infer<typeof Stage2LeverSchema>;
