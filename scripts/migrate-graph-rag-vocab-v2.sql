-- ClimatePulse: Graph-RAG vocab v2
--
-- Adds 4 predicates surfaced from the 14-day backfill's _uncategorised
-- spillover:
--   - competes_with   (6 occurrences)
--   - founded         (8 occurrences combined: "founder of"/"founder")
--   - opposes         (9 occurrences)
--   - researcher_at   (~32 occurrences combined: "researcher at"/"professor at"/"lead researcher at")
--
-- Together these absorb ~55 of the 548 _uncategorised rows (~10% reduction).
-- The full v2 should reduce spillover from 42% → ~30% on the next backfill.
--
-- Companion change (manual): tighten prompts/relationship-extraction-system.md
-- to absorb tense variants of partners_with ("collaborated with",
-- "partnered with", "collaborating with") which leak ~11 more rows.
--
-- Also retroactively promotes existing _uncategorised rows whose
-- metadata.raw_predicate maps to one of the new vocab entries. This is
-- safe because the unique_triple_per_source constraint is on
-- (subject_id, predicate, object_id, source_type, source_id) — UPDATEing
-- predicate creates a new unique key. We dedupe on conflict by deleting
-- the now-unreachable original row before the UPDATE.
--
-- Spike branch only. To revert:
--   1. UPDATE predicate back to '_uncategorised' for any rows where
--      metadata.raw_predicate matches a removed vocab entry
--   2. ALTER TABLE entity_relationships DROP CONSTRAINT entity_relationships_predicate_check
--   3. Re-add the v1 CHECK constraint

BEGIN;

-- =============================================================================
-- Step 1: Replace the CHECK constraint with the v2 vocab
-- =============================================================================

ALTER TABLE entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_predicate_check;

ALTER TABLE entity_relationships
  ADD CONSTRAINT entity_relationships_predicate_check
  CHECK (predicate IN (
    -- v1 vocab (12)
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
    -- v2 additions (4)
    'competes_with',
    'founded',
    'opposes',
    'researcher_at',
    -- spillover sentinel
    '_uncategorised'
  ));

-- =============================================================================
-- Step 2: Retroactively promote existing _uncategorised rows whose
-- raw_predicate matches a v2 entry. Mapping table is inline.
-- =============================================================================

-- Use a CTE that maps raw_predicate strings to v2 vocab entries, then
-- updates in-place. We strip raw_predicate from metadata after promotion
-- to keep the data model clean (raw_predicate is only meaningful for rows
-- that ARE _uncategorised).
--
-- If two _uncategorised rows differ only by raw_predicate value but would
-- collapse to the same triple after promotion, the second UPDATE would
-- violate unique_triple_per_source. We handle that by first deleting any
-- such would-be-conflict rows.

WITH mapping AS (
  SELECT * FROM (VALUES
    ('competes with',          'competes_with'),
    ('competes_with',          'competes_with'),
    ('founder',                'founded'),
    ('founder of',             'founded'),
    ('co-founder of',          'founded'),
    ('founded',                'founded'),
    ('opposes',                'opposes'),
    ('opposed',                'opposes'),
    ('opposing',               'opposes'),
    ('researcher at',          'researcher_at'),
    ('professor at',           'researcher_at'),
    ('lead researcher at',     'researcher_at'),
    ('researcher_at',          'researcher_at')
  ) AS m(raw, target)
),
promotable AS (
  SELECT er.id, m.target AS new_predicate
  FROM entity_relationships er
  JOIN mapping m ON LOWER(er.metadata->>'raw_predicate') = m.raw
  WHERE er.predicate = '_uncategorised'
),
-- Find rows that would collide if we promote: a different existing row
-- already has (subject_id, target_predicate, object_id, source_type, source_id).
collisions AS (
  SELECT p.id AS to_delete
  FROM promotable p
  JOIN entity_relationships er_old ON er_old.id = p.id
  WHERE EXISTS (
    SELECT 1 FROM entity_relationships er_existing
    WHERE er_existing.subject_id  = er_old.subject_id
      AND er_existing.object_id   = er_old.object_id
      AND er_existing.source_type = er_old.source_type
      AND er_existing.source_id   = er_old.source_id
      AND er_existing.predicate   = p.new_predicate
      AND er_existing.id <> er_old.id
  )
)
DELETE FROM entity_relationships
WHERE id IN (SELECT to_delete FROM collisions);

-- Now promote the surviving _uncategorised rows.
WITH mapping AS (
  SELECT * FROM (VALUES
    ('competes with',          'competes_with'),
    ('competes_with',          'competes_with'),
    ('founder',                'founded'),
    ('founder of',             'founded'),
    ('co-founder of',          'founded'),
    ('founded',                'founded'),
    ('opposes',                'opposes'),
    ('opposed',                'opposes'),
    ('opposing',               'opposes'),
    ('researcher at',          'researcher_at'),
    ('professor at',           'researcher_at'),
    ('lead researcher at',     'researcher_at'),
    ('researcher_at',          'researcher_at')
  ) AS m(raw, target)
)
UPDATE entity_relationships er
SET predicate = m.target,
    metadata  = er.metadata - 'raw_predicate'
FROM mapping m
WHERE er.predicate = '_uncategorised'
  AND LOWER(er.metadata->>'raw_predicate') = m.raw;

-- =============================================================================
-- Step 3: Show what changed (for the script's caller)
-- =============================================================================

SELECT predicate, COUNT(*) AS n, ROUND(AVG(confidence)::numeric, 2) AS avg_conf
FROM entity_relationships
GROUP BY predicate
ORDER BY n DESC;

COMMIT;
