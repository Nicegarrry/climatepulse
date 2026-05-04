# Database

PostgreSQL via the `pg` driver (no ORM). Prod is Supabase (`sixyxxuvplvpjcnkthed`); local dev is Docker Compose. The migration SQL is the single source of truth for schema — these docs only group tables by purpose.

## Table groupings

### Core ingestion
- `sources` — source health tracking (RSS / scrape / API)
- `raw_articles` — ingested items (title, snippet, URL, `title_hash` SHA-1 for cross-source soft dedup, deduped by URL uniqueness)
- `full_text_articles` — extracted article content (cheerio)
- `categorised_articles` — legacy 20-category classification (DO NOT DROP — historical record + classic-view fallback)
- `pipeline_runs` — per-run telemetry (`id, status, trigger, steps JSONB, error`)

### Enrichment
- `taxonomy_domains`, `taxonomy_sectors`, `taxonomy_microsectors`, `taxonomy_tags`
- `entities` — registry with `canonical_name`, `aliases[]`, pg_trgm fuzzy matching
- `enriched_articles` — `microsector_ids[]`, `signal_type`, `sentiment`, `jurisdictions[]`, `raw_entities`, `significance_composite`, `contradicts_prior`, `contradicted_source_ids[]`, `pipeline_version`
- `article_entities` — join table
- `transmission_channels` — hand-authored causal links between domains
- `enrichment_runs` — cost + performance
- `category_migration_map` — legacy 20 categories → microsector slugs

### RAG
- `content_embeddings` (pgvector, HNSW) — see [`rag.md`](rag.md)

### Weekly Pulse
- `weekly_reports` — auto-generated intelligence reports
- `weekly_digests` — human-curated editorial digests

### Podcast
- `podcast_episodes` — multi-variant keyed by expression index `idx_podcast_episodes_variant_uniq(tier, briefing_date, COALESCE(archetype,''), COALESCE(theme_slug,''), COALESCE(flagship_episode_id,''), COALESCE(user_id,''))`. See [`../features/podcast.md`](../features/podcast.md) for columns
- `voice_profiles` — TTS voice registry decoupling provider voice IDs from characters
- `podcast_characters` — canonical cast bios, FK to `voice_profiles`
- `podcast_formats` — flagship Main Piece format registry (`dinner_table`, `fireside`, …)
- `flagship_episodes` — backlog → published pipeline
- `themed_schedule` — weekly deep-dive cadence
- `user_podcast_interactions` — append-only playback telemetry

### Newsroom
- `newsroom_items` — lightly-classified wire items (FK to `raw_articles`, `primary_domain`, `urgency`, `teaser`, `duplicate_of_id`, `editor_override JSONB`)
- `user_saved_articles` — user archive (FK raw + nullable FK newsroom; unique on `(user_id, raw_article_id)`; GIN index on `note`)
- `user_newsroom_interactions` — append-only log (`read | expand | thumbs_up | thumbs_down | save | unsave`)
- `user_push_subscriptions` — `failure_count` tombstones at 5
- `newsroom_push_log` — audit of every urgency-5 dispatch attempt
- `newsroom_runs` — cost + duration telemetry

### Editor
- `editor_assignments` — guest editor week-based access
- `share_clicks` — share-link click tracking

### Indicators
- `indicators` — catalogue of tracked quantitative climate/energy indicators (slug, sector, geography, unit, value_type, direction_good, status); `current_value`/`prior_value`/`last_updated_at` are denormalised caches kept in sync by `trg_indicator_values_update_cache`
- `indicator_values` — append-only history; provenance enforced at DB level via `indicator_values_provenance_check` (article rows require `source_article_id` + `evidence_quote`; scraper rows require `source_scraper`)
- `indicator_review_queue` — uncertain detections (confidence 0.6–0.85 or unit/geo mismatch) awaiting editor approval; mirrors the `concept_card_candidates` review pattern
- `scraper_runs` — telemetry for direct-scraper indicator updates (bypass path); one row per scraper run, mirrors `pipeline_runs` shape

## Migrations (`scripts/`)

| File | Purpose |
|---|---|
| `migrate.sql` | Phase 1 core schema |
| `migrate-enrichment.sql` | Enrichment tables + enums + extensions |
| `migrate-two-stage.sql` | Two-stage pipeline columns + indexes |
| `migrate-newsroom.sql` | Newsroom tables, `title_hash`, notification_prefs |
| `migrate-intelligence.sql` | pgvector + `content_embeddings` + HNSW + 10 filter indexes |
| `migrate-contradicts-prior.sql` | `contradicts_prior` + `contradicted_source_ids` on `enriched_articles` |
| `migrate-podcast.sql` + `migrate-podcast-evolution.sql` | Podcast episodes + voices/characters/formats/flagship/themed/variants/interactions |
| `migrate-weekly-digest.sql` | `weekly_reports` + `weekly_digests` |
| `migrate-markets.sql` | Markets tables |
| `migrate-graph-rag.sql` + `migrate-graph-rag-vocab-v2.sql` | Graph-RAG entity relation schema |
| `migrations/indicators/001-indicators.sql` + `002-seed-catalogue.sql` + `003-scrapers.sql` | Indicators system: catalogue, append-only history with DB-enforced provenance, review queue, scraper telemetry. Apply via `pnpm tsx scripts/apply-indicators-migration.mjs` |

## Seed + apply wrappers

- `scripts/seed-taxonomy.sql`, `scripts/seed-sources.sql`, `scripts/seed-podcast.sql`, `scripts/seed-accounts.sql`
- Per-migration apply wrappers: `scripts/apply-<name>-migration.mjs` (they use `pg` over `DATABASE_URL` — do not use the Supabase MCP here)

## Working with the schema

**Use `pg` over `DATABASE_URL`, not the Supabase MCP.** The MCP is bound to the coffeeclub project in this workspace; calling it from climatepulse will succeed but hit the wrong database (the tell: `enriched_articles does not exist`).

Template for ad-hoc SQL: copy `scripts/apply-intelligence-migration.mjs` — it handles pulling the env, opening a pool, running the file, and closing cleanly.

`supabase` CLI can be relinked (`supabase link --project-ref sixyxxuvplvpjcnkthed`) but only has `db push` (file-in-migrations-dir) and `db reset` — no execute-file verb, so `pg`/Node is the pragmatic path.

## Schema gotchas

- **`user_id` columns that join to users are `TEXT`**, not UUID, because they match `user_profiles.id`. Every new table joining the user must use TEXT.
- **No volatile functions in partial-index predicates.** Postgres requires IMMUTABLE. `NOW()` in a `WHERE` predicate will fail (we hit this in `migrate-newsroom.sql` and fell back to `WHERE title_hash IS NOT NULL`).
- **`podcast_episodes` has no simple unique constraint.** Uniqueness is enforced by `idx_podcast_episodes_variant_uniq`, an expression index over `COALESCE(...)` which Postgres **won't accept as an `ON CONFLICT` target**. Callers must guard with a `SELECT` before insert (see `/api/podcast/generate` and `step5Podcast`).
