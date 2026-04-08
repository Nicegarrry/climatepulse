-- Entity System Redesign Cleanup
-- Run AFTER migration script, BEFORE next enrichment batch
-- This purges noisy data so the new stricter rules start clean

-- 1. Delete all article_entities links (all have role='mentioned' — no signal value)
DELETE FROM article_entities;

-- 2. Delete jurisdiction entities (now captured as story-level tags only)
DELETE FROM entities WHERE entity_type = 'jurisdiction';

-- 3. Reset all promotions so new stricter rules re-evaluate from scratch
UPDATE entities SET status = 'candidate' WHERE status = 'promoted';

-- 4. Prune single-mention noise candidates
DELETE FROM entities WHERE mention_count <= 1;

-- 5. Reset mention_count (rebuilt from article_entities during re-enrichment)
UPDATE entities SET mention_count = 0;

-- 6. Now safe to tighten entity_type constraint (no jurisdiction rows remain)
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_check;
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check
  CHECK (entity_type IN ('company', 'project', 'regulation', 'person', 'technology'));
