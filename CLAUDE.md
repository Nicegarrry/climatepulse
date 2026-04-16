# ClimatePulse

AI-powered daily climate, energy & sustainability intelligence digest. Adapts the BenchWatch pattern for climate/energy practitioners.

## Project Context

**Moving to production (2026-04-17).** The pipeline phases have been validated locally and the app is being deployed to Vercel Pro. Each phase remains a separate tab in the tabbed SaaS shell for inspection and admin use. New work should assume production constraints (real users, real costs, RLS on, secrets-safe env vars).

The validated pipeline: (1) ingest climate/energy news from RSS + scrapers, (2) enrich articles with granular taxonomy + entity tagging + sentiment, (3) prioritise within categories, and (4) generate a smart digest.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19 + Tailwind CSS 4 + shadcn/ui + Framer Motion
- **Backend**: Node.js (Next.js API routes)
- **Database**: PostgreSQL 16 via `pg` driver (Docker Compose, no ORM)
- **AI (Triage/Enrichment)**: Gemini 2.5 Flash via Google AI API — chosen for cost
- **AI (Digest Generation)**: Claude Sonnet via Anthropic API
- **Email**: Resend
- **Hosting**: Vercel Pro (Next.js app + cron jobs); Supabase for auth + Postgres in prod

## Architecture

### Pipeline Phases

**Phase 1 — Ingestion (Tab: "Discovery")**
- Poll 15+ RSS feeds across 2 tiers (news, industry/research)
- Scrape 3 non-RSS sources (ARENA, Clean Energy Council, RMI)
- API sources: NewsAPI.ai (EventRegistry), NewsAPI.org (fallback)
- Store: title, summary snippet, source, URL, published_at
- Deduplicate by URL
- Target: ~100-200 new entries per day

**Phase 2 — Enrichment (Tab: "Categories" enriched view + "Taxonomy")**
- Full text extraction BEFORE enrichment (cheerio-based, 100-word minimum)
- Gemini 2.5 Flash processes batches (5 articles with full text, 15 without)
- Single AI call extracts: micro-sectors (1-3), signal type, sentiment, jurisdictions, entities
- Entity resolution: exact match → alias match → fuzzy match (pg_trgm) → create candidate
- Auto-promotion: regulations/projects/jurisdictions immediately; others after 3+ mentions
- Cost target: ~$0.03-0.05/day for 200 articles

**Phase 2a — Legacy Categorisation (Tab: "Categories" classic view)**
- Old 20-category flat taxonomy (kept for backward compatibility)
- Gemini 2.5 Flash, batches of 20, title+snippet only
- Cost: ~$0.01/day

**Phase 2b — Significance Scoring (implemented)**
- Two-stage pipeline: Stage 1 (batch domain classification) → Stage 2 (per-article enrichment + 6-factor significance scoring)
- Stage 1 classifies 10 articles per Gemini call; Stage 2 enriches one article at a time with domain-filtered context
- 6-factor significance scoring: impact_breadth (25%), novelty (20%), decision_forcing (20%), quantitative_magnitude (15%), source_authority (10%), temporal_urgency (10%)
- Composite score 0-100 stored in enriched_articles.significance_composite
- Prompt templates in prompts/ directory, definitions in prompts/definitions/, calibration in prompts/scoring/
- pipeline_version column enables safe re-enrichment of existing articles (?reenrich=true)

**Phase 3 — Daily Digest Generation**
- Claude Sonnet generates personalised digest per user
- Cap at 15 articles total sent to Sonnet

**Phase 3b — Daily Podcast ("ClimatePulse Daily")**
- ~5 min two-speaker audio podcast generated after digest
- Pipeline step 5: digest → Claude Sonnet script → Gemini TTS → WAV storage
- Script: Claude Sonnet converts DigestOutput + full article text + NEM data into conversational script
- TTS: Gemini `gemini-2.5-flash-preview-tts` with multi-speaker (Aoede=host, Charon=analyst)
- Voices: Female host "Sarah" (qualitative, sceptical) + Male analyst "James" (data-driven, precise)
- NEM check-in every episode with real OpenElectricity data (renewable %, state spot prices)
- Storage: local `public/podcasts/` in dev, Vercel Blob in production
- Generate locally: `npx tsx scripts/generate-podcast.ts [date]`
- v1 is global (one episode for all users); per-user custom podcasts deferred to premium tier
- DB table: `podcast_episodes` (schema in `scripts/migrate-podcast.sql`)

**Phase 4 — Weekly Digest ("The Weekly Pulse")**
- Friday 3pm: Auto-generate intelligence report from week's enriched articles
- Theme clustering via taxonomy overlap (group by domain + shared entities + microsectors)
- Gemini Flash for cluster label refinement (~$0.01/week)
- Human reviews report, writes editorial commentary, curates stories
- Publish triggers: email blast (Resend), 48h banner on Intelligence tab, LinkedIn draft
- Cost target: ~$0.03/week

### Taxonomy (108 Micro-Sectors)

Three-level hierarchy stored in the database (editable via Taxonomy tab):

**12 Domains**: Energy–Generation, Energy–Storage, Energy–Grid, Carbon & Emissions, Transport, Industry, Agriculture, Built Environment, Critical Minerals, Finance, Policy, Workforce & Adaptation

**~75 Sectors** under domains, **103 Micro-Sectors** as leaf nodes, plus **5 Cross-Cutting Tags** (Geopolitics, AI & Digital, Gender & Equity, First Nations, Disinformation)

Taxonomy is DB-stored (not hardcoded) in: `taxonomy_domains`, `taxonomy_sectors`, `taxonomy_microsectors`, `taxonomy_tags`

### Signal Types (10)

Every enriched article gets exactly one: market_move, policy_change, project_milestone, corporate_action, enforcement, personnel, technology_advance, international, community_social

### Entity Types (6)

Company, Project, Regulation, Jurisdiction, Person, Technology — stored in `entities` table with canonical_name, aliases[], auto-discovery, and promotion logic.

### Transmission Channels

Hand-authored causal links between domains (e.g., "EU ETS price → Australian offset demand"). Stored in `transmission_channels` table. Used in future "So What" generation.

## Database Schema

### Core Tables
- `sources` — source health tracking (RSS, scrape, API)
- `raw_articles` — ingested articles (title, snippet, URL, deduped)
- `full_text_articles` — extracted article content (cheerio)
- `categorised_articles` — old 20-category classification (legacy)

### Enrichment Tables
- `taxonomy_domains` / `taxonomy_sectors` / `taxonomy_microsectors` — 3-level hierarchy
- `taxonomy_tags` — 5 cross-cutting tags
- `entities` — entity registry with aliases, fuzzy matching (pg_trgm)
- `enriched_articles` — new enrichment results (microsector_ids[], signal_type, sentiment, jurisdictions[], raw_entities)
- `article_entities` — join table (enriched_article ↔ entity)
- `transmission_channels` — causal links between domains
- `enrichment_runs` — cost/performance tracking
- `category_migration_map` — old 20 categories → new microsector slugs

### Weekly Digest Tables
- `weekly_reports` — auto-generated intelligence reports (theme clusters, sentiment, numbers)
- `weekly_digests` — human-curated editorial digests (headline, narrative, curated stories, distribution tracking)

### Migrations
- `scripts/migrate.sql` — Phase 1 schema
- `scripts/migrate-enrichment.sql` — Enrichment tables, enums, extensions
- `scripts/seed-taxonomy.sql` — 12 domains, 75 sectors, 103 microsectors, 5 tags

## Dashboard Tabs

1. **Intelligence** — v1 Daily briefing: personalised digest with Daily Number, narrative synthesis, hero stories (expert analysis), compact stories (accordion), cross-story connections. Uses mock data by default; calls Claude Sonnet when ANTHROPIC_API_KEY is set.
2. **Discovery** — Phase 1: Article ingestion, source health, full text testing
3. **Categories** — Phase 2: Dual view (Classic 20-cat / Enriched with taxonomy drill-down)
4. **Energy** — Live Australian NEM data from OpenElectricity
5. **Taxonomy** — Manage taxonomy tree, entity registry, signal/sentiment overview, transmission channels, run enrichment
6. **Events** — Future: climate events timeline
7. **Weekly** — "The Weekly Pulse" editorial digest: auto-generated intelligence report (theme clusters, sentiment, numbers), human-curated editorial commentary, curated story roundup, archive view, email via Resend, LinkedIn draft

## Key Principles

- **Full text extraction BEFORE enrichment** — trivial cost increase, massive quality improvement
- **Tag once at ingestion, query forever** — zero AI at read time
- **Normalise entities, not strings** — alias resolution, fuzzy matching, canonical names
- **Emergent themes surface automatically** — unregistered entities promoted by frequency
- **Taxonomy stored in DB** — editable via dashboard, not hardcoded
- **Cost efficiency** — Gemini Flash for all triage/enrichment, Sonnet only for final digest
- **Each phase independently testable** — separate tabs, separate data
- **Old pipeline preserved** — categorised_articles table and classic view remain functional

## Mistakes to Avoid

- DO NOT use NewsAPI.org free tier for production — it blocks server-side calls
- DO NOT send more than 15 articles to Sonnet digest regardless of sector count
- Auth is real: Supabase magic links (`signInWithOtp` in `src/lib/auth-context.tsx`, login UI in `src/app/login/page.tsx`). Server routes gate access via `requireAuth()` in `src/lib/supabase/server.ts`. Never reintroduce hardcoded test users.
- DO NOT drop categorised_articles — it's the historical record and classic view fallback
- DO NOT hardcode taxonomy — it lives in the database, loaded via taxonomy-cache.ts
- RSS feeds can change URLs without notice — source health monitoring is built-in

## Environment Variables

```
DATABASE_URL=            # PostgreSQL connection string
GOOGLE_AI_API_KEY=       # Gemini 2.5 Flash for enrichment
NEWSAPI_AI_KEY=          # EventRegistry API
NEWSAPI_ORG_KEY=         # NewsAPI.org (backup)
OPENELECTRICITY_API_KEY= # Australian NEM energy data
ANTHROPIC_API_KEY=       # Claude Sonnet for digest generation
RESEND_API_KEY=          # Future: email delivery
```

## File Structure

```
climatepulse/
├── CLAUDE.md
├── package.json
├── docker-compose.yml           # PostgreSQL 16
├── prompts/
│   ├── stage1-system.md         # Stage 1 domain classification prompt
│   ├── stage2-system.md         # Stage 2 enrichment + scoring prompt
│   ├── definitions/
│   │   ├── domains.md           # 12 domain definitions
│   │   ├── micro-sectors.md     # 108 microsector definitions (include/exclude)
│   │   ├── signal-types.md      # 10 signal type definitions
│   │   └── entity-types.md      # 6 entity type definitions
│   └── scoring/
│       ├── calibration-examples.md  # 8 scored examples for prompt anchoring
│       └── prioritisation-logic.md  # 6-factor scoring spec (reference)
├── scripts/
│   ├── migrate.sql              # Phase 1 schema
│   ├── migrate-enrichment.sql   # Enrichment schema
│   ├── migrate-two-stage.sql    # Two-stage pipeline columns + indexes
│   ├── seed-taxonomy.sql        # 108 microsectors + domains + tags
│   ├── seed-sources.sql         # Initial source seeding
│   ├── migrate-weekly-digest.sql # Weekly reports + digests tables
│   ├── migrate-podcast.sql      # Podcast episodes table
│   └── generate-podcast.ts      # Standalone podcast generation script
├── src/
│   ��── app/
│   │   ├── layout.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx   # Main tabbed dashboard
│   │   │   ├── settings/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── api/
│   │       ├── discovery/           # Phase 1 routes
│   │       ├── phase2a/             # Legacy categorisation routes
│   │       ├── enrichment/          # New enrichment routes (run, stats, results)
│   │       ├── taxonomy/            # Taxonomy CRUD (tree, domains, sectors, microsectors, tags)
│   │       ├─�� entities/            # Entity registry CRUD
│   │       ├── channels/            # Transmission channel CRUD
│   │       ├── energy/              # NEM energy data
│   │       ├── digest/              # Digest generation (Claude Sonnet)
│   │       └── podcast/             # Podcast generation + retrieval
│   ├── lib/
│   │   ├── db.ts                    # PostgreSQL pool
│   │   ├── types.ts                 # All TypeScript interfaces (incl. personalisation + digest)
│   │   ├── personalisation.ts       # Relevance scoring + briefing story selection
│   │   ├── mock-digest.ts           # Mock data for UI development
│   │   ├── taxonomy.ts              # Old 20-category definitions (legacy)
│   │   ├── sources.ts               # RSS + scrape configs
│   │   ├── categorise/
│   │   │   └── engine.ts            # Old Gemini categorisation (legacy)
│   │   ├── enrichment/
│   │   │   ├── pipeline.ts          # Two-stage orchestrator (prefetch → classify → enrich → promote)
│   │   │   ├── stage1-classifier.ts # Stage 1: batch domain classification (10/call)
│   │   │   ├── stage2-enricher.ts   # Stage 2: per-article enrichment + significance
│   │   │   ├── prompt-loader.ts     # Load/cache .md prompt templates
│   │   │   ├── entity-resolver.ts   # Entity matching + candidate creation
│   │   │   ├── taxonomy-cache.ts    # DB-loaded taxonomy cache (5-min TTL)
│   │   │   └─��� fulltext-prefetch.ts # Pre-fetch full text before enrichment
│   │   ├── discovery/
│   │   │   ├── poller.ts, scraper.ts, fulltext.ts
│   │   │   ├── newsapi-ai.ts, newsapi-org.ts
│   │   │   └── news-queries.ts
│   │   ├── energy/
│   │   │   └── openelectricity.ts
│   │   ├── podcast/
│   │   │   ├── script-generator.ts  # Claude Sonnet → two-speaker script
│   │   │   ├── tts-synthesizer.ts   # Gemini TTS multi-speaker → WAV
│   │   │   └── storage.ts           # Vercel Blob / local file storage
│   │   └── weekly/
│   │       ├── theme-clusterer.ts   # Taxonomy-based article clustering
│   │       └── email-sender.ts      # Resend email delivery
│   └── components/
│       ├── intelligence/            # Daily briefing (folder with subcomponents)
│       ├── weekly/                  # Weekly digest tab
│       │   ├── index.tsx            # Main component, data fetching, layout
│       │   ├── current-digest.tsx   # Digest reading view
│       │   ├── digest-archive.tsx   # Past editions list
│       │   ├── weekly-number.tsx    # Number of the Week card
│       │   └── banner.tsx           # Time-limited banner for Intelligence tab
│       ├── discovery-tab.tsx
│       ├── categories-tab.tsx       # Dual view: classic + enriched
│       ├── energy-tab.tsx
│       ├── taxonomy-tab.tsx         # Taxonomy management
│       ├── app-header.tsx
│       ├── dev-panel.tsx
│       └── ui/                      # shadcn/ui components
```
