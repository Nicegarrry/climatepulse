-- ============================================================================
-- Onboarding support + demo user seeding
-- Run after: migrate-user-profiles.sql
-- Safe to re-run (ON CONFLICT + IF NOT EXISTS)
-- ============================================================================

-- Add onboarding timestamp column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- ─── Delete old test users and re-seed with richer profiles ─────────────────

DELETE FROM daily_briefings WHERE user_id IN ('test-user-1','test-user-2','test-user-3','test-user-4','test-user-5');
DELETE FROM user_profiles WHERE id IN ('test-user-1','test-user-2','test-user-3','test-user-4','test-user-5');

-- User 1: Sarah — Clean Energy Investor
-- Infrastructure fund analyst covering Australian renewables.
-- Cares about project economics, deal flow, PPA pricing, CIS tender outcomes.
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, followed_storylines, briefing_depth, onboarded_at)
VALUES (
  'test-user-1',
  'Sarah Chen',
  'sarah@climatepulse.dev',
  'investor',
  ARRAY['renewable-finance','infra-funds','lithium-bess','utility-solar','ma-transactions','electricity-pricing'],
  ARRAY['australia','nsw','vic','qld'],
  ARRAY['Capacity Investment Scheme','AGL Energy','Origin Energy'],
  ARRAY[]::text[],
  'standard',
  NOW()
);

-- User 2: Marcus — Corporate Sustainability Manager
-- Head of sustainability at a mid-sized ASX-listed resources company.
-- World is compliance and reporting — Safeguard, NGER, ISSB, greenwashing.
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, followed_storylines, briefing_depth, onboarded_at)
VALUES (
  'test-user-2',
  'Marcus Webb',
  'marcus@climatepulse.dev',
  'corporate_sustainability',
  ARRAY['esg-reporting','safeguard-mechanism','accus','greenwashing','emissions-mrv','corporate-governance'],
  ARRAY['australia'],
  ARRAY['Safeguard Mechanism','ISSB Standards','ACCC'],
  ARRAY[]::text[],
  'standard',
  NOW()
);

-- User 3: Priya — Government Policy Analyst
-- Policy analyst at a federal department working on energy transition.
-- Needs full picture: approvals, community engagement, REZs, international peers.
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, followed_storylines, briefing_depth, onboarded_at)
VALUES (
  'test-user-3',
  'Priya Sharma',
  'priya@climatepulse.dev',
  'policy_analyst',
  ARRAY['federal-energy-policy','federal-climate-policy','state-rez-planning','environmental-approvals','social-licence','international-agreements','trade-climate'],
  ARRAY['australia','nsw','eu'],
  ARRAY['Chris Bowen','EPBC Act','DCCEEW'],
  ARRAY['Road to 82% Renewables'],
  'deep',
  NOW()
);

-- User 4: James — Project Developer
-- Development manager at a mid-sized renewable energy developer.
-- Grid connection queues, approval timelines, community consultation, workforce.
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, followed_storylines, briefing_depth, onboarded_at)
VALUES (
  'test-user-4',
  'James Okonkwo',
  'james@climatepulse.dev',
  'project_developer',
  ARRAY['onshore-wind','utility-solar','grid-connection','transmission-build','environmental-approvals','social-licence','workforce-gap'],
  ARRAY['australia','nsw','qld','vic'],
  ARRAY['EnergyConnect','HumeLink','EnergyCo'],
  ARRAY['Snowy 2.0 Budget Crisis'],
  'standard',
  NOW()
);

-- User 5: Dr. Amira Hassan — Academic Researcher
-- Agricultural science researcher working on methane reduction in livestock.
-- Narrow but deep: livestock emissions, soil carbon, nature-based removal.
INSERT INTO user_profiles (id, name, email, role_lens, primary_sectors, jurisdictions, followed_entities, followed_storylines, briefing_depth, onboarded_at)
VALUES (
  'test-user-5',
  'Dr. Amira Hassan',
  'amira@climatepulse.dev',
  'researcher',
  ARRAY['ruminant-methane','soil-carbon','nature-removal','climate-science','ag-emissions','regen-ag'],
  ARRAY['australia','eu'],
  ARRAY['CSIRO'],
  ARRAY[]::text[],
  'quick',
  NOW()
);
