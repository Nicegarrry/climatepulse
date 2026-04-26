# Plan: Climate & Energy Indicators

## Context

ClimatePulse currently surfaces *narrative* signals — what happened today, framed editorially. We have no persistent quantitative spine: no answer to "is solar still getting cheaper?", "where is the AU grid renewable share trending?", "what's the current ACCU price?". A reader can only infer those from the digest noise.

This feature adds a tracked panel of ~25 quantitative climate/energy indicators that:

1. Persist as time-series in Supabase (catalogue + history rows).
2. Render on a dedicated `/indicators` dashboard tab, grouped by sector with sparklines.
3. Get *passively updated* by the daily pipeline — when an article reports a new value, an LLM detector proposes an update, gated by confidence and routed to either a live append or a human review queue.
4. Get *called out* in the daily digest — count line at the top + per-article badges where the article triggered an update.
5. Have a clear extension point for direct scrapers (AEMO, BNEF, etc.) that bypass article inference.

Hard constraint: **never fabricate numbers.** Every `indicator_values` row must cite either a `source_article_id` + `evidence_quote` or a `source_scraper` identifier.

---

## Data model

Three tables. Lean SQL over JSONB so we can index, append history, and run trend queries cheaply. New migration: `scripts/migrations/indicators/001-indicators.sql` (mirrors the existing `scripts/migrations/learn/` numbered-idempotent style — `IF NOT EXISTS`, `BEGIN/COMMIT`, the shared `update_updated_at_column()` trigger from `010-concept-cards.sql`).

### `indicators` — catalogue (one row per indicator)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `DEFAULT gen_random_uuid()` |
| `slug` | TEXT UNIQUE | e.g. `solar_deployed_cost_au` — stable, used by detector |
| `name` | TEXT | Display name, e.g. "Deployed solar cost (AU)" |
| `description` | TEXT | One-liner, shown on card |
| `sector` | TEXT | Must match a slug in `taxonomy_domains.slug` (12 domains, kebab-case) |
| `geography` | TEXT | Free-text (e.g. `AU`, `Global`, `EU`, `US`, `China`, `India`, `NSW`). No CHECK — detector can propose any region. Risk of drift mitigated by a small `KNOWN_GEOGRAPHIES` constant in `src/lib/indicators/types.ts` used for filter dropdown options + lint of new catalogue rows. |
| `unit` | TEXT | `$/W`, `$/kWh`, `%`, `Mt`, `GW`, `ppm`, etc. |
| `value_type` | TEXT | `currency` / `percent` / `count` / `physical` — drives formatting |
| `direction_good` | TEXT | `down` / `up` / `neutral` — for sparkline tint (cheaper solar = green) |
| `status` | TEXT | `live` / `review` / `dormant` (default `live`) |
| `current_value` | NUMERIC | Denormalised cache of latest `indicator_values.value` |
| `prior_value` | NUMERIC | Denormalised cache of penultimate value |
| `last_updated_at` | TIMESTAMPTZ | Cache of latest `indicator_values.observed_at` |
| `last_source_article_id` | UUID | FK to `raw_articles(id)`, nullable |
| `last_source_url` | TEXT | Convenience copy |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard, with shared trigger |

Indices: `(sector)`, `(status)`, `(slug)` unique.

### `indicator_values` — history (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `indicator_id` | UUID FK | `REFERENCES indicators(id) ON DELETE CASCADE` |
| `value` | NUMERIC NOT NULL | |
| `unit` | TEXT NOT NULL | Snapshotted in case the indicator's unit changes |
| `geography` | TEXT NOT NULL | Snapshotted |
| `observed_at` | TIMESTAMPTZ NOT NULL | When the *real-world* observation was made (article publish date or scraper poll time) |
| `source_type` | TEXT NOT NULL | `article` / `scraper` / `manual` |
| `source_article_id` | UUID | FK `raw_articles(id)`, nullable when `source_type='scraper'` |
| `source_url` | TEXT | |
| `source_scraper` | TEXT | e.g. `aemo_grid_mix`, nullable when `source_type='article'` |
| `evidence_quote` | TEXT | Required when `source_type='article'` — the exact sentence the LLM extracted |
| `confidence` | NUMERIC | 0–1, from detector; `1.0` for scrapers; `1.0` for manual |
| `created_at` | TIMESTAMPTZ | |

Indices: `(indicator_id, observed_at DESC)` for sparkline queries; `(source_article_id)` for digest "did this article move an indicator?" lookup.

CHECK constraint: `(source_type = 'article' AND source_article_id IS NOT NULL AND evidence_quote IS NOT NULL) OR (source_type = 'scraper' AND source_scraper IS NOT NULL) OR (source_type = 'manual')`.

A trigger on insert updates `indicators.current_value`, `prior_value`, `last_updated_at`, `last_source_article_id`, `last_source_url`.

### `indicator_review_queue` — uncertain detections

Mirrors the existing `concept_card_candidates` pattern at `scripts/migrations/learn/010-concept-cards.sql` (status enum + `reviewed_by` / `reviewed_at` / `review_notes`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `indicator_id` | UUID FK | nullable — detector might propose a *new* indicator |
| `proposed_indicator_slug` | TEXT | for novel-indicator hints |
| `proposed_value` | NUMERIC | nullable — qualitative hints land here too ("EVs got cheaper this quarter") |
| `proposed_unit` | TEXT | |
| `proposed_geography` | TEXT | |
| `source_article_id` | UUID FK | required |
| `evidence_quote` | TEXT | required |
| `detector_confidence` | NUMERIC | 0–1 |
| `detector_reason` | TEXT | LLM's free-text explanation |
| `status` | TEXT | `pending_review` / `approved` / `rejected` / `superseded` (default `pending_review`) |
| `reviewed_by` | TEXT FK `user_profiles(id)` | nullable |
| `reviewed_at` | TIMESTAMPTZ | nullable |
| `review_notes` | TEXT | nullable |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

On approval, an `indicator_values` row is inserted and the queue row flips to `approved`.

---

## Starter catalogue — 25 indicators

Seed file: `scripts/migrations/indicators/002-seed-catalogue.sql` (bulk `INSERT ... ON CONFLICT (slug) DO NOTHING`, mirrors `scripts/seed-taxonomy.sql`). All `sector` values are existing `taxonomy_domains.slug` strings — verified against `scripts/seed-taxonomy.sql`.

| # | Slug | Name | Sector | Geo | Unit | Direction good |
|---|---|---|---|---|---|---|
| 1 | `solar_deployed_cost_au` | Deployed solar cost AU | `energy-generation` | AU | $/W | down |
| 2 | `bess_deployed_cost_au` | Deployed BESS cost AU | `energy-storage` | AU | $/kWh | down |
| 3 | `liion_pack_price_global` | Global Li-ion pack price | `energy-storage` | Global | $/kWh | down |
| 4 | `liion_cell_price_global` | Global Li-ion cell price | `energy-storage` | Global | $/kWh | down |
| 5 | `ev_avg_price_au` | Average new EV price AU | `transport` | AU | $ | down |
| 6 | `ev_avg_range_km` | Average new EV range | `transport` | Global | km | up |
| 7 | `grid_renewables_share_au` | Grid renewables share AU (rolling avg) | `energy-grid` | AU | % | up |
| 8 | `grid_renewables_share_global` | Grid renewables share Global (rolling avg) | `energy-grid` | Global | % | up |
| 9 | `green_steel_production_global` | Green steel production | `industry` | Global | Mt | up |
| 10 | `green_h2_cost_global` | Green hydrogen production cost | `industry` | Global | $/kg | down |
| 11 | `solar_capacity_global` | Global solar PV deployed capacity | `energy-generation` | Global | GW | up |
| 12 | `wind_capacity_global` | Global wind deployed capacity | `energy-generation` | Global | GW | up |
| 13 | `bess_utility_capacity_global` | Global utility BESS deployed | `energy-storage` | Global | GWh | up |
| 14 | `ev_share_new_sales_au` | EV share of new car sales AU | `transport` | AU | % | up |
| 15 | `ev_share_new_sales_global` | EV share of new car sales Global | `transport` | Global | % | up |
| 16 | `dc_fast_chargers_au` | Public DC fast-charger count AU | `transport` | AU | count | up |
| 17 | `rooftop_solar_cumulative_au` | Cumulative rooftop solar AU | `energy-generation` | AU | GW | up |
| 18 | `nem_wholesale_price` | NEM wholesale price (rolling 30d) | `energy-grid` | AU | $/MWh | neutral |
| 19 | `rez_commissioned_mw_au` | REZ capacity commissioned | `energy-grid` | AU | MW | up |
| 20 | `accu_price_au` | ACCU spot price | `carbon-emissions` | AU | $/t CO2-e | neutral |
| 21 | `co2_atmospheric_global` | Atmospheric CO2 | `carbon-emissions` | Global | ppm | down |
| 22 | `cement_embodied_carbon` | Cement embodied carbon | `industry` | Global | kg CO2/t | down |
| 23 | `lithium_spodumene_price` | Lithium spodumene price | `critical-minerals` | Global | $/t | neutral |
| 24 | `green_h2_capacity_global` | Green H2 capacity in operation | `industry` | Global | GW | up |
| 25 | `grid_emissions_intensity_au` | AU grid emissions intensity | `energy-grid` | AU | gCO2/kWh | down |

Catalogue is editable via SQL; an editor admin form is in scope for a later phase if churn justifies it (deferred — out of this plan).

---

## `/indicators` page (read-only)

New tab in `src/app/(app)/dashboard/page.tsx` — register `"indicators"` in `getTabsForRole()` between `"energy"` and `"markets"` for all roles. Mirror the **Energy tab** pattern (`src/components/energy-tab.tsx`):

- Client component (`"use client"`) with `useEffect` fetch from a new `/api/indicators/route.ts`.
- Layout: filter bar (sector multiselect, geography selector) → sector-grouped sections → card grid.
- Each card:
  - Sector badge (using existing `src/lib/design-tokens.ts` colour map) + name + geography pill
  - Big current value + unit; small delta vs prior with arrow tinted by `direction_good`
  - Custom-SVG sparkline — reuse the `Sparkline()` helper from `energy-tab.tsx` (no new chart library; energy tab proves the pattern)
  - "Last updated DD MMM" + source link to `last_source_url`
  - Click → opens a sheet/modal with the full history table (date, value, source, evidence quote)
- Empty/loading: shadcn `Skeleton` matching Energy tab's skeleton.

API: `GET /api/indicators` returns `{ indicators: IndicatorWithHistory[] }` where each row carries the catalogue fields plus the last ~30 `indicator_values` rows. Single SQL query with `LEFT JOIN LATERAL`.

Detail/admin: `/api/indicators/review` (admin-only via `requireAuth("admin")`) — list pending queue rows, approve/reject. Mirror the candidate-actions pattern at `src/app/(app)/teaching/candidates/CandidateActions.tsx`. UI lives under the existing **Editor** tab as a new section, not a top-level admin tab — keeps tab list short.

---

## Pipeline change-detection step

New step `"detect_indicators"` slotted between `enrichment` and `digest` in the orchestrator (`src/lib/pipeline/orchestrator.ts`). Cron stagger: enrich runs at `10 19 * * *` (800s timeout), digest at `25 19 * * *` — detection slots at `22 19 * * *` with a 300s timeout, leaving 3 minutes before digest fires.

### File-by-file changes

- `src/lib/pipeline/types.ts` — add `"detect_indicators"` to `StepName` union.
- `src/lib/pipeline/steps.ts` — new export `step3bDetectIndicators(): Promise<StepResult>`.
- `src/lib/pipeline/orchestrator.ts` — add to `STEP_FUNCTIONS` and insert into `STEP_ORDER` after `"enrichment"`.
- `src/app/api/pipeline/detect-indicators/route.ts` — 3-line wrapper calling `handleStepCron(req, "detect_indicators")` (same shape as siblings).
- `vercel.json` — new cron entry `{ "path": "/api/pipeline/detect-indicators", "schedule": "22 19 * * *" }`.
- `src/lib/indicators/detector.ts` — the actual detector (new module).

### Detection logic

For each enriched article from today's run (join `enriched_articles` + `raw_articles` + optional `full_text_articles`), filtered to articles where `enriched_articles.primary_domain` ∈ {sectors covered by at least one live indicator}:

1. Build a per-domain catalogue slice — the subset of `indicators` where `sector` matches the article's primary/secondary domains. Saves prompt tokens.
2. Call **Gemini 2.5 Flash** (same model + concurrency wrapper as Stage 2 enrichment in `src/lib/enrichment/pipeline.ts`) with a structured-output prompt:
   > "You are given a news article and a list of tracked indicators. For each indicator the article reports a *new numeric value* for, return `{indicator_slug, value, unit, geography, observed_at, evidence_quote, confidence}`. Confidence rubric: 0.95+ = exact match (slug, unit, geography all aligned, explicit number). 0.7–0.94 = match but unit/geo needs interpretation. <0.7 = qualitative or ambiguous. Return `[]` if none."
3. Validate each hit:
   - `indicator_slug` exists in catalogue → if not, route to review queue with `proposed_indicator_slug`.
   - `value` is a parseable number.
   - `unit` matches catalogue unit (allow simple conversions: `$/kWh ↔ $/Wh`, `MW ↔ GW`); if conversion ambiguous, route to review.
   - `geography` matches catalogue geography (or article jurisdiction).
4. Routing:
   - `confidence ≥ 0.85` AND validation clean → insert `indicator_values` row (`source_type='article'`).
   - `0.6 ≤ confidence < 0.85` OR validation needed human judgment → insert `indicator_review_queue` row.
   - `confidence < 0.6` → drop (logged in step result for telemetry only, not persisted).
5. Step result: `{ articles_scanned, hits_total, live_updates, queued_for_review, dropped, errors }` — surfaced on `/api/pipeline/runs` like every other step.

### Cost / safety

- ~150 articles/day × ~1 short Gemini call each ≈ $0.02–0.04/day (matches Stage 2 cost profile from explore notes).
- Concurrency = 3, mirroring `STAGE2_CONCURRENCY`. Reuses `withConcurrency()` helper from `src/lib/enrichment/pipeline.ts`.
- Per-article try/catch — failures counted, not fatal.
- `pipeline_version` bumped on the indicator path so re-runs are tracked.

---

## Digest integration

Two changes in the digest flow.

### 1. Top-of-digest count line

In `src/lib/digest/generate.ts::generateBriefingForUser()`, after the digest LLM call returns and before persistence to `daily_briefings`, count `indicator_values` rows where `source_type='article' AND DATE(created_at) = CURRENT_DATE`. Add the count to the `digest` JSONB payload as `digest.indicators_updated_today: number`.

In `src/components/intelligence/index.tsx`, render a one-line strip near the top of the briefing header (above the "Daily Number"):

> "**3 indicators updated today** → View"

The link routes to `/dashboard?tab=indicators`. Component is hidden when count is 0.

### 2. Per-article badge

When `generateBriefingForUser` builds each story object for the `daily_briefings.stories` JSONB, add `triggered_indicator_update?: { indicator_slug, indicator_name, new_value, unit }` by joining stories' `source_article_id` against today's `indicator_values` rows. (Single query, denormalised into the JSONB so the renderer never re-queries.)

Render in both `src/components/intelligence/lead-stories.tsx` (hero card) and `src/components/intelligence/also-today.tsx` (compact list) as a small badge near the headline:

> `[ ↗ Indicator updated: Solar deployed cost AU → $1.18/W ]`

Reuse shadcn `Badge` + colour from `direction_good` (green for movement in the good direction, amber for the bad direction, slate for neutral).

---

## Direct scraper hook (future, sketched)

Indicators where source-of-truth data exists publicly should bypass article inference and pull straight. Sketch only — not built in this phase except the AEMO worked example.

Pattern:
- `src/lib/indicators/scrapers/<scraper-name>.ts` exports `runScraper(): Promise<ScraperResult>` which inserts `indicator_values` rows with `source_type='scraper'`, `source_scraper='aemo_grid_mix'`.
- New cron route `/api/scrapers/<name>` registered in `vercel.json` at its own cadence (AEMO daily at `0 21 * * *`, BNEF monthly when reports drop, etc.) — runs independently of the main pipeline.
- A `scraper_runs` table (small, mirrors `pipeline_runs`) tracks last-success timestamps for ops visibility.

Phase 2 ships **one** worked example: AEMO grid mix daily → updates `grid_renewables_share_au` and `grid_emissions_intensity_au`. Cheapest because AEMO publishes a free CSV; no auth needed. This proves the bypass path before we add BNEF / other paid feeds.

---

## Build plan — one commit per step

Branch: `feat/indicators`. PR to `main` at the end (per `CLAUDE.md` git workflow — major change, branch + PR, not straight to main).

1. **Migration + catalogue seed** — `scripts/migrations/indicators/001-indicators.sql`, `002-seed-catalogue.sql`. Apply via `psql "$DATABASE_URL" -f`. Verify with `\d indicators`, `SELECT COUNT(*) FROM indicators` (= 25). Update `docs/claude/architecture/database.md` index. Commit: `feat(indicators): schema + 25-indicator catalogue seed`.

2. **`/indicators` page (read-only, no detection yet)** — new tab registration, `/api/indicators/route.ts`, `src/components/indicators-tab.tsx` (mirroring `energy-tab.tsx`), reusing `Sparkline()`. Manually `INSERT INTO indicator_values` 2–3 rows so the page has something to render. Commit: `feat(indicators): /indicators dashboard tab with sparkline grid`.

3. **Pipeline detection step** — types + steps + orchestrator wiring + cron route + `vercel.json`, plus `src/lib/indicators/detector.ts` and review-queue UI under Editor tab. Verify: trigger `/api/pipeline/detect-indicators` manually with `Authorization: Bearer $CRON_SECRET` against today's enriched articles, confirm rows land in `indicator_values` and `indicator_review_queue`. Commit: `feat(indicators): pipeline change-detection step + review queue`.

4. **Digest integration** — count line in `generate.ts` + JSONB shape change + renderer in `intelligence/index.tsx`, `lead-stories.tsx`, `also-today.tsx`. Verify against a mock briefing locally. Commit: `feat(indicators): digest count line + per-article update badges`.

5. **AEMO direct scraper (worked example)** — `src/lib/indicators/scrapers/aemo-grid-mix.ts`, `/api/scrapers/aemo-grid-mix`, `vercel.json` cron, schema for `scraper_runs`. Commit: `feat(indicators): AEMO grid-mix scraper bypass path`.

---

## Verification (end-to-end)

After step 3 lands, full-flow check on staging:

1. Run `pnpm tsx scripts/test/insert-test-article.ts` (or pick a real article from yesterday) where the body contains a known number, e.g. "Australian utility-scale solar fell to $0.95/W in Q1 2026."
2. Hit `POST /api/pipeline/enrich` → confirm `enriched_articles` row.
3. Hit `POST /api/pipeline/detect-indicators` with cron secret → step result should report `live_updates >= 1`.
4. `SELECT * FROM indicator_values WHERE indicator_id = (SELECT id FROM indicators WHERE slug='solar_deployed_cost_au') ORDER BY created_at DESC LIMIT 1;` → row should carry the new value, `evidence_quote` containing the sentence, `confidence >= 0.85`.
5. Open `/dashboard?tab=indicators` → card shows the new value, sparkline includes it, source link points at the article.
6. Hit `POST /api/digest/generate` for a test user → returned digest JSONB has `indicators_updated_today >= 1`; the article that triggered the update has `triggered_indicator_update` populated.
7. Open the briefing UI → count line visible, per-article badge visible on that story.
8. For low-confidence verification: feed an ambiguous article ("EVs are getting cheaper across the board") → confirm row lands in `indicator_review_queue` with `status='pending_review'`, **not** in `indicator_values`.
9. Approve it from the Editor review UI → confirm queue row flips to `approved` AND a new `indicator_values` row is created with `source_type='article'`.
10. AEMO scraper (after step 5): `POST /api/scrapers/aemo-grid-mix` → confirm `grid_renewables_share_au` updates with `source_type='scraper'`, no `source_article_id`.

Smoke test for the no-fabrication rule: code review the detector for any path that inserts into `indicator_values` without an `evidence_quote` (article path) or `source_scraper` (scraper path). The CHECK constraint on the table is the belt; the code review is the suspenders.

---

## Critical files modified / created

**New**
- `scripts/migrations/indicators/001-indicators.sql`
- `scripts/migrations/indicators/002-seed-catalogue.sql`
- `src/app/api/indicators/route.ts`
- `src/app/api/indicators/review/route.ts`
- `src/app/api/pipeline/detect-indicators/route.ts`
- `src/app/api/scrapers/aemo-grid-mix/route.ts`
- `src/components/indicators-tab.tsx`
- `src/lib/indicators/detector.ts`
- `src/lib/indicators/scrapers/aemo-grid-mix.ts`
- `src/lib/indicators/types.ts`

**Modified**
- `src/app/(app)/dashboard/page.tsx` — register `"indicators"` tab in `getTabsForRole()`
- `src/lib/pipeline/orchestrator.ts` — add `detect_indicators` to `STEP_ORDER` + `STEP_FUNCTIONS`
- `src/lib/pipeline/steps.ts` — export `step3bDetectIndicators`
- `src/lib/pipeline/types.ts` — extend `StepName`
- `src/lib/digest/generate.ts` — `generateBriefingForUser` joins indicator updates into JSONB
- `src/components/intelligence/index.tsx` — count-line strip
- `src/components/intelligence/lead-stories.tsx` — per-article badge
- `src/components/intelligence/also-today.tsx` — per-article badge
- `vercel.json` — two new crons (detect + AEMO)
- `docs/claude/architecture/database.md` — schema index entry
- `docs/claude/features/` — new `indicators.md` topic file
- `docs/claude/ops/crons.md` — new cron entries

## Reused (no changes, just imported)
- `src/lib/db.ts` — `pool`
- `src/lib/ai-models.ts` — `GEMINI_MODEL`
- `src/lib/enrichment/pipeline.ts` — `withConcurrency()` helper (or hoist to `src/lib/util/concurrency.ts` if cleaner)
- `src/lib/design-tokens.ts` — sector colour map, severity tints
- `src/components/ui/{card,badge,skeleton,select}.tsx` — shadcn primitives
- `src/components/energy-tab.tsx::Sparkline()` — hoist to `src/components/charts/sparkline.tsx` so both Energy and Indicators tabs share it
- `src/app/(app)/teaching/candidates/CandidateActions.tsx` — review-queue action pattern (mirror, don't import)

---

## Decisions confirmed

- Geography: **free-text** TEXT column. `KNOWN_GEOGRAPHIES` constant in `src/lib/indicators/types.ts` provides filter-dropdown options and a lint check for new catalogue rows; detector can still propose new regions and they land in the queue if unfamiliar.
- Detector thresholds: **live ≥ 0.85**, queue 0.6–0.85, drop < 0.6.
- Admin CRUD form for catalogue: **deferred**. Catalogue managed via seed SQL until churn justifies the UI.
- Review queue UI: **section under existing Editor tab**, not a new top-level tab. Reader-facing UI never shows queue contents.
