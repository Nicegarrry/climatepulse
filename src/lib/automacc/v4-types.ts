// AutoMACC v4 — single source of truth for runtime types.
// Mirrors the shape that flows through localStorage and the macc_sessions table.

export type SourceBucket =
  | "stationary_electricity"
  | "stationary_fuel"
  | "mobility"
  | "industrial_process"
  | "ag_nature"
  | "other";

export const SOURCE_BUCKETS: { id: SourceBucket; label: string; blurb: string }[] = [
  {
    id: "stationary_electricity",
    label: "Stationary electricity",
    blurb: "Grid + on-site electricity for buildings, process, IT.",
  },
  {
    id: "stationary_fuel",
    label: "Stationary fuel use",
    blurb: "Coal, gas, diesel burned on-site for heat or process.",
  },
  {
    id: "mobility",
    label: "Mobility",
    blurb: "Fleet, trucks, flights, rail, marine.",
  },
  {
    id: "industrial_process",
    label: "Industrial processes",
    blurb: "Cement clinker, coking coal, fugitives, chemicals.",
  },
  {
    id: "ag_nature",
    label: "Agriculture & nature",
    blurb: "Livestock methane, fertiliser, land use.",
  },
  {
    id: "other",
    label: "Other",
    blurb: "Waste, refrigerants, miscellaneous.",
  },
];

export type LeverApproach =
  | "stop"
  | "efficiency"
  | "electrify"
  | "fuel_switch"
  | "ccs"
  | "negative";

export const LEVER_APPROACHES: { id: LeverApproach; label: string; blurb: string }[] = [
  { id: "stop", label: "Stop doing", blurb: "Eliminate the activity entirely." },
  { id: "efficiency", label: "Do more efficiently", blurb: "Same output, less energy / less waste." },
  { id: "electrify", label: "Electrify", blurb: "Swap fuel-burning equipment for electric." },
  { id: "fuel_switch", label: "Fuel switch", blurb: "Lower-carbon fuel (gas → bio, diesel → HVO, etc.)." },
  { id: "ccs", label: "Carbon capture", blurb: "Capture and store/use CO2 at source." },
  { id: "negative", label: "Negative emissions", blurb: "Sequester (afforestation, soil C, BECCS, DAC)." },
];

export type EmployeeRange = "1-50" | "51-200" | "201-1000" | "1001-10000" | "10000+";
export type RevenueRange = "<10M" | "10-100M" | "100M-1B" | "1B-10B" | ">10B";

export interface CompanyMeta {
  industry: string;          // one of dropdown values
  description: string;       // free text
  employees: EmployeeRange | "";
  revenue: RevenueRange | "";
  buildings: number;         // count
}

// A single emission source row entered by the student.
// numericalValue is what they typed (may be empty — Gemini Call 1 will fill).
// tco2y is computed deterministically from numericalValue × factor after Call 1.
export interface SourceEntry {
  id: string;                // local uuid
  bucket: SourceBucket;
  sourceId: string;          // matches factors.ts id
  numericalValue: number | null;
  numericalUnit: string;     // echoed from factor table for display
  freeText: string;          // student commentary
  tco2y: number | null;      // computed after normalise
  factorUsed: number | null; // for transparency in UI
  rationale: string | null;  // from Gemini Call 1
  confidence: "high" | "medium" | "low" | null;
}

// Student's lever choice for a given source.
export interface LeverChoice {
  sourceId: string;                 // SourceEntry.id (NOT factor source_id)
  approach: LeverApproach | null;
  description: string;              // "what this looks like for my company"
  capexAud: number | null;          // student's all-in cost guess
  abatementPct: number;             // 0-100 — fraction of this source's tCO2/y removed
  // Filled by Gemini Call 2 / deterministic math:
  refinedCapexAud: number | null;
  lifetimeOpexDeltaAudAnnual: number | null;
  abatementTco2yFinal: number | null;
  npvAud: number | null;
  costPerTco2: number | null;
  libraryLeverId: string | null;    // citation from lever-library.md
  geminiRationale: string | null;
}

export interface MaccSession {
  version: 4;
  updatedAt: string;            // ISO
  meta: CompanyMeta;
  sources: SourceEntry[];
  levers: LeverChoice[];        // 1:1 with sources after Screen 2
  step: 1 | 2 | 3;
  // Screen 3 controls
  aggressivenessPct: number;    // 0-100, default 100 (build all levers)
}

export const EMPTY_SESSION: MaccSession = {
  version: 4,
  updatedAt: new Date(0).toISOString(),
  meta: {
    industry: "",
    description: "",
    employees: "",
    revenue: "",
    buildings: 0,
  },
  sources: [],
  levers: [],
  step: 1,
  aggressivenessPct: 100,
};

// ─── Reference data shapes (consumed by factors.ts / levers.ts) ──────────────

export type FactorCitation = "NGER" | "AEMO" | "IEA" | "IPCC" | "ABS" | "ClimateActive" | "DCCEEW" | "Other";

export interface SourceFactor {
  id: string;                   // stable slug, referenced from SourceEntry.sourceId
  bucket: SourceBucket;
  label: string;                // human-readable display label
  // The single numerical the student is asked for (after normalisation by Gemini Call 1).
  numerical: {
    name: string;               // e.g. "Annual gas use"
    unit: string;               // e.g. "GJ"
    hint: string;               // UI placeholder / example, e.g. "e.g. 8,000 GJ for a 5,000 m² office"
  };
  // tCO2e per unit of `numerical`. Multiplied directly.
  factor: {
    value: number;
    unitOut: "tCO2e";
    source: FactorCitation;
    year: number;               // factor vintage
    notes?: string;             // 1-line caveat or geographic scope
  };
  // Optional: avoided cost factor when this source is reduced.
  // Used by Screen 2 lifetime-savings calc. Currency = AUD.
  costFactorAudPerUnit?: number;
}

export interface LeverRef {
  id: string;
  name: string;
  approach: LeverApproach;
  appliesToSourceIds: string[];        // matches SourceFactor.id
  // Cost reference for sanity-check pill on Screen 2.
  typicalCapex: {
    unit: string;                       // e.g. "AUD/kW installed", "AUD per vehicle"
    low: number;
    mid: number;
    high: number;
  };
  opexDeltaPctOfCapex: number;          // annual opex change as % of capex (negative = savings)
  abatementEfficiencyPct: number;       // share of source emissions removed (0-100)
  lifetimeYears: number;
  evidenceSource: FactorCitation;
  evidenceNote?: string;
}

export const INDUSTRIES = [
  "Consulting & professional services",
  "Manufacturing",
  "Resources (mining, oil & gas)",
  "Banking & finance",
  "Retail & consumer",
  "Property & construction",
  "Transport & logistics",
  "Energy & utilities",
  "Agriculture",
  "Other",
] as const;
