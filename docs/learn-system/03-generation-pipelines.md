# Learn — Generation Pipelines (Phase 2)

Companion to `01-schema.md` and `02-edge-cases.md`. Documents the LLM prompt design, cost projections, editorial review workflow, and operator knobs for Phase 2 generation code under `src/lib/learn/`.

Scope: concept cards, microsector brief blocks, learning paths, regime-change detection, retrieval extensions. **Not** Deep Dive generation (schema-only in Phase 1 per plan).

---

## 1. Module map

| Module | Entry point | Prompt(s) | Cost bucket |
|---|---|---|---|
| Concept cards | `src/lib/learn/concept-cards/{extractor,candidate-queue,generator}.ts` | `prompts/learn/concept-card-generation.md` + `definitions/concept-card-schema.md` | `learn-concept` |
| Microsector brief blocks | `src/lib/learn/microsector-briefs/{block-generator,scheduler,seeder,related-derivation}.ts` | `prompts/learn/brief-blocks/{fundamentals,key-mechanisms,australian-context,current-state,whats-moving,watchlist}.md` | `learn-brief` |
| Learning paths | `src/lib/learn/path-generator/{intent-parser,substrate-selector,prereq-walker,sequencer,coherence-pass,handlers,persister,index}.ts` | `prompts/learn/{path-intent,path-coherence}.md` | `learn-path` |
| Regime-change detector | `src/lib/learn/regime-change-detector.ts` | (no LLM — queries `entity_relationships`) | `learn-regime` |
| Retrieval (Learn-flavoured) | `src/lib/learn/retriever-extensions.ts` | n/a — wraps `retrieveContent` | n/a |

Every LLM-emitting module calls `logGeneration()` in `cost-tracker.ts`, which writes to `enrichment_runs` with `module='learn-*'` and feeds the `generation_costs` view created in `001-learn-prelude.sql`.

---

## 2. Prompt design rationale

### 2.1 Concept cards — `concept-card-generation.md`

**Editorial voice.** ClimatePulse readers are industry practitioners, not students. The prompt forbids encyclopaedic hedging ("It's worth noting that…"), marketing tone, and the words "essentially" / "basically" — which signal that the model hasn't understood yet. British/Australian English is pinned so outputs don't drift into American spelling.

**Hard guardrails (refusal over fabrication).** Five rules are enforced as refusals rather than soft warnings because a ClimatePulse concept card becomes a tooltip that other briefings will point at. Quality debt compounds.

1. **≥3 source citations** — below that, return a `refused: "insufficient_sources"` object. `generator.ts` also enforces this server-side: if the model complies with the prompt but the JSON has <3 citations, the generator returns `{ refused: "insufficient_sources" }` regardless. Guardrail in two places on purpose.
2. **No citing sources the model wasn't given.** Input supplies a `<sources>` block; the model can't invent a URL.
3. **No speculation about future dates.**
4. **Abbrev must appear in source material** — prevents the model from coining TLAs.
5. **Uncertainty flags required** — every claim <90% confident must surface. This is the only way editor review stays efficient.

**Field caps.** `inline_summary` ≤ 60 words (hard cap — renderer truncates at 60 in `generator.ts`), `full_body` ≤ 200 words, `key_mechanisms` 2–5 entries. The body is plain prose, not markdown, because the renderer supplies structure.

**Disambiguation.** When sources describe meaningfully different concepts with the same surface term, the model must refuse with `disambiguation_required` and propose splits rather than merging them into one muddy card. This is how we keep `concept_cards.slug` + `disambiguation_context` unique meaningful.

**Model choice.** Gemini 2.5 Flash is the default (`GEMINI_MODEL` in `generator.ts`). The cost/quality trade is acceptable because every card is reviewed before `editorial_status` flips from `ai_drafted` to `editor_reviewed`. For canonical_source extractions (AEMO, CER), the `generateConceptCard` docstring flags a Sonnet hook — not yet wired, added in Phase 3 when the editorial queue ships.

### 2.2 Microsector brief blocks

**Per-block cadence** is the design axiom. `fundamentals` / `key_mechanisms` / `australian_context` change rarely (yearly), `current_state` weekly, `whats_moving` daily, `watchlist` quarterly, `related` derived from SQL (no LLM). `nicks_lens` is schema-enforced manual-only (`mbb_nicks_lens_manual_only` CHECK) — the editor writes it; the scheduler never touches it.

Each prompt file stays narrow to its block:

| Prompt | Purpose | Output shape |
|---|---|---|
| `fundamentals.md` | Canonical definition + scope; authoritative sources only | Plain prose |
| `key-mechanisms.md` | 3–7 mechanism entries with title + 2-sentence body | JSON list |
| `australian-context.md` | AU regulators, market structure, policy framework | Plain prose |
| `current-state.md` | Last 90 days — where the sector is right now | Plain prose |
| `whats-moving.md` | Last 14 days — pointer list of active stories | JSON list |
| `watchlist.md` | Scheduled events only; no speculation | JSON list |

`block-generator.ts` routes structured types (`KeyMechanisms`, `Watchlist`, `AustralianContext`) to `body_json`; narrative types go to `body`. If JSON parse fails for a structured type, the raw text lands in `body` with a warning — the editor fixes it on review rather than a retry storm.

**Input-hash short-circuit.** Every call computes SHA-256 over `[article_id:content_hash]` pairs sorted by article_id. If the hash matches `last_input_hash`, the scheduler returns `{ skipped: 'inputs_unchanged' }` without a Gemini call. This is what keeps the daily `whats-moving` refresh cheap — most microsectors don't have new articles every day.

### 2.3 Learning paths

**Two LLM passes only** (intent + coherence). Everything else is deterministic SQL + graph traversal. This keeps per-path cost predictable and makes the path reviewable before it's persisted.

- `path-intent.md` — taxonomy-grounded intent parser. Returns either a structured `PathIntent` (microsector scope + level + time horizon) or a `clarification_needed` object. Refusal is preferred over guessing scope.
- `path-coherence.md` — single-pass reviewer. Reads the sequenced plan + intent and can suggest revisions (swap items, re-chapter, remove duplicates). Revisions are surfaced as warnings, not silent rewrites, so the reader sees what the model changed.

**Refusal handlers** (`handlers.ts`) pre-empt LLM calls when the substrate is too thin (≤5 candidates) or the intent is over-broad/over-narrow. These paths return structured refusals the UI can render as actionable messages, not spinner-then-empty-state.

### 2.4 Regime-change detector

No LLM. `regime-change-detector.ts` runs a single scan over `entity_relationships` for `supersedes` / `opposes` triples with confidence ≥ 0.7, joins to entities, and flips `microsector_briefs.regime_change_flagged` + `regime_change_source_ids`. The editorial queue integration is stubbed (`console.log`) until Phase 3 ships the endpoint.

Predicate vocabulary is limited to `supersedes` + `opposes` today because those are the 2 of the 17 v2 predicates that encode a regime shift. When `reforms` / `repeals` land in the vocab, add them to `REGIME_PREDICATES`.

### 2.5 Retrieval — `retrieveForLearn`

Wraps the existing `retrieveContent` with three Learn-specific adjustments:

1. **Editorial boost** — +0.15 on the fused score for `editorial_status IN ('editor_authored','editor_reviewed')`. Currently `TODO`-stubbed because `RetrievedContent` doesn't surface `editorial_status`; Phase 3 extends the base retriever to join source tables and the boost turns on automatically.
2. **Freshness decay** — half-life of 45 days on `published_at`. Concept cards skip the decay (they're intended to be stable).
3. **Taxonomy-deprecation expansion** — if a `microsector_id` filter targets a row with `merged_into IS NOT NULL`, expand the filter to include the successor so bookmarks survive taxonomy reshuffles.

---

## 3. Cost projections

All figures at Gemini 2.5 Flash pricing ($0.15 / $0.60 per 1M input/output tokens, per `cost-tracker.ts::estimateCostUsd`). These are working numbers, not commitments — log against `generation_costs` to reconcile.

### 3.1 Concept cards (one-shot seeding)

| Stage | Items | Tokens in/out (est) | USD/item | Total |
|---|---|---|---|---|
| Candidate extraction | n/a | 0 (pure SQL) | $0 | $0 |
| Gemini generation, successful draft | 50 | 2,500 in / 900 out | $0.00092 | ~$0.05 |
| Sonnet re-draft of canonical-source cards (~10%) | 5 | 3,000 in / 1,200 out | $0.027 | ~$0.14 |
| **Phase 2 seed total** | **50** | — | — | **≈ $0.20** |

Steady state: ~30 new cards/month at $0.03 total. The editorial review queue is the bottleneck, not the model spend.

### 3.2 Microsector brief blocks

~108 microsectors × 6 LLM-generated block types, but cadence staggers the spend hard:

| Block | Cadence | Cost per refresh | Refreshes/year/sector | Annual $/sector |
|---|---|---|---|---|
| fundamentals | yearly | ~$0.001 | 1 | $0.001 |
| key_mechanisms | yearly | ~$0.002 | 1 | $0.002 |
| australian_context | yearly | ~$0.002 | 1 | $0.002 |
| current_state | weekly | ~$0.002 | 52 | $0.104 |
| whats_moving | daily | ~$0.001 | 365 | $0.365 |
| watchlist | quarterly | ~$0.001 | 4 | $0.004 |

Unclamped upper bound: **~$52/year** for all 108 microsectors. In practice the input-hash short-circuit skips a large fraction of `whats_moving` refreshes (microsectors without fresh articles return `{ skipped: 'inputs_unchanged' }` for free), pulling the realistic spend under **$25/year**.

`related` has no LLM cost — SQL derivation only.

### 3.3 Learning paths

Per generated path: ~1.2k tokens for intent parse + ~2.5k for coherence = **~$0.003 per path at Flash**. At 200 user-generated paths/month that's $0.60/month.

Editor-curated paths use `scripts/learn/author-path.ts` (Phase 3) and skip the LLM entirely.

### 3.4 Regime-change detector

Zero LLM cost. Runs in ~200ms per full scan against `entity_relationships`.

### 3.5 Total budget envelope (Learn, steady state)

| Bucket | Monthly USD |
|---|---|
| Concept cards (new + rewrites) | ~$0.10 |
| Microsector briefs | ~$2 |
| Learning paths (user-generated) | ~$0.60 |
| Regime-change detector | $0 |
| **Total** | **~$2.70/month** |

This is well inside the existing enrichment budget envelope ($1–1.50/day for the core pipeline per CLAUDE.md). Learn's cost is not a planning constraint — **editorial review capacity is.**

---

## 4. Editorial review workflow

Every generated artifact lands with `editorial_status='ai_drafted'`. No surface should render an `ai_drafted` artifact without an editorial-status badge. The five status values (enum in `001-learn-prelude.sql`):

| Value | Meaning |
|---|---|
| `editor_authored` | Human wrote it end-to-end (CLI or admin UI). |
| `editor_reviewed` | Model drafted, editor accepted with or without edits. |
| `previously_reviewed_stale` | Was reviewed at version N, current version is higher. |
| `ai_drafted` | Default for LLM output; shown with a visible badge and a "flag for review" affordance. |
| `user_generated` | User-generated path or note; never rendered as canonical. |

### 4.1 Concept cards

1. **Extract.** `extractor.ts` populates `concept_card_candidates` from 4 sources (briefing corpus, entity registry, manual seed, canonical sources). Dedupe groups are resolved via `similarity(term) > 0.7`.
2. **Review candidates.** Editor inspects `concept_card_candidates.status='pending_review'` and flips rows to `approved` (Phase 3 admin UI; SQL or `candidate-queue.ts::approve` in the interim).
3. **Generate.** `scripts/learn/generate-concept-cards.ts [--limit N] [--source ...] [--dry-run]` promotes approved candidates. Dedupe-group siblings auto-reject when one is promoted first.
4. **Review drafts.** `concept_cards.editorial_status='ai_drafted'` rows render with a badge in the admin Learn queue (Phase 3). Editor either:
   - Edits in place and flips status → `editor_reviewed` (increments `version`, recomputes `content_hash`).
   - Rewrites and re-inserts with `scripts/learn/author-concept-card.ts --file <path> --reviewer <user_id> --allow-update`, landing as `editor_authored`.
5. **Supersede.** Regime-change-flagged cards get a `superseded_by` pointer to the replacement; old cards stay queryable via `deprecated_at`.

### 4.2 Microsector brief blocks

1. **Seed.** `ensureBriefRows()` backfills one `microsector_briefs` row per non-deprecated microsector. Idempotent.
2. **Refresh.** `scripts/learn/refresh-brief-blocks.ts [--dry-run] [--block-type ...] [--microsector ...]` runs the scheduler. Cadence governs what runs; input-hash governs whether it costs anything.
3. **Review.** Each block carries its own `editorial_status` + `version` + `content_hash`. The regime-change detector can flip `regime_change_flagged` on the parent brief without touching the blocks.
4. **Nick's Lens.** Manual-only. The schema refuses to set `nicks_lens.cadence_policy != 'manual'` and `block-generator.ts` throws if anyone asks it to generate one. This is deliberate.

### 4.3 Learning paths

1. **User path.** UI form → `parseIntent` → refusal handlers → substrate selection → prereq walk → sequence → coherence pass → persist. Generation warnings are surfaced on the review screen before the path is saved.
2. **Curated path.** `scripts/learn/author-path.ts` (Phase 3). Editor supplies structured items; no LLM calls.
3. **Drift.** `learning_paths.update_policy ∈ {frozen, live, periodic}` governs whether regenerated content replaces items at read-time or only at explicit re-author.

---

## 5. Operator knobs & feature flags

| Flag / env | Default | Purpose |
|---|---|---|
| `LEARN_GENERATION_ENABLED` | unset | Hard gate on all LLM-emitting code paths. Set to `true` in the environment before running any generation script; dry-run paths bypass it. |
| `GOOGLE_AI_API_KEY` | — | Required for concept card + brief block + path intent/coherence calls. |
| `scripts/learn/generate-concept-cards.ts --limit <n>` | 25 | Per-run cap. Keeps reviewer queues from exploding. |
| `scripts/learn/generate-concept-cards.ts --source <s>` | any | Filter by `extraction_source` (briefing_corpus \| entity_registry \| manual_seed \| canonical_source). |
| `scripts/learn/refresh-brief-blocks.ts --block-type <t>` | all generated types | Scope to one block type per run. |
| `scripts/learn/refresh-brief-blocks.ts --microsector <slug>` | all | Scope to one microsector. |
| `deriveRelatedForAllBriefs({ topN, coMentionLookbackDays })` | 8, 90 | SQL-only helper — safe to run on schedule. |

---

## 6. Observability

- **Cost view.** `SELECT * FROM generation_costs WHERE module LIKE 'learn%' ORDER BY day DESC LIMIT 30;` — daily token + USD by module + stage.
- **Per-run telemetry.** `enrichment_runs` rows with `module IN ('learn-concept','learn-brief','learn-path','learn-regime')` give batch size, tokens, duration, errors.
- **Candidate queue depth.** `SELECT status, COUNT(*) FROM concept_card_candidates GROUP BY 1;` — backlog pressure on editorial review.
- **Regime-change freshness.** `SELECT microsector_id, regime_change_flagged_at FROM microsector_briefs WHERE regime_change_flagged ORDER BY 2 DESC;` — sanity check on the detector.

---

## 7. Known gaps (carried into Phase 3)

- `editorial_status` is not exposed in `RetrievedContent`. The boost + allowlist hooks in `retriever-extensions.ts` are wired but inert until Phase 3 extends the base retriever.
- Editorial queue endpoint is stubbed in `regime-change-detector.ts` (currently `console.log`). Wire when the Phase 3 admin queue API lands.
- Canonical-source path in `concept-card-generation.md` flags a Sonnet upgrade hook; implementation deferred.
- `reforms` / `repeals` predicates aren't in the v2 relationship vocab yet — when they land, add them to `REGIME_PREDICATES`.
- Path generator's `logGeneration` passes `inputTokens: 0 / outputTokens: 0` — intent-parser and coherence-pass need to surface token counts for accurate cost accounting.

These are tracked in `phase-2-handoff.md` and are explicit Phase 3 prerequisites.
