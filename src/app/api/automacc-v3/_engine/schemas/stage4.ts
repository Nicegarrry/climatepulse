// AutoMACC v3 — Stage 4 (narrative + top-3) LLM output schema, v2 (H2.Q7).
// Ported from _outputs/teaching/2026-05-15-bootcamp-portal v1.1 portal.
//
// v2 additions over v1:
//   - MaccPointV2: adds `sensitivity: SensitivityBand`, `capex_category`,
//     `low_confidence_penalty` (all produced by stage3.ts before Stage 4 sees data)
//   - Top3EntryV2: structured rationale (headline/abatement/cost/watch_out)
//     instead of a flat string; adds `zone_stable` + `capex_category`
//   - Stage4OutputV2: uses V2 schemas for both; sort order refine preserved
//
// v1 schemas (MaccPointSchema, Top3EntrySchema, Stage4OutputSchema) are kept
// for backward compatibility with any pre-v3 portal route code. New v3 code
// uses the V2 variants.
//
// REJECT-ON-ABSENT policy: the validate-retry harness (Stage 4 caller) will
// reject and retry on any absent required field. Optional fields (.optional())
// do not trigger retry by themselves.

import { z } from "zod";

// ─── Sensitivity band ─────────────────────────────────────────────────────────
//
// Three NPV scenarios produced by stage3.ts (deterministic — no LLM call).
// Stage 4 echoes this block verbatim; it does NOT recalculate it.

export const SensitivityBandSchema = z.object({
  base: z.number(),          // $/tCO2e — base case (= cost_per_tco2e)
  energy_high: z.number(),   // $/tCO2e — energy savings +20%
  capex_high: z.number(),    // $/tCO2e — capex +30%
  zone_stable: z.boolean(),  // true if zone identical across all 3 scenarios
});

export type SensitivityBand = z.infer<typeof SensitivityBandSchema>;

// ─── Capex category ───────────────────────────────────────────────────────────
//
// CFO-facing budget classification:
//   zero_capex:        no capital outlay (PPA, telematics SaaS)
//   low_capex:         < $100k AUD (LED, BMS, small solar)
//   significant_capex: ≥ $100k AUD (fleet-ev, heat-pump, large solar)

export const CapexCategorySchema = z.enum([
  "zero_capex",
  "low_capex",
  "significant_capex",
]);

export type CapexCategory = z.infer<typeof CapexCategorySchema>;

// ─── v1 MACC point (kept for backward compat) ────────────────────────────────

export const MaccPointSchema = z.object({
  rank: z.number().int().positive(),
  lever_id: z.string(),
  lever_name: z.string(),
  cost_per_tco2e: z.number(),
  tco2e_abated_annual: z.number().nonnegative(),
  tco2e_abated_horizon: z.number().nonnegative(),
  cumulative_tco2e_abated: z.number().nonnegative(),
  capex_aud: z.number().nonnegative(),
  opex_delta_aud_annual: z.number(),
  npv_aud: z.number(),
  zone: z.enum(["do_now", "at_carbon_price", "strategic"]),
});

export type MaccPoint = z.infer<typeof MaccPointSchema>;

// ─── v2 MACC point ────────────────────────────────────────────────────────────

export const MaccPointV2Schema = MaccPointSchema.extend({
  sensitivity: SensitivityBandSchema,
  capex_category: CapexCategorySchema,
  low_confidence_penalty: z.boolean().optional(),
});

export type MaccPointV2 = z.infer<typeof MaccPointV2Schema>;

// ─── v1 Top3 entry (kept for backward compat) ────────────────────────────────

export const Top3EntrySchema = z.object({
  lever_id: z.string(),
  lever_name: z.string(),
  zone: z.enum(["do_now", "at_carbon_price", "strategic"]),
  rationale: z.string().min(10),
});

export type Top3Entry = z.infer<typeof Top3EntrySchema>;

// ─── v2 Top3 entry ────────────────────────────────────────────────────────────

export const Top3RationaleSchema = z.object({
  headline: z.string().min(5),    // lever name + one-sentence why
  abatement: z.string().min(5),   // tCO2e mid + sensitivity band
  cost: z.string().min(5),        // $/tCO2e mid + band + zone stability label
  watch_out: z.string().min(5),   // one-line prerequisite or key risk
});

export const Top3EntryV2Schema = z.object({
  lever_id: z.string(),
  lever_name: z.string(),
  zone: z.enum(["do_now", "at_carbon_price", "strategic"]),
  zone_stable: z.boolean(),
  capex_category: CapexCategorySchema,
  rationale: Top3RationaleSchema,
});

export type Top3RationaleV2 = z.infer<typeof Top3RationaleSchema>;
export type Top3EntryV2 = z.infer<typeof Top3EntryV2Schema>;

// ─── v1 Stage4 output (kept for backward compat) ─────────────────────────────

export const Stage4OutputSchema = z
  .object({
    macc_data: z.array(MaccPointSchema).min(1),
    top_3: z.array(Top3EntrySchema).min(1).max(3),
    narrative_md: z.string().min(20),
    methodology_ref: z
      .string()
      .default("NGER 2025; IRENA 2024 LCOE; McKinsey V2.1 MACC"),
  })
  .refine(
    (out) => {
      for (let i = 1; i < out.macc_data.length; i++) {
        if (
          out.macc_data[i].cost_per_tco2e <
          out.macc_data[i - 1].cost_per_tco2e
        ) {
          return false;
        }
      }
      return true;
    },
    { message: "macc_data must be sorted ascending by cost_per_tco2e" },
  );

export type Stage4Output = z.infer<typeof Stage4OutputSchema>;

// ─── v2 Stage4 output ─────────────────────────────────────────────────────────

export const Stage4OutputV2Schema = z
  .object({
    macc_data: z.array(MaccPointV2Schema).min(1),
    top_3: z.array(Top3EntryV2Schema).min(1).max(3),
    narrative_md: z.string().min(20),
    methodology_ref: z
      .string()
      .default("NGER 2025; IRENA 2024 LCOE; McKinsey V2.1 MACC"),
  })
  .refine(
    (out) => {
      for (let i = 1; i < out.macc_data.length; i++) {
        if (
          out.macc_data[i].cost_per_tco2e <
          out.macc_data[i - 1].cost_per_tco2e
        ) {
          return false;
        }
      }
      return true;
    },
    { message: "macc_data must be sorted ascending by cost_per_tco2e" },
  );

export type Stage4OutputV2 = z.infer<typeof Stage4OutputV2Schema>;
