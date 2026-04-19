# Graph-RAG Spike — Retrieval Comparison

_This doc is populated after running the harness. Placeholder until Phase 4 execution._

## How to run

```bash
# Ensure the migration has applied and relationships have been backfilled first:
#   docker exec -i climatepulse-db-1 psql -U climatepulse -d climatepulse < scripts/migrate-graph-rag.sql
#   GRAPH_EXTRACTION_ENABLED=true npx tsx scripts/backfill-relationships.ts --days 14
#
# Then:
npx tsx scripts/run-graph-rag-comparison.ts
```

Outputs land in `docs/graph-rag-spike/runs/<timestamp>-{results.json,results.csv,summary.txt}`.

## Hand-scoring workflow

1. Open the timestamped CSV in a spreadsheet.
2. Score each returned item in the `relevance_0_to_3` column:
   - **0** — irrelevant or off-topic
   - **1** — tangentially related
   - **2** — useful but not the best available
   - **3** — clearly one of the right results for this query
3. For each `(query_id, backend)` pair, compute mean relevance over the top-5 and top-10 results.
4. Flag any query where the three backends disagree strongly; those are the interesting cases.
5. Copy-paste your summary into this doc under "Results" below.

## Results (to be filled after run)

### Per-backend summary

| Backend | Avg latency | p95 latency | Avg results | Mean relevance @5 | Mean relevance @10 |
|---|---|---|---|---|---|
| `pgvector-only` | TBD | TBD | TBD | TBD | TBD |
| `pgvector-cooccurrence` | TBD | TBD | TBD | TBD | TBD |
| `pg-graph-walk` | TBD | TBD | TBD | TBD | TBD |

### Per-category summary

| Category | pgvector-only | pgvector-cooccurrence | pg-graph-walk | Winner | Margin |
|---|---|---|---|---|---|
| entity_walk  | TBD | TBD | TBD | TBD | TBD |
| thematic     | TBD | TBD | TBD | TBD | TBD |
| multi_hop    | TBD | TBD | TBD | TBD | TBD |
| contradiction| TBD | TBD | TBD | TBD | TBD |
| calibration  | TBD | TBD | TBD | TBD | TBD |

### Queries where the backends disagreed

_Fill in 3–5 interesting cases with a short narrative explaining why._

- **mh-04 ("projects operated by subsidiaries of European utilities")**: … (expected 3-hop graph-walk wins, vector misses the chain)
- **th-01 ("wholesale electricity prices")**: … (expected vector and graph-walk are near-tied, cooccurrence degrades if no seed entities)

## Cost observations

- Gemini Flash spend during the 14-day backfill: TBD
- Projected monthly cost at current pipeline volume: TBD
- Extraction quality from the 50-triple hand sample: TBD% correct (predicate accuracy × entity resolution × evidence faithfulness)

## Known limitations surfaced during the run

_Anything the harness couldn't test cleanly — unresolved seed entities, missing content, DB hotspots, etc._
