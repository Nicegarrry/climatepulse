# Claude Context Library

Long-form reference for future-Claude. CLAUDE.md is the thin index; this tree holds the detail. Each file is standalone — read only what the current task needs.

## Conventions

- **One topic per file.** If a file starts covering two things, split it.
- **Write for a cold-start reader.** No references to "last session" or "recent work" — these files should survive time.
- **Code is the source of truth.** Cite file paths + symbols, don't duplicate code bodies. When behaviour changes, update the relevant doc in the same PR.
- **Gotchas concentrate in `gotchas.md`.** When you learn something surprising, add a bullet there; don't scatter `DO NOT` notes across topic files.
- **New topic?** Add the file, then add one line to this README index and to CLAUDE.md's table.

## Index

### `architecture/` — how the system is put together
- [`overview.md`](architecture/overview.md) — stack, pipeline phases at a glance, key design principles
- [`taxonomy.md`](architecture/taxonomy.md) — 12 domains, 108 microsectors, signal types, entity types
- [`rag.md`](architecture/rag.md) — pgvector corpus, embedder, retriever, graph-walk router
- [`database.md`](architecture/database.md) — table groupings, migration conventions, schema pointers
- [`auth.md`](architecture/auth.md) — Supabase magic links, role gating, RLS, `cp_returning` cookie

### `features/` — user-facing product surfaces
- [`pipeline.md`](features/pipeline.md) — 5-phase daily ingestion → enrichment → digest → podcast
- [`newsroom.md`](features/newsroom.md) — live wire-feed, dedup, classifier, push, feedback-loop hook
- [`digest.md`](features/digest.md) — Phase 3 Sonnet digest, RAG priors, personalisation boosts
- [`podcast.md`](features/podcast.md) — Sonnet script → Gemini TTS, archetype variants, telemetry
- [`weekly.md`](features/weekly.md) — Weekly Pulse report + editorial workflow
- [`learn.md`](features/learn.md) — Learn tab + conditional retrieval router
- [`markets.md`](features/markets.md) — Markets tab + cron
- [`share.md`](features/share.md) — AI-drafted blurbs + `/share/*` preview pages
- [`editor.md`](features/editor.md) — editor dashboard, assignments, briefing pack
- [`landing.md`](features/landing.md) — marketing landing, scoped design system, returning-user redirect
- [`launchpad.md`](features/launchpad.md) — post-login triptych, opt-in digest, /automacc fast path

### `ops/` — how to run, deploy, and diagnose
- [`deployment.md`](ops/deployment.md) — Vercel Pro, Supabase Marketplace integration, env vars
- [`crons.md`](ops/crons.md) — full cron schedule with `maxDuration` and trigger recipes
- [`diagnostics.md`](ops/diagnostics.md) — probe scripts, common failure modes, manual cron triggers

### Top-level
- [`gotchas.md`](gotchas.md) — concentrated "mistakes to avoid" list; read this before any non-trivial change
