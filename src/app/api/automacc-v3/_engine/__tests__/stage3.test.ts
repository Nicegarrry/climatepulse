// AutoMACC v3 — Stage 3 unit tests.
// Reproduces the ConsultCo reference numbers from
// .claude/skills/automacc/examples/consultco/04-npv.md within tolerance.
// Tolerance per dispatch brief: ±2% NPV / ±$5 cost-per-t.
//
// Run with:
//   cd /Users/sa/Desktop/climatepulse
//   npx tsx src/app/api/automacc-v3/_engine/__tests__/stage3.test.ts

import { strict as assert } from "node:assert";
import {
  annuityFactor,
  flatNpv,
  discountedCashflowsNpv,
  costPerTco2e,
} from "../finance";
import { computeStage3, classifyZone } from "../stage3";
import type { Stage2Lever } from "../schemas/stage2";

// ── finance.ts ────────────────────────────────────────────────────────────

function near(actual: number, expected: number, tol: number, label: string) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) {
    throw new Error(`${label}: expected ${expected} ± ${tol}, got ${actual}`);
  }
}

// PVIFA(0.08, 10) ≈ 6.7101
near(annuityFactor(0.08, 10), 6.7101, 0.001, "annuityFactor(0.08, 10)");
// Edge: rate=0 → years
assert.equal(annuityFactor(0, 10), 10, "annuityFactor(0, 10) edge case");
// flatNpv check: BMS shape
near(flatNpv(25000, 6500, 0.08, 10), 18615.5, 1, "flatNpv BMS");
// discountedCashflowsNpv equivalence to flatNpv for level cashflow
const flat = flatNpv(8000, 2400, 0.08, 10);
const dcf = discountedCashflowsNpv(8000, Array(10).fill(2400), 0.08);
near(flat, dcf, 0.01, "flat == DCF for level stream");
// costPerTco2e
near(costPerTco2e(18615, 160), -116.3, 0.1, "costPerTco2e BMS");
// edge: zero abatement → 999 sentinel
assert.equal(costPerTco2e(-1000, 0), 999, "costPerTco2e zero abatement");

// ── classifyZone ──────────────────────────────────────────────────────────

assert.equal(classifyZone(-115), "do_now");
assert.equal(classifyZone(0), "at_carbon_price");
assert.equal(classifyZone(82.68), "at_carbon_price");
assert.equal(classifyZone(82.69), "strategic");
assert.equal(classifyZone(210), "strategic");

// ── ConsultCo full pipeline ───────────────────────────────────────────────
// Inputs sourced from .claude/skills/automacc/examples/consultco/04-npv.md.
// (addressable_t, capex_aud, annual_savings_aud, useful_life_years per lever)

const consultcoLevers: Stage2Lever[] = [
  {
    lever_id: "bms-optimisation",
    lever_name: "Building management system (BMS) optimisation",
    addresses_rows: ["row-1", "row-3"],
    applicability_score: 1.0,
    mutually_exclusive_with: [],
    mutually_exclusive_flag: false,
    match_rationale: "",
    addressable_t: 16.0,
    capex_aud: 25000,
    annual_savings_aud: 6500,
    useful_life_years: 10,
  },
  {
    lever_id: "led-lighting-retrofit",
    lever_name: "LED lighting retrofit",
    addresses_rows: ["row-1"],
    applicability_score: 1.0,
    mutually_exclusive_with: [],
    mutually_exclusive_flag: false,
    match_rationale: "",
    addressable_t: 10.2,
    capex_aud: 8000,
    annual_savings_aud: 2400,
    useful_life_years: 10,
  },
  {
    lever_id: "solar-pv-rooftop",
    lever_name: "Rooftop solar PV (behind the meter)",
    addresses_rows: ["row-1"],
    applicability_score: 1.0,
    mutually_exclusive_with: [],
    mutually_exclusive_flag: false,
    match_rationale: "",
    addressable_t: 16.0,
    capex_aud: 60000,
    annual_savings_aud: 10000,
    useful_life_years: 10,
  },
  {
    lever_id: "solar-pv-ppa",
    lever_name: "Corporate renewable PPA (off-site solar/wind)",
    addresses_rows: ["row-1", "row-3"],
    applicability_score: 1.0,
    mutually_exclusive_with: [],
    mutually_exclusive_flag: false,
    match_rationale: "",
    addressable_t: 24.0,
    capex_aud: 0,
    annual_savings_aud: 1200,
    useful_life_years: 10,
  },
  {
    lever_id: "heat-pump-electrify",
    lever_name: "Heat pump electrification (replace gas heating)",
    addresses_rows: ["row-2"],
    applicability_score: 1.0,
    mutually_exclusive_with: ["electrify-process-heat-low"],
    mutually_exclusive_flag: false,
    match_rationale: "",
    addressable_t: 25.6,
    capex_aud: 80000,
    annual_savings_aud: 4000,
    useful_life_years: 10,
  },
];

const ranked = computeStage3(consultcoLevers, { hurdle_rate: 0.08, horizon_years: 10 });

// Reference values from 04-npv.md / 05-macc-data.json
const reference = {
  "bms-optimisation":      { cost: -115, npv: 18600, horizon: 160, rank: 1, zone: "do_now" },
  "led-lighting-retrofit": { cost:  -80, npv:  8100, horizon: 102, rank: 2, zone: "do_now" },
  "solar-pv-rooftop":      { cost:  -45, npv:  7100, horizon: 160, rank: 3, zone: "do_now" },
  "solar-pv-ppa":          { cost:  -35, npv:  8000, horizon: 240, rank: 4, zone: "do_now" },
  "heat-pump-electrify":   { cost:  210, npv: -53200, horizon: 256, rank: 5, zone: "strategic" },
} as const;

// Tolerances per dispatch brief: ±2% NPV / ±$5 cost-per-t
const NPV_PCT_TOL = 0.02;
const COST_TOL = 5;

console.log("ConsultCo Stage 3 results:");
for (const point of ranked) {
  const ref = reference[point.lever_id as keyof typeof reference];
  if (!ref) throw new Error(`Unexpected lever ${point.lever_id}`);

  const npvAbsTol = Math.max(Math.abs(ref.npv) * NPV_PCT_TOL, 200);
  const costDelta = Math.abs(point.cost_per_tco2e - ref.cost);
  const npvDelta = Math.abs(point.npv_aud - ref.npv);

  console.log(
    `  rank=${point.rank} ${point.lever_id.padEnd(24)}` +
    ` cost=${point.cost_per_tco2e}(ref ${ref.cost}, Δ${costDelta})` +
    ` npv=${point.npv_aud}(ref ${ref.npv}, Δ${npvDelta})` +
    ` zone=${point.zone}` +
    ` sens.base=${point.sensitivity.base}` +
    ` sens.energy_high=${point.sensitivity.energy_high}` +
    ` sens.capex_high=${point.sensitivity.capex_high}` +
    ` zone_stable=${point.sensitivity.zone_stable}`,
  );

  assert.equal(point.rank, ref.rank, `${point.lever_id} rank`);
  assert.equal(point.zone, ref.zone, `${point.lever_id} zone`);

  if (costDelta > COST_TOL) {
    throw new Error(`${point.lever_id} cost_per_tco2e ${point.cost_per_tco2e} vs ref ${ref.cost} (Δ ${costDelta} > ${COST_TOL})`);
  }
  if (npvDelta > npvAbsTol) {
    throw new Error(`${point.lever_id} npv_aud ${point.npv_aud} vs ref ${ref.npv} (Δ ${npvDelta} > ${npvAbsTol})`);
  }
}

// Cumulative monotone-increasing check
let prevCumul = 0;
for (const point of ranked) {
  if (point.cumulative_tco2e_abated < prevCumul) {
    throw new Error(`cumulative non-monotone at rank ${point.rank}`);
  }
  prevCumul = point.cumulative_tco2e_abated;
}

// ── Sensitivity-band invariants ───────────────────────────────────────────
//
// For every lever:
//   - sensitivity.base == cost_per_tco2e (echoes the base case)
//   - energy_high <= base (better economics from richer savings)
//   - capex_high  >= base (worse economics from higher capex)
//   - zone_stable equals (zone(base) == zone(energy_high) == zone(capex_high))
//   - exception: zero-capex levers (PPA) — capex_high == base since capex × 1.3 = 0

for (const p of ranked) {
  assert.equal(p.sensitivity.base, p.cost_per_tco2e, `${p.lever_id} base==cost_per_tco2e`);
  if (!(p.sensitivity.energy_high <= p.sensitivity.base + 1e-6)) {
    throw new Error(`${p.lever_id}: energy_high ${p.sensitivity.energy_high} should be <= base ${p.sensitivity.base}`);
  }
  if (p.capex_aud > 0) {
    if (!(p.sensitivity.capex_high >= p.sensitivity.base - 1e-6)) {
      throw new Error(`${p.lever_id}: capex_high ${p.sensitivity.capex_high} should be >= base ${p.sensitivity.base}`);
    }
  } else {
    assert.equal(
      p.sensitivity.capex_high,
      p.sensitivity.base,
      `${p.lever_id} zero-capex => capex_high == base`,
    );
  }
}

// Cashflow-override path: pass explicit per-year cashflows for one lever and
// confirm result matches the flat path within rounding.
const overrideRanked = computeStage3(
  consultcoLevers.slice(0, 1),
  { hurdle_rate: 0.08, horizon_years: 10 },
  [{ lever_id: "bms-optimisation", cashflows: Array(10).fill(6500) }],
);
near(overrideRanked[0].npv_aud, 18600, 100, "BMS via cashflows[] path");

// Capex-category check (thresholds: $0 = zero_capex; <$100k = low; ≥$100k = significant)
const bms = ranked.find((p) => p.lever_id === "bms-optimisation")!;
const heatPump = ranked.find((p) => p.lever_id === "heat-pump-electrify")!;
const ppa = ranked.find((p) => p.lever_id === "solar-pv-ppa")!;
assert.equal(bms.capex_category, "low_capex", "BMS capex_category ($25k)");
// heat-pump capex $80k sits below the $100k threshold => low_capex.
// A larger heat-pump (≥$100k) would be significant_capex; covered by synthetic test below.
assert.equal(heatPump.capex_category, "low_capex", "heat-pump capex_category ($80k)");
assert.equal(ppa.capex_category, "zero_capex", "PPA capex_category ($0)");

// Synthetic significant_capex case at the threshold boundary
const bigLever: Stage2Lever = {
  ...consultcoLevers[4], // copy heat-pump shape
  lever_id: "big-capex-synthetic",
  capex_aud: 150_000,
};
const bigRanked = computeStage3([bigLever], { hurdle_rate: 0.08, horizon_years: 10 });
assert.equal(
  bigRanked[0].capex_category,
  "significant_capex",
  "synthetic $150k lever => significant_capex",
);

console.log("\nAll Stage 3 unit tests passed.");
