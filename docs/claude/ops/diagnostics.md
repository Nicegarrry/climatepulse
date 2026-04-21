# Diagnostics

Runbook for investigating pipeline + feature issues. All scripts live in `scripts/` and connect via `DATABASE_URL` — pull env with `vercel env pull .env.vercel --environment=production` if diagnosing prod.

## Pipeline health

| Script | Purpose |
|---|---|
| `node scripts/pipeline-status.mjs` | Quick diagnostic: content freshness + recent `pipeline_runs` |
| `node scripts/pipeline-probe.mjs` | Deeper probe: recent articles + source health |
| `node scripts/pipeline-cleanup.mjs` | Marks stale "running" `pipeline_runs` rows as failed (after 3 min) |

## RAG health

| Script | Purpose |
|---|---|
| `node scripts/rag-status.mjs` | Confirms pgvector installed + `content_embeddings` table state |
| `node scripts/rag-verify.mjs` | Coverage report + sample HNSW nearest-neighbour query |
| `npx tsx scripts/backfill-embeddings.ts` | Re-embed anything missing; idempotent |
| `node scripts/backfill-contradicts-prior.ts` | Backfill the `contradicts_prior` flag |

## Podcast

| Script | Purpose |
|---|---|
| `npx tsx scripts/generate-podcast.ts [date]` | Standalone podcast generation (bypasses HTTP timeout issues) |
| `node scripts/podcast-backlog-inspect.mjs` | Survey podcast backlog before purge |
| `node scripts/podcast-backlog-purge.mjs` | Delete unprocessed >3d-old podcast items |
| `node --env-file=.env.production.local scripts/podcast-evolution-smoke.mjs` | Schema + seed + archive-query smoke test |

## Common failure modes

### "Digest didn't run / podcast missing"
Check if enrichment timed out. `pipeline-status.mjs` shows the `steps` JSONB for the last run. If `enrich` is `running` past 800s, it hit the Vercel ceiling. Run `pipeline-cleanup.mjs` to release the run lock, then trigger the remaining steps manually (see [`crons.md`](crons.md) for the curl recipe).

### "Fulltext success rate is low (e.g. 7/80)"
Check source mix. Podcast RSS feeds link at audio files, not HTML, so cheerio can't extract. The 91% fail rate observed on 2026-04-17 was dominated by first-time ingestion of Energy Insiders, Cleaning Up, Zero, etc. — entirely expected. Enrichment still works on snippet-only items.

### "Supabase MCP says a table doesn't exist"
You're hitting the wrong database. The `mcp__supabase__*` tools in this workspace are bound to the `coffeeclub` project, not climatepulse. Use `pg` over `DATABASE_URL` instead (template: `scripts/apply-intelligence-migration.mjs`).

### "Blob upload fails with ENOENT"
`BLOB_READ_WRITE_TOKEN` is missing from the env. Check `vercel env ls | grep BLOB`. The local-fs fallback in `src/lib/podcast/storage.ts` will always fail on Vercel because `/var/task` is read-only outside `/tmp`.

### "21% of articles classified as 'uncertain'"
Domain slug mismatch between prompt templates and DB. The Stage 1 classifier validates Gemini's returned slug against `getDomainSlugs()` and overwrites mismatches to `uncertain`. Check that `prompts/definitions/domains.md`, `stage1-system.md`, `stage2-system.md`, `calibration-examples.md`, and the `taxonomy_domains` seed all agree.

### "Pipeline ran but produced no briefing for a user"
Check `user_profiles` — auth is real (Supabase magic links), not hardcoded. Also check the per-user personalisation boost output; if every story floors at `BOOST_FLOOR=-10` the selector may return nothing.

### "Podcast insert silently duplicates"
`podcast_episodes` has no simple unique constraint — uniqueness is an expression index (`idx_podcast_episodes_variant_uniq`) that Postgres won't accept as an `ON CONFLICT` target. Callers must `SELECT` before insert. If you're writing a new caller, copy the pattern from `/api/podcast/generate`.
