# Graph-RAG Spike — Phase 1 Research

_Last updated: 2026-04-19_

## Why this spike exists

We already use pgvector in Supabase for every RAG touchpoint: prior-coverage lookups in the daily briefing, entity-history in the podcast script, contradictory-coverage detection during enrichment, and the four `/api/intelligence/*` endpoints. For the upcoming **Learn** feature, graph-style retrieval — follow taxonomy → entity → source → event chains — is likely to beat pure semantic similarity when the question is about how ideas, companies, and projects relate rather than which article best matches a query.

The initial brief proposed adopting **LightRAG** (https://github.com/HKUDS/LightRAG) as the graph-RAG foundation. Before committing to that, we needed to answer two questions honestly:

1. What does LightRAG actually require to run in production?
2. Can we get most of the benefit by adding a relationship layer to the Postgres schema we already run, without introducing any new infrastructure?

The answer to (1) made (2) worth testing first. This doc summarises both.

## LightRAG at a glance (Apr 2026)

- **Licence**: MIT. **Status**: v1.4.14, actively maintained, 6.9k commits, single-research-group authored (HKUDS).
- **Language**: Python 3.10+. No JS/TS bindings exist.
- **Shape**: a Python library with an optional FastAPI server wrapper.
- **Required storage layers** (four of them):
  - KV store (docs, chunks, LLM cache)
  - Vector store (embeddings)
  - Graph store (knowledge graph)
  - Doc status tracker
- **Ingestion cost**: LLM calls for entity/relationship extraction on every doc. Claude or GPT-class model recommended for quality. We'd expect this to dominate the cost.
- **Query path**: dual-level — vector similarity plus graph walk; modes include naive/local/global/hybrid.

**Storage backend reality check**: Postgres can back the KV, vector, and doc-status layers via pgvector. The graph store is where things break down. Apache AGE on the same Postgres works but LightRAG's own docs say _"For production scenarios requiring graph databases, Neo4j is recommended as Apache AGE's performance is not as competitive."_ In practice a real deployment is Postgres + Neo4j Aura (~$65/mo for the smallest prod tier) plus a Python sidecar service (Railway / Fly / Render, ~$15–50/mo) so Next.js can call it over REST.

**Net cost of adopting LightRAG**: one Python service + one additional database, between $15–120/mo, plus a cross-language boundary every retrieval call crosses.

## What we already have that looks graph-like

Reading the existing schema + enrichment code, a surprising amount of what LightRAG would build for us is already present:

| Concept | Where it lives today |
|---|---|
| Typed entity nodes | `entities` (company / project / regulation / person / technology) |
| Article ↔ entity co-occurrence edges | `article_entities` join table, plus `enriched_articles.entity_ids[]` denormalised onto `content_embeddings` |
| Hand-authored typed edges between domains | `transmission_channels` |
| Taxonomy hierarchy | `taxonomy_domains` → `taxonomy_sectors` → `taxonomy_microsectors` |
| Per-article sector / signal / sentiment / jurisdiction tags | `enriched_articles.*` |
| Vector store | `content_embeddings` (768-dim, HNSW cosine) |

The one clear gap: **typed entity↔entity relationships** (`Origin ──acquires──> Octopus AU`, `Andrew Forrest ──ceo_of──> Fortescue`, `RET ──supersedes──> prior RET`). We track that entities co-occur in articles, but not _how_ they relate.

## The decision framing

If typed relationships are the only real gap, LightRAG is doing two things for us — extracting those relationships via LLM, and storing them in a graph DB. The extraction step is an LLM call that runs at enrichment time; the storage step is any table that can record typed edges between entity IDs.

We already run an LLM (Gemini Flash) at enrichment time. We already have a table with typed entity IDs. Adding a `(subject, predicate, object, confidence, evidence, source_article)` table and one extra Gemini call per article closes the gap **without** a second database, a Python service, or a cross-language hop.

The spike's Phase-1 bet is that this is enough. Phase 2 (LightRAG proper) only gets triggered if the Postgres-native approach produces measurably worse results on the 30-query evaluation set — see `03-comparison.md` for that evidence.

## Hosting recommendation (answering "would it mean 2 databases?")

**If Phase 1 succeeds:** one database (Supabase Postgres). The new `entity_relationships` table lives alongside the existing schema. No new services, no cross-language runtime.

**If Phase 1 measurably fails and Phase 2 escalation happens:** two databases plus a sidecar service. Sidecar on **Railway** (cheapest Python deploy with persistent volume). Start with **Apache AGE on a Supabase dev branch** (costs nothing extra to try); only escalate to **Neo4j Aura** if AGE's perf on our corpus is clearly inadequate. See `05-lightrag-shelved.md` for the full plan.

## Risks we're taking by starting with Postgres-native

1. **Extraction quality is the real bottleneck, not storage.** If the Gemini Flash extraction is noisy, the graph is noisy, and any retrieval layer on top inherits that. LightRAG would have the same problem — both approaches need the same extraction step. Mitigation: hand-review 50 triples after the 14-day backfill before running the full 60-day window.
2. **Recursive CTEs on entity_relationships might not scale.** At our expected scale (hundreds of triples per day, ~12 months retention = low tens-of-thousands of edges) this is fine; at 100× that it would be questionable. Monitor. Mitigation: if scale becomes a real concern, migrating to Neo4j is a 1-sprint refactor thanks to the `GraphRetrievalBackend` interface.
3. **The 12-predicate vocab might be too tight.** We've deliberately erred tight to prevent drift, with `_uncategorised` as a spillover. Expect to promote 2–3 predicates into the vocab after first month of data.
4. **LightRAG-style multi-level retrieval** (local vs global summaries) isn't something recursive CTEs do natively. If that matters for Learn, we'll discover it in Phase 4 and escalate.

## What changed vs the original brief

- Renamed branch from `feat/lightrag-spike` to `feat/graph-rag-spike` so the scope reflects the comparison, not a foregone adoption.
- Added a **third comparator** (`pgvector + entity-cooccurrence`) so we can isolate whether the improvement comes from typed relationships or just from filtering by entity overlap at all.
- Designed retrieval behind a single `GraphRetrievalBackend` interface so LightRAG (or anything else) can drop in later without touching call sites.
- Kept the comparison harness permanently at `src/lib/intelligence/evaluation/` (not a spike directory) so it becomes the regression test for any future retrieval change.
