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

// ─── Rio Tinto ───────────────────────────────────────────────────────────────
// Anchored on the 2024 Annual Report / 2025 Climate Action Plan extract:
//   Scope 1+2 (adjusted equity, 2024)     = 30.7 Mt CO2e
//   Split (2024 bar chart):
//     Electricity                         = ~38% → 11.7 Mt
//     Processing (anodes, reductants,
//       process heat at smelters + alumina) ≈ 47% → 14.4 Mt
//     Diesel (mining trucks + rail)       = 14%  → 4.3 Mt
//     Other                               = 1%   → 0.3 Mt
//   Operational sources called out on p47:
//     electricity 37% · carbon anodes/reductants 25% · fossil heat 23%
//     · mining diesel 13% · other 1-2%
//
// We map this into the AutoMACC factor table as four headline sources so the
// student sees a realistic resources-sector MACC dominated by smelter power +
// alumina heat + haul truck diesel.

function rsid(slug: string): string {
  return `case_riotinto_${slug}`;
}

const RIOTINTO_SOURCES: SourceEntry[] = [
  {
    id: rsid("elec_process"),
    bucket: "stationary_electricity",
    sourceId: "elec_process",
    numericalValue: 16_500_000, // MWh/y across smelters + mining
    numericalUnit: "MWh",
    freeText:
      "Aluminium smelters at Boyne Island, Tomago + Bell Bay, plus mining ops in Pilbara. 78% already from renewables (2024); targeting >90% by 2030.",
    tco2y: 11_715_000, // 16.5M × 0.71 (QLD intensity)
    factorUsed: 0.71,
    rationale: "Case study seed (2024 Annual Report).",
    confidence: "high",
  },
  {
    id: rsid("proc_aluminium_smelt"),
    bucket: "industrial_process",
    sourceId: "proc_aluminium_smelt",
    numericalValue: 3_296_000, // tonnes Al produced (2024 Rio share)
    numericalUnit: "t",
    freeText:
      "Carbon-anode CO2 + PFC emissions from smelting (excludes smelter electricity, counted separately). ELYSIS inert anode tech being commissioned at Alma smelter.",
    tco2y: 5_438_400, // 3.296 Mt × 1.65
    factorUsed: 1.65,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: rsid("fuel_gas_process"),
    bucket: "stationary_fuel",
    sourceId: "fuel_gas_process",
    numericalValue: 130_000_000, // GJ/y for alumina calcination + iron ore + smelter heat
    numericalUnit: "GJ",
    freeText:
      "Natural gas for alumina refineries (Queensland Alumina, Yarwun) + Pilbara gas-fired power. Yarwun running 2.5 MW H2 electrolyser pilot for calcination.",
    tco2y: 7_293_000, // 130M × 0.0561
    factorUsed: 0.0561,
    rationale: "Case study seed.",
    confidence: "high",
  },
  {
    id: rsid("mob_truck_diesel_heavy"),
    bucket: "mobility",
    sourceId: "mob_truck_diesel_heavy",
    numericalValue: 1_475_000, // kL diesel/y (mining haul fleet + rail)
    numericalUnit: "kL",
    freeText:
      "Haul truck fleet across Pilbara iron ore, copper, alumina + rail freight. 8 battery-electric trucks trialled at Oyu Tolgoi; biofuel transition starting (Kennecott).",
    tco2y: 3_997_250, // 1.475M × 2.71
    factorUsed: 2.71,
    rationale: "Case study seed.",
    confidence: "high",
  },
];

const RIOTINTO_LEVERS: LeverChoice[] = [
  {
    sourceId: rsid("elec_process"),
    approach: "electrify",
    description:
      "2.2 GW renewable PPAs for Boyne Island + Tomago aluminium smelters; 600-700 MW of wind+solar in the Pilbara to displace gas-fired power generation. Target >90% renewable electricity by 2030.",
    capexAud: 5_500_000_000, // $5-6B operational decarbonisation capex (CAP)
    abatementPct: 70,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: rsid("fuel_gas_process"),
    approach: "fuel_switch",
    description:
      "Electrify alumina calcination (heat pumps + green H2) at Yarwun and Queensland Alumina; switch Pilbara gas turbines to renewable electricity + storage.",
    capexAud: 1_500_000_000,
    abatementPct: 60,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: rsid("mob_truck_diesel_heavy"),
    approach: "electrify",
    description:
      "Battery-electric haul trucks at scale by ~2030 (currently 8 deployed at Oyu Tolgoi). Bridge with HVO biofuel at Kennecott/Boron.",
    capexAud: 1_200_000_000,
    abatementPct: 30,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: rsid("proc_aluminium_smelt"),
    approach: "efficiency",
    description:
      "Roll out ELYSIS inert anode smelting technology — eliminates direct anode CO2 in aluminium electrolysis. Commercial-scale 450 kA cells commissioning 2025 at Alma.",
    capexAud: 800_000_000,
    abatementPct: 40,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
];

const RIO_TINTO: MaccSession = {
  id: "case_study_riotinto_v1",
  name: "Case study — Rio Tinto",
  version: 4,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
  meta: {
    industry: "Resources (mining, oil & gas)",
    description:
      "Diversified global miner (iron ore, aluminium, copper, lithium). 2024 Scope 1+2 = 30.7 Mt CO2e (adjusted equity), Scope 3 = 574.6 Mt (steel value chain). 78% renewable electricity, $5-6B decarbonisation capex by 2030. Targets: 50% Scope 1+2 cut by 2030 vs 2018, net zero by 2050.",
    employees: "10000+",
    revenue: ">10B",
    buildings: 60,
    state: "QLD", // Boyne Island smelter — biggest single emitter
  },
  sources: RIOTINTO_SOURCES,
  levers: RIOTINTO_LEVERS,
  step: 2,
  aggressivenessPct: 100,
};

// ─── Atlassian ───────────────────────────────────────────────────────────────
// Anchored on Atlassian's published Sustainability Report (2023/24) + CDP.
//   Scope 1                ≈ 370 tCO2e   (small office gas + refrigerants)
//   Scope 2 (location-based) ≈ 16,400 tCO2e (offices @ grid before renewables)
//   Scope 2 (market-based)  ≈ 250 tCO2e   (100% renewable PPAs in major markets)
//   Scope 3 — business travel ≈ 15-20k tCO2e
//
// We use the LOCATION-based view so students see actual abatement potential
// from PPAs (Atlassian has already done this; case study lets students walk
// through the lever themselves). Travel is included as a real lever since
// Atlassian has a distributed-team policy.

function asid(slug: string): string {
  return `case_atlassian_${slug}`;
}

const ATLASSIAN_SOURCES: SourceEntry[] = [
  {
    id: asid("elec_building"),
    bucket: "stationary_electricity",
    sourceId: "elec_building",
    numericalValue: 26_000, // MWh/y across global office portfolio
    numericalUnit: "MWh",
    freeText:
      "13+ offices globally (Sydney HQ, San Francisco, Mountain View, Austin, NYC, Amsterdam, Bangalore, Bengaluru, Tokyo, Manila). Location-based pre-PPA. Atlassian has 100% renewable PPAs in major markets so market-based figure is near zero.",
    tco2y: 17_160, // 26,000 × 0.66 (NSW grid for HQ)
    factorUsed: 0.66,
    rationale: "Case study seed (Atlassian Sustainability Report 2024).",
    confidence: "high",
  },
  {
    id: asid("mob_flight_intl_long"),
    bucket: "mobility",
    sourceId: "mob_flight_intl_long",
    numericalValue: 5_000, // long-haul sectors / year
    numericalUnit: "sector",
    freeText:
      "Long-haul business travel (Sydney ↔ SF, EMEA ↔ AU). Distributed-team policy means quarterly all-hands + regional offsites; ~5,000 long-haul sectors a year across ~12k staff.",
    tco2y: 14_000, // 5000 × 2.8
    factorUsed: 2.8,
    rationale: "Case study seed.",
    confidence: "medium",
  },
  {
    id: asid("mob_flight_domestic_short"),
    bucket: "mobility",
    sourceId: "mob_flight_domestic_short",
    numericalValue: 3_000, // short-haul sectors / year
    numericalUnit: "sector",
    freeText:
      "Intra-AU + US domestic travel — Sydney↔Melbourne, SF↔NYC, etc. Smaller volume per sector but still meaningful.",
    tco2y: 630, // 3000 × 0.21
    factorUsed: 0.21,
    rationale: "Case study seed.",
    confidence: "medium",
  },
  {
    id: asid("fuel_gas_heating"),
    bucket: "stationary_fuel",
    sourceId: "fuel_gas_heating",
    numericalValue: 1_500, // GJ/y office heating (mostly US offices)
    numericalUnit: "GJ",
    freeText:
      "Office gas heating, primarily Mountain View + NYC. Sydney HQ all-electric.",
    tco2y: 84, // 1500 × 0.0561
    factorUsed: 0.0561,
    rationale: "Case study seed.",
    confidence: "medium",
  },
];

const ATLASSIAN_LEVERS: LeverChoice[] = [
  {
    sourceId: asid("elec_building"),
    approach: "electrify",
    description:
      "Already largely done — extend 100% renewable PPAs to remaining markets (India, Manila) and shift to 24/7 carbon-free electricity matching by 2030.",
    capexAud: 200_000,
    abatementPct: 95,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
  {
    sourceId: asid("mob_flight_intl_long"),
    approach: "stop",
    description:
      "Halve long-haul travel via async + video-first culture; cap quarterly meeting travel for >70% of staff. Retain key in-person quarterly leadership offsites.",
    capexAud: 50_000,
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
    sourceId: asid("mob_flight_domestic_short"),
    approach: "stop",
    description:
      "Eliminate non-essential domestic travel within AU/US east coast — default to video calls for <2 hr meetings.",
    capexAud: 20_000,
    abatementPct: 70,
    refinedCapexAud: null,
    lifetimeOpexDeltaAudAnnual: null,
    abatementTco2yFinal: null,
    npvAud: null,
    costPerTco2: null,
    libraryLeverId: null,
    geminiRationale: null,
  },
];

const ATLASSIAN: MaccSession = {
  id: "case_study_atlassian_v1",
  name: "Case study — Atlassian",
  version: 4,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
  meta: {
    industry: "Other",
    description:
      "Australian-founded global software company. ~12,000 staff, 13+ offices, cloud-first. Already net-zero operations via 100% renewable PPAs in major markets (market-based Scope 2 ≈ 0). Case study uses LOCATION-based view so students can see the PPA lever's impact. Net-zero by 2050 target across all scopes.",
    employees: "10000+",
    revenue: "1B-10B",
    buildings: 13,
    state: "NSW", // Sydney HQ
  },
  sources: ATLASSIAN_SOURCES,
  levers: ATLASSIAN_LEVERS,
  step: 2,
  aggressivenessPct: 100,
};

export const CASE_STUDY_SESSIONS: MaccSession[] = [ACME_CONSULTING, RIO_TINTO, ATLASSIAN];
