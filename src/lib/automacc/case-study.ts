// AutoMACC v4 — case-study seed data.
// Loaded into a student's workspace on first ever use so they have a plausible
// pre-built company to inspect and play with before scoping their own. The
// session id is intentionally stable so re-seeding is idempotent: the loader
// only inserts these if a session with the same id does not already exist.
//
// Numbers below are computed directly from the factor values in factors.ts
// (and NSW grid intensity from STATE_GRID_INTENSITY) so the baseline is
// internally consistent with the rest of the engine.

import type { MaccSession, SourceEntry, LeverChoice } from "./v4-types";

// Local id factory — must be deterministic across reloads so the levers can
// reference these source ids stably. (Not using newSourceId() because we want
// the seed to be reproducible, not time-dependent.)
function sid(slug: string): string {
  return `case_consulting_${slug}`;
}

const SEED_TIMESTAMP = "2026-05-14T00:00:00.000Z";

// ─── Source entries ──────────────────────────────────────────────────────────
// Factor lookups (echoed here for transparency; sourced from factors.ts):
//   elec_building.factor.value          = 0.62 (national avg)
//     NSW grid intensity                = 0.66 → use 0.66 since state = NSW
//   fuel_gas_heating.factor.value       = 0.0561
//   mob_flight_domestic_short           = 0.21
//   mob_flight_intl_long                = 2.8   (substituted for "intl_longhaul")
//   mob_car_petrol                      = 0.00234 (substituted for "fleet_light_ice"
//                                          — pool car fleet, petrol ICE)

const CONSULTING_SOURCES: SourceEntry[] = [
  {
    id: sid("elec_building"),
    bucket: "stationary_electricity",
    sourceId: "elec_building",
    numericalValue: 3000,
    numericalUnit: "MWh",
    freeText:
      "4 city offices × ~5,000 m² × ~150 kWh/m²/y. HVAC, lighting, plug load.",
    tco2y: 1980, // 3000 × 0.66 (NSW grid intensity)
    factorUsed: 0.66,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: sid("fuel_gas_heating"),
    bucket: "stationary_fuel",
    sourceId: "fuel_gas_heating",
    numericalValue: 1500,
    numericalUnit: "GJ",
    freeText:
      "Small gas load across the 4 buildings for HVAC reheat and hot water.",
    tco2y: 84.15, // 1500 × 0.0561
    factorUsed: 0.0561,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: sid("mob_flight_domestic_short"),
    bucket: "mobility",
    sourceId: "mob_flight_domestic_short",
    numericalValue: 6000,
    numericalUnit: "sector",
    freeText:
      "MEL–SYD, SYD–BNE, MEL–CBR commuter sectors. Heaviest item by volume.",
    tco2y: 1260, // 6000 × 0.21
    factorUsed: 0.21,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: sid("mob_flight_intl_long"),
    bucket: "mobility",
    sourceId: "mob_flight_intl_long",
    numericalValue: 400,
    numericalUnit: "sector",
    freeText:
      "Partner / senior-manager long-haul to LHR, JFK, FRA for client work.",
    tco2y: 1120, // 400 × 2.8
    factorUsed: 2.8,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: sid("mob_car_petrol"),
    bucket: "mobility",
    sourceId: "mob_car_petrol",
    numericalValue: 40000,
    numericalUnit: "L",
    freeText:
      "Small pool car fleet across the 4 offices for client visits. Petrol ICE.",
    tco2y: 93.6, // 40000 × 0.00234
    factorUsed: 0.00234,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: sid("other_paper"),
    bucket: "other",
    sourceId: "other_paper_consumption",
    numericalValue: 12,
    numericalUnit: "t",
    freeText:
      "Office printing across 4 sites. ~5,000 reams/y × 2.5 kg ≈ 12 t.",
    tco2y: 13.2, // 12 × 1.1
    factorUsed: 1.1,
    rationale: "Case study seed.",
    confidence: "medium",
  },
];

// ─── Lever choices (partial — Gemini Call 2 fills the rest) ──────────────────
// Students see approach + description + their guess at capex/abatement%,
// then run "refine" to populate refinedCapexAud, npvAud, costPerTco2 etc.

const CONSULTING_LEVERS: LeverChoice[] = [
  {
    sourceId: sid("elec_building"),
    approach: "electrify",
    description:
      "Sign a 100% renewable PPA with Origin / Energy Australia for the office portfolio.",
    capexAud: 50000,
    abatementPct: 90,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: sid("mob_flight_domestic_short"),
    approach: "stop",
    description:
      "Mandate video for any meeting <2 hours and any sector <1,500 km that does not include a client face-to-face.",
    capexAud: 30000,
    abatementPct: 50,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: sid("mob_flight_intl_long"),
    approach: "efficiency",
    description:
      "Premium economy → economy where appropriate; SAF credits on remaining flights.",
    capexAud: 0,
    abatementPct: 25,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: sid("mob_car_petrol"),
    approach: "electrify",
    description:
      "Transition pool car fleet to EV at lease renewal over 3 years.",
    capexAud: 600000,
    abatementPct: 80,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
];

// ─── Session ─────────────────────────────────────────────────────────────────

const ACME_CONSULTING: MaccSession = {
  id: "case_study_consulting_v1",
  name: "Case study — Acme Consulting",
  version: 4,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
  meta: {
    industry: "Consulting & professional services",
    description:
      "Australian professional-services firm. ~1,500 staff across 4 city offices. High air-travel intensity. Lease office space; no industrial process.",
    employees: "1001-10000",
    revenue: "100M-1B",
    buildings: 4,
    state: "NSW",
  },
  sources: CONSULTING_SOURCES,
  levers: CONSULTING_LEVERS,
  step: 2,
  aggressivenessPct: 100,
};

export const CASE_STUDY_SESSIONS: MaccSession[] = [ACME_CONSULTING];
