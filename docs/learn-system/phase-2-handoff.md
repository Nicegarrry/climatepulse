# Phase 2 Handoff

**Branch**: `feat/learn-system`
**Base**: `main` (post-merge of `feat/learn` UI + graph-rag)
**Commits so far**:
- Phase 1: schema migrations + design docs
- Phase 2: generation pipelines + retrieval + prompts (this commit)

This doc is the single source of truth for resuming work in a **fresh context window**. Everything needed to continue sits on disk; nothing lives only in conversation memory.

---

## What's done

### Phase 1 (committed, reviewable)
- `docs/learn-system/00-agent-team-plan.md` — 4-phase roadmap with agent-team orchestration
- `docs/learn-system/01-schema.md` — ER diagram, integration with existing tables, versioning strategy
- `docs/learn-system/02-edge-cases.md` — 8 concrete decisions
- `scripts/migrations/learn/001-learn-prelude.sql` — shared enum + trigger + additive columns + generation_costs view
- `scripts/migrations/learn/010-concept-cards.sql` — concept_cards + candidates + relationships
- `scripts/migrations/learn/020-microsector-briefs.sql` — briefs + blocks with per-block cadence
- `scripts/migrations/learn/030-learning-paths.sql` — paths + items + progress + deep_dives (schema only)
- `scripts/migrations/learn/040-knowledge-surfaces.sql` — surfaces + private content + members + analytics

### Phase 2 (committed, reviewable)

**Generation pipelines** (`src/lib/learn/`):
- `concept-cards/` — extractor (4 sources), candidate queue, generator (Gemini Flash default, Sonnet hook documented)
- `microsector-briefs/` — block generator (per-type dispatch, nicks_lens guard, related skip), scheduler (cadence windows, concurrency 3), seeder
- `path-generator/` — intent parser, substrate selector, prereq walker, sequencer, coherence pass, refusal handlers, orchestrator, persister
- `regime-change-detector.ts` — scans entity_relationships for supersedes/opposes triples
- `retriever-extensions.ts` — `retrieveForLearn` with editorial boost, freshness decay, taxonomy-deprecation expansion
- `cost-tracker.ts` — `logGeneration` writes to `enrichment_runs` with `module='learn-*'`
- `types.ts` — shared Learn types

**Prompts** (`prompts/learn/`):
- `concept-card-generation.md` — Newsreader-style editorial voice, 60-word inline summary, ≥3 sources, uncertainty_flags required
- `brief-blocks/fundamentals.md` — yearly cadence, authoritative anchors only
- `brief-blocks/key-mechanisms.md` — yearly, structured mechanism list
- `brief-blocks/australian-context.md` — annual, regulators + market structure + policy framework
- `brief-blocks/current-state.md` — weekly, last-90-days synthesis
- `brief-blocks/whats-moving.md` — daily, last-14-days pointer list
- `brief-blocks/watchlist.md` — quarterly, anchored scheduled events only
- `path-intent.md` — taxonomy-grounded intent parser
- `path-coherence.md` — single-pass coherence reviewer

**CLI**:
- `scripts/learn/refresh-brief-blocks.ts` — `--dry-run`, `--block-type`, `--microsector`, env-gated on `LEARN_GENERATION_ENABLED=true`

---

## What's deferred (with reasons)

### Blocked on env + user approval
1. **Seed generation of 50 concept cards + 10 microsector brief drafts.** Needs `LEARN_GENERATION_ENABLED=true` + `GOOGLE_AI_API_KEY` + user approval of the candidate list. Runbook in the next section.

### Not written to disk yet (agents returned blueprints; context-pressured write-out deferred)
2. **`scripts/learn/generate-concept-cards.ts`** — CLI wrapping `concept-cards/candidate-queue.promote()` at concurrency 3 with `--limit`, `--dry-run`, `--source` args, env-gated. **Blueprint in transcript, writing to disk is a 5-minute task to re-do in fresh session.**
3. **`scripts/learn/author-concept-card.ts`** — CLI for editor-authored cards from a JSON file with `--file <path>`. **Blueprint ready.**

### Blocked on Phase 3 surface work
4. **Editorial queue API integration in `regime-change-detector.ts`** — currently `console.log`-stubbed. Wire once the editorial queue endpoint ships in Phase 3.
5. **`editorial_status` field in `RetrievedContent`** — `retriever-extensions.ts` has TODOs for editorial boost + status allowlist because the underlying `RetrievedContent` shape doesn't surface `editorial_status`. Phase 3 extends `retrieveContent` to join against source tables and return the field; the boost/allowlist code is wired and becomes live automatically.
6. **`docs/learn-system/03-generation-pipelines.md`** — prompt design rationale + cost projections + review-queue workflow doc. Deferred because prompt-authoring happened in parallel with code and the doc is best written once both are settled.

### Vocabulary gap (out-of-scope for Learn)
7. **`reforms` / `repeals` predicates not in `entity_relationships` v2 vocab** — currently 17 predicates; regime-change-detector uses `supersedes` + `opposes` only. When the predicate vocab expands, add the new entries to `REGIME_PREDICATES` in `regime-change-detector.ts`.

### Structural (Phase 2 scope consciously limited)
8. **`related` brief-block is not LLM-generated.** `block-generator.ts` returns `skipped: 'related_derived_not_generated'` for this type. Needs a SQL-only helper that derives related microsectors from taxonomy proximity + article co-mentions. Short (~50 lines). Worth doing before first production run but not blocking.
9. **2 curated seed paths** (AU Electricity Markets + Carbon Markets). These are interactive authoring with the user using a CLI that doesn't exist yet (`scripts/learn/author-path.ts`). Phase 3 task.

### Deliberately not implemented
10. **Deep Dive generation pipeline.** Schema only per plan. No scope change requested.

---

## Runbook — generating seed content (when you're ready)

```bash
# 1. Apply Phase 1 migrations (one-time, idempotent)
psql "$DATABASE_URL" -f scripts/migrations/learn/001-learn-prelude.sql
psql "$DATABASE_URL" -f scripts/migrations/learn/010-concept-cards.sql
psql "$DATABASE_URL" -f scripts/migrations/learn/020-microsector-briefs.sql
psql "$DATABASE_URL" -f scripts/migrations/learn/030-learning-paths.sql
psql "$DATABASE_URL" -f scripts/migrations/learn/040-knowledge-surfaces.sql

# 2. Seed microsector_briefs rows (one per active microsector)
npx tsx -e "import('./src/lib/learn/microsector-briefs/seeder').then(m => m.ensureBriefRows())"

# 3. Extract concept card candidates (safe; no LLM calls)
npx tsx -e "
  import('./src/lib/learn/concept-cards/extractor').then(async m => {
    await m.extractFromBriefingCorpus({ lookbackDays: 60, limit: 300 });
    await m.extractFromEntityRegistry({ limit: 100 });
  });
"

# 4. Review pending candidates and approve a subset (admin UI will land in Phase 3;
#    for now, inspect and approve directly in SQL)
psql "$DATABASE_URL" -c "
  SELECT id, term, extraction_source, signal_count
    FROM concept_card_candidates
    WHERE status='pending_review'
    ORDER BY signal_count DESC LIMIT 100;
"
# Approve the top 50:
psql "$DATABASE_URL" -c "
  UPDATE concept_card_candidates SET status='approved', reviewed_at=NOW()
    WHERE id IN (SELECT id FROM concept_card_candidates
                   WHERE status='pending_review'
                   ORDER BY signal_count DESC LIMIT 50);
"

# 5. Generate (enable the feature flag first)
export LEARN_GENERATION_ENABLED=true
export GOOGLE_AI_API_KEY=...

# 5a. Concept cards — writes to scripts/learn/generate-concept-cards.ts when scaffolded
#     Until then, use the library directly:
npx tsx -e "
  import('./src/lib/learn/concept-cards/candidate-queue').then(async m => {
    const pending = await m.listPending(50);
    for (const c of pending) {
      try { await m.promote(c.id); console.log('OK', c.term); }
      catch (e) { console.log('FAIL', c.term, String(e)); }
    }
  });
"

# 5b. Brief blocks — use the CLI
npx tsx scripts/learn/refresh-brief-blocks.ts --dry-run
# If dry-run looks right:
npx tsx scripts/learn/refresh-brief-blocks.ts

# 6. Verify cost tracking
psql "$DATABASE_URL" -c "SELECT * FROM generation_costs WHERE module LIKE 'learn%' ORDER BY day DESC;"
```

---

## Phase 3 entry points (what to build next)

Per the approved plan (`docs/learn-system/00-agent-team-plan.md` § Phase 3):

**5 parallel workstreams** via `general-purpose` agents (they have Write tool; don't use `feature-dev:code-architect` — it's read-only):

| Team | Scope |
|---|---|
| G — Learn landing | Port existing `src/components/learn/` components into `app/learn/page.tsx`; swap mock imports for `retrieveForLearn` calls. Dashboard tab entry becomes `<Link href="/learn">`. |
| H — Concept pages | `app/learn/concepts/[slug]/page.tsx` full card, disambiguation page pattern, `<InlineConceptTooltip>` component |
| I — Microsector pages | `app/learn/microsectors/[slug]/page.tsx` with block-based render, per-block timestamps/badges, regime-change banner, low-signal "quarterly pulse" variant |
| J — Path pages | `app/learn/paths/[slug]/page.tsx` overview, `/read/page.tsx` reader with completion tracking, `/generate/page.tsx` form → confirm → generate → review |
| K — Search + inline + seeds | `app/learn/search/page.tsx` grouped, update existing briefing + Q&A rendering for inline tooltips, `scripts/learn/author-path.ts` CLI, author 2 seed paths with user |

**Shared components to add in Phase 3**:
- `<EditorialStatusBadge>` — one component, 5 states, used everywhere
- `<InlineConceptTooltip>` — first-occurrence-only, mobile-modal, keyboard accessible
- Reuse existing design tokens (`src/lib/design-tokens`) + Heroicons outline

**Prerequisite before Phase 3 starts**:
- User signs off on Phase 2 code (this handoff's intent).
- Optionally run seed generation so Phase 3 UI has real content to render. If skipped, Phase 3 UI renders from an empty DB + a seed fixture that's shipped as a JSON file.

**Critical change for Phase 3 agents** (lesson from Phase 2):
- Use `general-purpose` subagent_type. Do NOT use `feature-dev:code-architect` — that agent type lacks Write/Edit tools and will return inline blueprints requiring manual transcription.

---

## Phase 4 entry points

See `docs/learn-system/00-agent-team-plan.md` § Phase 4. 7 parallel workstreams for the Knowledge Surfaces primitive (Hub + Course templates, admin UI, access control, scope filter, uploaded docs, analytics).

Prerequisites before Phase 4:
- Phase 3 shipped + reviewed
- `editorial_status` exposed in `RetrievedContent` (Phase 3 gap)
- Real seed content in the DB so surfaces have substrate to scope over

---

## Lessons from Phase 2 (for future session pacing)

1. **Subagent-type matters.** `feature-dev:code-architect` returns read-only blueprints; `general-purpose` has `*` tool access and can write directly. Agent-team orchestration should default to `general-purpose` unless the specific subagent-type guarantee is needed.
2. **Prompts are best written by the orchestrator** (me), not dispatched to agents. Editorial voice is high-leverage and hard to coordinate across agents.
3. **Commit after every phase** — don't batch. Context-recovery is much easier when each phase is a clean commit.
4. **Scaffolding is a valid endpoint for a session.** Runtime content generation (LLM calls on real data) is a separate, env-gated ceremony; don't try to cram it into the same session as the code write.

---

## To resume in a fresh window

1. `git checkout feat/learn-system`
2. `git pull`
3. Read this doc (`docs/learn-system/phase-2-handoff.md`) first — it's the orientation.
4. Read `docs/learn-system/00-agent-team-plan.md` — the approved 4-phase plan.
5. Look at `git log --oneline main..HEAD` — the committed trail.
6. Pick up wherever: either (a) Phase 3 execution, (b) seed-content generation runbook above, or (c) disk-writing the two deferred CLIs (`generate-concept-cards.ts`, `author-concept-card.ts`) which have blueprints in the Phase 2 conversation transcript — straightforward to re-derive from `candidate-queue.ts` and the spec in `00-agent-team-plan.md`.

Branch is pushed after this commit — visible on GitHub with PR link.
