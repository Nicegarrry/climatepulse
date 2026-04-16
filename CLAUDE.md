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

**Phase 5 — Newsroom (Tab: "Newsroom")**
- Live wire feed, complementary to the curated morning briefing
- Runs every 30 min during Sydney business hours (Mon–Fri 06:00–20:00 local)
- Vercel Cron hits `/api/newsroom/ingest` twice in UTC to cover both AEST and AEDT; runtime `Intl`-based guard in `src/lib/newsroom/business-hours.ts` gates the actual work
- Ingestion: RSS + NewsAPI.org + NewsAPI.ai + **Google News RSS search** (no API key) in parallel; all write into `raw_articles` via the existing `ON CONFLICT (article_url)` dedup
- Cross-source dedup: 3-layer (URL uniqueness → SHA-1 `title_hash` partial-unique index → pg_trgm soft-match that sets `duplicate_of_id` without deleting rows)
- Classifier: Gemini Flash-lite batches of 15 (concurrency 3), deliberately lighter than Stage-1 enrichment — only domain (one of the 12) + urgency 1–5 + one-sentence teaser (≤160 chars). Prompt: `prompts/newsroom-classify-system.md`. Response schema enforced via `SchemaType`
- Storage: separate `newsroom_items` table, FK to `raw_articles`; the nightly Stage-1/Stage-2 enrichment can still pick up the same `raw_articles` rows independently
- Cost target: <$0.50/week at projected volume (≈1 cent per 30-min run)
- UI: wire-feed density (no cards, no shadows, hairline dividers only; Crimson Pro 15px headline + Source Sans 3 11–13px metadata; urgency rendered as plum bullets in the right gutter for 4–5, nothing for 1–3). All 12 domains filterable as small-caps `SectorTag` chips.
- Feedback loop (influences next morning's briefing):
  - Implicit read (`read`/`expand`) — +3 per, capped +6
  - Thumbs up — +10; thumbs down — −15
  - Save — +18, also stored in `user_saved_articles`
  - Softer entity propagation — +5 engaged / +9 saved, once per story, via shared entity names between a Newsroom item and an enriched briefing story (bridges the UUID gap since they're separate DB rows)
  - All boosts clamped by existing `BOOST_CAP=35 / BOOST_FLOOR=-10` in `src/lib/personalisation.ts`
  - Wired through `computeBoosts()` (signature extended with optional `interactions`) and `selectBriefingStories()`; fetched once per digest run via `getInteractionSummary(userId)` in `src/lib/newsroom/interactions.ts`
- Push notifications: urgency-5 only, opt-in
  - Service worker: `public/sw.js` (push handler only; no offline caching to avoid future WS5 conflicts)
  - Contract in `src/lib/newsroom/types.ts::NewsroomPushPayload`
  - Fanout in `src/lib/newsroom/fanout.ts` filters opted-in subscribers by sector overlap, rate-limits to 3 sends/user/hour, tracks failures in `user_push_subscriptions.failure_count`, purges at 5, audits every attempt to `newsroom_push_log`
  - Gracefully no-ops if `VAPID_*` env vars aren't set
- Saved articles archive: dense CSS-grid clippings board on the Profile page (`src/components/newsroom/SavedBoard.tsx`); typographic search, sector filter, saved_at cursor pagination

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

### Newsroom Tables
- `newsroom_items` — lightly-classified wire items (FK to `raw_articles`, `primary_domain`, `urgency`, `teaser`, `duplicate_of_id`, `editor_override` JSONB for future WS4 controls)
- `user_saved_articles` — user archive; FK to `raw_articles` + nullable FK to `newsroom_items`; unique on `(user_id, raw_article_id)`; GIN index on `note` for search
- `user_newsroom_interactions` — append-only log of `read|expand|thumbs_up|thumbs_down|save|unsave` per user; powers the briefing-bump hook and preserves calibration history
- `user_push_subscriptions` — web-push subscriptions with `failure_count` tombstoning at 5
- `newsroom_push_log` — audit trail of every urgency-5 push attempt (`sent|rate_limited|failed|expired`)
- `newsroom_runs` — cost/duration telemetry mirroring `enrichment_runs`
- `raw_articles.title_hash` — SHA-1(first 16 hex) of normalised title; partial-unique index blocks cross-source duplicates

### Migrations
- `scripts/migrate.sql` — Phase 1 schema
- `scripts/migrate-enrichment.sql` — Enrichment tables, enums, extensions
- `scripts/seed-taxonomy.sql` — 12 domains, 75 sectors, 103 microsectors, 5 tags
- `scripts/migrate-newsroom.sql` — Newsroom tables, `title_hash` column, notification_prefs JSONB backfill

## Dashboard Tabs

Tabs are role-gated via `getTabsForRole()` in `src/app/(app)/dashboard/page.tsx` — `readerTabs`, `editorTabs`, `adminTabs`. All readers see: Briefing, Newsroom, Energy, Markets, Weekly. Editors add: Editor. Admins add: Discovery, Categories, Taxonomy.

1. **Intelligence** ("Briefing", reader) — v1 Daily briefing: personalised digest with Daily Number, narrative synthesis, hero stories (expert analysis), compact stories (accordion), cross-story connections. Uses mock data by default; calls Claude Sonnet when ANTHROPIC_API_KEY is set.
2. **Newsroom** (reader) — Phase 5: live wire-feed timeline, 30-min refresh cadence, per-user sector + urgency filtering, thumbs/save feedback loop that bumps items in the next briefing, urgency-5 push opt-in.
3. **Energy** (reader) — Live Australian NEM data from OpenElectricity
4. **Markets** (reader) — Commodity + equity ticker coverage
5. **Weekly** (reader) — "The Weekly Pulse" editorial digest: auto-generated intelligence report (theme clusters, sentiment, numbers), human-curated editorial commentary, curated story roundup, archive view, email via Resend, LinkedIn draft
6. **Editor** (editor+) — Weekly digest workflow: curate stories, write commentary, publish
7. **Discovery** (admin) — Phase 1: Article ingestion, source health, full text testing
8. **Categories** (admin) — Phase 2: Dual view (Classic 20-cat / Enriched with taxonomy drill-down)
9. **Taxonomy** (admin) — Manage taxonomy tree, entity registry, signal/sentiment overview, transmission channels, run enrichment

The Profile page additionally renders `SavedBoard` — the user's personal archive of saved Newsroom items as a dense clippings board.

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
- DO NOT write NOW() or other volatile functions into partial-index predicates — Postgres requires IMMUTABLE predicates (we hit this in `migrate-newsroom.sql` and fell back to `WHERE title_hash IS NOT NULL`)
- DO NOT push notifications for anything under urgency 5 — preserves signal value and avoids notification fatigue. Fanout enforces a hard 3/user/hour rate limit on top of that.
- DO NOT add offline-caching logic to `public/sw.js` without coordination — it is deliberately limited to push handling so it can coexist with any future caching SW
- DO NOT classify Newsroom items at microsector granularity — Newsroom is domain-only by design. Deep microsector + entity work happens in the nightly Stage-1/Stage-2 pipeline
- Newsroom `user_id` columns are `TEXT` (matches `user_profiles.id`), not UUID — every new table that joins to the user must use TEXT

## Supabase × Vercel linking (prod)

Supabase is linked to Vercel via the **Vercel Marketplace Supabase integration** (`vercel.com/marketplace/supabase`), not manual env-var copy-paste. The integration auto-provisions `DATABASE_URL` (transaction pooler, correctly SSL-configured), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project, and keeps them in sync when you rotate keys in Supabase. This is the path to reach for first whenever a web project needs Supabase in prod — it sidesteps the SSL cert-chain and pooler-URL footguns that manual setup hits.

The SSL-strip workaround in `src/lib/db.ts` is still in place as a belt-and-braces layer (so any future URL with `?sslmode=require` still works), but the integration-provisioned URL doesn't need it.

## Environment Variables

```
# ─── Data + AI (manual in Vercel) ────────────────────────────────────────
GOOGLE_AI_API_KEY=                  # Gemini 2.5 Flash for enrichment + Newsroom
NEWSAPI_AI_KEY=                     # EventRegistry API
NEWSAPI_ORG_KEY=                    # NewsAPI.org (backup)
OPENELECTRICITY_API_KEY=            # Australian NEM energy data
ANTHROPIC_API_KEY=                  # Claude Sonnet for digest generation
RESEND_API_KEY=                     # Email delivery

# ─── Supabase (auto-provisioned by the Marketplace integration) ─────────
DATABASE_URL=                       # PostgreSQL transaction-pooler URL
NEXT_PUBLIC_SUPABASE_URL=           # Public — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Public — anon key for client auth
SUPABASE_SERVICE_ROLE_KEY=          # Server-only — bypasses RLS, never expose

# ─── Cron + Push (Newsroom) ──────────────────────────────────────────────
CRON_SECRET=                        # Bearer token required by /api/**/ingest cron routes
VAPID_PUBLIC_KEY=                   # Web-push VAPID public key (server-side)
VAPID_PRIVATE_KEY=                  # Web-push VAPID private key
VAPID_SUBJECT=                      # mailto:ops@climatepulse.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # Public — same value as VAPID_PUBLIC_KEY, exposed for browser subscribe
NEXT_PUBLIC_APP_URL=                # e.g. https://climatepulse.app (used in push payload `url`)
```

Newsroom gracefully no-ops on push when the VAPID vars are missing, so the feature still works in dev without them — only the urgency-5 notification dispatch is skipped (the intent is logged to `newsroom_push_log` for audit either way).

## File Structure

```
climatepulse/
├── CLAUDE.md
├── package.json
├── docker-compose.yml           # PostgreSQL 16
├── public/
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Minimal service worker (Newsroom push only)
├── prompts/
│   ├── stage1-system.md         # Stage 1 domain classification prompt
│   ├── stage2-system.md         # Stage 2 enrichment + scoring prompt
│   ├── newsroom-classify-system.md  # Newsroom classifier (domain + urgency + teaser)
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
│   ├── migrate-newsroom.sql     # Newsroom tables, title_hash, push/saved/interactions
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
│   │       ├── podcast/             # Podcast generation + retrieval
│   │       └── newsroom/            # Newsroom API
│   │           ├── ingest/          # Cron entry (GET|POST, CRON_SECRET)
│   │           ├── feed/            # Paginated user feed
│   │           ├── interact/        # POST {raw_article_id, type}
│   │           ├── save/            # POST/DELETE save toggle
│   │           ├── saved/           # GET user archive
│   │           ├── prefs/           # PATCH/GET notification prefs
│   │           └── push/
│   │               ├── subscribe/   # POST — persist PushSubscription
│   │               └── unsubscribe/ # POST — remove subscription
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
│   │   ├── newsroom/
│   │   │   ├── run.ts               # Orchestrator: poll → dedup → classify → fanout
│   │   │   ├── google-news-fetch.ts # Keyless Google News RSS search
│   │   │   ├── dedup.ts             # title_hash + pg_trgm soft dedup
│   │   │   ├── classifier.ts        # Gemini batch: domain + urgency + teaser
│   │   │   ├── business-hours.ts    # Intl-based Sydney business-hours guard
│   │   │   ├── feed-queries.ts      # fetchFeed + fetchSaved
│   │   │   ├── interactions.ts      # getInteractionSummary for briefing bump
│   │   │   ├── fanout.ts            # Urgency-5 web-push dispatch
│   │   │   └── types.ts             # NewsroomItem, Urgency, InteractionSummary
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
│       ├── newsroom/                # Newsroom wire-feed tab + saved archive
│       │   ├── NewsroomTab.tsx      # Tab shell: header + feed + PushOptIn
│       │   ├── FeedHeader.tsx       # Urgency slider + sector chips + refresh
│       │   ├── FeedList.tsx         # Infinite-scroll list with sentinel
│       │   ├── FeedRow.tsx          # Single wire row (timestamp | headline | sector+urgency)
│       │   ├── SectorTag.tsx        # Small-caps tag with hairline underline
│       │   ├── UrgencyGlyph.tsx     # 0–2 plum bullets for urgency ≥4
│       │   ├── QuickActions.tsx     # Thumbs + save buttons (keyboard: j/k/s/t)
│       │   ├── PushOptIn.tsx        # Urgency-5 push opt-in card
│       │   ├── SavedBoard.tsx       # Profile-page clippings grid
│       │   └── SavedClipping.tsx    # Single clipping cell
│       ├── discovery-tab.tsx
│       ├── categories-tab.tsx       # Dual view: classic + enriched
│       ├── energy-tab.tsx
│       ├── taxonomy-tab.tsx         # Taxonomy management
│       ├── app-header.tsx
│       ├── dev-panel.tsx
│       └── ui/                      # shadcn/ui components
```
