# Learn

Concept-driven reader surface. Surfaces today's core concept, featured learning paths, deep-dive podcasts, and microsector drill-down. Reader-facing tab between Briefing and Newsroom.

## Status (2026-04-20)

- Phase 1 (UI shell + mock data) merged to `main` — concept hero, paths, podcasts, microsector drill
- Phase 2 (generation pipelines + retrieval + prompts) on branch `feat/learn-system`. Handoff doc at commit `e8a2fbd` for fresh-window resumption.

## Components (`src/components/learn/`)

- `learn.tsx` — composition
- `learn.css` — scoped styles
- `today-concept-hero.tsx` — concept of the day
- `concept-overlay.tsx` — expanded reading view
- `featured-paths.tsx` + `path-side-panel.tsx` — curated learning paths
- `deep-dive-podcasts.tsx` — themed episodes relevant to the path
- `browse-microsectors.tsx` + `microsector-drill.tsx` — taxonomy drill
- `continue-learning.tsx` — resume state
- `header-art.tsx`, `mlf-viz.tsx`, `waveform.tsx`, `trust-marker.tsx` — presentation
- `mock-data.ts`, `types.ts`

## Retrieval

All Learn retrieval flows through the conditional router in `src/lib/intelligence/router.ts`:

- Routes to **graph-walk** when ≥1 named entity in the query resolves in `entities` AND the query has a multi-hop verb (`funded by`, `operated by`, `developed by`, `acquired by`, `owned by`, `subsidiaries of`, `linking X and Y`)
- Otherwise routes to **vector** (`retrieveContent`)
- Heuristic is intentionally simple (~10 ms) — log decisions in prod and tighten once real Learn usage data lands

Why this split: the graph-rag spike showed the killer case (`mh-01: "projects funded by ARENA"`) went from 0.00 → 2.00 mean@3 on graph-walk. Single-seed multi-hop queries are the sweet spot — requiring ≥2 entities would miss exactly what graph-walk is best at. The trade-off: entity-anchored queries with a multi-hop word in them (e.g. "What is AGL acquired by?") may now route to graph-walk and underperform. Mitigated by logging every routing decision.

Full background: `docs/graph-rag-spike/04-recommendation.md`.

## Migrations

- `scripts/migrate-graph-rag.sql` — entity relation schema
- `scripts/migrate-graph-rag-vocab-v2.sql` — predicate vocab refinements

Both already applied to prod.

## Where to pick up Phase 2

Start from the handoff at commit `e8a2fbd` on `feat/learn-system`. Don't restart from scratch — generation pipelines, prompts, and retrieval plumbing are in place.
