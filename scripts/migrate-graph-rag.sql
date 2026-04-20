-- ClimatePulse: Graph-RAG Spike Migration
--
-- Adds a typed entity-to-entity relationship table on top of the existing
-- entities / article_entities / content_embeddings layout. Purely additive —
-- no existing tables, columns, or indexes are altered.
--
-- Predicate vocabulary is deliberately tight (12 entries). Anything the
-- extraction model emits outside this set is stored with predicate
-- '_uncategorised' and the original verbatim string in metadata.raw_predicate
-- for periodic review and promotion.
--
-- Spike branch only. Drop with:
--   DROP TABLE IF EXISTS entity_relationships CASCADE;

BEGIN;

CREATE TABLE IF NOT EXISTS entity_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Both FKs point at entities.id (INTEGER serial — matches existing schema).
  subject_id        INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  object_id         INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Controlled vocabulary (12 + 1 sentinel).
  predicate         TEXT NOT NULL CHECK (predicate IN (
    'acquires',
    'partners_with',
    'subsidiary_of',
    'invests_in',
    'develops',
    'operates',
    'funds',
    'regulates',
    'supersedes',
    'located_in',
    'ceo_of',
    'uses_technology',
    '_uncategorised'
  )),

  -- Provenance: where this triple was observed.
  source_type       TEXT NOT NULL CHECK (source_type IN (
    'article',                -- enriched_articles.id (UUID, stored as text)
    'editorial',              -- daily_briefings or weekly_digests
    'transmission_channel',   -- inferred from a transmission_channels row
    'manual'                  -- hand-curated (future admin UI)
  )),
  source_id         TEXT NOT NULL,

  -- Extraction quality + audit.
  confidence        NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  evidence          TEXT,                              -- verbatim quote from source, max ~120 chars

  -- Co-observation collation (same triple seen multiple times).
  first_observed    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation_count INTEGER NOT NULL DEFAULT 1 CHECK (observation_count >= 1),

  -- Free-form per-row data. Used for raw_predicate spillover when the model
  -- emits something outside the vocab, plus future per-predicate qualifiers.
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT no_self_relations CHECK (subject_id <> object_id),
  CONSTRAINT unique_triple_per_source UNIQUE (subject_id, predicate, object_id, source_type, source_id)
);

-- Outbound traversal: walk forward from a subject.
CREATE INDEX IF NOT EXISTS idx_er_subject_pred
  ON entity_relationships (subject_id, predicate);

-- Inbound traversal: walk backward to a subject (for symmetric queries).
CREATE INDEX IF NOT EXISTS idx_er_object_pred
  ON entity_relationships (object_id, predicate);

-- Predicate-only scan (for vocab promotion analysis).
CREATE INDEX IF NOT EXISTS idx_er_predicate
  ON entity_relationships (predicate);

-- Recency cursor for "what changed lately?" queries.
CREATE INDEX IF NOT EXISTS idx_er_last_observed
  ON entity_relationships (last_observed DESC);

COMMIT;
