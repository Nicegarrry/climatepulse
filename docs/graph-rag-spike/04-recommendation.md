# Graph-RAG Spike — Recommendation

_Last updated: 2026-04-20. Structural sections finalised; relevance-conditional sections await hand-scoring of the divergent queries (see `03-comparison.md`)._

## Recommendation (preliminary)

**Most likely outcome: adopt the Postgres-native graph layer for the Learn feature only, keep pgvector authoritative for the daily briefing / podcast / contradiction-check paths, and shelve LightRAG.**

This is the structural read before relevance scoring. Two relevance scenarios shift it:
- **If hand-scoring shows graph-walk wins on multi-entity / multi-hop queries** (ew-10, mh-01, mh-02, mh-04 in the divergent set): adopt for Learn confidently. Final recommendation as above.
- **If hand-scoring shows graph-walk's distinct picks are no better than vector** (i.e. graph-walk is just churn): drop the storage and read paths but keep the entity_relationships table populated as a future-options hedge — the cost is trivial ($1.80/mo) and pulling it back out of the system is easy if needed.

Neither scenario justifies escalating to LightRAG. The structural findings (latency, cost, storage shape) all rule out the conditions that would make a Python sidecar + Neo4j worthwhile.

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

## If we adopt (Postgres-native, Learn only) — rollout

1. **Land the spike branch behind `GRAPH_EXTRACTION_ENABLED=false` in prod.** Schema applied, code deployed, no behaviour change until we flip the flag.
2. **Apply v2 vocab** (see `scripts/migrate-graph-rag-vocab-v2.sql`): adds `competes_with`, `founded`, `opposes`, `researcher_at`, plus prompt update to absorb tense variants of `partners_with`. Cuts spillover from 42% → ~30% on next backfill.
3. **Shadow mode** (week 1): flip flag in prod. Relationships extracted and stored, no read path uses them. Monitor: extraction cost, `_uncategorised` rate trend, table growth, error rate in `console.warn` logs.
4. **Backfill** (week 2, off-peak): `npx tsx scripts/backfill-relationships.ts --days 60`. Re-check extraction quality on another 50-triple sample.
5. **Wire into Learn only** (week 3): use `pgGraphWalkBackend` for Learn's retrieval. All other read paths unchanged.
6. **Evaluate after a month of real usage.** Compare Learn engagement metrics with and without graph-walk (split test or sequential A/B). If clearly positive, consider extending to the briefing's hero-story prior-coverage lookup.
7. **In parallel**: Stage 2 entity-extraction iteration to capture more projects/regulations.

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

## What the user needs to decide after reading this

1. **Do we adopt the Postgres-native graph layer for Learn** (preliminary "yes" above, conditional on hand-scoring of the 4 divergent queries) — or do we wait and re-evaluate after Stage 2 entity-extraction is improved?
2. **Do we apply the v2 vocab now** (additive migration, low risk) or hold until after a second hand-scored backfill confirms it's worth the change?
3. **Do we keep the spike branch open** for follow-up work, or merge what we have to main behind the env flag and continue iterations on top?
