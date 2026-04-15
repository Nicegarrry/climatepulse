// Mock data for the Weekly Digest tab
// Powers the UI during development before backend APIs are wired up

import type { WeeklyDigest, WeeklyReport, WeeklyCuratedStory } from "./types";

// ─── Mock Weekly Number ──────────────────────────────────────────────────────

const WEEKLY_NUMBER = {
  value: "10.2",
  unit: "GW",
  label: "Grid-connected battery storage capacity (national)",
  context:
    "Australia crossed 10 GW of grid battery capacity for the first time this week, driven by three QLD projects reaching commercial operation simultaneously.",
  trend: "+1.4 GW since March",
};

// ─── Mock Curated Stories ────────────────────────────────────────────────────

const CURATED_STORIES: WeeklyCuratedStory[] = [
  {
    headline:
      "Western Victoria curtailment exceeds 20% for first time as WRL delays deepen",
    source: "AEMO",
    url: "#",
    editor_take:
      "Four consecutive days above 15% was a concern. Breaching 20% is a capital allocation event \u2014 developers with committed projects in the region are now formally revisiting financial models. The Western Renewables Link delay to late 2028 means this bottleneck has at least two more summers to bite.",
    severity: "alert",
    sector: "GRID & TRANSMISSION",
    key_metric: { value: "20.3", unit: "%" },
  },
  {
    headline:
      "EU CBAM enters definitive phase \u2014 first certificates purchased at \u20AC72/t",
    source: "European Commission",
    url: "#",
    editor_take:
      "The transitional phase is over. Real money is changing hands at the EU border and Australian aluminium and steel exporters now face a direct carbon cost on shipments. At \u20AC72/t, the implicit price exceeds Australia\u2019s Safeguard baseline by a wide margin.",
    severity: "alert",
    sector: "CARBON & EMISSIONS",
    key_metric: { value: "72", unit: "\u20AC/t", delta: "first purchases" },
  },
  {
    headline:
      "Origin confirms Eraring coal closure timeline holds \u2014 700 MW battery on track",
    source: "Origin Energy ASX",
    url: "#",
    editor_take:
      "After years of speculation about extensions, Origin locking in the closure date removes a major uncertainty for NEM capacity planning. The 700 MW battery co-located on the Eraring site is the largest single storage project committed in Australia.",
    severity: "ready",
    sector: "ENERGY \u2014 STORAGE",
    key_metric: { value: "700", unit: "MW" },
  },
  {
    headline:
      "Spodumene slides to A$840/t as African supply floods market",
    source: "Fastmarkets",
    url: "#",
    editor_take:
      "Sub-$900 was bad. Sub-$850 is existential for mid-tier Australian lithium processors. Albemarle\u2019s Kemerton deferral is the canary \u2014 watch for more production pauses in Q3.",
    severity: "watch",
    sector: "CRITICAL MINERALS",
    key_metric: { value: "840", unit: "A$/t", delta: "\u221212% MoM" },
  },
  {
    headline:
      "ARENA awards $45M for four long-duration storage pilots",
    source: "ARENA Media",
    url: "#",
    editor_take:
      "The grant targets technologies beyond lithium-ion: compressed air, iron-air, and gravity storage. None are commercially proven at scale, but ARENA\u2019s bet is that 8+ hour duration is where the grid bottleneck shifts once 4-hour batteries saturate.",
    severity: "ready",
    sector: "ENERGY \u2014 STORAGE",
    key_metric: { value: "45", unit: "M AUD" },
  },
  {
    headline:
      "CER tightens ACCU methodology for landfill gas after satellite audit",
    source: "CER",
    url: "#",
    editor_take:
      "Satellite-verified emissions data is now directly contradicting project-level reporting. The 20\u201340% discrepancy range implies a material chunk of landfill gas ACCUs may be overcredited. If you hold exposure to this category, the repricing risk is real.",
    severity: "watch",
    sector: "CARBON & OFFSETS",
  },
];

// ─── Mock Published Digest ───────────────────────────────────────────────────

export const MOCK_WEEKLY_DIGEST: WeeklyDigest = {
  id: "wdigest-mock-001",
  report_id: null,
  week_start: "2026-04-06",
  week_end: "2026-04-12",
  status: "published",
  headline: "Batteries Cross 10 GW as Curtailment Crisis Deepens",
  editor_narrative: `This was a week of milestones pulling in opposite directions. Australia\u2019s grid battery capacity crossed 10 GW for the first time \u2014 a genuine inflection point for storage and a signal that the economics now work at scale. Three Queensland projects reaching commercial operation simultaneously tells you this isn\u2019t a one-off.

But in western Victoria, the curtailment story got worse. Breaching 20% means developers aren\u2019t just losing revenue at the margin \u2014 they\u2019re revisiting whether committed projects still pencil. The Western Renewables Link delay to late 2028 locks in at least two more summers of this pain.

Internationally, the EU CBAM\u2019s definitive phase changes the calculus for Australian exporters. At \u20AC72/t, the border carbon cost exceeds what most domestic producers currently pay under the Safeguard Mechanism. This isn\u2019t a theoretical risk anymore \u2014 it\u2019s an invoice.

The lithium slide continued, with spodumene hitting A$840/t. At these levels, the viability question isn\u2019t about new projects \u2014 it\u2019s about whether existing processors can keep running. Albemarle\u2019s Kemerton pause is the first domino.`,
  weekly_number: WEEKLY_NUMBER,
  curated_stories: CURATED_STORIES,
  theme_commentary: [
    {
      theme_label: "Storage vs. Transmission",
      commentary:
        "Batteries are solving the duration problem faster than transmission is solving the geography problem. The 10 GW milestone and WRL delays are two sides of the same coin \u2014 but they\u2019re not substitutes. Victoria needs both.",
    },
    {
      theme_label: "Carbon Price Convergence",
      commentary:
        "CBAM and the CER methodology review are compressing the gap between international and domestic carbon pricing. The direction is clear: upward pressure on Australian carbon costs from multiple vectors.",
    },
  ],
  outlook:
    "Watch for: AEMO\u2019s draft ISP update (due Thursday), Fortescue\u2019s Gibson Island pilot progress report, and the CER\u2019s next tranche of ACCU issuance data which will test whether the landfill gas methodology review has chilled new project registrations.",
  published_at: "2026-04-13T07:00:00Z",
  banner_expires_at: "2026-04-15T07:00:00Z",
  linkedin_draft: null,
  created_at: "2026-04-12T10:00:00Z",
};

// ─── Mock Archive ────────────────────────────────────────────────────────────

export const MOCK_WEEKLY_ARCHIVE: WeeklyDigest[] = [
  MOCK_WEEKLY_DIGEST,
  {
    id: "wdigest-mock-002",
    report_id: null,
    week_start: "2026-03-30",
    week_end: "2026-04-05",
    status: "published",
    headline: "Safeguard Baseline Tightens as Gas Exporters Push Back",
    editor_narrative:
      "The Clean Energy Regulator published updated Safeguard Mechanism baselines for FY27, with gas exporters facing the steepest reductions. Industry lobbying is intensifying but the trajectory is set.",
    weekly_number: {
      value: "4.9",
      unit: "%",
      label: "Average Safeguard baseline reduction for LNG facilities",
      context:
        "The largest single-year tightening since the reformed Safeguard took effect.",
      trend: "Up from 3.2% last year",
    },
    curated_stories: CURATED_STORIES.slice(0, 4),
    theme_commentary: null,
    outlook: null,
    published_at: "2026-04-06T07:00:00Z",
    banner_expires_at: "2026-04-08T07:00:00Z",
    linkedin_draft: null,
    created_at: "2026-04-05T10:00:00Z",
  },
  {
    id: "wdigest-mock-003",
    report_id: null,
    week_start: "2026-03-23",
    week_end: "2026-03-29",
    status: "published",
    headline: "Hydrogen Reality Check \u2014 FFI Scales Back Gibson Island",
    editor_narrative:
      "Fortescue\u2019s decision to reduce Gibson Island from 250 MW to a 50 MW pilot crystallises what the data has been saying for months: green hydrogen offtake agreements remain elusive at investment-grade scale.",
    weekly_number: {
      value: "< 10",
      unit: "%",
      label: "Global green hydrogen projects reaching FID",
      context:
        "Of 1,000+ projects announced since 2020, fewer than 10% have reached final investment decision.",
      trend: null,
    },
    curated_stories: CURATED_STORIES.slice(2, 6),
    theme_commentary: null,
    outlook: null,
    published_at: "2026-03-30T07:00:00Z",
    banner_expires_at: "2026-04-01T07:00:00Z",
    linkedin_draft: null,
    created_at: "2026-03-29T10:00:00Z",
  },
];

// ─── Mock Auto-Generated Report ──────────────────────────────────────────────

export const MOCK_WEEKLY_REPORT: WeeklyReport = {
  id: "wreport-mock-001",
  week_start: "2026-04-06",
  week_end: "2026-04-12",
  status: "ready",
  theme_clusters: [
    {
      cluster_id: "c1",
      label: "Grid Storage Milestone & Curtailment Pressure",
      domain: "energy-storage",
      articles: [
        { id: "a1", title: "Australia crosses 10 GW grid battery capacity", source: "RenewEconomy", url: "#", significance: 82 },
        { id: "a2", title: "WRL delay pushes western VIC curtailment past 20%", source: "AEMO", url: "#", significance: 78 },
        { id: "a3", title: "Origin confirms Eraring 700 MW battery timeline", source: "Origin ASX", url: "#", significance: 75 },
      ],
      entity_overlap: ["AEMO", "AusNet Services"],
      sentiment_agg: { positive: 2, negative: 1, neutral: 0, mixed: 0 },
      key_numbers: [
        { value: "10.2", unit: "GW", context: "National grid battery capacity" },
        { value: "20.3", unit: "%", context: "Western VIC solar curtailment peak" },
      ],
    },
    {
      cluster_id: "c2",
      label: "Carbon Pricing Pressure from Multiple Vectors",
      domain: "carbon-emissions",
      articles: [
        { id: "a4", title: "EU CBAM definitive phase begins with \u20AC72/t certificates", source: "European Commission", url: "#", significance: 80 },
        { id: "a5", title: "CER flags ACCU methodology review for landfill gas", source: "CER", url: "#", significance: 68 },
      ],
      entity_overlap: ["Clean Energy Regulator"],
      sentiment_agg: { positive: 0, negative: 1, neutral: 0, mixed: 1 },
      key_numbers: [
        { value: "72", unit: "\u20AC/t", context: "First CBAM certificate price" },
      ],
    },
    {
      cluster_id: "c3",
      label: "Critical Minerals Price Deterioration",
      domain: "critical-minerals",
      articles: [
        { id: "a6", title: "Spodumene drops to A$840/t on African oversupply", source: "Fastmarkets", url: "#", significance: 72 },
        { id: "a7", title: "Albemarle flags Kemerton hydroxide production pause", source: "Albemarle ASX", url: "#", significance: 65 },
      ],
      entity_overlap: ["Albemarle", "IGO Limited"],
      sentiment_agg: { positive: 0, negative: 2, neutral: 0, mixed: 0 },
      key_numbers: [
        { value: "840", unit: "A$/t", context: "Spodumene spot price" },
      ],
    },
    {
      cluster_id: "c4",
      label: "Government Investment in Long-Duration Storage",
      domain: "energy-storage",
      articles: [
        { id: "a8", title: "ARENA awards $45M for four long-duration storage pilots", source: "ARENA", url: "#", significance: 62 },
      ],
      entity_overlap: ["ARENA"],
      sentiment_agg: { positive: 1, negative: 0, neutral: 0, mixed: 0 },
      key_numbers: [
        { value: "45", unit: "M AUD", context: "ARENA long-duration storage grants" },
      ],
    },
  ],
  top_numbers: [
    { value: "10.2", unit: "GW", context: "National grid battery capacity milestone", source_article_id: "a1", delta: "+1.4 GW in April" },
    { value: "72", unit: "\u20AC/t", context: "First EU CBAM certificate transactions", source_article_id: "a4" },
    { value: "840", unit: "A$/t", context: "Spodumene spot price, lowest since 2022", source_article_id: "a6", delta: "\u221212% MoM" },
    { value: "20.3", unit: "%", context: "Western VIC solar curtailment (new record)", source_article_id: "a2", delta: "+2pp WoW" },
    { value: "45", unit: "M AUD", context: "ARENA long-duration storage grants", source_article_id: "a8" },
  ],
  sentiment_summary: {
    overall: "mixed",
    by_domain: {
      "energy-storage": { positive: 3, negative: 1, neutral: 0, mixed: 0 },
      "carbon-emissions": { positive: 0, negative: 1, neutral: 0, mixed: 1 },
      "critical-minerals": { positive: 0, negative: 2, neutral: 0, mixed: 0 },
      "energy-grid": { positive: 0, negative: 1, neutral: 1, mixed: 0 },
    },
  },
  storyline_updates: [
    { storyline_id: 1, title: "Western Victoria Curtailment Crisis", article_count: 3, latest_development: "Curtailment breached 20% for first time" },
    { storyline_id: 2, title: "Australian Lithium Processing Viability", article_count: 2, latest_development: "Albemarle production pause at Kemerton" },
  ],
  transmission_activity: [
    { channel_label: "BESS Cost Curve \u2192 Coal Retirement Timeline", triggered_count: 2, example_article_ids: ["a1", "a3"] },
    { channel_label: "EU Carbon Price \u2192 Australian Export Competitiveness", triggered_count: 1, example_article_ids: ["a4"] },
  ],
  article_ids_included: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"],
  model_used: "gemini-2.5-flash",
  generated_at: "2026-04-11T04:00:00Z",
};
