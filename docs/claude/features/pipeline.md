# Pipeline (Phases 1–5)

The daily ingestion → enrichment → digest → podcast flow. Admin-facing inspection lives across the Discovery, Categories, and Taxonomy tabs; reader-facing outputs are Briefing and Podcast.

## Phase 1 — Ingestion (admin tab "Discovery")

- 15+ RSS feeds across 2 tiers (news, industry/research)
- 3 scraped non-RSS sources (ARENA, Clean Energy Council, RMI)
- API sources: NewsAPI.ai (EventRegistry), NewsAPI.org (fallback)
- Google News RSS is used by Newsroom only, not the nightly pipeline
- Writes: `title`, `summary snippet`, `source`, `url`, `published_at` to `raw_articles`
- Dedupe by URL uniqueness
- Target: ~100–200 new entries/day

**Max-age filter**: `MAX_ARTICLE_AGE_DAYS = 7` in `src/lib/discovery/poller.ts`. RSS items with `pubDate` older than 7 days are skipped. This prevents podcast RSS feeds (which serve their full episode history) from repopulating multi-year backlogs. Items without `pubDate` are kept. DO NOT widen without thinking — a single podcast feed can have 400+ episodes that will flood enrichment.

Code:
- `src/lib/discovery/poller.ts`, `scraper.ts`, `newsapi-ai.ts`, `newsapi-org.ts`, `news-queries.ts`
- Cheerio extraction config for fulltext: `src/lib/discovery/fulltext.ts` (site-specific selectors for `.prose`, `.mainC`, `.gutenberg-simple`, etc. with a 100-word minimum fallback)

## Phase 2 — Enrichment (admin tabs "Categories" enriched view + "Taxonomy")

Full-text extraction runs BEFORE enrichment — trivial cost, massive quality improvement.

**Two-stage Gemini pipeline** (`src/lib/enrichment/pipeline.ts`):

| Stage | What it does |
|---|---|
| Stage 1 — `stage1-classifier.ts` | Batch domain classification, 10 articles per Gemini call |
| Stage 2 — `stage2-enricher.ts` | Per-article enrichment + 6-factor significance scoring, with domain-filtered context |

Stage 2 output per article:
- 1–3 microsectors
- Exactly one signal type (of 10)
- Sentiment
- Jurisdictions
- Entities (resolved via exact → alias → pg_trgm fuzzy → create candidate)
- 6-factor significance score (composite 0–100 in `enriched_articles.significance_composite`)

**Post-enrichment side effects** (inside `pipeline.ts`):
1. `embedAndStoreArticle()` — embeds into `content_embeddings` (see [`../architecture/rag.md`](../architecture/rag.md))
2. `checkContradictsPrior()` — one HNSW query (entity overlap + opposite sentiment + sim ≥ 0.72, 30-day window) flips `enriched_articles.contradicts_prior=TRUE` and records matched `contradicted_source_ids`. Personalisation adds +12 boost when flagged.

**Entity auto-promotion** (`src/lib/enrichment/entity-resolver.ts`):
- Immediate for `Regulation`, `Project`, `Jurisdiction`
- After 3+ mentions for `Company`, `Person`, `Technology`

**Prompts**: `prompts/stage1-system.md`, `prompts/stage2-system.md`, `prompts/definitions/*.md`, `prompts/scoring/*.md`, loaded via `src/lib/enrichment/prompt-loader.ts`.

**Re-enrichment**: the `pipeline_version` column allows safe re-enrichment via `?reenrich=true`.

**Cost target**: ~$0.03–0.05/day for 200 articles.

## Phase 2a — Legacy Categorisation (Categories tab classic view)

Old 20-category flat taxonomy kept for backward compatibility. Gemini 2.5 Flash, batches of 20, title+snippet only. Cost: ~$0.01/day. DO NOT drop `categorised_articles`.

## Phase 3 — Daily Digest

- Claude Sonnet generates personalised digest per user
- **Capped at 15 articles total** sent to Sonnet regardless of sector count
- Core logic: `src/lib/digest/generate.ts::generateBriefingForUser(userId, { mock })`
- HTTP route AND pipeline's `step4Digest` both call this function directly — **never self-fetch `http://localhost:...`** (old version did and always 500'd inside Vercel)
- **RAG prior-coverage hook**: per HERO story, `fetchPriorCoverage()` runs `retrieveContent` with entity overlap + trust tiers 0/1 + 3-day lookback; injects a "Prior ClimatePulse coverage" block into the prompt. Claude is instructed to reference only when reframing today's piece.

See [`digest.md`](digest.md) for deeper digest design.

## Phase 3b — Daily Podcast

Step 5 after digest. Covered in depth in [`podcast.md`](podcast.md).

## Phase 4 — Weekly Pulse

Covered in [`weekly.md`](weekly.md).

## Phase 5 — Newsroom

Covered in [`newsroom.md`](newsroom.md).

## Pipeline orchestration code

- `src/lib/pipeline/orchestrator.ts` — `runPipeline()`: persists to `pipeline_runs`, dispatches steps
- `src/lib/pipeline/steps.ts` — `step1Ingest` → `step5Podcast` implementations
- `src/lib/pipeline/cron-handler.ts` — shared auth + dispatch for the 5 dedicated cron routes
- `src/lib/pipeline/types.ts` — `StepName`, `StepResult`, `PipelineRunResult`

Cron schedule + triggers: [`../ops/crons.md`](../ops/crons.md). Diagnostics: [`../ops/diagnostics.md`](../ops/diagnostics.md).

## Gotchas

- DO NOT schedule a single cron to run all steps sequentially. Enrichment reliably exceeds Vercel Pro's 800s cap and silently kills digest + podcast.
- DO NOT recombine the 5 routes into `/api/pipeline/run` as a cron. The admin `/api/pipeline/run` exists for manual full-pipeline + single-step runs only.
- Fulltext success rate is dominated by input mix — podcast-source RSS entries point at audio files, not HTML, so cheerio can't extract. A 91% "failure" rate can be entirely expected. If fixing, either mark podcast sources `fulltext_supported=false`, use RSS description text, or add a transcript fetch path.
