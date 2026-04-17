// Mock editorial data for the Intelligence tab
// Ported from docs/desktop view.jsx and docs/mobile view.jsx

import type { SeverityLevel } from "./design-tokens";

export interface EditorialStory {
  id: number;
  sector: string;
  severity: SeverityLevel;
  headline: string;
  summary: string;
  body: string;
  whyItMatters: string;
  sources: string[];
  sourceTypes?: string[];
  number?: string;
  unit?: string;
  trend?: string;
  isLead?: boolean;
  url?: string;
  signalType?: string;
  connectedStoryline?: { title: string; context: string } | null;
  entitiesMentioned?: string[];
  // Post-publish editorial overrides (Daily Review panel)
  editorsPick?: boolean;
  editorialNote?: string | null;
}

export interface DailyNumber {
  value: string;
  unit: string;
  label: string;
  change: string;
  changeLabel: string;
  context?: string;
  source: string;
}

export const DAILY_NUMBER: DailyNumber = {
  value: "34.2",
  unit: "GW",
  label: "Renewable generation yesterday",
  change: "+7.5%",
  changeLabel: "vs.\u200930-day avg",
  context: "Highest April weekday on record.",
  source: "AEMO",
};

export const TODAYS_READ =
  "Western Victoria\u2019s curtailment crisis is no longer a grid operations footnote \u2014 it\u2019s becoming a capital allocation story. Four consecutive days above 15% are forcing developers to revisit financial models, while lithium\u2019s slide below A$900/t compounds the pressure on Australia\u2019s critical minerals ambitions.";

export const TODAYS_READ_SHORT =
  "Curtailment, commodity slides, and carbon methodology doubts \u2014 today\u2019s briefing traces three pressure points converging on Australia\u2019s energy transition.";

export const LEADS: EditorialStory[] = [
  {
    id: 1,
    sector: "GRID & TRANSMISSION",
    severity: "alert",
    headline:
      "Victoria\u2019s west region curtailment hits 18% as transmission bottleneck deepens",
    summary:
      "AEMO data shows solar curtailment in western Victoria reached 18.3% yesterday \u2014 the fourth consecutive day above 15%. The Western Renewables Link faces a revised completion date of late 2028 following contractor disputes.",
    body: "Solar curtailment in western Victoria reached 18.3% yesterday, marking the fourth consecutive day above the 15% threshold that project developers consider economically significant.\n\nThe Western Renewables Link \u2014 the transmission upgrade expected to relieve this bottleneck \u2014 now faces a revised completion date of late 2028, pushed back from 2027 after contractor disputes disclosed in AusNet\u2019s quarterly update.\n\nFor the dozen utility-scale solar projects committed to the region, each percentage point of curtailment directly erodes revenue. At current levels, some developers are reportedly revisiting their financial models entirely.",
    whyItMatters:
      "Persistent curtailment erodes project economics for existing solar farms and delays ROI timelines for committed capacity across the NEM.",
    sources: ["AEMO Dashboard", "AusNet Q3 Update"],
    sourceTypes: ["data", "filing"],
    number: "18.3",
    unit: "%",
    trend: "\u2191 4th day >15%",
    isLead: true,
  },
  {
    id: 2,
    sector: "CRITICAL MINERALS",
    severity: "alert",
    headline:
      "Pilbara lithium spot price falls below A$900/t for first time since 2022",
    summary:
      "Spodumene concentrate traded at A$880/t on the Pilbara spot market. Albemarle has flagged potential production deferrals at its Kemerton hydroxide facility, while IGO confirmed a review of downstream processing timelines.",
    body: "Spodumene concentrate traded at A$880 per tonne on the Pilbara spot market yesterday \u2014 its lowest level since October 2022 and well below the A$1,200/t most Australian producers need to break even on processing.\n\nAlbemarle has flagged potential production deferrals at its Kemerton hydroxide facility in WA. IGO confirmed a review of its downstream processing timelines.\n\nThe decline reflects oversupply from new African mines and softening demand from Chinese battery manufacturers who have shifted toward LFP chemistry for standard-range EVs.",
    whyItMatters:
      "Sub-$900 spodumene threatens the viability of Australia\u2019s lithium processing ambitions and the critical minerals supply chain for domestic battery manufacturing.",
    sources: ["Fastmarkets", "ASX Filings"],
    sourceTypes: ["data", "filing"],
    number: "880",
    unit: "A$/t",
    trend: "\u2193 lowest since Oct 2022",
  },
  {
    id: 3,
    sector: "CARBON & OFFSETS",
    severity: "watch",
    headline:
      "CER flags methodology review for landfill gas credits after satellite discrepancy",
    summary:
      "The Clean Energy Regulator has initiated a review of ACCU methodology for landfill gas capture projects, citing discrepancies between reported methane destruction and satellite-derived emissions estimates from the Global Methane Pledge monitoring network.",
    body: "The Clean Energy Regulator has initiated a formal review of the ACCU methodology for landfill gas capture projects after identifying discrepancies between reported methane destruction rates and satellite-derived emissions estimates.\n\nThe review was triggered by data from the Global Methane Pledge monitoring network, which suggested several accredited projects may be overstating capture rates by 20\u201340%.\n\nThe landfill gas category represents approximately 15% of total ACCU issuances. If the methodology is tightened, a material portion of the current supply pipeline could be invalidated or repriced.",
    whyItMatters:
      "Carbon credit integrity underpins the Safeguard Mechanism. A methodology correction here ripples through every portfolio holding landfill gas ACCUs.",
    sources: ["CER Media Release"],
    sourceTypes: ["release"],
  },
];

export const ALSO: EditorialStory[] = [
  {
    id: 4,
    sector: "BUILT ENVIRONMENT",
    severity: "ready",
    headline:
      "NABERS 6-star threshold proposed for new commercial buildings from 2028",
    summary: "",
    body: "The Climate Change Authority\u2019s draft recommendation would mandate 6-star NABERS energy ratings for all new commercial buildings over 2,000 square metres, up from the current 5.5-star requirement.\n\nThe proposal includes a transition pathway: 5.75 stars from July 2026, rising to the full 6-star requirement by January 2028. Existing buildings would be exempt but face disclosure requirements.\n\nThe Property Council has signalled cautious support, noting most new premium-grade developments already target 6 stars. The real impact falls on mid-tier commercial construction.",
    whyItMatters:
      "This sets the trajectory for building energy performance through 2030 and creates a clear signal for building services and retrofit providers.",
    sources: ["CCA Draft Report"],
    sourceTypes: ["report"],
  },
  {
    id: 5,
    sector: "HYDROGEN",
    severity: "watch",
    headline:
      "Fortescue scales back Gibson Island electrolyser to 50\u2009MW pilot",
    summary: "",
    body: "Fortescue Future Industries confirmed the Gibson Island green hydrogen project in Brisbane will proceed as a 50 MW pilot rather than the previously announced 250 MW commercial facility.\n\nCEO Mark Hutchinson cited \u201Cmarket readiness\u201D concerns, noting that offtake agreements for green hydrogen remain difficult to secure at prices that justify large-scale electrolyser investment.\n\nOf the 1,000+ green hydrogen projects announced globally since 2020, fewer than 10% have reached final investment decision. The gap between announcement and execution continues to widen.",
    whyItMatters:
      "If FFI \u2014 with its balance sheet \u2014 can\u2019t make the economics work at scale, smaller developers face an even steeper path.",
    sources: ["Fortescue ASX Announcement"],
    sourceTypes: ["filing"],
    number: "50",
    unit: "MW",
  },
];

export const BRIEFING: EditorialStory[] = [...LEADS, ...ALSO];

export const SECTOR_SEVERITY_MAP: Record<string, SeverityLevel> = {
  "GRID & TRANSMISSION": "alert",
  "CRITICAL MINERALS": "alert",
  "CARBON & OFFSETS": "watch",
  "BUILT ENVIRONMENT": "ready",
  HYDROGEN: "watch",
};

export const MARKET_CONTEXT = {
  generation: [
    { day: "Mon", solar: 14.2, wind: 11.8, hydro: 4.1 },
    { day: "Tue", solar: 15.1, wind: 10.2, hydro: 4.3 },
    { day: "Wed", solar: 13.8, wind: 13.5, hydro: 4.0 },
    { day: "Thu", solar: 16.2, wind: 9.8, hydro: 4.2 },
    { day: "Fri", solar: 15.9, wind: 12.1, hydro: 3.9 },
    { day: "Sat", solar: 14.5, wind: 14.8, hydro: 4.1 },
    { day: "Sun", solar: 15.8, wind: 14.3, hydro: 4.1 },
  ],
  wholesale: { current: 138, average: 67 },
  statePrices: [
    { state: "NSW", price: 82 },
    { state: "QLD", price: 71 },
    { state: "SA", price: 63 },
    { state: "TAS", price: 88 },
    { state: "VIC", price: 41 },
  ],
  accuSpot: { price: 34.5, change: 0.8, prevClose: 33.7 },
};
