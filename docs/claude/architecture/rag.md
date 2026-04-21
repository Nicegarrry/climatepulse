# Intelligence Layer (RAG)

Unified pgvector corpus covering articles, podcasts, daily briefings, weekly digests, and weekly reports. Live end-to-end since 2026-04-17.

## Storage

- **Extension**: `vector 0.8.0` in Supabase
- **Index**: HNSW with cosine distance
- **Model**: `gemini-embedding-001` at 768 dims (Matryoshka truncation); free-tier rate-limited
- **Table**: `content_embeddings(content_type, source_id, chunk_index, embedding vector(768), …filter metadata)` with 10 supporting indexes
- **Migration**: `scripts/migrate-intelligence.sql` (apply via `node scripts/apply-intelligence-migration.mjs`)

## Embedder — `src/lib/intelligence/embedder.ts`

Called automatically at:
- End of Stage 2 enrichment (one `embedAndStoreArticle()` per article)
- After digest generation
- After podcast + weekly generation

Every call is wrapped in try/catch so a failure never blocks the hot path. Average ~1.1 chunks per article.

Chunker: `src/lib/intelligence/chunker.ts` (token-aware, for long-form content).

## Retriever — `src/lib/intelligence/retriever.ts`

Three public entry points:

| Function | Purpose |
|---|---|
| `retrieveContent(query, filters, options)` | Hybrid search with entity / domain / sentiment / date / trust filters |
| `getEntityBrief(entityId)` | Recent mentions + domain/signal distribution + co-occurring entities |
| `findRelatedContent(source_id)` | Similarity neighbours of an existing piece |

## Router — `src/lib/intelligence/router.ts`

Conditional retrieval router for the Learn feature. Picks graph-walk backend vs vector baseline per query.

**Routes to graph-walk when BOTH:**
1. At least one named entity in the query resolves in `entities` (canonical name OR alias)
2. Query matches a multi-hop verb pattern (`funded by`, `operated by`, `developed by`, `acquired by`, `owned by`, `subsidiaries of`, etc.)

Otherwise → vector (`retrieveContent`). Heuristic is intentionally small and fast (~10 ms) — log decisions in prod and tighten once real Learn usage data lands. Background: `docs/graph-rag-spike/04-recommendation.md`.

## Consumers

| Consumer | Hook | What it does |
|---|---|---|
| Digest (`src/lib/digest/generate.ts`) | `fetchPriorCoverage()` per hero story | Injects "Prior ClimatePulse coverage" block into Sonnet prompt (entity overlap + trust tiers 0/1 + 3-day lookback) |
| Podcast (`src/lib/podcast/script-generator.ts`) | `fetchEntityHistory()` per episode | Injects `ENTITY HISTORY` block for ≤8 hero entities → "as we covered on April 12…" callbacks |
| Enrichment (`src/lib/enrichment/contradicts-prior.ts`) | One HNSW query post-embed | Flags `enriched_articles.contradicts_prior=TRUE` when entity overlap + opposite sentiment + sim ≥ 0.72 within 30 days |
| Personalisation (`src/lib/personalisation.ts`) | `computeBoosts()` | +12 boost when `story.contradicts_prior` is true |

## Backfills

- `npx tsx scripts/backfill-embeddings.ts` — re-embed anything missing; idempotent
- `node scripts/backfill-contradicts-prior.ts` — same for the contradicts flag

## Verification

- `node scripts/rag-status.mjs` — confirms pgvector + table state
- `node scripts/rag-verify.mjs` — coverage report + sample HNSW nearest-neighbour query
