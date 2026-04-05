/**
 * Climate/energy search queries tuned for each API's capabilities and rate limits.
 *
 * NewsAPI.ai: 4 targeted queries × 15 articles = ~60 articles per run.
 * Uses 2,000 free tokens/month — each query costs ~1 token.
 *
 * NewsAPI.org: 2 broader queries × 50 articles = ~100 articles per run.
 * Limited to 100 requests/day on free tier.
 */

export const NEWSAPI_AI_QUERIES = [
  '"renewable energy" OR "solar power" OR "wind energy" OR "energy storage" OR "battery technology"',
  '"climate change" OR "climate policy" OR "carbon emissions" OR "net zero" OR "global warming"',
  '"electric vehicle" OR "green hydrogen" OR "carbon market" OR "clean energy transition"',
  '"critical minerals" OR "nuclear energy" OR "fossil fuel" OR "energy efficiency"',
];

export const NEWSAPI_ORG_QUERIES = [
  '("climate change" OR "renewable energy" OR "clean energy" OR "net zero")',
  '("electric vehicle" OR "carbon emissions" OR "energy storage" OR "green hydrogen")',
];

export const NEWSAPI_AI_MAX_PER_QUERY = 15;
export const NEWSAPI_ORG_PAGE_SIZE = 50;
