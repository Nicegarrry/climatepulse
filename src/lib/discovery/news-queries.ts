/**
 * Climate/energy search queries tuned for each API's capabilities and rate limits.
 *
 * NewsAPI.ai: 4 targeted queries using QueryItems.OR() with keyword arrays.
 * Uses 2,000 free tokens/month — each query costs ~1 token.
 *
 * NewsAPI.org: 2 broader queries as URL-encoded keyword strings.
 * Limited to 100 requests/day on free tier.
 */

// NewsAPI.ai: arrays of keywords combined via QueryItems.OR()
export const NEWSAPI_AI_QUERIES: string[][] = [
  ["renewable energy", "solar power", "wind energy", "energy storage", "battery technology"],
  ["climate change", "climate policy", "carbon emissions", "net zero", "global warming"],
  ["electric vehicle", "green hydrogen", "carbon market", "clean energy"],
  ["critical minerals", "nuclear energy", "fossil fuel phase-out", "energy efficiency"],
];

// NewsAPI.org: keyword strings for the q= parameter
// More specific phrases to improve relevance (free tier returns a lot of noise)
export const NEWSAPI_ORG_QUERIES: string[] = [
  '"climate change" OR "renewable energy" OR "clean energy transition" OR "net zero emissions"',
  '"electric vehicle" OR "carbon capture" OR "energy storage" OR "green hydrogen" OR "offshore wind"',
];

export const NEWSAPI_AI_MAX_PER_QUERY = 15;
export const NEWSAPI_ORG_PAGE_SIZE = 50;
