-- ClimatePulse: Taxonomy & Enrichment Overhaul Migration
-- Adds hierarchical taxonomy, entity registry, enrichment pipeline, and cost tracking

-- =============================================================================
-- Extension: pg_trgm (fuzzy entity matching)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- Enums: signal_type, sentiment
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE signal_type AS ENUM (
    'market_move',
    'policy_change',
    'project_milestone',
    'corporate_action',
    'data_release',
    'enforcement',
    'personnel',
    'technology_advance',
    'international',
    'community_social'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sentiment AS ENUM (
    'positive',
    'negative',
    'neutral',
    'mixed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Taxonomy: Domains (12 top-level)
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_domains (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Taxonomy: Sectors (~30 mid-level)
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_sectors (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES taxonomy_domains(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_sectors_domain ON taxonomy_sectors(domain_id);

-- =============================================================================
-- Taxonomy: Microsectors (108 leaf-level)
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_microsectors (
  id SERIAL PRIMARY KEY,
  sector_id INTEGER NOT NULL REFERENCES taxonomy_sectors(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_microsectors_sector ON taxonomy_microsectors(sector_id);

-- =============================================================================
-- Taxonomy: Tags (5 cross-cutting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_tags (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Entities: Registry with fuzzy matching
-- =============================================================================

CREATE TABLE IF NOT EXISTS entities (
  id SERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'company', 'project', 'regulation', 'jurisdiction', 'person', 'technology'
  )),
  aliases TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN (
    'candidate', 'promoted', 'archived'
  )),
  mention_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canonical_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON entities USING gin(canonical_name gin_trgm_ops);

-- =============================================================================
-- Enriched Articles: New enrichment results (alongside existing categorised_articles)
-- =============================================================================

CREATE TABLE IF NOT EXISTS enriched_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id UUID NOT NULL REFERENCES raw_articles(id),
  microsector_ids INTEGER[] NOT NULL DEFAULT '{}',
  tag_ids INTEGER[] DEFAULT '{}',
  signal_type signal_type,
  sentiment sentiment DEFAULT 'neutral',
  jurisdictions TEXT[] DEFAULT '{}',
  raw_entities JSONB DEFAULT '[]',
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  used_full_text BOOLEAN DEFAULT FALSE,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_article_id)
);

CREATE INDEX IF NOT EXISTS idx_enriched_raw_article ON enriched_articles(raw_article_id);
CREATE INDEX IF NOT EXISTS idx_enriched_microsectors ON enriched_articles USING gin(microsector_ids);
CREATE INDEX IF NOT EXISTS idx_enriched_signal ON enriched_articles(signal_type);
CREATE INDEX IF NOT EXISTS idx_enriched_sentiment ON enriched_articles(sentiment);

-- =============================================================================
-- Article Entities: Join table (enriched_articles <-> entities)
-- =============================================================================

CREATE TABLE IF NOT EXISTS article_entities (
  id SERIAL PRIMARY KEY,
  enriched_article_id UUID NOT NULL REFERENCES enriched_articles(id) ON DELETE CASCADE,
  entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'mentioned',
  UNIQUE(enriched_article_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_article_entities_article ON article_entities(enriched_article_id);
CREATE INDEX IF NOT EXISTS idx_article_entities_entity ON article_entities(entity_id);

-- =============================================================================
-- Transmission Channels: Hand-authored causal links between domains
-- =============================================================================

CREATE TABLE IF NOT EXISTS transmission_channels (
  id SERIAL PRIMARY KEY,
  source_domain_id INTEGER REFERENCES taxonomy_domains(id),
  target_domain_id INTEGER REFERENCES taxonomy_domains(id),
  label TEXT NOT NULL,
  description TEXT,
  mechanism TEXT,
  strength TEXT DEFAULT 'moderate' CHECK (strength IN ('weak', 'moderate', 'strong')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Enrichment Runs: Cost and performance tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS enrichment_runs (
  id SERIAL PRIMARY KEY,
  batch_size INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10,6),
  articles_processed INTEGER,
  errors INTEGER,
  duration_ms INTEGER,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Category Migration Map: Old 20 categories -> new microsector slugs
-- =============================================================================

CREATE TABLE IF NOT EXISTS category_migration_map (
  old_category_id TEXT NOT NULL,
  new_microsector_slug TEXT NOT NULL,
  PRIMARY KEY (old_category_id, new_microsector_slug)
);
