# LightRAG — Shelved Phase 2 Plan

This doc keeps the LightRAG option alive without needing a re-discovery cycle. Use it when:
- The Postgres-native approach succeeds but we hit a specific failure mode it can't address
- A year from now, someone asks "why didn't we use LightRAG?" and we need the receipts
- We decide to escalate Phase 2

## Summary

LightRAG (https://github.com/HKUDS/LightRAG) is a Python library for hybrid vector + graph retrieval. It auto-extracts entities and relationships from documents at ingestion time using an LLM, stores them across a KV + vector + graph backend, and exposes a dual-level retrieval API (naive / local / global / hybrid).

**Assessment as of 2026-04**: high quality, actively maintained, MIT licensed, but doesn't fit our stack cleanly because (a) it's Python-only with no JS/TS bindings and (b) production-grade deployment wants Neo4j for the graph store (their own docs say Apache AGE perf "is not as competitive"). Adopting means a Python sidecar service + a second database.

## When to escalate to Phase 2

Escalate ONLY if the Postgres-native approach in Phase 1 fails on **specific, measurable** retrieval quality dimensions that LightRAG would plausibly fix. Examples:

- Multi-hop queries (`mh-*` category) perform _worse_ than pgvector-only after graph walk — suggests the graph is too sparse, and LightRAG's denser auto-extraction might help
- `_uncategorised` rate on extracted triples stays >40% after prompt iteration — suggests our tight vocab is leaving value on the table, and LightRAG's open-vocab relationship extraction would capture more
- Retrieval latency on graph-walk p95 exceeds 2× vector baseline at production scale — suggests recursive CTEs don't scale for us, and a dedicated graph DB would

Don't escalate for:
- Marginal quality improvements on queries that already work
- Extraction quality problems (LightRAG has the same extraction-quality bottleneck — it just uses a different prompt)
- Operational complexity objections (LightRAG is _more_ operationally complex than what we have)

## Architecture if adopted

```
┌─────────────────────────────┐
│  Next.js / Vercel           │
│  (existing app, unchanged)  │
└────────────┬────────────────┘
             │ REST
             ▼
┌─────────────────────────────┐       ┌──────────────────────┐
│  Python sidecar on Railway  │       │  Supabase Postgres   │
│  FastAPI wrapper around     │──────▶│  • existing schema   │
│  LightRAG                   │       │  • pgvector (reuse)  │
│  • /ingest                  │       │  • lightrag.* schema │
│  • /query                   │       │    (KV + vectors)    │
└────────────┬────────────────┘       └──────────────────────┘
             │ Bolt protocol
             ▼
┌─────────────────────────────┐
│  Neo4j Aura (managed)       │
│  • knowledge graph only     │
│  • ~$65/mo smallest prod    │
└─────────────────────────────┘
```

Sidecar on Railway because: cheapest Python host with a persistent volume, ~$15/mo baseline. Fly.io is comparable but less turn-key. Render is slightly more expensive. Vercel Functions Python runtime is not an option — cold-start and timeout budgets don't fit LightRAG's ingestion workloads.

## Prerequisites before starting Phase 2

1. Phase 1 recommendation doc identifies a specific failure that LightRAG would address
2. Sign off from the team on ~1 month of implementation time
3. Budget approval for ~$80–150/mo ongoing infra cost
4. Fresh test data: Phase 1's `entity_relationships` corpus is our gold standard to beat, not LightRAG's baseline

## Implementation plan (compressed)

### Step 1 — Sidecar skeleton (2 days)

Branch `feat/lightrag-spike` off `feat/graph-rag-spike`. New directory `lightrag-sidecar/` (Python, Poetry, FastAPI). Deploy to Railway dev. Confirm `/health` returns 200.

### Step 2 — Storage wiring (3 days)

- Enable Apache AGE extension on a Supabase dev branch (`CREATE EXTENSION age; LOAD 'age';`). Configure LightRAG to use PG + AGE for KV + vector + graph.
- If AGE perf is clearly inadequate (load test with ~5k triples): provision Neo4j Aura and reconfigure LightRAG to use Neo4j for graph only, Postgres for KV + vector.
- Use the `lightrag.*` Postgres schema so everything is droppable with `DROP SCHEMA lightrag CASCADE`.

### Step 3 — Schema seeding (2 days)

Implement Schema Option B from the original plan: pre-populate LightRAG's graph from our existing relations rather than letting LightRAG's LLM extraction start from scratch. Seed:
- Domain, sector, microsector, entity nodes from our Postgres tables
- `belongs_to`, `mentions`, `published_by`, `tagged_with` edges from existing joins
- Hand-authored `transmission_channels` edges as typed links

This gives LightRAG a high-quality starting graph; its own extraction layer only adds what's not already known. Without this step, LightRAG re-extracts from raw text and we'd lose the curation work from our entity registry.

### Step 4 — Parallel ingest (3 days)

Dual-write: when `LIGHTRAG_ENABLED=true`, every call to `embedAndStoreArticle` also fires a Node fetch at the sidecar's `/ingest`. Failures are warnings, not fatal. Prod has `LIGHTRAG_ENABLED=false` by default.

### Step 5 — LightRAG backend for the comparison harness (2 days)

Implement `src/lib/intelligence/evaluation/backends/lightrag.ts` conforming to `RetrievalBackend`. It POSTs to the sidecar's `/query` endpoint. The harness can now compare four backends.

### Step 6 — Comparison run (2 days)

Run the same 30-query set across all four backends. Write `06-lightrag-comparison.md` with results. Decide: does LightRAG beat the Postgres-native baseline by enough to justify the infra? Honest yes/no.

### Step 7 — Decision (1 day)

- **Yes**: plan the rollout — shadow mode → dual-read → cutover for Learn only → monitor for a month → consider wider adoption
- **No**: tear down the Railway project, drop the Supabase branch, archive the branch. Postgres-native stays authoritative.

## Design invariants we must keep

- The `GraphRetrievalBackend` interface in `src/lib/intelligence/evaluation/types.ts` stays source-of-truth. LightRAG is one more implementation of that interface — nothing changes for existing callers.
- No existing pgvector code path gets modified. The LightRAG integration is dual-write / dual-read, never replace-in-place, until cutover.
- Production is never touched without an env flag. Same discipline as Phase 1.
- If the sidecar is unreachable, retrieval falls back to the pgvector baseline silently.
