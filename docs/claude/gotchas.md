# Gotchas — Mistakes to Avoid

Concentrate surprises here. When you learn something non-obvious, add a bullet (brief; link to the relevant topic file for detail). Scan this list before any non-trivial change.

## Ingestion + enrichment

- DO NOT use NewsAPI.org free tier for production — it blocks server-side calls
- DO NOT widen the `MAX_ARTICLE_AGE_DAYS = 7` RSS cutoff without thinking. Podcast RSS feeds serve their full episode history (400+ each) and will flood enrichment. If you must, add a per-source cap in `pollAllFeeds` instead. See [`features/pipeline.md`](features/pipeline.md).
- Prompt domain slugs MUST match DB `taxonomy_domains.slug` exactly. A `finance-investment` vs `finance` mismatch silently routes 21% of classifications to "uncertain". Check every `prompts/definitions/*.md` + `prompts/stage*.md` + `calibration-examples.md` when editing. See [`architecture/taxonomy.md`](architecture/taxonomy.md).
- Low fulltext success (e.g. 7/80) is usually input mix, not a bug — podcast RSS entries link at audio files, not HTML. See [`ops/diagnostics.md`](ops/diagnostics.md).

## Digest

- DO NOT auto-fire digest generation on the briefing tab for un-onboarded users — `src/components/intelligence/index.tsx` checks `user.onboardedAt` and short-circuits `fetchData()`, rendering an opt-in CTA card instead. If you remove that gate, every cold-start on /launchpad → briefing tab will trigger a per-user Gemini call. See [`features/launchpad.md`](features/launchpad.md).
- DO NOT widen the digest cron user-list query past `WHERE onboarded_at IS NOT NULL AND COALESCE(array_length(primary_sectors, 1), 0) > 0`. Un-onboarded users have no sectors so the digest would just fail per-user, and any new signup burst would balloon the serial loop. See `src/lib/pipeline/steps.ts` step4Digest + [`features/launchpad.md`](features/launchpad.md).
- DO NOT send more than 15 articles to Sonnet regardless of sector count. See [`features/digest.md`](features/digest.md).
- DO NOT `fetch('http://localhost:...')` from inside a serverless function — there's no localhost server in a Vercel invocation. Call shared lib functions directly. Digest used to hit this and 500'd every run.
- `published_at` must be coerced to ISO string before going into the prior-coverage block.

## Podcast

- DO NOT re-add `ON CONFLICT (briefing_date, user_id)` to `savePodcastEpisode`. The unique constraint was dropped by `migrate-podcast-evolution.sql`; replacement `idx_podcast_episodes_variant_uniq` is an expression index over `COALESCE(...)` that Postgres won't accept as an `ON CONFLICT` target. Guard with a `SELECT` before insert. See [`features/podcast.md`](features/podcast.md).
- DO NOT fire interact events from progress-bar scrub drags — only from explicit skip controls. Scrubs flood `user_podcast_interactions`.
- If `BLOB_READ_WRITE_TOKEN` disappears, prod will fail with ENOENT — Vercel `/var/task` is read-only outside `/tmp`. Check `vercel env ls | grep BLOB`.

## Newsroom

- DO NOT push-notify anything under urgency 5 — signal-value + fanout hard-limits to 3/user/hour on top.
- DO NOT add offline-caching logic to `public/sw.js` without coordination — it's deliberately push-only to coexist with any future caching SW.
- DO NOT classify Newsroom items at microsector granularity — Newsroom is domain-only by design. Deep microsector + entity work belongs in the nightly Stage-1/Stage-2 pipeline.
- Newsroom `user_id` columns are **TEXT**, not UUID (they match `user_profiles.id`). Every new table joining the user must use TEXT.

## Pipeline + cron

- DO NOT schedule a single cron to run all pipeline steps sequentially. Enrichment reliably exceeds Vercel Pro's 800s cap and silently kills digest + podcast. Keep steps on their own staggered crons. See [`ops/crons.md`](ops/crons.md).
- Check the Vercel Pro cron-count ceiling before adding a new schedule.

## Schema + Postgres

- DO NOT write `NOW()` or other volatile functions into partial-index predicates — Postgres requires IMMUTABLE predicates. We hit this in `migrate-newsroom.sql` and fell back to `WHERE title_hash IS NOT NULL`.
- DO NOT drop `categorised_articles` — it's the historical record and classic-view fallback.
- DO NOT hardcode taxonomy — it lives in the database, loaded via `taxonomy-cache.ts` (5-min TTL).
- DO NOT rely on the Supabase MCP — it's bound to `coffeeclub`, not climatepulse. For schema work use `pg` over `DATABASE_URL` (template: `scripts/apply-intelligence-migration.mjs`).

## Landing + auth

- DO NOT leak landing-page styles into the authed app — every selector in `src/components/landing/landing.css` is namespaced under `.cp-landing`, including CSS variables. A stray unprefixed rule will override shadcn tokens globally.
- DO NOT remove the `cp_returning` cookie from `/auth/callback` — the landing page's server-side redirect depends on it.
- DO NOT change `public/manifest.json` `start_url` away from `/dashboard` — PWA installers rely on it to skip landing.
- Auth is real: Supabase magic links (`signInWithOtp` in `src/lib/auth-context.tsx`). Server routes gate via `requireAuth()` in `src/lib/supabase/server.ts`. Never reintroduce hardcoded test users.

## Misc

- RSS feeds can change URLs without notice — source health monitoring is built-in.
