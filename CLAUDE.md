# ClimatePulse

AI-powered daily climate, energy & sustainability intelligence digest for practitioners. Live on Vercel Pro since 2026-04-17 — assume production constraints on all work (real users, real AI/API costs, RLS on Supabase tables).

## Stack (cheat sheet)

- **Framework**: Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, Framer Motion
- **Backend**: Next.js API routes, PostgreSQL via `pg` (Supabase in prod, Docker locally), no ORM
- **AI**: Gemini 2.5 Flash (triage/enrichment/classification) · Claude Sonnet (digest + podcast script) · Gemini TTS (audio)
- **Infra**: Vercel Pro (app + cron) · Supabase (auth + Postgres + pgvector) · Vercel Blob (audio) · Resend (email)

## Documentation layout

Long-form reference lives in **`docs/claude/`**. This file is the index — fetch the relevant topic file on demand.

```
docs/claude/
├── README.md              ← full index; read first when in doubt
├── gotchas.md             ← concentrated "mistakes to avoid" list — scan before any non-trivial change
│
├── architecture/
│   ├── overview.md        ← stack + pipeline at a glance + design principles
│   ├── taxonomy.md        ← 12 domains, 108 microsectors, signal types, entity types, significance scoring
│   ├── rag.md             ← pgvector corpus, embedder, retriever, graph-walk router
│   ├── database.md        ← table groupings, migrations, schema pointers
│   └── auth.md            ← Supabase magic links, role gating, RLS, cp_returning cookie
│
├── features/
│   ├── pipeline.md        ← 5-phase daily pipeline (ingest → fulltext → enrich → digest → podcast)
│   ├── digest.md          ← Phase 3 Sonnet digest, RAG priors, personalisation boosts
│   ├── podcast.md         ← Sonnet script → Gemini TTS, archetype variants, telemetry
│   ├── newsroom.md        ← live wire-feed, dedup, classifier, push, feedback-loop hook
│   ├── weekly.md          ← Weekly Pulse report + editorial workflow
│   ├── learn.md           ← Learn tab + conditional retrieval router
│   ├── markets.md         ← Markets tab + cron
│   ├── share.md           ← AI-drafted blurbs + /share/* preview pages
│   ├── editor.md          ← editor dashboard, assignments, briefing pack
│   ├── landing.md         ← marketing landing, scoped design system
│   └── launchpad.md       ← post-login triptych, opt-in digest, /automacc fast path
│
└── ops/
    ├── deployment.md      ← Vercel Pro, Supabase Marketplace integration, env vars
    ├── crons.md           ← full cron schedule with maxDuration + trigger recipes
    └── diagnostics.md     ← probe scripts + common failure modes
```

## How to navigate this docs tree

- **Scoping a new feature** → read `architecture/overview.md` then the relevant `features/*.md`
- **Working on an existing feature** → read the matching `features/*.md`, then `gotchas.md`
- **Touching schema or migrations** → `architecture/database.md` + `gotchas.md` (Schema section)
- **Cron / deploy / env work** → `ops/*.md`
- **Debugging a failed pipeline run or missing briefing** → `ops/diagnostics.md`
- **Before any non-trivial change** → scan `gotchas.md`

## Conventions for docs

- **One topic per file.** If a file starts covering two things, split it.
- **Code is the source of truth.** Cite paths + symbols, don't duplicate code bodies. When behaviour changes, update the matching doc in the same PR.
- **New topic?** Add the file, then add one line to `docs/claude/README.md` and to the table above.
- **Gotchas concentrate in `docs/claude/gotchas.md`.** When you learn something surprising, add a bullet there; don't scatter `DO NOT` notes across topic files.

## Git workflow

- **Small fixes → straight to `main` and push.** Typos, single-file bug fixes, one-line config tweaks, docs updates. Prod auto-deploys from `main` and small fixes are easy to revert.
- **Major changes → ask first: branch + PR, or main?** New features, migrations, multi-subsystem work, risky refactors. Default assumption is branch + PR.
- If uncertain, ask.

## Dashboard tabs at a glance

Role-gated via `getTabsForRole()` in `src/app/(app)/dashboard/page.tsx`:

- **Reader**: Briefing, Learn, Newsroom, Energy, Markets, Weekly
- **Editor adds**: Editor, Flagship
- **Admin adds**: Discovery, Categories, Taxonomy, Podcast (admin)

Full RBAC detail: `docs/claude/architecture/auth.md`.
