# Climate Pulse Decommission Implementation Plan

> **For agentic workers:** Use GPT-5.5 for all implementation, review, and
> verification tasks. Default to `reasoning.effort=medium`; use `high` only for
> archive design, restore debugging, or safety-critical data handling.

**Spec:** `docs/superpowers/specs/2026-07-07-climatepulse-decommission-spec.md`

**Goal:** Replace Climate Pulse with a minimal holding page, stop recurring API
usage, preserve contacts and the pgvector knowledge store, then move future
knowledge updates into a private local-first knowledge repo driven by a Climate
Pulse skill.

**Important:** This plan intentionally separates product shutdown from archive
verification. Do not delete, downgrade, or revoke production services until the
backup and restore checkpoints pass.

---

## Phase 1 - Replace Landing Page And Stop API Usage

**Agent-time estimate:** 3-10 hours.

### Task 1: Confirm Shutdown Mode

- [ ] Confirm the public copy:
  - "Thanks for the support. We will be in touch about a renewed Climate Pulse
    experience and our other new products."
- [ ] Confirm email capture option:
  - temporary external form endpoint
  - simple inbox/`mailto:` fallback
  - minimal backend table after Phase 2
- [ ] Confirm whether former app routes should return:
  - `404`
  - `410 Gone`
  - redirect to `/`
  - maintenance page
- [ ] Confirm deployment target:
  - existing Vercel project
  - separate static project
  - DNS cutover later

### Task 2: Inspect Current Landing Dependencies

Files to inspect:

- `src/app/page.tsx`
- `src/components/landing/landing.tsx`
- `src/components/landing/landing.css`
- `src/app/layout.tsx`
- `public/logo.svg`
- `vercel.json`

Checklist:

- [ ] Identify all DB calls needed only for the old landing page.
- [ ] Identify root redirect behavior based on `cp_returning`.
- [ ] Identify imports that pull in digest, auth, analytics, or AI dependencies.
- [ ] Identify CSS/assets that can be reused safely.

Expected finding:

- `src/app/page.tsx` should stop importing `getPublicDigest`,
  `unstable_cache`, `cookies`, and `redirect`.

### Task 3: Build Minimal Holding Page

Files likely modified:

- `src/app/page.tsx`
- `src/app/globals.css` or `src/components/landing/landing.css`
- optional new component under `src/components/landing/`

Implementation requirements:

- [ ] Render logo.
- [ ] Render shutdown copy.
- [ ] Render email field.
- [ ] Render submit button and success/failure state.
- [ ] Do not require JavaScript for the core message.
- [ ] Do not call Supabase, pg, Gemini, OpenAI, EventRegistry, NewsAPI, market
  APIs, Vercel Blob, or internal digest routes to render `/`.
- [ ] Remove returning-user redirect from root.
- [ ] Update metadata to match holding page.

Verification:

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start local server and verify `/`.
- [ ] Inspect server logs to confirm no DB/API work occurs on page load.
- [ ] Use browser/network inspection if available.

### Task 4: Disable Scheduled Work

Files likely modified:

- `vercel.json`
- `docs/claude/ops/crons.md`

Implementation requirements:

- [ ] Remove or empty all `crons` entries in `vercel.json`.
- [ ] Document that production cron execution is intentionally disabled.
- [ ] Keep route code in place until archive work finishes unless explicitly
  approved to remove it.

Verification:

- [ ] `npm run build` still passes.
- [ ] Vercel dashboard shows no active crons after deployment.
- [ ] No scheduled execution appears in logs after the next expected cron window.

### Task 5: Guard Costly App/API Routes

Decision point:

- [ ] Choose between middleware maintenance mode, route-level guard, or Vercel
  routing config.

Recommended default:

- Add a simple maintenance guard for non-root app/API surfaces, while allowing
  static assets and the holding page.

Guarded surfaces:

- `/api/pipeline/*`
- `/api/newsroom/*`
- `/api/markets/*`
- `/api/scrapers/*`
- `/api/podcast/*`
- `/api/digest/*`
- `/api/weekly/*`
- authenticated app routes under `/(app)`

Verification:

- [ ] Manual requests to former costly routes cannot trigger work.
- [ ] Holding page and assets still load.
- [ ] Share routes are either intentionally kept or intentionally disabled.

### Task 6: Deploy Phase 1

- [ ] Commit Phase 1 changes.
- [ ] Deploy to preview.
- [ ] Verify preview root page.
- [ ] Verify no cron config in preview build output.
- [ ] Promote to production.
- [ ] Monitor logs for at least one prior cron window.
- [ ] Record deployment URL, commit SHA, and verification notes.

Human gate:

- [ ] User approves the live holding page and API shutdown behavior.

---

## Phase 2 - Contact Export And Local Knowledge Database

**Agent-time estimate:** 6-18 hours, excluding large transfer time.

### Task 1: Prepare Export Workspace

Create outside normal git history:

```text
~/ClimatePulseArchive/
  contacts/
  database/
  portable/
  blobs/
  manifests/
  logs/
```

Checklist:

- [ ] Confirm local archive path.
- [ ] Confirm encryption or backup destination if needed.
- [ ] Confirm production database URL access.
- [ ] Confirm Supabase Auth export access.
- [ ] Confirm Vercel Blob access if blob assets are in scope.
- [ ] Create `.gitignore` protections if any scripts live in repo.

### Task 2: Export Contacts

Create an export script, preferably under repo scripts but writing output outside
the repo:

```text
scripts/archive/export-contacts.ts
```

Required sources:

- `auth.users`
- `public.user_profiles`
- `public.knowledge_surface_members`

Export files:

- private CSV: `contacts/climatepulse-contacts-YYYY-MM-DD.csv`
- private JSONL: `contacts/climatepulse-contacts-YYYY-MM-DD.jsonl`
- commit-safe manifest: `manifests/contact-export-YYYY-MM-DD.json`

Fields:

- [ ] name
- [ ] email
- [ ] source
- [ ] signed_up_at
- [ ] onboarded_at
- [ ] role_lens
- [ ] primary_sectors
- [ ] jurisdictions
- [ ] tier
- [ ] notification preferences

Verification:

- [ ] Count rows by source.
- [ ] Deduplicate by lowercased email.
- [ ] Exclude obvious test/internal users.
- [ ] Spot check 10 rows.
- [ ] Store private CSV outside git.

Human gate:

- [ ] User approves final outreach CSV.

### Task 3: Full Database Dump

Required outputs:

- [ ] custom-format full dump:
  `database/climatepulse-full-YYYY-MM-DD.dump`
- [ ] schema-only SQL:
  `database/climatepulse-schema-YYYY-MM-DD.sql`
- [ ] globals/roles notes if needed
- [ ] dump log
- [ ] checksum file

Recommended commands, adjusted for actual connection:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl \
  --file "$ARCHIVE/database/climatepulse-full-YYYY-MM-DD.dump"

pg_dump "$DATABASE_URL" --schema-only --no-owner --no-acl \
  --file "$ARCHIVE/database/climatepulse-schema-YYYY-MM-DD.sql"

shasum -a 256 "$ARCHIVE/database/"* > "$ARCHIVE/manifests/checksums-YYYY-MM-DD.txt"
```

Verification:

- [ ] Dump completes without fatal errors.
- [ ] Checksum file generated.
- [ ] Schema file contains `CREATE EXTENSION IF NOT EXISTS vector` or equivalent
  pgvector requirement is documented.

### Task 4: Portable Knowledge Exports

Create export scripts under:

```text
scripts/archive/export-knowledge.ts
scripts/archive/export-table.ts
scripts/archive/export-content-embeddings.ts
```

Required portable exports:

- [ ] `content_embeddings.jsonl` with `embedding::text`
- [ ] `raw_articles.jsonl`
- [ ] `full_text_articles.jsonl`
- [ ] `enriched_articles.jsonl`
- [ ] `entities.jsonl`
- [ ] `article_entities.jsonl`
- [ ] `taxonomy_*.jsonl`
- [ ] `storylines.jsonl`
- [ ] `storyline_articles.jsonl`
- [ ] `daily_briefings.jsonl`
- [ ] `weekly_reports.jsonl`
- [ ] `weekly_digests.jsonl`
- [ ] `podcast_episodes.jsonl`
- [ ] `library_documents.jsonl`
- [ ] `knowledge_surfaces*.jsonl`
- [ ] `sources.jsonl`
- [ ] `enrichment_runs.jsonl`

Manifest:

- [ ] row counts by table
- [ ] export timestamps
- [ ] checksums by file
- [ ] embedding model: `gemini-embedding-001`
- [ ] embedding dimensions: `768`
- [ ] database source identifier
- [ ] script commit SHA

Verification:

- [ ] Parse every JSONL file.
- [ ] Confirm `content_embeddings` row count matches DB.
- [ ] Confirm vector dimensions parse to 768 for sampled rows.
- [ ] Confirm source table rows exist for sampled embedding source IDs.

### Task 5: Blob Archive Inventory

Source references:

- `library_documents.blob_url`
- `library_documents.blob_path`
- `knowledge_surface_content.blob_url`
- `knowledge_surface_content.blob_path`
- `podcast_episodes.audio_url`

Outputs:

- [ ] `manifests/blob-inventory-YYYY-MM-DD.jsonl`
- [ ] downloaded blob mirror under `blobs/`
- [ ] `manifests/blob-checksums-YYYY-MM-DD.txt`

Verification:

- [ ] Every referenced blob has status: downloaded, unavailable, skipped, or not
  required.
- [ ] Downloaded files have checksums.
- [ ] Missing blobs are listed explicitly.

### Task 6: Create Local Knowledge Repo

Recommended path:

```text
/Users/sa/code/climatepulse-knowledge
```

Initial structure:

```text
README.md
docker-compose.yml
.gitignore
schema/
migrations/
scripts/export/
scripts/import/
scripts/verify/
exports/manifests/
exports/samples/
knowledge/raw/
knowledge/curated/
knowledge/sources/
skills/climatepulse/SKILL.md
```

Implementation requirements:

- [ ] Docker Compose starts Postgres with pgvector.
- [ ] Import script can restore the custom dump or import portable JSONL.
- [ ] Verify script prints table counts and vector counts.
- [ ] README documents restore, query, and backup workflow.
- [ ] `.gitignore` blocks dumps, PII, full JSONL exports, blobs, and secrets.

Verification:

- [ ] Local DB starts.
- [ ] Schema restores.
- [ ] Full dump restores, or portable import works.
- [ ] Sample vector similarity query works.
- [ ] Verification report saved to manifest.

Human gate:

- [ ] User confirms archive is restorable before any production service deletion,
  downgrade, or key revocation.

---

## Phase 3 - Regular Continued Knowledge Addition Using Skills

**Agent-time estimate:** 4-16 hours.

### Task 1: Define Knowledge Update Policy

Decisions:

- [ ] Source allowlist.
- [ ] Source denylist.
- [ ] Daily vs twice-weekly vs weekly cadence.
- [ ] Staging-only vs auto-import for trusted sources.
- [ ] Human review threshold.
- [ ] Whether embeddings are generated every run or batched weekly/monthly.

Default policy:

- Stage all new items.
- Auto-import only manually curated notes or explicitly allowlisted public
  sources.
- Generate embeddings after human review.

### Task 2: Write `climatepulse` Skill

File:

```text
skills/climatepulse/SKILL.md
```

Skill responsibilities:

- [ ] Discover or accept source URLs/files.
- [ ] Extract source text or metadata.
- [ ] Classify relevance to Climate Pulse.
- [ ] Extract entities, sectors, jurisdictions, signal types, and dates.
- [ ] Summarize with citations.
- [ ] Stage candidate additions as JSONL.
- [ ] Avoid direct DB writes unless explicitly invoked in import mode.
- [ ] Produce a run report.

Skill modes:

- [ ] `discover`
- [ ] `stage`
- [ ] `review`
- [ ] `import`
- [ ] `verify`
- [ ] `report`

### Task 3: Add Deterministic Scripts

Scripts:

```text
scripts/run-knowledge-update.sh
scripts/discover-sources.ts
scripts/stage-item.ts
scripts/import-reviewed.ts
scripts/embed-reviewed.ts
scripts/verify-db.ts
scripts/write-run-report.ts
```

Requirements:

- [ ] Scripts are idempotent.
- [ ] Scripts write to dated run directories.
- [ ] Scripts never commit outputs automatically.
- [ ] Scripts fail closed if secrets are missing.
- [ ] Scripts produce machine-readable reports.

Run directory shape:

```text
runs/YYYY-MM-DD/
  inputs.jsonl
  candidates.jsonl
  reviewed.jsonl
  imported.jsonl
  skipped.jsonl
  report.md
  manifest.json
```

### Task 4: Wire Local Cron

Recommended cron:

```text
0 7 * * 1,4 cd /Users/sa/code/climatepulse-knowledge && ./scripts/run-knowledge-update.sh
```

Checklist:

- [ ] Use absolute paths.
- [ ] Load secrets from a local env file outside git.
- [ ] Append logs to a local log file.
- [ ] Send or write a run report.
- [ ] Do not require the legacy Climate Pulse app.

Verification:

- [ ] Run once manually.
- [ ] Confirm staged candidates.
- [ ] Confirm no DB write unless import mode is enabled.
- [ ] Confirm report is readable.
- [ ] Confirm cron environment has required PATH and env vars.

### Task 5: Optional Codex Automation

If using Codex app automation:

- [ ] Create standalone project automation against `climatepulse-knowledge`.
- [ ] Prompt explicitly invokes `$climatepulse`.
- [ ] Automation runs in workspace-write mode.
- [ ] Automation uses a dedicated worktree if it can edit files.
- [ ] First three runs require manual review.

If using GitHub Actions instead:

- [ ] Store secrets in GitHub Actions secrets.
- [ ] Do not expose API keys to untrusted repo-controlled build steps.
- [ ] Upload run reports as artifacts.
- [ ] Keep database writes behind explicit approval or trusted branch rules.

### Task 6: Monthly Archive Maintenance

- [ ] Generate monthly manifest.
- [ ] Dump local DB.
- [ ] Checksum dumps and run directories.
- [ ] Back up to chosen private destination.
- [ ] Prune temporary files.
- [ ] Review source quality metrics.

Human gate:

- [ ] User approves cadence, source policy, and first successful staged run.

---

## Final Production Shutdown Checklist

Run only after Phase 2 restore is verified.

- [ ] Confirm contact CSV is complete.
- [ ] Confirm full DB dump and local restore.
- [ ] Confirm blob archive status.
- [ ] Confirm holding page is live.
- [ ] Confirm no active crons.
- [ ] Revoke or remove Vercel env vars for:
  - Gemini/OpenAI keys
  - News APIs
  - market APIs
  - web push keys
  - cron secret
  - old Supabase service role from active landing deployment
- [ ] Downgrade, pause, or delete Supabase only after final approval.
- [ ] Downgrade or delete Vercel Blob only after blob archive approval.
- [ ] Keep domain/DNS and contact email active.
- [ ] Tag final repository state.
- [ ] Record final shutdown notes in the archive manifest.

## Suggested Commit Sequence

1. `docs(shutdown): add decommission spec and implementation plan`
2. `feat(shutdown): replace landing page with holding page`
3. `chore(shutdown): disable production crons`
4. `chore(shutdown): guard costly app routes`
5. `chore(archive): add contact export script`
6. `chore(archive): add knowledge export scripts`
7. `docs(archive): add restore and verification runbook`
8. Separate repo: `chore: scaffold climatepulse knowledge archive`
9. Separate repo: `feat(skill): add climatepulse knowledge update workflow`

## Definition Of Done

- Public users see only the holding page.
- No scheduled production API usage remains.
- Contacts are exported for personal outreach.
- Knowledge store is archived and restorable locally.
- Future additions happen in `climatepulse-knowledge`, not the legacy app.
- A scheduled skill-driven workflow can stage new knowledge safely.
