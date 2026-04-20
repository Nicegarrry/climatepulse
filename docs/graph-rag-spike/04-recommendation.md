# Graph-RAG Spike — Recommendation

_Last updated: 2026-04-20. Structural sections finalised; relevance-conditional sections await hand-scoring of the divergent queries (see `03-comparison.md`)._

## Recommendation

**Adopt the Postgres-native graph layer, but route to it selectively — only for queries with explicit multi-hop intent. Keep pgvector as the default everywhere else, including for single-entity-anchored queries. Shelve LightRAG.**

This is a more nuanced call than the structural read suggested. Hand-scoring of 109 cells across 26 query × backend slots showed:

- **graph-walk crushes multi-hop**: on `mh-01` ("projects funded by ARENA hitting milestones"), pgvector returned 0.00 mean@3, graph-walk returned 2.00. This is the textbook multi-hop case and it works exactly as graph-RAG is supposed to.
- **graph-walk hurts entity-walk and contradiction**: paired comparisons lost 3 of 5 — `ew-10` (Origin × Octopus) the worst at −1.00. The 2-hop traversal over-fetches relationships the user didn't want and dilutes the result.
- **Top-1 inversion**: graph-walk has the highest top-1 mean (1.83) but the lowest mean@3 (1.53). When right at rank 1 it's *very* right; below that, it's noisier than vector.

The recommendation that fits this evidence is **conditional routing**, not a wholesale backend switch. Use a query-classifier (or the seed-entity count, as a cheap proxy: ≥2 distinct seed entities + multi-hop verb pattern → graph-walk; otherwise vector) to decide which backend to call. This gets the multi-hop wins without paying the entity-walk losses.

None of this justifies escalating to LightRAG. The structural findings (latency, cost, storage shape) all rule out the conditions that would make a Python sidecar + Neo4j worthwhile.

## Evidence — what we measured

**Latency** (3 harness runs, n=30 queries each, all consistent):
- pgvector-only: 485 ms avg / 585 ms p95
- pgvector-cooccurrence: 475 ms avg / 522 ms p95 — **fastest**
- pg-graph-walk: 486 ms avg / 571 ms p95

The recursive CTE is not a bottleneck at this scale (1,306 triples). The "is graph-walk too slow?" risk we flagged in research is closed. Cooccurrence pre-filtering actually shrinks the vector scan enough to come in under the baseline at p95.

**Backend agreement** (top-3 per query, full breakdown in `runs/2026-04-20T04-17-51-167Z-agreement.md`):
- 2 of 30 queries identical across all 3 backends (no signal)
- 4 of 30 divergent (zero overlap between at least one backend pair)
- 24 of 30 overlap — but in nearly all cases pgvector-only ≡ cooccurrence, with graph-walk being the variant

**Important inference**: cooccurrence as a backend gives almost nothing over plain pgvector when seed entities resolve to the dominant vector hits anyway. The two filtering modes that matter in practice are **pure vector** vs **typed-graph-walk**. Cooccurrence is interesting only as a control — it isolates whether graph-walk's value comes from typed relationships specifically vs just from any entity-overlap filter.

**Extraction cost** (settled):
- 14-day backfill: $0.35 Gemini Flash for 1,165 articles
- Projected at full pipeline volume: ~$1.80/mo additional spend
- Storage at full pipeline volume after a year: ~18 MB. Trivial.
- Vocab fit on first run: 58% (758 / 1,306 stored triples)

**Quality signal from extraction** (hand-review of the smoke-test 20):
- 14 of 15 vocab-fit triples correct (~93%)
- The 1 wrong (IONNA "operates" Circle K instead of "partners_with") had the correct triple co-existing in the same article
- Average confidence: 0.86–0.96 across all vocab predicates

## Why LightRAG doesn't win this spike

The case for LightRAG would be one of three things:
1. **Storage was the bottleneck.** It isn't — recursive CTEs hit p95 < 600 ms on 1,306 triples and would scale to ~30k triples (year of pipeline data) without changing query plans.
2. **Multi-level retrieval (LightRAG's local/global modes) was needed.** Possibly relevant for Learn, not measured here. The 30-query set didn't probe summary-level retrieval. Worth flagging in the recommendation: if the Learn UX wants topical summaries spanning many articles, that's the one capability we did NOT test against, and it's where LightRAG's hybrid retrieval modes could plausibly win.
3. **Extraction quality was so poor that LightRAG's pipeline would do better.** It isn't — 93% on hand-review of vocab-fit triples; 42% spillover but with clear v2 vocab promotion candidates.

None of those conditions hold strongly enough to justify the architectural cost (Python sidecar + Neo4j Aura ≈ $80–150/mo, plus a cross-language boundary on every retrieval call).

The shelved LightRAG plan in `05-lightrag-shelved.md` stays available if the Learn UX exposes a real need we can't measure here.

## Real surprise from the spike: entity-registry coverage is the actual gating factor

5 of the 18 seeded queries had unresolved entity names. After the AGL alias fix, 4 are still genuinely missing entities:
- `Snowy Hydro` / `Snowy 2.0` (project)
- `Fortescue Future Industries` (subsidiary)
- `Renewable Energy Target` / `RET` (regulation)
- `Loy Yang` (project)

These aren't bugs in the spike — they reflect that Stage 2 entity extraction is biased toward companies and people, and under-extracts named projects/regulations. **This is the most actionable Phase-1 finding**: graph-RAG quality is bounded by what the entity registry knows about, and the ceiling won't move until Stage 2 starts pulling more named projects/regulations as entities.

Recommended follow-up regardless of the graph-RAG decision: a small Stage 2 prompt iteration to extract more named projects and named regulations as entities, with a specific calibration pass on Australian project names (Snowy 2.0, Loy Yang, Bayswater, Eraring, etc.) and named federal/state legislation.

## Rollout

1. **Land the spike branch behind `GRAPH_EXTRACTION_ENABLED=false` in prod.** Schema applied, code deployed, no behaviour change until we flip the flag.
2. **Apply v2 vocab** (see `scripts/migrate-graph-rag-vocab-v2.sql`): adds `competes_with`, `founded`, `opposes`, `researcher_at`, plus prompt update to absorb tense variants of `partners_with`. Cuts spillover from 42% → ~30% on next backfill.
3. **Shadow mode** (week 1): flip `GRAPH_EXTRACTION_ENABLED=true` in prod. Relationships extracted and stored, no read path uses them. Monitor: extraction cost, `_uncategorised` rate trend, table growth, error rate in `console.warn` logs.
4. **Backfill** (week 2, off-peak): `npx tsx scripts/backfill-relationships.ts --days 60`. Re-check extraction quality on another 50-triple sample.
5. **Build the query router** (week 3, ~½ day's work): a small classifier in front of Learn's retrieval that picks the backend per-query. Initial heuristic — use graph-walk when the query contains 2+ named entities resolving to the entity registry AND a multi-hop verb pattern (e.g. "X funded by Y", "operated by subsidiaries of"). Otherwise use vector. Iterate based on real Learn usage logs.
6. **Wire into Learn only** (week 3): the router decides per-query. All other read paths (briefing, podcast, contradiction-check, the four `/api/intelligence/*` endpoints) stay on `retrieveContent` unchanged.
7. **Evaluate after a month of real usage.** Track which backend the router picks, and Learn engagement on each. Refine the router if it's mis-routing a meaningful fraction of queries.
8. **In parallel** (the most important follow-up): Stage 2 entity-extraction iteration to capture more named projects and regulations. The spike's entity-registry coverage gap (Snowy Hydro, Loy Yang, RET, Fortescue Future Industries — all missing from the dev DB) caps how much value graph-walk can deliver until upstream extraction improves.

**What we are explicitly NOT doing**: replacing `retrieveContent` anywhere, exposing graph-walk to non-Learn paths, or attempting to use graph-walk on contradiction queries (where vector clearly wins).

## If we don't adopt — the cleanup is two SQL statements

```sql
DROP TABLE IF EXISTS entity_relationships CASCADE;
-- That's it. The pipeline.ts hook is env-flag gated, so it's already a no-op.
```

The harness at `src/lib/intelligence/evaluation/` stays — the 30-query benchmark is valuable as a regression test for any future retrieval change regardless of which backend wins.

## Top 3 risks in the recommended path

1. **The 4 divergent + ~6 most-shifted queries do not give a clear winner after hand-scoring** → we'd be picking a slightly more complex retrieval path with no measured upside. Mitigation: keep the env flag, ship in shadow mode only, decide based on real Learn engagement.
2. **Extraction quality drifts down at scale** as new article topics push the model into unfamiliar predicate territory. Mitigation: weekly check on `_uncategorised` rate; schedule a vocab review every ~2 weeks for the first 2 months.
3. **The entity-registry coverage gap doesn't get worked on** because it's not visible from Learn's UX → graph-RAG underperforms even after adoption, and gets blamed when the real cause is upstream. Mitigation: explicitly couple the rollout to a Stage 2 prompt iteration in the same sprint.

## Top 3 risks in the recommended path (updated)

1. **The query router mis-routes a non-trivial fraction of queries** — sending entity-walk queries to graph-walk hurts (we measured −1.00 on ew-10) and sending multi-hop queries to vector hurts even more (mh-01 was 0.00 on vector vs 2.00 on graph-walk). Mitigation: log every routing decision in shadow mode for the first month and tune the heuristic against the log.
2. **Hand-scored sample is small** (5 paired queries; 109 cells of 810). The directional pattern is consistent but the magnitudes have wide CIs. Mitigation: re-score after the v2 vocab + Stage 2 entity-extraction improvements land, since the corpus those decisions inform should look different.
3. **The entity-registry coverage gap** doesn't get worked on because it's not visible from Learn's UX → graph-RAG underperforms even after adoption, and gets blamed when the real cause is upstream. Mitigation: explicitly couple the rollout to a Stage 2 prompt iteration in the same sprint (see step 8 of rollout).

## What the user needs to decide after reading this

1. **Adopt the conditional-routing rollout?** This is the data-supported answer. Alternatives: (a) skip graph-walk entirely if the multi-hop wins don't matter for Learn's UX; (b) adopt unconditionally and accept the entity-walk regression; (c) wait and re-evaluate after Stage 2 entity-extraction improvements.
2. **Apply v2 vocab now or after another scored backfill?** Vocab v2 is additive and low-risk, and the spillover analysis already justified the 4 new predicates. I'd apply now; the marginal cost of waiting is one more backfill cycle of suboptimal extraction.
3. **Keep the spike branch open or merge to main behind the env flag?** Merging behind the flag is safer (one less long-lived branch to rebase repeatedly as main moves). The router work in step 5 of rollout can happen on a fresh branch off main.
