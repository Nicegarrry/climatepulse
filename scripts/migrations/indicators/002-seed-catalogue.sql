-- Indicators — starter catalogue (25 indicators)
-- Idempotent: ON CONFLICT (slug) DO NOTHING
-- Sector slugs map to taxonomy_domains.slug (12 domains).
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/indicators/002-seed-catalogue.sql

BEGIN;

INSERT INTO indicators (slug, name, description, sector, geography, unit, value_type, direction_good)
VALUES
    -- Energy generation
    ('solar_deployed_cost_au',
     'Deployed solar cost AU',
     'Average installed cost of utility-scale solar in Australia.',
     'energy-generation', 'AU', '$/W', 'currency', 'down'),

    ('solar_capacity_global',
     'Global solar PV capacity',
     'Cumulative deployed solar PV capacity worldwide.',
     'energy-generation', 'Global', 'GW', 'physical', 'up'),

    ('wind_capacity_global',
     'Global wind capacity',
     'Cumulative deployed onshore + offshore wind capacity.',
     'energy-generation', 'Global', 'GW', 'physical', 'up'),

    ('rooftop_solar_cumulative_au',
     'Cumulative rooftop solar AU',
     'Total installed rooftop solar capacity in Australia.',
     'energy-generation', 'AU', 'GW', 'physical', 'up'),

    -- Energy storage
    ('bess_deployed_cost_au',
     'Deployed BESS cost AU',
     'Average installed cost of utility-scale battery storage in Australia.',
     'energy-storage', 'AU', '$/kWh', 'currency', 'down'),

    ('liion_pack_price_global',
     'Li-ion pack price (global)',
     'Volume-weighted average lithium-ion battery pack price.',
     'energy-storage', 'Global', '$/kWh', 'currency', 'down'),

    ('liion_cell_price_global',
     'Li-ion cell price (global)',
     'Volume-weighted average lithium-ion battery cell price.',
     'energy-storage', 'Global', '$/kWh', 'currency', 'down'),

    ('bess_utility_capacity_global',
     'Global utility BESS deployed',
     'Cumulative utility-scale battery storage deployed worldwide.',
     'energy-storage', 'Global', 'GWh', 'physical', 'up'),

    -- Energy grid
    ('grid_renewables_share_au',
     'AU grid renewables share',
     'Rolling average share of AU NEM electricity supplied by renewables.',
     'energy-grid', 'AU', '%', 'percent', 'up'),

    ('grid_renewables_share_global',
     'Global grid renewables share',
     'Rolling average share of global electricity supplied by renewables.',
     'energy-grid', 'Global', '%', 'percent', 'up'),

    ('nem_wholesale_price',
     'NEM wholesale price (rolling 30d)',
     'Trailing 30-day mean NEM wholesale electricity price.',
     'energy-grid', 'AU', '$/MWh', 'currency', 'neutral'),

    ('rez_commissioned_mw_au',
     'AU REZ commissioned capacity',
     'Cumulative MW commissioned across declared Renewable Energy Zones.',
     'energy-grid', 'AU', 'MW', 'physical', 'up'),

    ('grid_emissions_intensity_au',
     'AU grid emissions intensity',
     'Carbon intensity of grid electricity supplied to consumers.',
     'energy-grid', 'AU', 'gCO2/kWh', 'physical', 'down'),

    -- Carbon emissions
    ('accu_price_au',
     'ACCU spot price',
     'Generic Australian Carbon Credit Unit spot price.',
     'carbon-emissions', 'AU', '$/t CO2-e', 'currency', 'neutral'),

    ('co2_atmospheric_global',
     'Atmospheric CO2',
     'Mauna Loa monthly mean atmospheric CO2 concentration.',
     'carbon-emissions', 'Global', 'ppm', 'physical', 'down'),

    -- Transport
    ('ev_avg_price_au',
     'Average new EV price AU',
     'Volume-weighted average sticker price of new battery-electric vehicles sold in AU.',
     'transport', 'AU', '$', 'currency', 'down'),

    ('ev_avg_range_km',
     'Average new EV range',
     'Sales-weighted average WLTP range of new BEVs released this period.',
     'transport', 'Global', 'km', 'physical', 'up'),

    ('ev_share_new_sales_au',
     'EV share of new car sales AU',
     'Share of new passenger vehicle registrations that are battery-electric.',
     'transport', 'AU', '%', 'percent', 'up'),

    ('ev_share_new_sales_global',
     'EV share of new car sales (global)',
     'Share of new passenger vehicle sales worldwide that are battery-electric.',
     'transport', 'Global', '%', 'percent', 'up'),

    ('dc_fast_chargers_au',
     'Public DC fast-chargers AU',
     'Total operational public DC fast-charging connectors in Australia.',
     'transport', 'AU', 'count', 'count', 'up'),

    -- Industry
    ('green_steel_production_global',
     'Green steel production',
     'Annualised production of low-emissions / fossil-free primary steel.',
     'industry', 'Global', 'Mt', 'physical', 'up'),

    ('green_h2_cost_global',
     'Green hydrogen production cost',
     'Levelised production cost of renewable hydrogen.',
     'industry', 'Global', '$/kg', 'currency', 'down'),

    ('green_h2_capacity_global',
     'Green H2 capacity in operation',
     'Cumulative renewable hydrogen electrolyser capacity in operation.',
     'industry', 'Global', 'GW', 'physical', 'up'),

    ('cement_embodied_carbon',
     'Cement embodied carbon',
     'Average embodied carbon per tonne of cement produced.',
     'industry', 'Global', 'kg CO2/t', 'physical', 'down'),

    -- Critical minerals
    ('lithium_spodumene_price',
     'Lithium spodumene price',
     'Spot price of 6% Li2O spodumene concentrate.',
     'critical-minerals', 'Global', '$/t', 'currency', 'neutral')

ON CONFLICT (slug) DO NOTHING;

COMMIT;
