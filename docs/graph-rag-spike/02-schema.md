# Graph-RAG Spike — Schema

_Migration file: `scripts/migrate-graph-rag.sql`_

## The one new table

```sql
entity_relationships (
  id                UUID PRIMARY KEY,
  subject_id        INTEGER REFERENCES entities(id) ON DELETE CASCADE,
  object_id         INTEGER REFERENCES entities(id) ON DELETE CASCADE,
  predicate         TEXT   CHECK (predicate IN (…12 vocab + '_uncategorised')),
  source_type       TEXT   CHECK (source_type IN ('article','editorial','transmission_channel','manual')),
  source_id         TEXT,
  confidence        NUMERIC(3,2) CHECK (0.0 ≤ confidence ≤ 1.0),
  evidence          TEXT,                       -- verbatim quote from source
  first_observed    TIMESTAMPTZ,
  last_observed     TIMESTAMPTZ,
  observation_count INTEGER,
  metadata          JSONB,
  CONSTRAINT no_self_relations CHECK (subject_id <> object_id),
  CONSTRAINT unique_triple_per_source UNIQUE (subject_id, predicate, object_id, source_type, source_id)
);
```

Plus four indexes: `(subject_id, predicate)`, `(object_id, predicate)`, `(predicate)`, `(last_observed DESC)`.

### Why these specific design choices

- **`subject_id` and `object_id` are `INTEGER`**, matching the existing `entities.id` (serial). The plan originally said UUID — that was wrong, caught during implementation.
- **`confidence` is `NUMERIC(3,2)`**, not `REAL`. Two-decimal precision is sufficient and comparing `0.65` to `0.6` is unambiguous.
- **`source_type + source_id` is a loose FK**, not a proper one, because the same column must reference different tables depending on `source_type`. We pay strictness for schema flexibility — acceptable for a write-mostly, append-only log.
- **`unique_triple_per_source`** lets us re-run extraction idempotently. Re-processing the same article with `ON CONFLICT DO UPDATE` increments `observation_count` and bumps `last_observed` without creating a duplicate row.
- **`_uncategorised` sentinel predicate** + `metadata.raw_predicate` gives us a spillover bin for extractor drift. Without it, a tight vocab would drop anything the model saw that doesn't cleanly fit.
- **`no_self_relations` check** — defensive. LLMs occasionally emit `(X, partners_with, X)` when a sentence has X in two clauses; this blocks them at the DB layer.

## Predicate vocabulary (v1 — 12 entries, deliberately tight)

| Predicate | Shape | Example |
|---|---|---|
| `acquires` | company → company/project | Origin acquires Octopus Energy |
| `partners_with` | company → company | Tesla partners_with Neoen |
| `subsidiary_of` | company → company | Octopus AU subsidiary_of Octopus Energy UK |
| `invests_in` | company/fund → company/project | BlackRock invests_in Akaysha |
| `develops` | company/agency → project | AGL develops Muswellbrook BESS |
| `operates` | company → project | Neoen operates Hornsdale Power Reserve |
| `funds` | agency/fund → project | ARENA funds Green Steel Trial |
| `regulates` | regulation/agency → company/project | EPBC Act regulates Narrabri Gas |
| `supersedes` | regulation → regulation | Safeguard Mechanism Reforms supersede original Safeguard Mechanism |
| `located_in` | project/company → jurisdiction | Snowy 2.0 located_in NSW |
| `ceo_of` | person → company | Andrew Forrest ceo_of Fortescue |
| `uses_technology` | company/project → technology | Akaysha uses_technology Tesla Megapack |

Plus `_uncategorised` for anything the model sees but can't fit cleanly. The raw string goes into `metadata.raw_predicate` for later review and potential vocab promotion.

### Vocab promotion process

- Run a query every ~2 weeks:
  ```sql
  SELECT metadata->>'raw_predicate' AS raw, COUNT(*) AS n
  FROM entity_relationships
  WHERE predicate = '_uncategorised'
  GROUP BY 1 HAVING COUNT(*) >= 5 ORDER BY n DESC;
  ```
- Review top N. If any shows up consistently with clean semantics, propose a v2 predicate add.
- Adding a predicate = drop and recreate the CHECK constraint + update the extraction prompt. Existing `_uncategorised` rows can be bulk-updated where `metadata.raw_predicate` matches.

## Relationship to `transmission_channels` (keeping them separate)

`transmission_channels` is hand-authored domain↔domain edges, trust-level "human editor". `entity_relationships` is auto-extracted entity↔entity edges at confidence ≥0.6, trust-level "LLM + heuristic". Different granularity, different trust. The UI can surface both in a graph viz later, but they never share a table.

If we ever need to reify a transmission channel as an entity relationship (for retrieval purposes), we add one row per channel with `source_type = 'transmission_channel'` and `source_id = transmission_channels.id`. This keeps the channel as the authoritative source of truth but exposes its edges to the same traversal code.

## Sync strategy when the entity registry changes

- **Entity deleted** → `ON DELETE CASCADE` drops all rows that reference it. Fine — if an entity is deleted, edges that reference it are invalid anyway.
- **Entity merged** (two candidates collapse into one canonical) → `UPDATE entity_relationships SET subject_id = new WHERE subject_id = old` + same for `object_id`, then deduplicate via `DISTINCT ON (subject_id, predicate, object_id, source_type, source_id)` into a fresh table if needed. For the spike we'll do this by hand if it comes up; future automation is a follow-up.
- **Entity renamed** → nothing to do; the FK uses `id`, not name.

## What the schema does NOT try to do

- **No time-bounded edges.** If Origin acquires Octopus on 2026-05-01 and divests on 2030-01-01, the spike stores both as separate triples with different `source_id`s. Richer temporal modelling is a v2 concern.
- **No qualifier/reification.** LightRAG supports attributes on edges (e.g. "deal size"). We don't, for now. Put them in `metadata` JSONB if we hit a case where we need them.
- **No explicit inverse predicates.** `(Fortescue, subsidiary_of, FMG Group)` doesn't imply `(FMG Group, owns, Fortescue)` — the retriever walks edges in both directions via the `idx_er_object_pred` index, so we don't need duplicate inverse rows.
- **No multiplicity constraints.** A company can have multiple CEO relationships over time. The `unique_triple_per_source` constraint only forbids duplicate identical triples from the same source, not a changing history.
