# Newsroom (Phase 5)

Live wire-feed complementing the morning briefing. Reader-facing tab.

## Cadence

- Cron runs every 30 min during Sydney business hours (Mon–Fri 06:00–20:00 local)
- Vercel Cron hits `/api/newsroom/ingest` twice in UTC to cover both AEST and AEDT
- Runtime `Intl`-based guard in `src/lib/newsroom/business-hours.ts` gates the actual work

## Ingestion

Parallel sources, all writing into `raw_articles` via the existing `ON CONFLICT (article_url)` dedup:

- RSS
- NewsAPI.org
- NewsAPI.ai
- **Google News RSS search** (keyless) — `src/lib/newsroom/google-news-fetch.ts`

## Cross-source dedup (3 layers)

1. URL uniqueness on `raw_articles.article_url`
2. SHA-1 `title_hash` partial-unique index (blocks repost of the same headline from different outlets)
3. pg_trgm soft-match in `src/lib/newsroom/dedup.ts` sets `duplicate_of_id` without deleting rows

## Classifier

`src/lib/newsroom/classifier.ts`:
- Gemini Flash-lite, batches of 15, concurrency 3
- **Domain-only** classification (one of 12) + urgency 1–5 + ≤160-char teaser
- Prompt: `prompts/newsroom-classify-system.md`
- Response schema enforced via `SchemaType`

Deliberately lighter than nightly Stage-1 enrichment — the same `raw_articles` rows can still be picked up by the full pipeline independently.

**DO NOT classify at microsector granularity in Newsroom.** Deep microsector + entity work happens in the nightly pipeline. Newsroom is domain-only by design.

## Storage

- `newsroom_items` — FK to `raw_articles`, `primary_domain`, `urgency`, `teaser`, `duplicate_of_id`, `editor_override JSONB` (reserved for future editor controls)
- `newsroom_runs` — cost + duration telemetry mirroring `enrichment_runs`

Cost target: <$0.50/week at projected volume (~1¢ per 30-min run).

## UI density

Wire-feed aesthetic (no cards, no shadows, hairline dividers only):
- Crimson Pro 15px headline
- Source Sans 3 11–13px metadata
- Urgency rendered as plum bullets in the right gutter for 4–5, nothing for 1–3
- All 12 domains filterable as small-caps `SectorTag` chips
- Keyboard: `j/k/s/t` for navigate/save/thumbs

Components (`src/components/newsroom/`): `NewsroomTab`, `FeedHeader`, `FeedList`, `FeedRow`, `SectorTag`, `UrgencyGlyph`, `QuickActions`, `PushOptIn`, `SavedBoard`, `SavedClipping`.

## Feedback loop (bumps next morning's briefing)

Wired through `computeBoosts()` (optional `interactions` arg) and `selectBriefingStories()` in `src/lib/personalisation.ts`. Fetched once per digest run via `getInteractionSummary(userId)` in `src/lib/newsroom/interactions.ts`.

| Event | Boost |
|---|---|
| `read` / `expand` | +3 each, capped at +6 |
| `thumbs_up` | +10 |
| `thumbs_down` | −15 |
| `save` | +18 (also inserts into `user_saved_articles`) |
| Entity propagation — engaged | +5 once per story |
| Entity propagation — saved | +9 once per story |

Entity propagation bridges the UUID gap between Newsroom and enriched briefing stories by matching shared entity names.

All clamped by `BOOST_CAP=35 / BOOST_FLOOR=-10`.

## Push notifications (urgency 5 only, opt-in)

- Service worker: `public/sw.js` (**push handler only — no offline caching**, to avoid conflicts with any future caching SW)
- Payload contract: `src/lib/newsroom/types.ts::NewsroomPushPayload`
- Fanout: `src/lib/newsroom/fanout.ts`
  - Filters opted-in subscribers by sector overlap
  - Rate-limits **3 sends/user/hour**
  - Tracks failures in `user_push_subscriptions.failure_count`, tombstones at 5
  - Audits every attempt to `newsroom_push_log` (`sent | rate_limited | failed | expired`)
- Gracefully no-ops if VAPID env vars aren't set

## Saved archive

Dense CSS-grid clippings board on the Profile page (`src/components/newsroom/SavedBoard.tsx`):
- Typographic search
- Sector filter
- `saved_at` cursor pagination
- `user_saved_articles`: FK to `raw_articles`, nullable FK to `newsroom_items`, unique on `(user_id, raw_article_id)`, GIN index on `note` for search

## API surface (`/api/newsroom/`)

| Route | Purpose |
|---|---|
| `ingest` | Cron entry (GET or POST, `CRON_SECRET`) |
| `feed` | Paginated user feed |
| `interact` | `POST {raw_article_id, type}` |
| `save` | POST/DELETE save toggle |
| `saved` | GET user archive |
| `prefs` | PATCH/GET notification prefs |
| `push/subscribe` | POST — persist `PushSubscription` |
| `push/unsubscribe` | POST — remove subscription |

## Gotchas

- Newsroom `user_id` columns are **TEXT**, not UUID (they match `user_profiles.id`). Every new table joining the user must use TEXT.
- DO NOT add offline-caching logic to `public/sw.js` without coordination — it's deliberately push-only.
- DO NOT push-notify anything under urgency 5. Preserves signal value + avoids notification fatigue. The 3/user/hour fanout cap is a second line of defence, not the primary control.
- Partial-unique index on `title_hash` must NOT contain volatile functions in the predicate — Postgres requires IMMUTABLE. We hit this during `migrate-newsroom.sql` and fell back to `WHERE title_hash IS NOT NULL`.
