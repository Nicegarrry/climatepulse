# Podcast ("ClimatePulse Daily")

~5 min two-speaker audio episode generated after each daily digest. Reader-facing in the Briefing tab; admin management in the Podcast tab.

## Generation pipeline (step 5)

1. `DigestOutput` + full article text + NEM data → Claude Sonnet → conversational script
2. Gemini TTS (`gemini-2.5-flash-preview-tts`) with multi-speaker → 24 kHz 16-bit mono PCM
3. PCM → 64 kbps mono MP3 via `@breezystack/lamejs` (pure JS, Vercel-safe)
4. Upload to Vercel Blob (`climatepulse-blob`) in prod; local `public/podcasts/` fallback in dev

Size: ~1.6 MB for a 3-min episode (was ~9 MB WAV). First-tap playback starts instantly over cellular.

Code:
- `src/lib/podcast/script-generator.ts` — Sonnet prompt + two-speaker script
- `src/lib/podcast/tts-synthesizer.ts` — Gemini TTS + PCM→MP3 encode
- `src/lib/podcast/storage.ts` — Blob / local-fs branching on `BLOB_READ_WRITE_TOKEN`

Local generation: `npx tsx scripts/generate-podcast.ts [date]` (bypasses HTTP timeout issues).

## Voices + script style

- **Sarah** (host) — Aoede voice, feminine, qualitative, big-picture, sceptical
- **James** (analyst) — Charon voice, masculine, numbers/data, precise, also sceptical
- Australian accents via director's notes in the prompt
- Openly a ClimatePulse product ("our analysis flagged…") — not pretending to randomly find articles
- Focus: climate and energy implications (emissions, grid, renewables, storage, transition speed) — NOT policy process or corporate governance
- Be critical of corporate announcements and policy claims — no press-release framing
- NEM check-in every episode with real OpenElectricity data (renewable %, state-level spot prices)
- Full article text passed to the script generator, not just headlines
- Target ~5 min / 750–850 words; pacing brisk (~10% faster than default); vary tempo; occasional "look," "yeah," "I mean" for naturalness

## Archetype variants (Workstream A — on main)

`/api/podcast/archetypes` runs `src/lib/podcast/workstream-a-archetypes.ts`, generating per-archetype daily variants on top of the global episode:

- `commercial | academic | public | general`
- Stored with `tier='daily'` + `archetype='…'`
- Keyed by expression index `idx_podcast_episodes_variant_uniq(tier, briefing_date, COALESCE(archetype,''), COALESCE(theme_slug,''), COALESCE(flagship_episode_id,''), COALESCE(user_id,''))`
- Framing from `ARCHETYPE_FRAMINGS` in `src/lib/podcast/archetypes.ts` (role-lens → archetype mapping), injected into the `DigestOutput` narrative before the existing Claude script generator runs

Themed deep-dives (Workstream B) and flagship auto-link on weekly-digest publish (Workstream C) are on the `podcast` branch, not yet merged.

## RAG entity callbacks

`fetchEntityHistory()` in `script-generator.ts` fetches `getEntityBrief` for up to 8 unique entities across hero stories and injects an `ENTITY HISTORY` block. Claude uses it sparingly for "as we covered on April 12…" references — only when it reframes a story.

## Playback telemetry

`/api/podcast/interact` + `src/lib/podcast/telemetry.ts` persist per-user events into `user_podcast_interactions`:

`play | resume | complete | quit | skip_back | skip_forward` with `position_seconds`.

Player (`src/components/intelligence/podcast-player.tsx`):
- Fires via `fetch(..., { keepalive: true })` with a `pagehide` fallback
- Distinguishes first play from resume via a ref
- Skips emits for mock episodes
- **Skip events come from media-session 15s handlers only — NOT from progress-bar scrubs.** Scrubs fire on every pointermove and would flood the table.

## Schema

`podcast_episodes` columns (extended by `migrate-podcast-evolution.sql`):

- `tier` — `daily | themed | flagship`
- `archetype`, `theme_slug`, `flagship_episode_id`, `user_id` — variant keys
- `character_ids[]`, `music_bed_url`, `mix_manifest JSONB`

Supporting tables: `voice_profiles`, `podcast_characters`, `podcast_formats`, `flagship_episodes`, `themed_schedule`. Verify schema health with `node --env-file=.env.production.local scripts/podcast-evolution-smoke.mjs`.

## Gotchas

- DO NOT re-add `ON CONFLICT (briefing_date, user_id)` to `savePodcastEpisode`. The old unique constraint was dropped by `migrate-podcast-evolution.sql`; the replacement `idx_podcast_episodes_variant_uniq` is an **expression index over `COALESCE(...)` which Postgres won't accept as an `ON CONFLICT` target**. Callers must guard with a `SELECT` before insert (see `/api/podcast/generate` and `step5Podcast`).
- DO NOT fire interact events from progress-bar scrub drags. Only from explicit skip controls.
- If `BLOB_READ_WRITE_TOKEN` disappears from env, prod will hit the local-fs fallback and fail with ENOENT mkdir (Vercel filesystem is read-only outside `/tmp`). Check `vercel env ls | grep BLOB`.
- v1 is global (one episode for all users). Per-user custom podcasts are deferred to a premium tier.
