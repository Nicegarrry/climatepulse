# Graph-RAG Spike — Recommendation

_This doc is the final deliverable. Populated after Phase 4 results are in. Placeholder until then._

## Recommendation

_One of: **Adopt Postgres-native graph RAG** / **Adopt for Learn only, pgvector elsewhere** / **Stay on pgvector** / **Escalate to LightRAG (Phase 2)**_

**To be filled after the comparison run.**

## Evidence

Summary of findings from `03-comparison.md`:

- Per-category winner distribution: _TBD_
- Typed-relationship walk beat plain co-occurrence on multi-hop queries by: _TBD points_ (mean relevance delta)
- Latency cost of graph walk vs baseline: _TBD ms_ (p95)
- Extraction quality (hand-review of 50 triples): _TBD%_ correct
- Monthly LLM spend increment: _~$TBD_/month at projected pipeline volume

## If we adopt (Postgres-native, the happy path)

Rollout in this order, each step gated on the previous succeeding in prod:

1. **Merge** the spike branch behind `GRAPH_EXTRACTION_ENABLED=false` in prod. Schema applied, code deployed, no behaviour change until we flip the flag.
2. **Shadow mode** (week 1): flip `GRAPH_EXTRACTION_ENABLED=true` in prod. Relationships are extracted and stored, but nothing reads from `entity_relationships` in user-facing paths. Monitor: extraction cost, `_uncategorised` rate, DB table growth, error rate in `console.warn` logs.
3. **Backfill** (week 2, off-peak): run `scripts/backfill-relationships.ts --days 60` against prod. Re-check extraction quality by hand on another 50-triple sample.
4. **Wire into one read path** (week 3): the Learn feature uses `pgGraphWalkBackend` as its primary retrieval. All other read paths (daily briefing, podcast, contradiction check, `/api/intelligence/*`) stay on `retrieveContent` / the existing retriever.
5. **Evaluate after a month of real usage.** If Learn users engage measurably better with graph-walk results vs pure vector, consider extending to the briefing's hero-story prior-coverage lookup.

## If we don't adopt

- Drop the migration: `DROP TABLE entity_relationships CASCADE`
- Revert the `pipeline.ts` change (one block, env-gated — safe to leave in place with the flag off if rollback is messy)
- Keep the harness at `src/lib/intelligence/evaluation/` as a regression test for any future retrieval change — the 30-query set is valuable regardless of what backend wins
- Move `05-lightrag-shelved.md` to the "considered and rejected" archive if we're ruling LightRAG out entirely

## If we escalate to LightRAG (Phase 2)

Triggered only if the Postgres-native approach fails _specific_ failure modes (multi-hop queries where graph-walk still loses to vector, or extraction quality so poor that LightRAG's heavier pipeline would likely do better). See `05-lightrag-shelved.md` for the plan.

## Top 3 risks in the recommended path

_To be filled based on what actually went wrong during the spike._

1. _TBD_
2. _TBD_
3. _TBD_

## What the user needs to decide after reading this

_Populate with the specific go/no-go question and any preconditions._
