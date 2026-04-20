# Learn System — full 4-phase build with agent-team orchestration

## Context

ClimatePulse is adding **Learn**, a timely learning surface over the existing intelligence substrate (pgvector + Postgres-native graph). The Phase 1 UI shell (mock data, scoped CSS, inside the dashboard tab rail) has shipped on `feat/learn`. This plan covers the full system build — schema, generation, real UI, and the Knowledge Surface (microsite) primitive — in four reviewable phases with hard user-approval checkpoints between each.

**Key decisions from clarification round:**
- **Route architecture**: standalone `/learn` section (deprecate the dashboard tab). Phase 1 UI components port into `app/learn/page.tsx` + `app/learn/concepts/[slug]` + `app/learn/paths/[slug]/read`. Dashboard "Learn" entry becomes a link to `/learn`.
- **Branch plan**: merge `feat/learn` → `main` first (as a milestone PR), then branch `feat/learn-system` off freshly-merged `main`.
- **Retrieval**: stay on pgvector + Postgres graph. Do not plan LightRAG. `walkAndRetrieve` from `src/lib/intelligence/evaluation/backends/pg-graph-walk.ts` is the graph-retrieval primitive to extend with Learn-specific filters.
- **Deep Dive generation is deferred** (schema only).

---

## Current codebase state (Phase 1 research findings)

Primary findings from 3 parallel Explore agents on 2026-04-20:

### What's already live and reusable
| Artifact | Path | Notes for Learn |
|---|---|---|
| `entity_relationships` table | `scripts/migrate-graph-rag.sql` | 17 controlled predicates + `_uncategorised` sentinel; `CHECK` constraint on `predicate`; triples carry `confidence`, `evidence`, `first/last_observed`, `observation_count`, `metadata` JSONB. Concept-card relationships table should mirror this shape. |
| `walkAndRetrieve()` | `src/lib/intelligence/evaluation/backends/pg-graph-walk.ts:39` | Signature: `retrieve({query, seedEntityIds, limit, maxHops=2, minConfidence=0.6, predicateAllowlist})`. Fuses graph + vector at 0.7×similarity + 0.3×(1/(1+hops)). **No Learn filters yet** — needs editorial_status, freshness decay, scope-filter extensions. |
| `content_embeddings` | `scripts/migrate-intelligence.sql:35` | `content_type` CHECK already includes `learn_content` slot. 11 filter indexes (HNSW, content_type, source, domain, signal, published, significance, tier, microsectors, entities, jurisdictions). Just add new content_type enum values. |
| `retrieveContent()` | `src/lib/intelligence/retriever.ts:64` | 12 filter dimensions incl. microsector_ids/entity_ids array overlaps. Copy the shape for `retrieveForLearn()`. |
| Prompt injection system | `src/lib/enrichment/prompt-loader.ts:27` | `assemblePrompt()` with `{{PLACEHOLDER}}` tokens; definition injection by domain (e.g., `extractMicrosectorDefinitions()`). Mirror at `prompts/learn/definitions/`. |
| `enrichment_runs` cost pattern | `scripts/migrate-enrichment.sql:183` + `migrate-two-stage.sql` | Columns: tokens in/out, estimated_cost_usd, duration_ms, batch_size, stage, pipeline_version. Add `module` column and reuse, rather than create a parallel table. |
| `stage2-enricher.ts` generation pattern | `src/lib/enrichment/stage2-enricher.ts:100` | Per-article, `{result, inputTokens, outputTokens, durationMs}` return, 2-attempt retries, Gemini client, manual JSON parse + validation. Skeleton for concept-card + brief-block generators. |
| Cron handler | `src/lib/pipeline/cron-handler.ts:14` | `handleStepCron(req, step)` pattern. Learn brief-block refresh mirrors this. |
| Existing `feat/learn` UI components | `src/components/learn/` | 16 files, ~2316 lines, scoped CSS. Transportable into `app/learn/` routes in Phase 3. |

### Gaps Learn introduces (fresh patterns, no precedent)
| Gap | Resolution in this plan |
|---|---|
| No `editorial_status` or `reviewed_at` columns anywhere on source content | Introduce a shared enum `editorial_status` (`editor_authored` \| `editor_reviewed` \| `previously_reviewed_stale` \| `ai_drafted` \| `user_generated`) + `reviewed_by` + `reviewed_at` as a **column pattern** applied to concept_cards, microsector_briefs, microsector_brief_blocks, learning_paths. Phase 3 adds the `<EditorialStatusBadge>` component consuming this field. |
| No soft-delete / version tracking on `taxonomy_microsectors` | Additive migration: `deprecated_at`, `merged_into` columns. Surfaces use these to adapt scope when taxonomy evolves. Not destructive. |
| No `concept_cards` table | Phase 1 migration. Orthogonal to `entities` (which stays a registry only). Cards may reference entity_ids but don't replace them. |
| No `scripts/migrations/` directory convention | Current migrations are flat at `scripts/migrate-*.sql`. Introduce `scripts/migrations/learn/` sub-directory for all Learn migrations (agreed with user spec). Existing migrations are not reorganised. |
| No per-module cost view | Extend `enrichment_runs` with `module TEXT DEFAULT 'enrichment'`; create SQL view `generation_costs` that projects filtered by module. |

---

## Branch & PR strategy

```
main
 ├── feat/learn           ← Phase 1 UI shell (PENDING MERGE as milestone)
 │
 └── feat/learn-system    ← branches off main after feat/learn merge
     ├── phase-1/schema        → PR back to feat/learn-system at Phase 1 checkpoint
     ├── phase-2/generation    → PR back to feat/learn-system at Phase 2 checkpoint
     ├── phase-3/ui-routes     → PR back to feat/learn-system at Phase 3 checkpoint
     └── phase-4/surfaces      → final merge feat/learn-system → main
```

No merges to `main` between Phase 1 and Phase 4 without explicit approval. Intra-phase sub-branches merge into `feat/learn-system` to keep the phase PR reviewable in slices.

---

## PHASE 1 — Schema + design docs (active)

### Agent team

| Team | Agent type | Model | Owns |
|---|---|---|---|
| Schema author | general-purpose | Opus | `docs/learn-system/01-schema.md` (ER diagram, rationale, existing-table integration) |
| Edge-case decider | general-purpose | Opus | `docs/learn-system/02-edge-cases.md` (8 decisions) |
| Migration writers (4 parallel) | general-purpose | Sonnet | One each for concept cards, briefs, paths, surfaces |
| Reviewer (single pass) | superpowers:code-reviewer | Opus | FK integrity, idempotency, additive-only verification, cross-file consistency |

Parallel migration authoring is safe because each migration is additive and touches a disjoint set of tables. Cross-cutting concerns (shared `editorial_status` enum, shared timestamp trigger function) go into a prelude migration `001-learn-prelude.sql` authored before the four parallel workstreams.

### Deliverables

**Migrations** at `scripts/migrations/learn/`:
- `001-learn-prelude.sql` — shared enum `editorial_status`, shared `update_updated_at` trigger, additive columns on `taxonomy_microsectors` (`deprecated_at`, `merged_into`), additive columns on `content_embeddings` `content_type` CHECK (add `concept_card`, `microsector_brief`, `microsector_brief_block`, `learning_path`, `deep_dive`, `surface_module`, `uploaded_doc`), add `module` column to `enrichment_runs`, create `generation_costs` SQL view.
- `010-concept-cards.sql` — `concept_cards` (slug, term, abbrev, disambiguation_context, inline_summary, full_body, key_mechanisms JSONB, related_terms TEXT[], visual_type, visual_spec JSONB, uncertainty_flags JSONB, source_citations JSONB, editorial_status, reviewed_by, reviewed_at, version INT, superseded_by UUID, ai_drafted BOOL, created_at/updated_at), `concept_card_candidates` (extraction queue), `concept_card_relationships` (subject_card_id, object_card_id, relationship_type CHECK IN ('prereq','related','supersedes','contrasts_with','peer'), confidence, evidence, source metadata — mirrors entity_relationships shape).
- `020-microsector-briefs.sql` — `microsector_briefs` (one row per taxonomy_microsector; headline metadata, regime_change_flagged BOOL), `microsector_brief_blocks` (block_type CHECK IN ('nicks_lens','fundamentals','key_mechanisms','australian_context','current_state','whats_moving','watchlist','related'), body TEXT/JSONB, editorial_status, reviewed_at, last_generated_at, cadence_policy, content_hash, version). Unique(brief_id, block_type).
- `030-learning-paths.sql` — `learning_paths` (title, slug, goal, scope JSONB with in_scope_microsectors, update_policy CHECK IN ('frozen','live','periodic'), intent JSONB, editorial_status, author_user_id, version), `learning_path_items` (polymorphic refs via `item_type` + `item_id`, position INT, chapter TEXT, completion_required BOOL), `learning_path_progress` (user_id, path_id, item_id, completed_at), `deep_dives` (title, slug, summary, body placeholder, status='deferred', microsector_ids INTEGER[]).
- `040-knowledge-surfaces.sql` — `knowledge_surfaces` (title, slug, template CHECK IN ('hub','course'), scope JSONB, access JSONB, overlay JSONB, layout JSONB, branding JSONB, lifecycle CHECK IN ('draft','preview','published','archived'), owner_user_id, version), `knowledge_surface_content` (surface-private content: uploaded docs, custom modules, custom quizzes — isolated from canonical retrieval via scope filter), `knowledge_surface_members` (user_id or email or domain + access_level + granted_at/revoked_at), `knowledge_surface_analytics` (daily aggregate view counts + per-user completion events).

**Docs** at `docs/learn-system/`:
- `00-agent-team-plan.md` — this document, committed verbatim as the living orchestration reference.
- `01-schema.md` — mermaid ER diagram, per-table rationale, integration with `enriched_articles`, `entities`, `taxonomy_*`, `entity_relationships`, `content_embeddings`. Versioning strategy: concept cards use monotonic `version INT` + nullable `superseded_by`; brief blocks use `version` + `content_hash` so dependency-inference can detect change. Surface-private content isolation: `knowledge_surface_content` never embedded into global `content_embeddings`; scope filter injects `surface_id` constraint into all retrieval paths.
- `02-edge-cases.md` — concrete decisions on:
  1. **Disambiguation** — `disambiguation_context` TEXT column on `concept_cards`; unique on (term, disambiguation_context); `/learn/concepts/capacity` routes to a disambiguation page listing both.
  2. **Concept drift + version pinning** — old briefings reference `concept_card_id` + `concept_card_version` pair. Rendering compares current version; if materially different (hash diff threshold), shows a "concept has evolved" note with link to current.
  3. **Editor-review decay** — default expiry 180 days on `reviewed_at`. Daily cron downgrades `editor_reviewed` → `previously_reviewed_stale` when expired. Content is never modified; only the status badge changes.
  4. **Brief-block partial state** — every brief block renders independently with its own status badge + timestamp. Empty blocks collapse; `nicks_lens` block renders prominent when present, absent when null (no placeholder).
  5. **Path update policies** — default by context: user-generated paths are `frozen` at creation; editor-curated seed paths start `live`; auto-generated periodic paths (e.g., "This week in grid") are `periodic`.
  6. **Canonical overrides in surfaces** — surface overlay can pin a specific `concept_card_version` so the surface remains stable even if the canonical card evolves. Override stored in `knowledge_surfaces.overlay.pinned_versions` JSONB.
  7. **Taxonomy evolution** — microsector split: new IDs, old ID gets `deprecated_at` + `merged_into` NULL (split — multi-target). Merge: old ID gets `deprecated_at` + `merged_into = new_id`. Surface scopes auto-expand when a scoped microsector is split; notify surface admin via `surface_admin_notifications` (later phase).
  8. **Uploaded client docs** — stored in Vercel Blob under per-surface prefix; indexed into `knowledge_surface_content` only; hard-delete (Blob delete + row delete + content_embeddings purge for that source_id) on client request with audit-log entry.

### Out of scope for Phase 1
- Any generation prompts or content
- Any UI
- Any access-control logic (schema only)
- Any changes to existing `enriched_articles`, `entities`, core `taxonomy_*` rows (additive columns only)

### Phase 1 verification
- `psql` dry-run: apply each migration against a scratch schema; assert rollback with `BEGIN; apply; ROLLBACK;` succeeds.
- `git diff` confirms no modifications to existing `scripts/migrate-*.sql` files.
- Mermaid ER diagram renders (validated by copy-paste into mermaid.live).
- SQL view `generation_costs` returns zero rows on empty schema.
- Reviewer agent signs off on FK correctness + CHECK constraints.

### Phase 1 checkpoint
Stop. User reviews `01-schema.md`, `02-edge-cases.md`, all migration SQL. Iterate until approved. Only then Phase 2 starts.

---

## PHASE 2 — Generation pipelines + retrieval

### Agent team (up to 6 parallel workstreams)

| Team | Agent type | Model | Owns |
|---|---|---|---|
| A — concept cards | feature-dev:code-architect | Sonnet | `src/lib/learn/concept-cards/` (extractor, candidate queue, generator), `prompts/learn/concept-card-generation.md`, batch script `scripts/learn/generate-concept-cards.ts`, CLI authoring path |
| B — brief blocks | feature-dev:code-architect | Sonnet | `src/lib/learn/microsector-briefs/` (per-block generators), `prompts/learn/brief-blocks/*.md` (6 block prompts), refresh scheduler `scripts/learn/refresh-brief-blocks.ts` |
| C — regime change | general-purpose | Sonnet | `src/lib/learn/regime-change-detector.ts` — monitors `entity_relationships` for new high-confidence `supersedes`/`reforms`/`repeals`, flags affected briefs |
| D — path generator | feature-dev:code-architect | Sonnet | `src/lib/learn/path-generator.ts` — intent parser, substrate selector, prereq walker (uses `walkAndRetrieve`), sequencer, coherence pass, thin/over-broad/over-narrow handlers |
| E — retrieval | general-purpose | Sonnet | `src/lib/intelligence/retriever.ts::retrieveForLearn`, `pg-graph-walk.ts` extensions (editorial_status weight, freshness decay, scope filter) |
| F — seed content | general-purpose | Sonnet | Extract top-50 concept card candidates, generate AI drafts (user approves list first); extract top-10 microsectors by signal volume, generate brief drafts |

**Synthesis & review:** Schema author (Opus) writes `docs/learn-system/03-generation-pipelines.md`. Reviewer agent (Opus, `superpowers:code-reviewer`) does a single comprehensive pass on prompts, structured-output shapes, retry logic, guardrails (3-source minimum for concept cards, refusal behaviour, cost caps).

### Deliverables
- Concept-card pipeline end-to-end, gated on `LEARN_GENERATION_ENABLED=true` env flag.
- Brief-block pipeline with per-block cadence (daily/weekly/yearly) and `nicks_lens` manual-only rule enforced in code.
- `retrieveForLearn(query, scope, opts)` helper + walkAndRetrieve Learn options.
- 50 AI-drafted concept cards + 10 AI-drafted microsector briefs in `editorial_status='ai_drafted'`, awaiting review.
- `docs/learn-system/03-generation-pipelines.md` with prompt design rationale, cost projections (at 400 cards + 108 briefs × refresh cadence), review workflow, failure-mode handling.

### Out of scope for Phase 2
- Any UI
- Access control logic
- Deep Dive generation
- The 10 seed curated paths (user authors in Phase 3)
- Surface rendering

### Phase 2 verification
- Unit tests: each generator mocks the LLM and asserts structured output shape + refusal on <3 sources.
- Integration test: seed small corpus, run concept-card extractor → candidate queue → generation → DB write. Assert `ai_drafted` status, source citations ≥3, cost logged to `generation_costs` view.
- Retrieval test: seed 10 concept cards + 5 briefs, call `retrieveForLearn("MLF", {scope: {microsectors: ['energy-grid']}})`, assert returned items are in-scope and editorial-weighted.
- Sample output quality: user reviews 5 concept cards + 2 brief drafts at the checkpoint before full seed generation runs.

### Phase 2 checkpoint
Stop. User reviews prompts + 5 sample concept cards + 2 sample briefs before the full 50/10 seed run. Iterate on prompt quality — this is where editorial voice is set.

---

## PHASE 3 — User-facing surfaces (Learn tab → standalone /learn)

### Agent team (up to 5 parallel workstreams)

| Team | Agent type | Model | Owns |
|---|---|---|---|
| G — Learn landing | feature-dev:code-architect | Sonnet | Port `src/components/learn/` into `app/learn/page.tsx`, swap mock imports for real data fetched via `retrieveForLearn` + direct queries. Dashboard tab entry becomes `<Link href="/learn">`. |
| H — Concept pages | feature-dev:code-architect | Sonnet | `app/learn/concepts/[slug]/page.tsx` (full card), `app/learn/concepts/[term]/page.tsx` (disambiguation when multiple `disambiguation_context` rows), `<InlineConceptTooltip>` component for use in briefings + Q&A |
| I — Microsector pages | feature-dev:code-architect | Sonnet | `app/learn/microsectors/[slug]/page.tsx` — block-based render, low-signal "quarterly pulse" variant, regime-change banner, per-block status badges + timestamps |
| J — Path pages | feature-dev:code-architect | Sonnet | `app/learn/paths/[slug]/page.tsx` (overview), `app/learn/paths/[slug]/read/page.tsx` (reader with completion tracking), `app/learn/paths/generate/page.tsx` (user-requested form → intent confirmation → generation → review/reorder → save) |
| K — Search + inline + seeds | feature-dev:code-architect | Sonnet | `app/learn/search/page.tsx` (grouped results), browse drill-down, update existing briefing rendering + Q&A rendering to detect concept terms and show inline tooltips (first-occurrence-only rule), build `scripts/learn/author-path.ts` CLI and author 2 seed paths interactively with user |

### Cross-team shared components
- `<EditorialStatusBadge>` — one component, 5 states, used everywhere.
- `<InlineConceptTooltip>` — first-occurrence-only, modal on mobile, popover on desktop, keyboard accessible.
- Reuse existing design tokens (`src/lib/design-tokens`) + Heroicons outline — no ad-hoc styling.
- Trust marker from `src/components/learn/trust-marker.tsx` evolves into the shared `<EditorialStatusBadge>`.

### Out of scope for Phase 3
- Knowledge Surface configurability
- Custom microsite branding
- Access control beyond existing auth (all Learn is public to authed users in Phase 3)
- 8 remaining curated seed paths (defer until user has learned from first 2)

### Phase 3 verification
- E2E Playwright: anonymous → `/learn` → see Today's Concept + Browse. Sign in → Continue Learning appears. Click concept → full card renders with real content. Click path → reader works with completion tracking.
- Inline tooltip: seed a briefing with concept terms, verify only first occurrence per article renders a tooltip.
- Mobile responsive pass: 375px width, all routes usable, tooltip becomes modal.
- Old briefings (>12 months) show the "concept has evolved" note when referenced card version differs materially.
- Manual test script in `docs/learn-system/test-scenarios.md`.

### Phase 3 checkpoint
User reviews end-to-end + 2–3 friendly users test. Iterate. Approve before Phase 4.

---

## PHASE 4 — Knowledge Surfaces (microsite primitive)

### Agent team (up to 7 parallel workstreams)

| Team | Agent type | Model | Owns |
|---|---|---|---|
| L — surface config | feature-dev:code-architect | Sonnet | `src/lib/surfaces/config.ts` (scope, access, overlay, layout, branding, lifecycle schema validation) |
| M — access control | feature-dev:code-architect | Sonnet | `src/lib/surfaces/access.ts` (anonymous→authed→authorised flow, cohort code redemption, email/domain allowlist, audit log) |
| N — scope filter | feature-dev:code-architect | Sonnet | `src/lib/surfaces/scope-filter.ts` — bounds all substrate queries, enforces surface-private content isolation, handles taxonomy evolution |
| O — Hub template | feature-dev:code-architect | Sonnet | `app/s/[slug]/page.tsx` hub layout (rolling window, live updates, feed + featured paths + scoped browse + scoped search) |
| P — Course template | feature-dev:code-architect | Sonnet | `app/s/[slug]/page.tsx` course layout (fixed window, frozen, cohort gating, chapters→items, supplementary note mechanism) |
| Q — admin UI | feature-dev:code-architect | Sonnet | `app/admin/surfaces/` — create flow (template → scope → access → overlay → branding → preview → publish), surface dashboard |
| R — uploads + analytics + traffic | feature-dev:code-architect | Sonnet | `src/lib/surfaces/uploads.ts` (upload → chunk → embed into surface-private scope; hard delete), per-surface analytics pipeline, CDN caching + rate limiting |

### Cross-cutting
- Same `<EditorialStatusBadge>` / inline tooltip reused. No new design system.
- All routes namespaced under `/s/[slug]` to clearly separate surface contexts from canonical `/learn`.

### Out of scope for Phase 4
- Cohort, Presentation Companion, Briefing templates (defer)
- Custom domain support (defer)
- Billing/deactivation flows (defer until first real client)

### Phase 4 verification
- E2E: create a Hub surface, add email allowlist, invite test user, log in, confirm scope-bounded feed + search. Confirm canonical content visible when navigated with clear framing.
- E2E: create a Course surface, cohort code, mid-course supplementary note appears for all active members.
- Delete test: upload a doc, request deletion, verify Blob + row + embeddings all purged.
- Taxonomy evolution test: deprecate a microsector in a surface scope; confirm surface auto-expands to replacement microsector(s); admin notified.

### Phase 4 merge
`feat/learn-system` → `main`. Learn system goes live with first microsite deployment.

---

## Cross-cutting patterns (applied every phase)

### Production safety
- All migrations additive. No ALTER on existing tables except additive column adds.
- All generation scripts opt-in via `LEARN_GENERATION_ENABLED` env flag. Default off.
- Existing daily briefing, podcast, Q&A pipelines untouched in Phase 1 and 2. Phase 3 adds inline concept tooltips to rendering — content pipelines unchanged.
- No merges to `main` until phase approval.

### Cost management
- Cheap models (Haiku, Flash) for classification + synthesis; Sonnet reserved for editorially-critical generation (concept cards, `nicks_lens` support, path coherence pass).
- Content-hash gating: regenerate blocks only when input corpus hash changes materially.
- Every generation script writes to `generation_costs` view. SQL dashboard query in `docs/learn-system/03-generation-pipelines.md`.
- Cost projection table in the generation-pipelines doc: per-card cost × 400 + per-block cost × (6 blocks × 108 microsectors × avg cadence).

### Review workflows
- Every AI-generated content type writes to a candidate/draft table first (`concept_card_candidates`, `microsector_brief_blocks` with `editorial_status='ai_drafted'`).
- Batch review UX in admin, not one-at-a-time.
- Bulk approval for high-confidence outputs (e.g., sources ≥5, no uncertainty flags).

### Testing strategy
- Unit: schema migration up/down idempotence; generator structured-output shape.
- Integration: generation pipelines against mocked LLM, retrieval against seeded data.
- E2E: Playwright for key user flows per phase.
- Manual: scenarios doc at `docs/learn-system/test-scenarios.md`.

### Observability
- Structured logging across generation jobs (existing `dev-logger` pattern).
- `generation_costs` SQL view + `/api/learn/costs` endpoint (admin-only) for live cost tracking.
- Error paths log cleanly; no silent swallow.

---

## Files to create (Phase 1 execution starts here)

- `scripts/migrations/learn/001-learn-prelude.sql`
- `scripts/migrations/learn/010-concept-cards.sql`
- `scripts/migrations/learn/020-microsector-briefs.sql`
- `scripts/migrations/learn/030-learning-paths.sql`
- `scripts/migrations/learn/040-knowledge-surfaces.sql`
- `docs/learn-system/00-agent-team-plan.md` (committed copy of this plan as the living reference)
- `docs/learn-system/01-schema.md`
- `docs/learn-system/02-edge-cases.md`

## Files to modify (Phase 1)
None. All work is additive. Existing migrations, tables, and source files remain untouched.

---

## Critical-file references (reused, not modified, in Phase 1)

Read-only references consulted by Phase 1 schema design:
- `scripts/migrate-intelligence.sql` — content_embeddings schema, HNSW index tuning
- `scripts/migrate-graph-rag.sql` + `scripts/migrate-graph-rag-vocab-v2.sql` — entity_relationships shape, predicate vocab
- `scripts/migrate-enrichment.sql` — taxonomy_*, entities, enrichment_runs columns
- `scripts/migrate-two-stage.sql` — pipeline_version pattern precedent
- `scripts/migrate-contradicts-prior.sql` — content-level boolean-flag precedent
- `src/lib/intelligence/retriever.ts` — retrieveContent filter shape
- `src/lib/intelligence/evaluation/backends/pg-graph-walk.ts` — walkAndRetrieve interface
- `src/lib/enrichment/stage2-enricher.ts` — generation pattern
- `src/lib/enrichment/prompt-loader.ts` — assemblePrompt + definition injection

---

## Phase 1 checkpoint handoff

When Phase 1 execution completes, user reviews:
1. `docs/learn-system/01-schema.md` — does the ER model fit the product mental model?
2. `docs/learn-system/02-edge-cases.md` — are the 8 decisions ones you'd make?
3. `scripts/migrations/learn/*.sql` — FK correctness, additive-only, column names match doc.
4. This plan itself — does the phase/agent breakdown match your expectations before we kick off Phase 2?

Iterate on any of the above. Phase 2 only starts after explicit approval. Expect real iteration on edge cases (#3 editor-review decay, #7 taxonomy evolution) since those shape long-term maintenance cost.
