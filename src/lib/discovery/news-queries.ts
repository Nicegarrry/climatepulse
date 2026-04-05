/**
 * Climate/energy search queries tuned for each API's capabilities and rate limits.
 *
 * NewsAPI.ai: 3 targeted queries using QueryItems.OR() with specific multi-word phrases.
 * Uses 2,000 free tokens/month — each query costs ~1 token.
 * Keep terms specific to avoid pulling in general politics/economics noise.
 *
 * NewsAPI.org: 2 queries for the q= parameter. Free tier: 100 req/day, no full text.
 * searchIn=title keeps results focused.
 */

// NewsAPI.ai: arrays of keywords combined via QueryItems.OR()
// Fewer, more precise terms = higher signal-to-noise
export const NEWSAPI_AI_QUERIES: string[][] = [
  // Renewables & grid
  ["solar farm", "wind farm", "offshore wind", "battery storage", "grid-scale storage", "energy transition"],
  // Decarbonisation & transport
  ["electric vehicle sales", "EV charging", "green hydrogen", "carbon capture", "heat pump"],
  // Policy & markets
  ["carbon price", "emissions trading", "renewable energy target", "climate legislation", "net zero target"],
];

// NewsAPI.org: keyword strings for the q= parameter
export const NEWSAPI_ORG_QUERIES: string[] = [
  '"solar farm" OR "wind farm" OR "battery storage" OR "energy transition" OR "offshore wind"',
  '"electric vehicle" OR "carbon capture" OR "green hydrogen" OR "net zero" OR "climate policy"',
];

export const NEWSAPI_AI_MAX_PER_QUERY = 10;
export const NEWSAPI_ORG_PAGE_SIZE = 50;
