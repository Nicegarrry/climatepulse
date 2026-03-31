# ClimatePlus

AI-powered daily climate, energy & sustainability intelligence digest. Adapts the BenchWatch pattern for climate/energy practitioners.

## Project Context

This is a **local development testing environment** — not a production app. We are building and testing each phase of the data pipeline independently, with a simple visual frontend to inspect results at each stage. Each phase is a separate tab in a tabbed SaaS shell.

The goal is to validate that we can: (1) ingest climate/energy news from RSS + scrapers, (2) categorise it cheaply, (3) prioritise within categories, and (4) generate a smart digest — before building the real product.

## Stack

- **Framework**: Wasp (same as BenchWatch)
- **Frontend**: React + Vite (for local testing UI)
- **Backend**: Node.js
- **Database**: Supabase (PostgreSQL via Prisma)
- **AI (Triage/Categorisation)**: Gemini 2.0 Flash via Google AI API — chosen for cost ($0.10/$0.40 per 1M tokens, ~8x cheaper than Haiku on input). NOTE: Gemini 2.0 Flash deprecated June 2026; migrate to Gemini 2.5 Flash or Flash-Lite when needed.
- **AI (Digest Generation)**: Claude Sonnet via Anthropic API
- **Email**: Resend
- **Hosting (future)**: Railway (backend), Vercel (frontend)

## Architecture

### Four-Phase Pipeline

**Phase 1 — Ingestion (Tab 1: "Sources")**
- Poll 30+ RSS feeds across 4 tiers (news, industry, government, research)
- Scrape non-RSS sources (ARENA, AEMO, Clean Energy Council) via URL monitoring
- Store: title, summary snippet, source, URL, published_at — NO full text yet
- Deduplicate by URL
- Target: ~100-200 new entries per day

**Phase 2a — Categorisation (Tab 2: "Categories")**
- Gemini 2.0 Flash processes each entry using ONLY title + RSS summary snippet
- Assigns primary category + up to 2 secondary categories from 20-category taxonomy
- Structured JSON output, batched requests
- Cost target: <$0.01/day for 200 articles

**Phase 2b — Prioritisation (Tab 3: "Priorities")**
- Within each category, rank articles by significance (1-5 scale)
- Hard filter to top 3-5 per category
- Gemini 2.0 Flash again — send all articles in a category as one batch, ask for ranking
- Output: ~60-100 shortlisted articles across all categories

**Phase 3 — Digest Generation (Tab 4: "Digest")**
- Claude Sonnet generates personalised digest per user
- Smart batching: more interest areas = fewer articles per area in the batch
- Formula: articles_per_sector = max(2, floor(15 / num_sectors))
- Always cap at 15 articles total sent to Sonnet regardless of sector count
- Output structure:
  - Top 3 stories (full treatment, "why it matters")
  - Next 7-10 in accordion-style list (headline + one-liner)
  - Matches BenchWatch digest format

### Category Taxonomy (20 categories)

1. Solar
2. Wind
3. Energy Storage & Batteries
4. Hydrogen & Green Fuels
5. Grid & Transmission
6. Transport Electrification
7. Buildings & Energy Efficiency
8. Heavy Industry Decarbonisation
9. Carbon Capture & Removal
10. Nature, Land Use & Agriculture
11. Climate Finance & Carbon Markets
12. Policy & Regulation
13. Climate Science & Research
14. Adaptation & Resilience
15. Mining & Critical Minerals
16. Nuclear
17. Oil, Gas & Fossil Fuel Transition
18. Circular Economy & Waste
19. Water & Oceans
20. Climate Tech & Startups

### RSS Feed Sources (Tier 1 — poll daily)

| Source | Feed URL |
|--------|----------|
| Carbon Brief | `https://www.carbonbrief.org/feed` |
| Canary Media | `https://www.canarymedia.com/rss-feed` |
| CleanTechnica | `https://cleantechnica.com/feed` |
| Electrek | `https://electrek.co/feed` |
| Guardian Environment | `https://www.theguardian.com/environment/rss` |
| Inside Climate News | `https://insideclimatenews.org/feed` |
| Grist | `https://grist.org/feed` |
| RealClearEnergy | `https://www.realclearenergy.org/rss/` |
| PV Magazine | `https://www.pv-magazine.com/feed` |
| Energy Storage News | `https://www.energy-storage.news/feed` |
| Renewables Now | `https://renewablesnow.com/feeds/` |
| Bloomberg Green | `https://feeds.bloomberg.com/green/news.rss` |

### RSS Feed Sources (Tier 2 — poll daily)

| Source | Feed URL |
|--------|----------|
| DCCEEW Australia | `https://www.dcceew.gov.au/about/news/stay-informed/rss` |
| CSIRO Climate | `https://blog.csiro.au/feed/` |
| IEA | `https://www.iea.org/news/rss` |
| IRENA | `https://www.irena.org/rssfeed` |
| EIA Today in Energy | `https://www.eia.gov/rss/todayinenergy.xml` |
| NOAA Climate | `https://www.climate.gov/feeds` |
| Nature Climate Change | `https://www.nature.com/nclimate.rss` |
| CTVC | `https://www.ctvc.co/rss/` |
| PV Magazine Australia | `https://www.pv-magazine-australia.com/feed` |

### Scrape Targets (no RSS — monitor for new content)

| Source | URL to monitor | Check frequency |
|--------|---------------|-----------------|
| ARENA News | `https://arena.gov.au/news/` | Every 6 hours |
| AEMO Media | `https://aemo.com.au/newsroom` | Every 6 hours |
| Clean Energy Council | `https://www.cleanenergycouncil.org.au/news` | Every 12 hours |
| RMI | `https://rmi.org/insights/` | Every 12 hours |

## Key Principles

- **No full text in Phase 1 or 2** — only title + summary snippet. Full text fetched only for Phase 3 winners if needed.
- **Cost efficiency over quality for triage** — Gemini Flash for categorisation/prioritisation, Sonnet only for final digest.
- **Aggressive filtering** — max 3-5 articles per category survive prioritisation. Users see top 3 + accordion of next 7-10.
- **Smart batching for digest** — more sectors selected = fewer articles per sector. Total article count to Sonnet capped at 15.
- **Each phase is independently testable** — separate tabs, separate data, can re-run any phase without touching others.

## Design Language

Inherits from BenchWatch "Digital Ledger" aesthetic:
- **Typefaces**: DM Sans + Newsreader serif
- **Accent**: Amber (#C9922A) — shared across Nick's projects
- **Surface hierarchy**: Six-tier, no 1px borders (tonal background shifts)
- **Theme**: Light warm-white
- **For testing UI**: Keep it simple. Basic tabs, data tables, cards. Don't over-invest in styling during testing phase.

## Mistakes to Avoid

- DO NOT fetch full article text during ingestion or categorisation — it's unnecessary and expensive
- DO NOT use NewsAPI.org free tier — it explicitly blocks server-side production calls
- DO NOT send more than 15 articles total to the Sonnet digest call regardless of how many sectors a user follows
- DO NOT build auth, payments, or user management during testing — hardcode a test user
- DO NOT over-engineer the frontend — this is a testing harness, not the final product
- Gemini 2.0 Flash is deprecated June 2026 — plan migration to 2.5 Flash but don't worry about it now
- RSS feeds can change URLs without notice — build source health monitoring from the start (last_successful_poll, consecutive_failures)

## Environment Variables Required

```
GOOGLE_AI_API_KEY=       # Gemini Flash for categorisation/prioritisation
ANTHROPIC_API_KEY=       # Claude Sonnet for digest generation
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=          # Future: email delivery
```

## File Structure (Testing Phase)

```
climateplus/
├── CLAUDE.md
├── .env
├── package.json
├── src/
│   ├── phases/
│   │   ├── phase1-ingestion/     # RSS polling, scraping, dedup
│   │   ├── phase2a-categorise/   # Gemini Flash categorisation
│   │   ├── phase2b-prioritise/   # Gemini Flash ranking within categories
│   │   └── phase3-digest/        # Claude Sonnet digest generation
│   ├── shared/
│   │   ├── taxonomy.ts           # 20-category definitions
│   │   ├── sources.ts            # RSS feed + scrape target configs
│   │   ├── db.ts                 # Supabase client
│   │   └── types.ts              # Shared TypeScript types
│   └── ui/
│       ├── App.tsx               # Tabbed shell
│       ├── tabs/
│       │   ├── SourcesTab.tsx    # Phase 1 visual
│       │   ├── CategoriesTab.tsx # Phase 2a visual
│       │   ├── PrioritiesTab.tsx # Phase 2b visual
│       │   └── DigestTab.tsx     # Phase 3 visual
│       └── components/           # Shared UI components
```
