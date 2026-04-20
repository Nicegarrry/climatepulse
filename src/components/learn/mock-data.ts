import type { Concept, Microsector, Path, Podcast, SectorPodcast } from "./types";

export const TODAY_CONCEPT: Concept = {
  term: "Marginal Loss Factor",
  abbrev: "MLF",
  eyebrow: "Today's Concept · Energy — Grid",
  summary:
    "A per-generator coefficient the market operator applies to every megawatt-hour you sell — a number that quietly decides whether a project pencils.",
  long:
    "MLFs compress physics into a single coefficient. They measure the electrical distance between a generator's connection point and the regional reference node, and they reset every financial year. A solar farm with an MLF of 0.78 sells 78 megawatt-hours for every 100 it generates, and the AEMO 2025–26 update moved 38 renewable projects by more than 5 points.",
  updated: "Published 04:30 AEST · 17 min read",
};

export const MICROSECTORS: Microsector[] = [
  { num: "01", name: "Energy — Generation", briefs: 42, reviewed: 28, fresh: true },
  { num: "02", name: "Energy — Storage", briefs: 31, reviewed: 19, fresh: true },
  { num: "03", name: "Energy — Grid", briefs: 48, reviewed: 33, fresh: true },
  { num: "04", name: "Carbon & Emissions", briefs: 27, reviewed: 22, fresh: false },
  { num: "05", name: "Transport", briefs: 38, reviewed: 24, fresh: true },
  { num: "06", name: "Industry", briefs: 19, reviewed: 11, fresh: false },
  { num: "07", name: "Agriculture", briefs: 12, reviewed: 7, fresh: false, cold: true },
  { num: "08", name: "Built Environment", briefs: 16, reviewed: 9, fresh: false },
  { num: "09", name: "Critical Minerals", briefs: 24, reviewed: 18, fresh: true },
  { num: "10", name: "Finance", briefs: 44, reviewed: 30, fresh: true },
  { num: "11", name: "Policy", briefs: 36, reviewed: 25, fresh: false },
  { num: "12", name: "Workforce & Adaptation", briefs: 4, reviewed: 1, fresh: false, cold: true, coming: true },
];

export const PATHS: Path[] = [
  {
    id: "isp",
    title: "AEMO ISP 2026 — what changed",
    scope:
      "The step-change scenario is now base-case; transmission delays have reshaped the 2035 build-out.",
    duration: "42 min",
    chapters: 7,
    sector: "ENERGY — GRID",
    inProgress: true,
    progress: 0.43,
    chapterList: [
      { title: "What an ISP actually is", dur: "4 min", done: true },
      { title: "Scenarios: step change vs. progressive", dur: "8 min", done: true },
      { title: "The 2026 revisions at a glance", dur: "6 min", done: true },
      { title: "Transmission: REZ delays explained", dur: "7 min", done: false, current: true },
      { title: "Firming gap and storage build", dur: "6 min", done: false },
      { title: "Coal exit timelines", dur: "5 min", done: false },
      { title: "What to watch in the 2028 update", dur: "6 min", done: false },
    ],
  },
  {
    id: "safeguard",
    title: "Safeguard Mechanism — Q2 trades",
    scope:
      "SMCs are trading thinly below the ceiling; facility-level baselines are being renegotiated in three sectors.",
    duration: "34 min",
    chapters: 6,
    sector: "CARBON & EMISSIONS",
    inProgress: false,
    progress: 0,
  },
  {
    id: "nickel",
    title: "Critical minerals: nickel price floor watch",
    scope:
      "Indonesian supply pressure has pushed the Australian production tax credit into active use. Who draws, and when.",
    duration: "28 min",
    chapters: 5,
    sector: "CRITICAL MINERALS",
    inProgress: true,
    progress: 0.2,
  },
  {
    id: "queue",
    title: "Grid connection queue tracker",
    scope:
      "NEM-wide application pipeline by state, with MLF downgrade risk and the projects that actually matter.",
    duration: "51 min",
    chapters: 8,
    sector: "ENERGY — GRID",
    inProgress: false,
    progress: 0,
  },
  {
    id: "cefc",
    title: "CEFC pipeline this quarter",
    scope:
      "Deal flow, cheque sizes, and where the Clean Energy Finance Corporation is actually deploying capital.",
    duration: "22 min",
    chapters: 4,
    sector: "FINANCE",
    inProgress: false,
    progress: 0,
  },
];

export const PODCASTS: Podcast[] = [
  {
    id: "dd-isp",
    kind: "DEEP DIVE",
    duration: "38 min",
    published: "19 APR",
    title: "Inside AEMO's 2026 ISP — the transmission bottleneck nobody wants to price",
    host: "Eliza Brennan",
    guest: "with Dr. Finn Okafor, former AEMO chief planner",
    sector: "ENERGY — GRID",
    color: "forest",
    waveform: [4,7,12,18,14,22,28,19,16,24,31,27,22,18,26,33,29,24,19,14,21,27,32,28,24,19,15,22,28,33,29,25,21,17,13,18,24,29,25,20,16,22,27,21,15,11,8,5],
    progress: 0.12,
  },
  {
    id: "dd-safeguard",
    kind: "DEEP DIVE",
    duration: "44 min",
    published: "17 APR",
    title: "Safeguard Mechanism, two years in — is it actually bending the curve?",
    host: "Eliza Brennan",
    guest: "with Amrita Chen (Climateworks) & Liam Hart (CEC)",
    sector: "CARBON & EMISSIONS",
    color: "plum",
    waveform: [6,9,14,11,17,23,19,14,22,28,24,18,14,20,26,22,17,13,19,25,30,26,22,17,13,8,14,20,26,31,27,22,17,13,19,24,28,23,18,13,9,6,11,17,22,18,13,9],
    progress: 0,
  },
  {
    id: "dd-nickel",
    kind: "DEEP DIVE",
    duration: "29 min",
    published: "15 APR",
    title: "Nickel price floors and the production tax credit that nobody can model",
    host: "Marcus Vale",
    guest: "with Sarah Wellington, Wood Mackenzie",
    sector: "CRITICAL MINERALS",
    color: "ochre",
    waveform: [3,6,10,15,12,17,23,28,24,19,14,21,27,33,29,24,19,15,22,28,33,28,22,17,12,18,24,29,25,20,15,21,27,32,26,21,16,12,18,24,28,23,18,13,9,14,10,6],
    progress: 1,
  },
  {
    id: "wk-weekly",
    kind: "WEEKLY",
    duration: "18 min",
    published: "SUN",
    title: "Week in review — ISP delays, CEFC pipeline, and the REZ access rules",
    host: "Eliza Brennan",
    sector: "WEEKLY BRIEFING",
    color: "sky",
    waveform: [5,8,11,14,18,22,19,15,12,16,20,24,21,17,13,17,21,25,22,18,14,18,22,26,23,19,15,19,23,27,24,20,16,20,24,28,25,21,17,21,25,29,26,22,18,14,10,7],
    progress: 0.48,
  },
];

export const MICROSECTOR_SAMPLE_PODS: SectorPodcast[] = [
  { title: "FY26 MLF update — who moved, who didn't", dur: "8 min", date: "19 APR", kind: "DAILY" },
  { title: "HumeLink contract awarded — what it signals", dur: "6 min", date: "18 APR", kind: "DAILY" },
  { title: "Weekly grid roundup", dur: "14 min", date: "14 APR", kind: "WEEKLY" },
];

export const MICROSECTOR_TILE_ACCENTS = [
  "forest","forest","forest","plum","sky","clay","ochre","clay","ochre","sky","plum","ochre",
] as const;

export const SUBSTRATE_TOTAL = 341;
export const SUBSTRATE_REVIEWED = 217;

export const LEARN_HEADER = {
  eyebrow: "LEARN · SUN 19 APR 26 · 04:30 AEST",
  title: "Learn",
  sub: "The curated substrate behind today's briefing. Concepts, micro-sector reads, and editorial paths — designed to take you from “what's happening?” to “what do I need to understand?”.",
};

export const LEARN_PROVENANCE = {
  note: "Concepts and paths are curated by the ClimatePulse editorial desk. AI-drafted material is marked; verify against primary sources.",
  stamp: "LAST UPDATE · 04:30 AEST · 19·APR·26",
};
