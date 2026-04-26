# Cron Schedule

All times UTC. Sydney offset: 05:00 AEST = 19:00 UTC (AEDT is +11, so summer schedules run an hour earlier local).

## Daily pipeline (19:00 UTC block)

5 dedicated routes, staggered. Each is a 3-line wrapper around `handleStepCron(req, step)` in `src/lib/pipeline/cron-handler.ts`, delegating to `runPipeline({ trigger, singleStep })`.

| Time | Route | `maxDuration` | Notes |
|---|---|---|---|
| `0 19 * * *`  | `/api/pipeline/ingest`   | 300s | RSS + scrape + 2 APIs in parallel |
| `5 19 * * *`  | `/api/pipeline/fulltext` | 300s | 3-min internal budget |
| `10 19 * * *` | `/api/pipeline/enrich`   | **800s** | 12-min internal budget leaves headroom for the active Gemini batch |
| `22 19 * * *` | `/api/pipeline/detect-indicators` | 300s | LLM scan of last-24h enriched articles for indicator value updates; gated to live (≥0.85) vs review queue |
| `25 19 * * *` | `/api/pipeline/digest`   | 300s | Per-user Sonnet calls, direct function invocation (no self-fetch) |
| `40 19 * * *` | `/api/pipeline/podcast`  | 300s | Sonnet script + Gemini TTS → Vercel Blob |

Admin-facing `/api/pipeline/run` remains for full-pipeline + on-demand single-step runs (separate from the crons).

## Newsroom

Every 30 min during Sydney business hours (Mon–Fri 06:00–20:00 local). Two UTC crons cover AEST and AEDT; runtime `Intl`-based guard in `src/lib/newsroom/business-hours.ts` gates the actual work.

Route: `/api/newsroom/ingest` (GET or POST, requires `CRON_SECRET`).

## Weekly

- **Fri 15:00 AEST** — auto-generate intelligence report
- **Sat 06:00 AEST** — editor briefing pack into `weekly_reports`

## Markets

Dedicated cron for prices + announcements refresh (landed in commit `bc55d9f`). Check `vercel.json` for the exact schedule.

## Manual trigger recipe

```
curl -H "Authorization: Bearer $CRON_SECRET" \
     -X POST https://climatepulse-iota.vercel.app/api/pipeline/<step>
```

…where `<step>` is `ingest`, `fulltext`, `enrich`, `detect-indicators`, `digest`, or `podcast`.

## Hard rules

- **Never** schedule a single cron to run all pipeline steps sequentially. Enrichment reliably exceeds Vercel Pro's 800s cap and silently kills digest + podcast. This is a confirmed `FUNCTION_INVOCATION_TIMEOUT` from April 2026.
- When adding a new pipeline step: create a dedicated route, stagger the cron, set `maxDuration`. Never chain via internal fetch.
- Check the Vercel Pro cron-count ceiling before adding a new schedule (current count is at or near the limit — confirm in `vercel.json`).
