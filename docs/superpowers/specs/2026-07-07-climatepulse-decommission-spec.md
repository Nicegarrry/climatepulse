# Climate Pulse Decommission And Knowledge Archive Spec

**Date:** 2026-07-07
**Status:** Draft
**Execution model:** GPT-5.5 agent-led work with human approval gates

## Overview

Climate Pulse will be shut down as an active product while preserving the code,
subscriber/contact data, and the knowledge store built in Supabase/Postgres with
pgvector. The public site should become a low-dependency holding page. The
existing app pipelines, cron jobs, LLM calls, news APIs, market APIs, and
retrieval endpoints should stop running. The knowledge substrate should be
exported into a restorable local database and a private knowledge repo that can
continue receiving curated additions over time.

The strategic goal is not simply to "turn off the app". It is to preserve the
valuable Climate Pulse corpus so it can inform a renewed Climate Pulse
experience or adjacent products later.

## Current System Facts

- The root landing page currently reads a cached public digest and redirects
  returning users into `/launchpad` via `cp_returning`.
- `vercel.json` schedules a large number of cron routes, including pipeline,
  weekly, newsroom, markets, and scraper jobs.
- The knowledge substrate is centered on `content_embeddings`, a pgvector table
  with `vector(768)` embeddings, `content_type`, `source_id`, `chunk_index`,
  `chunk_text`, and denormalized metadata.
- User signup/contact data is split between Supabase Auth and
  `public.user_profiles`; there is no obvious separate waitlist/newsletter table
  in the current code.
- Long-term knowledge value depends on preserving source tables alongside the
  vector rows. Embeddings alone are not enough.

## Goals

1. Replace the public product with a minimal landing page using the logo,
   shutdown copy, and an email entry field.
2. Stop recurring API usage and prevent accidental app pipeline execution.
3. Pull user names/emails for personal outreach.
4. Export and verify a full restorable knowledge archive.
5. Create a private local-first knowledge repo with a local pgvector database.
6. Set up a maintainable workflow for slowly adding new knowledge using a
   Climate Pulse skill and scheduled agent runs.

## Non-Goals

- No deletion of production data until a verified restore exists.
- No product redesign beyond the holding page.
- No billing, subscription, or CRM automation unless explicitly added later.
- No public release of the knowledge archive.
- No committing raw PII, production database dumps, or secret-bearing exports to
  normal git history.

## Phase 1 - Easiest Shutdown Path

### Objective

Replace the active landing/product experience with a static or near-static
holding page and stop ongoing API usage as quickly as possible.

### User Experience

First viewport:

- Climate Pulse logo.
- Copy:

  > Thanks for the support. We will be in touch about a renewed Climate Pulse
  > experience and our other new products.

- Email entry field.
- Submit success state:

  > Thanks. We will be in touch.

### Default Implementation Choice

Keep the existing Vercel/Next deployment, but make the root route independent of
Supabase, digest data, auth cookies, and AI/news services.

This is faster and less risky than moving DNS to a new host immediately.

### Landing Capture Options

Preferred for fastest shutdown:

- Use a low-friction external form endpoint or simple inbox capture for the
  initial landing page.
- Do not use the existing Climate Pulse Supabase database for page rendering.
- Do not add a dependency on existing auth/session state.

Preferred after Phase 2:

- Replace the temporary capture with a private local or minimal managed capture
  flow that syncs into the knowledge repo/contact archive.

### App/API Shutdown Controls

Phase 1 should include multiple defensive controls:

- Remove or empty all Vercel crons in `vercel.json`.
- Remove landing page calls to public digest data.
- Remove root redirect behavior for `cp_returning`.
- Add a maintenance guard for app/API routes, or otherwise ensure hidden app
  routes cannot trigger costly work.
- Keep only the minimal route surface needed for the public holding page.
- After data export gates pass, remove production env vars for LLM, news, market,
  webhook, and cron secrets from the active deployment.

### Acceptance Criteria

- `/` renders without a Supabase database connection.
- `/` renders without calling Gemini, OpenAI, EventRegistry, NewsAPI, market APIs,
  Vercel Blob, or internal digest routes.
- No scheduled Vercel cron remains active.
- Email entry has a reviewed capture path and a success/failure state.
- Former app/API routes cannot run scheduled ingestion, enrichment, podcast,
  digest, newsroom, market, or scraper work.
- The live deployment is verified with network/log inspection.

### Estimated GPT-5.5 Agent Time

- Fast path: 3-6 hours.
- Normal path: 6-10 hours, including review, deploy verification, and route
  hardening.

## Phase 2 - Data Capture And Local Database

### Objective

Export contact data and preserve the production knowledge store in a local,
restorable, private archive.

### Contact Export

Source tables:

- `auth.users`
- `public.user_profiles`
- `knowledge_surface_members` for invited emails that may not have registered

Export fields:

- name
- email
- signup timestamp
- onboarding timestamp
- role lens
- primary sectors
- jurisdictions
- tier
- notification preferences
- source of record: auth user, profile, or surface invite

PII handling:

- Store contact exports outside git.
- Produce a sanitized counts-only manifest that can be committed.
- Exclude test/internal accounts.
- Keep one private CSV for personal outreach.

### Knowledge Archive Scope

Required database tables:

- `content_embeddings`
- `raw_articles`
- `full_text_articles`
- `categorised_articles`
- `enriched_articles`
- `article_entities`
- `entities`
- `taxonomy_domains`
- `taxonomy_sectors`
- `taxonomy_microsectors`
- `taxonomy_tags`
- `storylines`
- `storyline_articles`
- `daily_briefings`
- `weekly_reports`
- `weekly_digests`
- `podcast_episodes`
- `library_documents`
- `knowledge_surfaces`
- `knowledge_surface_content`
- `knowledge_surface_members`
- `knowledge_surface_analytics`
- `sources`
- `enrichment_runs`

Required file/code assets:

- `prompts/`
- `scripts/migrate*.sql`
- `scripts/migrations/`
- retrieval and embedding code references
- blob object inventory for uploaded docs and podcast audio

### Archive Formats

Use at least two export forms:

1. Full-fidelity restore:
   - `pg_dump --format=custom`
   - schema-only dump
   - restore test into local Postgres with pgvector

2. Portable knowledge data:
   - JSONL/CSV exports for key tables
   - `content_embeddings.embedding::text` so vectors survive outside Postgres
   - manifest with counts, checksums, source DB, export timestamp, embedding
     model, dimensions, and schema version

### Local Database

Create a private local-first knowledge repo, for example:

```text
climatepulse-knowledge/
  README.md
  docker-compose.yml
  schema/
  migrations/
  exports/
    manifests/
    samples/
  scripts/
    export/
    import/
    verify/
  knowledge/
    raw/
    curated/
    sources/
  skills/
    climatepulse/
      SKILL.md
```

The local database should use Postgres plus pgvector, not a bespoke vector file
format. Git should hold scripts, schemas, manifests, prompts, and small samples.
Large dumps, PII, blob mirrors, and full JSONL exports should stay in local
private storage, encrypted storage, Git LFS, or a private release/artifact store.

### Acceptance Criteria

- Contact CSV produced and reviewed.
- Full production database dump exists outside git.
- Schema-only dump exists.
- Portable JSONL/CSV exports exist for required tables.
- Blob inventory exists, with download/archive status for each referenced object.
- Local Postgres+pgvector can restore or import the archive.
- Verification script reports table counts and vector row counts.
- A README documents restore and query workflow.

### Estimated GPT-5.5 Agent Time

- Fast path: 6-10 hours, excluding large dump transfer time.
- Normal path: 10-18 hours, including local restore verification and manifesting.

## Phase 3 - Continued Knowledge Addition With Skills

### Objective

Set up a durable, low-cost way to keep adding to the Climate Pulse knowledge
store after the product is shut down.

### Operating Model

The ongoing system should live in the private `climatepulse-knowledge` repo, not
the legacy product app. It should be local-first, append-only where practical,
and easy to pause.

Primary runtime:

- Local cron on this machine, calling deterministic scripts plus a Climate Pulse
  skill for curation and summarization.

Optional runtime:

- Codex app standalone automation using `$climatepulse` when the local machine
  and Codex app are running.

Cloud alternative:

- GitHub Actions or a small VPS cron for predictable unattended scheduling.

Codex Cloud should be treated as useful for agent tasks and repo work, not as
the primary persistent database or scheduler.

### Climate Pulse Skill

The skill should define the repeatable knowledge-update workflow:

- discover new relevant sources
- pull source text or metadata
- classify relevance
- extract entities, sectors, jurisdictions, and signal types
- summarize and cite source material
- propose additions to the local knowledge store
- write append-only JSONL staging files
- optionally embed accepted text into local pgvector
- produce a run report with counts, skipped items, and review questions

The skill should avoid uncontrolled writes. It should stage candidate additions
for review unless the source is explicitly allowlisted.

### Scheduled Workflow

Recommended cadence:

- Daily or twice-weekly source discovery and staging.
- Weekly human review of staged additions.
- Weekly or monthly embedding/import into local pgvector.
- Monthly archive manifest and backup.

Recommended local cron shape:

```text
0 7 * * 1,4  cd /path/to/climatepulse-knowledge && ./scripts/run-knowledge-update.sh
```

The shell script should call deterministic fetch/import checks first, then invoke
Codex or another agent only for the parts that need judgment.

### Acceptance Criteria

- `climatepulse-knowledge` has a documented skill and runbook.
- Local DB import and query scripts work.
- A staged update run can add candidate knowledge without touching production.
- Cron or automation runs produce a clear report.
- Secrets are not committed.
- The workflow can run with no dependency on the legacy Climate Pulse app.

### Estimated GPT-5.5 Agent Time

- Fast path: 4-8 hours for repo scaffold, skill, scripts, and one dry run.
- Normal path: 8-16 hours for robust staging, review flow, embeddings, and cron.

## Overall Agent-Time Estimate

| Phase | Fast Path | Normal Path |
|---|---:|---:|
| Phase 1 - Landing and API shutdown | 3-6h | 6-10h |
| Phase 2 - Contacts and local DB archive | 6-10h | 10-18h |
| Phase 3 - Continued knowledge skill workflow | 4-8h | 8-16h |
| Total | 13-24h | 24-44h |

The elapsed calendar time is likely 2-5 days because human approvals, vendor
console work, database transfer time, and restore verification add waiting time.

## Human Approval Gates

1. Approve holding page copy and capture mechanism.
2. Approve route/API shutdown behavior before deployment.
3. Approve contact export handling and outreach CSV fields.
4. Confirm full backup exists before deleting or downgrading production services.
5. Approve the knowledge repo location and storage policy.
6. Approve the scheduled update cadence and source allowlist.

## Key Risks

- Production database or blob export may be larger than expected.
- Supabase Auth export permissions may require owner-level access.
- A root landing page can still accidentally call app data if the cached digest
  path is not fully removed.
- Email capture can become a hidden dependency if it uses the old app database.
- Raw exports may contain PII or copyrighted source text and must stay private.
- Automated knowledge updates can accumulate low-quality data without a staging
  and review loop.

## Recommended Default Path

1. First, ship the static holding page and disable crons.
2. Second, export contacts and create a verified local pgvector archive.
3. Third, build the `climatepulse-knowledge` repo and Climate Pulse skill.
4. Only after restore verification, downgrade or delete production services.
