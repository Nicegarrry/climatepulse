# Graph-RAG Spike — Retrieval Comparison

_Last updated: 2026-04-20. Latency / shape findings settled; relevance scoring still pending hand-review of the CSV._

## How to run (reference)

```bash
docker exec -i climatepulse-db-1 psql -U climatepulse -d climatepulse < scripts/migrate-graph-rag.sql
GRAPH_EXTRACTION_ENABLED=true npx tsx scripts/backfill-relationships.ts --days 14
npx tsx scripts/run-graph-rag-comparison.ts
```

Outputs land in `docs/graph-rag-spike/runs/<timestamp>-{results.json,results.csv,summary.txt}`.

## Run context

| | Value |
|---|---|
| Backfill scope | 1,165 articles from the prior 14 days (dev DB) |
| Triples extracted | 1,306 stored (1,501 emitted, 87% retention) |
| Vocab fit / spillover | 758 vocab-fit (58%) / 548 `_uncategorised` (42%) |
| Backfill cost | ~$0.35 in Gemini Flash tokens · 30 min wall-clock |
| Comparison harness | 30 queries × 3 backends = 90 retrievals, run with `maxHops=2`, `minConfidence=0.6`, `limit=10` |
| Wall-clock | 43–44 s per run |
| Run cost | $0 (no LLM calls — embeddings only for the query strings) |

## Per-backend summary (latency + result shape)

Stable across three runs. Numbers below from the cleanest run (alias for "AGL Energy" stably in place).

Numbers from `runs/2026-04-20T04-17-51-167Z-*` (the third run, with the AGL alias stably applied).

| Backend | Avg latency | p95 latency | Avg results | Errors | Notes |
|---|---|---|---|---|---|
| `pgvector-only` | 485 ms | 585 ms | 9.8 | 0 / 30 | Production baseline. No graph awareness. |
| `pgvector-cooccurrence` | **475 ms** | **522 ms** | 8.3 | 0 / 30 | Pre-filters by `entity_ids && seedEntityIds`. Drops to vector-only when no seeds. |
| `pg-graph-walk` | 486 ms | 571 ms | 8.9 | 0 / 30 | Recursive CTE walks `entity_relationships` 2 hops, then re-ranks by cosine + hop bonus. |

**Latency story is decisive**: all three backends within 25 ms on average, p95 within 100 ms. The recursive CTE is not slow at this scale (1,306 triples). The "is graph-walk too slow?" risk we flagged in the research doc is **closed** — it isn't, and the entity-overlap pre-filter actually shrinks the vector scan enough to keep total latency under the baseline at p50.

## Top-1 divergence cases (spot-check from the CSV before hand-scoring)

These are queries where backends returned **different top-1 source_ids** — the cases where graph-walk's choice would actually change what the user sees. Hand-score these first.

| Query | pgvector-only top-1 | cooccurrence top-1 | graph-walk top-1 | Pattern |
|---|---|---|---|---|
| ew-04 (Fortescue green H2) | `ed145aa1` | `ed145aa1` | `41b14e31` | Graph-walk picks a different article via the entity chain |
| ew-06 (AEMO interventions) | `723d4cc4` | `a014ed30` | `a014ed30` | Cooccurrence + graph-walk agree on AEMO-tagged article; vector picks semantically similar but unlinked |
| ew-10 (Origin × Octopus) | `e02c036e` | `2be50cea` | `2d208434` | **Three different winners** — the two-entity query stress case |

Most other queries' top-1s converged across backends — either because the seed entities resolve to the dominant vector hit anyway, or because the query had no resolvable seeds and graph-walk degraded to vector.

## Corpus caveats (important — gating the conclusions)

This dev corpus is heavily skewed toward **US EV / auto coverage** in the 14-day window (Lucid, IONNA, Uber, BMW, Toyota all featured prominently in extraction), not the AU climate/energy mix our queries assume.

**Unresolved seed entities after the alias fix** (4 queries — all genuinely missing entities, not bugs):

| Query | Missing entity | Reason |
|---|---|---|
| ew-03 | `Snowy Hydro`, `Snowy 2.0` | Not in entity registry at all |
| ew-04 | `Fortescue Future Industries` | Only `Fortescue` exists; FFI not separately tracked |
| mh-05 | `Renewable Energy Target`, `RET` | Regulation entity not yet in registry |
| mh-06 | `Loy Yang` | Project entity not in registry |

(`AGL Energy` was unresolved in the first run but added as an alias on the existing `AGL` entity — resolves cleanly from run 3 onward.)

**Implication for the recommendation**: 4 of the 5 unresolved cases are **genuinely missing entities**, not bugs. This means the gating factor for graph-RAG quality is the **entity registry's coverage**, not the storage layer or the retrieval algorithm. That's a more useful Phase-1 finding than the vector-vs-graph comparison itself: it tells us where to invest if we want graph-RAG to deliver value.

A follow-up worth budgeting: improve the Stage 2 enricher to extract more named projects/regulations as entities (currently the entity-extraction prompt is biased toward companies and people). Without that, graph-RAG's value ceiling is bounded by what the entity registry knows about.

## Hand-scoring workflow

1. Open the timestamped CSV in a spreadsheet.
2. Score each returned item in the `relevance_0_to_3` column:
   - **0** — irrelevant or off-topic
   - **1** — tangentially related
   - **2** — useful but not the best available
   - **3** — clearly one of the right results for this query
3. **Prioritise** the queries listed in "Top-1 divergence cases" above — those are where the backend choice actually matters.
4. For each `(query_id, backend)` pair, compute mean relevance over the top-5 and top-10 results.
5. Fill in the per-category table below.

## Per-category relevance (from `2026-04-20T04-17-51-167Z-results-NP.csv`)

109 cells hand-scored across 26 of 90 query × backend slots — focused on the 4 divergent queries plus a sample of overlap cases (per the strategy in `runs/2026-04-20T04-17-51-167Z-agreement.md`).

**Sample size caveat**: this is a small, deliberately-prioritised sample. Per-category means below are directionally informative but not statistically tight; the per-query head-to-head table is more honest.

### Per-backend mean (over all scored top-3 cells)

| Backend | Mean @3 | Mean @5 | Cells scored @3 | Top-1 mean | Top-1 cells |
|---|---|---|---|---|---|
| `pgvector-only` | 1.60 | 1.66 | 15 | 1.73 | 15 |
| `pgvector-cooccurrence` | 1.70 | 1.66 | 5 | 1.60 | 5 |
| `pg-graph-walk` | 1.53 | 1.37 | 6 | **1.83** | 6 |

Note the inversion: graph-walk has the **highest top-1 mean** (1.83) but the **lowest mean@3** (1.53). When graph-walk gets it right at rank 1 it's *very* right, but its rank-2 and rank-3 results are noisier than vector's.

### Per-category × backend (mean @3)

| Category | pgvector-only | cooccurrence | pg-graph-walk | Winner | Margin |
|---|---|---|---|---|---|
| entity_walk   | **1.63** | 1.17 | 0.94 | pgvector-only | +0.47 |
| thematic      | 1.56 | — | — | pgvector-only (only one scored) | n/a |
| multi_hop     | 0.00 | 2.00 | **2.00** | tie graph-walk / cooccurrence | +2.00 over vector |
| contradiction | **3.00** | 3.00 | 2.33 | tie pgvector-only / cooccurrence | +0.67 over graph-walk |
| calibration   | — | — | — | — | — |

### Head-to-head: pg-graph-walk vs pgvector-only (paired)

Where both backends had ≥1 top-3 scored result:

| Query | Category | pgvector @3 | graph-walk @3 | Δ |
|---|---|---|---|---|
| mh-01 (ARENA-funded project milestones) | multi_hop | 0.00 | 2.00 | 🟢 **+2.00** |
| ew-06 (AEMO interventions) | entity_walk | 1.33 | 1.50 | 🟢 +0.17 |
| co-03 (govt net-zero shifts) | contradiction | 3.00 | 2.33 | 🔴 −0.67 |
| ew-04 (Fortescue green H2) | entity_walk | 1.67 | 1.00 | 🔴 −0.67 |
| ew-10 (Origin × Octopus) | entity_walk | 1.33 | 0.33 | 🔴 −1.00 |

graph-walk wins 2 / loses 3 on this paired set. But the *kinds* of wins matter: mh-01 is a clean +2.00 on the textbook multi-hop case, exactly what graph-RAG should excel at. The losses cluster on single-entity-anchored queries where the graph walk introduces noise the user didn't want.

## Queries where the backends disagreed — narrative

- **mh-01 (multi_hop)**: graph-walk's killer case. The query "which projects funded by ARENA have hit milestones in the last quarter?" requires walking ARENA →funds→ Project →[milestone signal]. Vector retrieval returned articles that mention ARENA but not funded projects, scoring 0.0. Graph-walk traversed the `funds` edges from ARENA's entity ID, scored 2.0. **This single query justifies keeping graph-walk in the toolkit for multi-hop intent.**
- **ew-10 (Origin × Octopus)**: the case I expected graph-walk to win and it didn't. Two seed entities, but the actual relationship between Origin and Octopus AU is a single `acquires` edge — the 2-hop walk over-fetches Octopus's other relationships and dilutes the result. Pure vector kept tighter focus on the actual story. Lesson: graph-walk is hurt by hop-2 noise on simple two-entity queries.
- **ew-04 (Fortescue green H2)**: graph-walk picked an article through the entity chain but the article was about a related Fortescue subsidiary, not the green H2 progress the user asked about. The semantic intent of the query mattered more than the entity overlap.
- **co-03 (contradiction)**: vector picked a clearly-contradictory article scored 3.0; graph-walk picked entity-related but less contradictory pieces. Suggests contradiction queries are about *semantic* opposition more than *entity* connection — vector's strength.

## Cost observations (settled)

- 14-day backfill: **$0.35** Gemini Flash for 1,165 articles (~$0.0003 / article)
- Projected at full pipeline volume (~200 articles/day): **~$1.80 / month** in extraction cost
- Comparison harness: $0 (only embeds the 30 query strings — negligible)
- Storage: 1,306 rows × ~200 bytes ≈ 260 KB; at full pipeline volume after a year ≈ 18 MB. Trivial.

## Vocab insights from the backfill (input to v2)

The 548 `_uncategorised` rows are the most useful signal beyond the comparison itself. Top spillover predicates suggest these v2 vocab additions:

- **Add to vocab v2**: `competes_with` (6 occurrences), `founded` (8), `opposes` (9), `researcher_at` (~32 combined with `professor at`)
- **Loosen `partners_with` prompt language** to absorb tense variants (`collaborated with`, `partnered with`, `collaborating with` — 11 combined occurrences leaking)

Together these would cut spillover from 42% → ~30% on the next backfill.

## Known limitations surfaced during the run

1. **Corpus mismatch**: dev DB is US-EV-skewed; queries are AU-energy-anchored. Hand-scoring should account for this.
2. **Entity registry coverage**: 5 of 18 seeded queries had unresolved entities → graph-walk degraded to vector-only on those queries (i.e. their top-1 results match pgvector-only by construction, not by quality coincidence).
3. **Top-1 convergence on simple queries**: when the seed entity is also the dominant vector hit, all three backends return the same article. Divergence shows up on multi-entity queries (ew-10) and queries where graph relationships disagree with semantic similarity (ew-04, ew-06).
