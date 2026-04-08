-- =============================================================================
-- Storylines: Auto-discovered story bundles
-- =============================================================================

CREATE TABLE IF NOT EXISTS storylines (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  -- Matching criteria (overlap triggers association)
  entity_ids INTEGER[] DEFAULT '{}',
  microsector_slugs TEXT[] DEFAULT '{}',
  domain_ids INTEGER[] DEFAULT '{}',
  signal_types TEXT[] DEFAULT '{}',
  -- Metadata
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'active', 'dormant', 'archived')),
  article_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  auto_discovered BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS storyline_articles (
  storyline_id INTEGER REFERENCES storylines(id) ON DELETE CASCADE,
  enriched_article_id UUID REFERENCES enriched_articles(id) ON DELETE CASCADE,
  match_reason TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (storyline_id, enriched_article_id)
);

CREATE INDEX IF NOT EXISTS idx_storylines_status ON storylines(status);
CREATE INDEX IF NOT EXISTS idx_storylines_entity_ids ON storylines USING GIN(entity_ids);
CREATE INDEX IF NOT EXISTS idx_storylines_microsector_slugs ON storylines USING GIN(microsector_slugs);
CREATE INDEX IF NOT EXISTS idx_storyline_articles_enriched ON storyline_articles(enriched_article_id);
