-- Seed ASX watchlist tickers for ClimatePulse
-- Run: psql $DATABASE_URL -f scripts/seed-tickers.sql

INSERT INTO asx_tickers (ticker, company_name, sub_sector) VALUES
  -- Utilities
  ('AGL', 'AGL Energy', 'utilities'),
  ('ORG', 'Origin Energy', 'utilities'),
  ('MEZ', 'Meridian Energy', 'utilities'),
  ('GNX', 'Genex Power', 'utilities'),

  -- Oil & Gas
  ('STO', 'Santos', 'oil_gas'),
  ('WDS', 'Woodside Energy', 'oil_gas'),
  ('BPT', 'Beach Energy', 'oil_gas'),
  ('WHC', 'Whitehaven Coal', 'oil_gas'),

  -- Critical Minerals
  ('PLS', 'Pilbara Minerals', 'minerals'),
  ('LYC', 'Lynas Rare Earths', 'minerals'),
  ('IGO', 'IGO Limited', 'minerals'),
  ('MIN', 'Mineral Resources', 'minerals'),
  ('LTR', 'Liontown Resources', 'minerals'),
  ('SYA', 'Sayona Mining', 'minerals'),

  -- Renewables & Clean Energy
  ('FFI', 'Fortescue', 'renewables'),
  ('IFT', 'Infratil', 'renewables'),
  ('CWY', 'Cleanaway Waste', 'renewables'),
  ('NH3', 'NH3 Clean Energy', 'renewables'),
  ('INR', 'Ioneer', 'renewables'),
  ('SXE', 'Southern Cross Electrical', 'renewables'),

  -- ETFs
  ('CLNE', 'VanEck Global Clean Energy ETF', 'etfs'),
  ('ERTH', 'BetaShares Climate Change Innovation ETF', 'etfs'),
  ('ETHI', 'BetaShares Ethical ETF', 'etfs'),
  ('ACDC', 'Global X Battery Tech & Lithium ETF', 'etfs'),

  -- Infrastructure
  ('TCL', 'Transurban', 'infrastructure'),
  ('ENN', 'Elanor Investors', 'infrastructure')
ON CONFLICT (ticker) DO NOTHING;
