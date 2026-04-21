# Architecture Overview

## Stack

- **Framework**: Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, Framer Motion
- **Backend**: Next.js API routes (Node.js); PostgreSQL via `pg` (Supabase in prod, Docker locally), no ORM
- **AI**: Gemini 2.5 Flash for triage / enrichment / classification; Claude Sonnet for digest + podcast script; Gemini TTS (`gemini-2.5-flash-preview-tts`) for audio
- **Infra**: Vercel Pro (app + cron), Supabase (auth + Postgres + pgvector), Vercel Blob (audio), Resend (email)

Live on Vercel Pro since 2026-04-17. Assume production constraints on new work: real users, real AI/API costs, RLS on Supabase tables, no dev-only shortcuts.

## The pipeline at a glance

The validated daily pipeline runs 19:00 UTC (05:00 AEST) in 5 dedicated cron routes. Each phase is independently testable and has its own admin/reader tab.

1. **Ingest** — RSS + scrape + NewsAPI → `raw_articles` (dedup by URL)
2. **Fulltext** — cheerio extraction into `full_text_articles` (≥100 words)
3. **Enrich** — 2-stage Gemini: domain classify → microsectors + signal + sentiment + jurisdictions + entities + 6-factor significance score. Side effects: embed + `contradicts_prior` HNSW check
4. **Digest** — Claude Sonnet personalised briefing per user (capped at 15 stories) with RAG prior-coverage blocks
5. **Podcast** — Sonnet script → Gemini multi-speaker TTS → MP3 → Vercel Blob

Full cron table: [`../ops/crons.md`](../ops/crons.md). Full pipeline detail: [`../features/pipeline.md`](../features/pipeline.md).

## Parallel feature surfaces

Alongside the nightly pipeline:

- **Newsroom** — live wire feed every 30 min during Sydney business hours. Feedback loop bumps items in the next morning's briefing
- **Weekly Pulse** — Friday intelligence report, editor curates, email + LinkedIn + Intelligence-tab banner
- **Learn** — concept-driven reader surface. Uses a conditional graph-walk vs vector retrieval router
- **Markets** — cron-driven commodity + equity coverage
- **Share** — AI-drafted blurbs + `/share/*` preview pages for outbound distribution

## Key design principles

- **Full-text extraction BEFORE enrichment** — trivial cost, massive quality lift
- **Tag once at ingestion, query forever** — zero AI at read time
- **Normalise entities, not strings** — alias resolution, fuzzy matching (pg_trgm), canonical names
- **Emergent themes surface automatically** — unregistered entities promoted by frequency (3+ mentions for most types, immediate for regulations/projects/jurisdictions)
- **Taxonomy stored in DB** — editable via Taxonomy tab, loaded via `taxonomy-cache.ts` (5-min TTL), not hardcoded
- **Cost efficiency** — Gemini Flash for all triage/enrichment; Sonnet reserved for final digest + podcast script
- **Each phase independently testable** — separate tabs, separate tables
- **Old pipeline preserved** — `categorised_articles` + 20-category classic view remain functional as a fallback

## Where to look next

- Taxonomy details: [`taxonomy.md`](taxonomy.md)
- RAG layer: [`rag.md`](rag.md)
- Database tables + migrations: [`database.md`](database.md)
- Auth + RBAC: [`auth.md`](auth.md)
- Deployment + env vars: [`../ops/deployment.md`](../ops/deployment.md)
- Things that have bitten us before: [`../gotchas.md`](../gotchas.md)
