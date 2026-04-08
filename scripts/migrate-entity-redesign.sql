-- Entity System Redesign Migration
-- Run BEFORE deploying new code, BEFORE cleanup script

-- 1. Add 'dormant' to entity status constraint
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_status_check;
ALTER TABLE entities ADD CONSTRAINT entities_status_check
  CHECK (status IN ('candidate', 'promoted', 'archived', 'dormant'));

-- 2. Add story-level reference columns to enriched_articles
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS regulations_referenced TEXT[] DEFAULT '{}';
ALTER TABLE enriched_articles ADD COLUMN IF NOT EXISTS technologies_referenced TEXT[] DEFAULT '{}';

-- 3. Add normalised name index (for new matching strategy)
CREATE INDEX IF NOT EXISTS idx_entities_canonical_lower
  ON entities(LOWER(canonical_name), entity_type);

-- 4. Add role constraint on article_entities (subject/actor/mentioned during transition)
ALTER TABLE article_entities DROP CONSTRAINT IF EXISTS article_entities_role_check;
ALTER TABLE article_entities ADD CONSTRAINT article_entities_role_check
  CHECK (role IN ('subject', 'actor', 'mentioned'));

-- 5. Drop pg_trgm fuzzy matching index (no longer used)
DROP INDEX IF EXISTS idx_entities_name_trgm;
