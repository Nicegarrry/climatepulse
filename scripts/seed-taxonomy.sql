-- ClimatePulse: Taxonomy Seed Data
-- Populates taxonomy_domains, taxonomy_sectors, taxonomy_microsectors, taxonomy_tags
-- and category_migration_map tables.
-- Safe to run multiple times (ON CONFLICT DO NOTHING on all INSERTs).

-- =============================================================================
-- Domains (12 top-level)
-- =============================================================================

INSERT INTO taxonomy_domains (id, slug, name, description, sort_order) VALUES
  (1,  'energy-generation',     'Energy — Generation',             'Power generation from renewable and transitional sources', 1),
  (2,  'energy-storage',        'Energy — Storage',                'Battery, hydrogen, thermal and mechanical energy storage', 2),
  (3,  'energy-grid',           'Energy — Grid & Transmission',    'Electricity networks, market design and DER integration', 3),
  (4,  'carbon-emissions',      'Carbon & Emissions',              'Carbon markets, offsets, removal and industrial CCS', 4),
  (5,  'transport',             'Transport & Mobility',            'Road, aviation, shipping, rail and alternative fuels', 5),
  (6,  'industry',              'Industry & Heavy Emitters',       'Steel, cement, aluminium, mining, LNG and manufacturing', 6),
  (7,  'agriculture',           'Agriculture & Land Use',          'Livestock, cropping, forestry, water and food systems', 7),
  (8,  'built-environment',     'Built Environment',               'Building efficiency, electrification, materials and precincts', 8),
  (9,  'critical-minerals',     'Critical Minerals & Supply Chain','Lithium, rare earths, battery minerals, processing and recycling', 9),
  (10, 'finance',               'Finance & Investment',            'Project finance, green bonds, ESG disclosure and climate risk', 10),
  (11, 'policy',                'Policy & Governance',             'Federal, state and international climate and energy policy', 11),
  (12, 'workforce-adaptation',  'Workforce & Adaptation',          'Skills, research, adaptation, extreme weather and health', 12)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 1: Energy — Generation
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (1,  1, 'solar',              'Solar',              1),
  (2,  1, 'wind',               'Wind',               2),
  (3,  1, 'hydro',              'Hydro',              3),
  (4,  1, 'thermal-transition', 'Thermal Transition', 4),
  (5,  1, 'nuclear',            'Nuclear',            5)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (1,  1, 'utility-solar',       'Utility-Scale Solar PV',    'Large-scale solar farms, tracking systems, bifacial panels',
    ARRAY['utility solar', 'solar farm', 'tracking system', 'bifacial', 'large-scale PV'], 1),
  (2,  1, 'rooftop-solar',      'Rooftop & Distributed Solar','Residential and commercial rooftop, community solar',
    ARRAY['rooftop solar', 'distributed solar', 'community solar', 'residential PV', 'commercial rooftop'], 2),
  (3,  1, 'solar-manufacturing','Solar Manufacturing',        'Panel and cell manufacturing, domestic production, supply chain',
    ARRAY['solar manufacturing', 'panel production', 'cell manufacturing', 'domestic solar', 'PV supply chain'], 3),
  (4,  2, 'onshore-wind',       'Onshore Wind',              'Onshore wind farms, turbine technology, repowering',
    ARRAY['onshore wind', 'wind farm', 'turbine', 'repowering', 'wind energy'], 4),
  (5,  2, 'offshore-wind',      'Offshore Wind',             'Offshore projects, floating wind, port infrastructure',
    ARRAY['offshore wind', 'floating wind', 'port infrastructure', 'offshore turbine'], 5),
  (6,  3, 'pumped-hydro',       'Pumped Hydro',              'Pumped hydro energy storage projects, feasibility',
    ARRAY['pumped hydro', 'pumped storage', 'Snowy 2.0', 'hydroelectric storage'], 6),
  (7,  3, 'conventional-hydro', 'Conventional Hydro',        'Run-of-river, existing dam operations, environmental flows',
    ARRAY['conventional hydro', 'run-of-river', 'dam operations', 'environmental flows', 'hydropower'], 7),
  (8,  4, 'coal-retirement',    'Coal Plant Retirement',     'Closure schedules, life extensions, community transition',
    ARRAY['coal retirement', 'coal closure', 'coal phase-out', 'community transition', 'life extension'], 8),
  (9,  4, 'gas-transition',     'Gas Peaking & Transition',  'Gas as firming, new gas plants, gas supply policy',
    ARRAY['gas peaking', 'gas transition', 'firming capacity', 'gas plant', 'gas supply'], 9),
  (10, 5, 'nuclear-smr',        'Nuclear & SMR',             'Small modular reactors, nuclear policy debate, fusion',
    ARRAY['nuclear', 'SMR', 'small modular reactor', 'fusion', 'nuclear policy'], 10)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 2: Energy — Storage
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (6,  2, 'grid-storage',        'Grid Storage',        1),
  (7,  2, 'distributed-storage', 'Distributed Storage', 2),
  (8,  2, 'hydrogen-storage',    'Hydrogen Storage',    3),
  (9,  2, 'thermal-storage',     'Thermal Storage',     4)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (11, 6, 'lithium-bess',         'Lithium-Ion Grid BESS',         'Utility-scale li-ion, 2-hour and 4-hour systems',
    ARRAY['lithium-ion', 'BESS', 'grid battery', 'utility-scale storage', '4-hour battery'], 11),
  (12, 6, 'long-duration-storage','Long-Duration Storage',         '8+ hour storage, iron-air, compressed air, gravity',
    ARRAY['long-duration', 'iron-air', 'compressed air', 'gravity storage', 'LDES'], 12),
  (13, 6, 'alt-chemistry',       'Sodium-Ion & Alt Chemistry',     'Sodium-ion, zinc-bromine, flow batteries, solid-state',
    ARRAY['sodium-ion', 'zinc-bromine', 'flow battery', 'solid-state', 'alternative chemistry'], 13),
  (14, 7, 'home-battery',        'Home Battery Systems',           'Residential batteries, VPPs from aggregated home storage',
    ARRAY['home battery', 'residential battery', 'Powerwall', 'VPP aggregation', 'behind-the-meter'], 14),
  (15, 7, 'ci-storage',          'Commercial & Industrial Storage','Behind-the-meter C&I, demand charge management',
    ARRAY['C&I storage', 'commercial battery', 'demand charge', 'behind-the-meter', 'industrial storage'], 15),
  (16, 8, 'h2-energy-storage',   'Hydrogen for Energy Storage',    'H2 as seasonal storage, power-to-gas-to-power',
    ARRAY['hydrogen storage', 'power-to-gas', 'seasonal storage', 'green hydrogen', 'H2 storage'], 16),
  (17, 9, 'thermal-mechanical',  'Thermal & Mechanical Storage',   'Molten salt, sand batteries, compressed air',
    ARRAY['thermal storage', 'molten salt', 'sand battery', 'mechanical storage', 'CAES'], 17)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 3: Energy — Grid & Transmission
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (10, 3, 'transmission',    'Transmission',      1),
  (11, 3, 'distribution',    'Distribution',      2),
  (12, 3, 'grid-operations', 'Grid Operations',   3),
  (13, 3, 'der-integration', 'DER Integration',   4),
  (14, 3, 'market-design',   'Market Design',     5)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (18, 10, 'transmission-build',        'Transmission Build & Upgrade',  'New transmission lines, augmentation, undersea cables',
    ARRAY['transmission', 'HumeLink', 'VNI West', 'undersea cable', 'grid augmentation'], 18),
  (19, 10, 'grid-connection',           'Grid Connection Pipeline',      'Connection queue, generator connection, REZ access',
    ARRAY['grid connection', 'connection queue', 'REZ access', 'generator connection'], 19),
  (20, 11, 'distribution-network',      'Distribution Network',          'Poles and wires, hosting capacity, EV charging impact',
    ARRAY['distribution network', 'hosting capacity', 'poles and wires', 'DNSP', 'EV grid impact'], 20),
  (21, 12, 'grid-stability',            'Grid Stability & Inertia',      'Frequency control, system strength, synchronous condensers',
    ARRAY['grid stability', 'frequency control', 'system strength', 'inertia', 'synchronous condenser'], 21),
  (22, 12, 'demand-response',           'Demand Response & Flexibility', 'Demand management, flexible loads, time-of-use',
    ARRAY['demand response', 'flexible load', 'time-of-use', 'demand management', 'load shifting'], 22),
  (23, 13, 'vpps',                      'Virtual Power Plants',          'VPP aggregation, orchestration, market participation',
    ARRAY['VPP', 'virtual power plant', 'aggregation', 'orchestration', 'distributed energy'], 23),
  (24, 13, 'microgrids',                'Microgrids & Islanding',        'Remote microgrids, islanded systems, community energy',
    ARRAY['microgrid', 'islanding', 'remote power', 'community energy', 'off-grid'], 24),
  (25, 14, 'electricity-market-reform', 'Electricity Market Reform',     'NEM design, capacity mechanisms, pricing reform',
    ARRAY['NEM', 'capacity mechanism', 'market reform', 'electricity pricing', 'AEMC'], 25)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 4: Carbon & Emissions
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (15, 4, 'compliance-markets',  'Compliance Markets',  1),
  (16, 4, 'border-adjustments',  'Border Adjustments',  2),
  (17, 4, 'voluntary-markets',   'Voluntary Markets',   3),
  (18, 4, 'carbon-removal',      'Carbon Removal',      4),
  (19, 4, 'industrial-ccs',      'Industrial CCS',      5),
  (20, 4, 'accounting',          'Accounting',          6)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (26, 15, 'eu-ets',               'EU ETS',                          'European allowance trading, reform, price movements',
    ARRAY['EU ETS', 'European emissions trading', 'carbon allowance', 'EUA price'], 26),
  (27, 15, 'safeguard-mechanism',  'Australian Safeguard Mechanism',  'Safeguard baselines, facility obligations, SMC credits',
    ARRAY['safeguard mechanism', 'SMC', 'safeguard baseline', 'facility obligation', 'CER'], 27),
  (28, 15, 'other-compliance',     'Other Compliance Markets',        'UK ETS, China ETS, California cap-and-trade, Korea ETS',
    ARRAY['UK ETS', 'China ETS', 'cap-and-trade', 'Korea ETS', 'California carbon'], 28),
  (29, 16, 'cbam',                 'CBAM & Carbon Tariffs',           'EU CBAM, other carbon border mechanisms, trade impacts',
    ARRAY['CBAM', 'carbon border', 'carbon tariff', 'border adjustment', 'trade impact'], 29),
  (30, 17, 'accus',                'ACCUs & Australian Offsets',      'ACCU supply, methodology, integrity, pricing',
    ARRAY['ACCU', 'Australian carbon credit', 'offset methodology', 'ACCU price', 'CER integrity'], 30),
  (31, 17, 'international-offsets','International Offsets & VCM',     'Verra, Gold Standard, Article 6, voluntary credit pricing',
    ARRAY['Verra', 'Gold Standard', 'Article 6', 'voluntary carbon market', 'VCM'], 31),
  (32, 18, 'nature-removal',       'Nature-Based Removal',            'Reforestation, blue carbon, soil carbon sequestration',
    ARRAY['nature-based removal', 'reforestation', 'blue carbon', 'soil carbon', 'natural sequestration'], 32),
  (33, 18, 'engineered-removal',   'Engineered Removal & DAC',        'Direct air capture, biochar, enhanced weathering',
    ARRAY['DAC', 'direct air capture', 'biochar', 'enhanced weathering', 'engineered removal'], 33),
  (34, 19, 'ccs-storage',          'Carbon Capture & Storage',        'CCS on industrial facilities, CO2 transport, storage sites',
    ARRAY['CCS', 'carbon capture', 'CO2 storage', 'CO2 transport', 'sequestration site'], 34),
  (35, 20, 'emissions-mrv',        'Emissions Measurement & MRV',     'Monitoring, reporting, verification, satellite measurement',
    ARRAY['MRV', 'emissions monitoring', 'reporting', 'verification', 'satellite measurement'], 35)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 5: Transport & Mobility
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (21, 5, 'road-passenger',   'Road — Passenger',   1),
  (22, 5, 'road-commercial',  'Road — Commercial',  2),
  (23, 5, 'aviation',         'Aviation',           3),
  (24, 5, 'shipping',         'Shipping',           4),
  (25, 5, 'rail',             'Rail',               5),
  (26, 5, 'fuels',            'Fuels',              6)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (36, 21, 'passenger-ev',         'Passenger EV Adoption',        'EV sales, models, consumer behaviour, TCO',
    ARRAY['electric vehicle', 'EV sales', 'EV adoption', 'passenger EV', 'total cost of ownership'], 36),
  (37, 21, 'ev-charging',          'EV Charging Infrastructure',   'Fast charging networks, destination charging, standards',
    ARRAY['EV charging', 'fast charger', 'charging network', 'NEVI', 'charging standard'], 37),
  (38, 22, 'fleet-electrification','Commercial Fleet Electrification','Trucks, buses, vans, last-mile delivery',
    ARRAY['fleet electrification', 'electric truck', 'electric bus', 'last-mile', 'commercial EV'], 38),
  (39, 22, 'h2-road-transport',    'Hydrogen Road Transport',      'H2 fuel cell trucks, refuelling infrastructure',
    ARRAY['hydrogen truck', 'fuel cell vehicle', 'H2 refuelling', 'FCEV', 'hydrogen transport'], 39),
  (40, 23, 'aviation-decarb',      'Aviation Decarbonisation',     'SAF, electric aviation, airline commitments, CORSIA',
    ARRAY['aviation decarbonisation', 'SAF', 'sustainable aviation fuel', 'CORSIA', 'electric aircraft'], 40),
  (41, 24, 'maritime-decarb',      'Maritime Decarbonisation',     'Green shipping corridors, ammonia/methanol fuel, IMO',
    ARRAY['maritime decarbonisation', 'green shipping', 'ammonia fuel', 'methanol shipping', 'IMO'], 41),
  (42, 25, 'rail-electrification', 'Rail Electrification',         'Diesel-to-electric conversion, battery trains, hydrogen rail',
    ARRAY['rail electrification', 'battery train', 'hydrogen rail', 'electric rail', 'diesel conversion'], 42),
  (43, 26, 'alternative-fuels',    'Sustainable & Alternative Fuels','SAF production, e-fuels, biofuels, drop-in replacements',
    ARRAY['alternative fuel', 'e-fuel', 'biofuel', 'drop-in fuel', 'SAF production'], 43)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 6: Industry & Heavy Emitters
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (27, 6, 'steel',          'Steel',          1),
  (28, 6, 'cement',         'Cement',         2),
  (29, 6, 'aluminium',      'Aluminium',      3),
  (30, 6, 'chemicals',      'Chemicals',      4),
  (31, 6, 'mining',         'Mining',         5),
  (32, 6, 'lng-gas',        'LNG & Gas',      6),
  (33, 6, 'data-centres',   'Data Centres',   7),
  (34, 6, 'manufacturing',  'Manufacturing',  8),
  (35, 6, 'waste',          'Waste',          9)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (44, 27, 'green-steel',            'Green Steel & DRI',                      'Direct reduced iron, hydrogen steelmaking, EAF',
    ARRAY['green steel', 'DRI', 'hydrogen steelmaking', 'electric arc furnace', 'iron reduction'], 44),
  (45, 28, 'cement-decarb',          'Cement & Concrete Decarbonisation',      'Clinker alternatives, carbon-cured concrete, CCUS',
    ARRAY['cement decarbonisation', 'clinker alternative', 'carbon-cured concrete', 'green cement'], 45),
  (46, 29, 'aluminium-decarb',       'Aluminium Smelting & Decarbonisation',   'Inert anode, renewable-powered smelters',
    ARRAY['aluminium smelting', 'inert anode', 'renewable smelter', 'green aluminium'], 46),
  (47, 30, 'chemicals-transition',   'Chemical Industry Transition',           'Electrification of heat, green ammonia, methanol',
    ARRAY['chemical transition', 'green ammonia', 'methanol', 'heat electrification', 'petrochemical'], 47),
  (48, 31, 'mining-decarb',          'Mining Decarbonisation',                 'Electrification of haul fleets, renewable mine sites',
    ARRAY['mining decarbonisation', 'electric haul truck', 'renewable mine', 'mine electrification'], 48),
  (49, 32, 'lng-upstream',           'LNG & Upstream Gas',                     'LNG export, upstream emissions, fugitive methane',
    ARRAY['LNG', 'upstream gas', 'fugitive methane', 'gas export', 'methane emissions'], 49),
  (50, 33, 'data-centre-energy',     'Data Centre Energy & AI Load',           'AI-driven demand growth, renewable procurement, cooling',
    ARRAY['data centre', 'AI energy', 'hyperscale', 'renewable procurement', 'data centre cooling'], 50),
  (51, 34, 'advanced-manufacturing', 'Advanced Manufacturing',                 'Cleantech manufacturing, 3D printing, reshoring',
    ARRAY['advanced manufacturing', 'cleantech manufacturing', '3D printing', 'reshoring', 'onshoring'], 51),
  (52, 35, 'waste-circular',         'Waste-to-Energy & Circular Economy',     'Waste processing, recycling infrastructure, panel recycling',
    ARRAY['waste-to-energy', 'circular economy', 'recycling', 'panel recycling', 'waste processing'], 52)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 7: Agriculture & Land Use
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (36, 7, 'livestock',     'Livestock',     1),
  (37, 7, 'cropping',      'Cropping',      2),
  (38, 7, 'land-carbon',   'Land Carbon',   3),
  (39, 7, 'land-use',      'Land Use',      4),
  (40, 7, 'water-ag',      'Water',         5),
  (41, 7, 'food-systems',  'Food Systems',  6)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (53, 36, 'ruminant-methane', 'Ruminant Methane Reduction',  'Feed additives (Asparagopsis, 3-NOP), methane inhibitors',
    ARRAY['ruminant methane', 'Asparagopsis', '3-NOP', 'feed additive', 'methane inhibitor'], 53),
  (54, 36, 'alt-proteins',     'Alternative Proteins',        'Cultivated meat, plant-based, precision fermentation',
    ARRAY['alternative protein', 'cultivated meat', 'plant-based meat', 'precision fermentation'], 54),
  (55, 37, 'regen-ag',         'Regenerative Agriculture',    'No-till, cover crops, rotational grazing, soil health',
    ARRAY['regenerative agriculture', 'no-till', 'cover crop', 'rotational grazing', 'soil health'], 55),
  (56, 37, 'ag-emissions',     'Agricultural Emissions Reduction','Fertiliser efficiency, nitrous oxide, precision agriculture',
    ARRAY['agricultural emissions', 'fertiliser efficiency', 'nitrous oxide', 'precision agriculture'], 56),
  (57, 38, 'soil-carbon',      'Soil Carbon & Sequestration', 'Soil carbon credits, measurement, permanence',
    ARRAY['soil carbon', 'soil sequestration', 'soil carbon credit', 'carbon measurement', 'permanence'], 57),
  (58, 38, 'forestry',         'Forestry & Reforestation',    'Plantation forestry, native revegetation, agroforestry',
    ARRAY['forestry', 'reforestation', 'native revegetation', 'agroforestry', 'plantation'], 58),
  (59, 39, 'deforestation',    'Deforestation & Land Clearing','Land clearing policy, habitat protection, biodiversity',
    ARRAY['deforestation', 'land clearing', 'habitat protection', 'biodiversity loss'], 59),
  (60, 40, 'ag-water',         'Agricultural Water & Irrigation','Water efficiency, Murray-Darling, climate adaptation',
    ARRAY['agricultural water', 'irrigation', 'Murray-Darling', 'water efficiency', 'water allocation'], 60),
  (61, 41, 'food-waste',       'Food Waste & Supply Chain',   'Cold chain, food loss, packaging, circular food systems',
    ARRAY['food waste', 'cold chain', 'food loss', 'circular food', 'food packaging'], 61)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 8: Built Environment
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (42, 8, 'efficiency',           'Efficiency',       1),
  (43, 8, 'electrification-bldg', 'Electrification',  2),
  (44, 8, 'materials',            'Materials',        3),
  (45, 8, 'standards',            'Standards',        4),
  (46, 8, 'precincts',            'Precincts',        5),
  (47, 8, 'cooling',              'Cooling',          6),
  (48, 8, 'heritage',             'Heritage',         7)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (62, 42, 'building-efficiency',       'Building Energy Efficiency',        'Retrofits, insulation, passive design, NatHERS ratings',
    ARRAY['building efficiency', 'retrofit', 'insulation', 'passive design', 'NatHERS'], 62),
  (63, 43, 'building-electrification',  'Building Electrification & Heat Pumps','Gas-to-electric, heat pump adoption, induction cooking',
    ARRAY['building electrification', 'heat pump', 'induction cooking', 'gas-to-electric', 'electrify everything'], 63),
  (64, 44, 'embodied-carbon',           'Embodied Carbon in Construction',   'Timber buildings, low-carbon concrete, lifecycle analysis',
    ARRAY['embodied carbon', 'mass timber', 'low-carbon concrete', 'lifecycle analysis', 'construction carbon'], 64),
  (65, 45, 'green-building-standards',  'Green Building Standards & Ratings','NABERS, Green Star, WELL, net-zero buildings',
    ARRAY['NABERS', 'Green Star', 'WELL', 'net-zero building', 'green building standard'], 65),
  (66, 46, 'sustainable-precincts',     'Sustainable Precincts & Cities',    'Urban planning, smart cities, integrated energy systems',
    ARRAY['sustainable precinct', 'smart city', 'urban planning', 'integrated energy', 'precinct development'], 66),
  (67, 47, 'urban-cooling',             'Cooling & Urban Heat',              'Urban heat islands, district cooling, climate-resilient design',
    ARRAY['urban cooling', 'heat island', 'district cooling', 'climate-resilient design', 'urban heat'], 67),
  (68, 48, 'heritage-adaptation',       'Heritage & Climate Adaptation',     'Adapting existing building stock, heritage constraints',
    ARRAY['heritage adaptation', 'existing building stock', 'heritage constraint', 'building adaptation'], 68)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 9: Critical Minerals & Supply Chain
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (49, 9, 'lithium',        'Lithium',         1),
  (50, 9, 'rare-earths',    'Rare Earths',     2),
  (51, 9, 'cobalt-nickel',  'Cobalt & Nickel', 3),
  (52, 9, 'graphite',       'Graphite',        4),
  (53, 9, 'copper',         'Copper',          5),
  (54, 9, 'processing',     'Processing',      6),
  (55, 9, 'supply-chain',   'Supply Chain',    7),
  (56, 9, 'recycling',      'Recycling',       8)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (69, 49, 'lithium-extraction',     'Lithium Extraction & Processing',  'Hard rock, brine, DLE, domestic refining',
    ARRAY['lithium extraction', 'hard rock lithium', 'brine', 'DLE', 'lithium refining'], 69),
  (70, 50, 'rare-earth-elements',    'Rare Earth Elements',              'Mining, processing, magnet manufacturing, China dependence',
    ARRAY['rare earth', 'REE', 'magnet manufacturing', 'China dependence', 'rare earth processing'], 70),
  (71, 51, 'battery-minerals',       'Battery Minerals (Co, Ni, Mn)',    'Cobalt-free chemistries, nickel laterites, ethical sourcing',
    ARRAY['battery minerals', 'cobalt', 'nickel', 'manganese', 'ethical sourcing'], 71),
  (72, 52, 'graphite-anode',         'Graphite & Anode Materials',       'Synthetic graphite, natural graphite, silicon anodes',
    ARRAY['graphite', 'anode material', 'synthetic graphite', 'silicon anode'], 72),
  (73, 53, 'copper-supply',          'Copper Supply',                    'Copper demand for electrification, recycling, new mines',
    ARRAY['copper supply', 'copper demand', 'copper mine', 'copper recycling', 'electrification copper'], 73),
  (74, 54, 'domestic-processing',    'Domestic Processing & Refining',   'Value-adding in Australia, mid-stream investment',
    ARRAY['domestic processing', 'refining', 'value-adding', 'mid-stream', 'mineral processing'], 74),
  (75, 55, 'supply-diversification', 'Supply Chain Diversification',     'Friend-shoring, trade restrictions, China alternatives',
    ARRAY['supply chain diversification', 'friend-shoring', 'trade restriction', 'China alternative'], 75),
  (76, 56, 'battery-recycling',      'Battery & Panel Recycling',        'End-of-life processing, urban mining, circular economy',
    ARRAY['battery recycling', 'panel recycling', 'urban mining', 'end-of-life', 'circular economy'], 76)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 10: Finance & Investment
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (57, 10, 'project-finance', 'Project Finance', 1),
  (58, 10, 'green-finance',   'Green Finance',   2),
  (59, 10, 'disclosure',      'Disclosure',      3),
  (60, 10, 'risk',            'Risk',            4),
  (61, 10, 'deals',           'Deals',           5),
  (62, 10, 'markets',         'Markets',         6)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (77, 57, 'renewable-finance',    'Renewable Project Finance',       'Debt, equity, tax equity, CIS tenders',
    ARRAY['renewable finance', 'project finance', 'tax equity', 'CIS tender', 'debt financing'], 77),
  (78, 57, 'infra-funds',          'Infrastructure Funds & Investors','Institutional capital, sovereign wealth, pension funds',
    ARRAY['infrastructure fund', 'institutional capital', 'sovereign wealth', 'pension fund', 'clean energy investment'], 78),
  (79, 58, 'green-bonds',          'Green Bonds & Sustainable Debt',  'Green bonds, sustainability-linked loans, transition bonds',
    ARRAY['green bond', 'sustainability-linked loan', 'transition bond', 'sustainable debt'], 79),
  (80, 58, 'carbon-investment',    'Carbon Credit Investment',        'Carbon fund strategies, forward purchasing, speculation',
    ARRAY['carbon investment', 'carbon fund', 'forward purchasing', 'carbon speculation', 'carbon credit'], 80),
  (81, 59, 'esg-reporting',        'ESG Disclosure & Reporting',      'ISSB, TCFD, TNFD, ASRS, mandatory reporting',
    ARRAY['ESG reporting', 'ISSB', 'TCFD', 'TNFD', 'ASRS', 'mandatory disclosure'], 81),
  (82, 59, 'greenwashing',         'Greenwashing & Integrity',        'Greenwashing enforcement, ACCC, claims substantiation',
    ARRAY['greenwashing', 'ACCC', 'claims substantiation', 'ESG integrity', 'green claims'], 82),
  (83, 60, 'climate-risk',         'Climate Risk & Insurance',        'Physical risk, transition risk, insurance retreat, stranded assets',
    ARRAY['climate risk', 'insurance retreat', 'stranded assets', 'physical risk', 'transition risk'], 83),
  (84, 61, 'ma-transactions',      'M&A and Asset Transactions',      'Project sales, corporate acquisitions, portfolio trades',
    ARRAY['M&A', 'asset transaction', 'project sale', 'corporate acquisition', 'portfolio trade'], 84),
  (85, 62, 'electricity-pricing',  'Electricity Price & Contract Markets','PPA pricing, wholesale trends, contract structures',
    ARRAY['electricity pricing', 'PPA', 'wholesale price', 'contract structure', 'energy market'], 85)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 11: Policy & Governance
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (63, 11, 'federal',              'Federal',        1),
  (64, 11, 'state',                'State',          2),
  (65, 11, 'international-policy', 'International',  3),
  (66, 11, 'approvals',            'Approvals',      4),
  (67, 11, 'community',            'Community',      5),
  (68, 11, 'indigenous',           'Indigenous',     6),
  (69, 11, 'governance',           'Governance',     7)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (86, 63, 'federal-energy-policy',     'Australian Federal Energy Policy',    'National targets, legislation, ministerial direction',
    ARRAY['federal energy policy', 'national target', 'energy legislation', 'CET', 'ministerial'], 86),
  (87, 63, 'federal-climate-policy',    'Australian Federal Climate Policy',   'NDC, emissions budgets, Climate Change Authority',
    ARRAY['federal climate policy', 'NDC', 'emissions budget', 'Climate Change Authority', 'national climate'], 87),
  (88, 64, 'state-rez-planning',        'State REZ & Planning Policy',         'Renewable Energy Zones, state planning frameworks',
    ARRAY['REZ', 'renewable energy zone', 'state planning', 'planning framework', 'state target'], 88),
  (89, 64, 'state-climate-policy',      'State Climate & Net Zero Policy',     'State targets, EV policy, building standards',
    ARRAY['state climate policy', 'state net zero', 'state EV policy', 'state building standard'], 89),
  (90, 65, 'international-agreements',  'International Climate Agreements',    'Paris Agreement, COP outcomes, NDCs, Article 6',
    ARRAY['Paris Agreement', 'COP', 'NDC', 'Article 6', 'international climate'], 90),
  (91, 65, 'trade-climate',             'International Trade & Climate',       'Trade agreements with climate provisions, tariffs',
    ARRAY['trade climate', 'climate tariff', 'trade agreement', 'climate provision'], 91),
  (92, 66, 'environmental-approvals',   'Environmental Approvals & Permitting','EPBC Act reform, bilateral approvals, offsets',
    ARRAY['environmental approval', 'EPBC Act', 'permitting', 'bilateral approval', 'offset requirement'], 92),
  (93, 67, 'social-licence',            'Community Engagement & Social Licence','Benefit sharing, community opposition, consultation',
    ARRAY['social licence', 'community engagement', 'benefit sharing', 'community opposition', 'consultation'], 93),
  (94, 68, 'indigenous-engagement',     'Indigenous Engagement & Land Rights', 'Traditional Owner agreements, cultural heritage, equity',
    ARRAY['indigenous engagement', 'Traditional Owner', 'cultural heritage', 'First Nations', 'land rights'], 94),
  (95, 69, 'corporate-governance',      'Corporate Climate Governance',        'Board obligations, directors'' duties, litigation risk',
    ARRAY['corporate governance', 'directors duties', 'climate litigation', 'board obligation', 'fiduciary duty'], 95)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Domain 12: Workforce & Adaptation
-- =============================================================================

-- Sectors
INSERT INTO taxonomy_sectors (id, domain_id, slug, name, sort_order) VALUES
  (70, 12, 'skills',          'Skills',          1),
  (71, 12, 'research',        'Research',        2),
  (72, 12, 'adaptation',      'Adaptation',      3),
  (73, 12, 'extreme-weather', 'Extreme Weather', 4),
  (74, 12, 'health',          'Health',          5),
  (75, 12, 'technology-rd',   'Technology R&D',  6)
ON CONFLICT DO NOTHING;

-- Microsectors
INSERT INTO taxonomy_microsectors (id, sector_id, slug, name, description, keywords, sort_order) VALUES
  (96,  70, 'workforce-gap',       'Energy Workforce & Skills Gap',     'Trade shortages, engineer pipeline, apprenticeships',
    ARRAY['workforce gap', 'skills shortage', 'apprenticeship', 'engineer pipeline', 'trade shortage'], 96),
  (97,  70, 'reskilling',          'Reskilling & Just Transition',      'Coal region transition, worker retraining, community support',
    ARRAY['reskilling', 'just transition', 'coal region', 'worker retraining', 'community support'], 97),
  (98,  71, 'climate-science',     'Climate Science & Modelling',       'CSIRO, BOM, IPCC findings, projections',
    ARRAY['climate science', 'CSIRO', 'BOM', 'IPCC', 'climate modelling', 'projection'], 98),
  (99,  72, 'physical-adaptation', 'Physical Climate Adaptation',       'Infrastructure resilience, heat planning, flood defence',
    ARRAY['physical adaptation', 'infrastructure resilience', 'heat planning', 'flood defence', 'climate resilience'], 99),
  (100, 72, 'biodiversity',        'Biodiversity & Ecosystems',         'Species impact, habitat corridors, renewable-nature coexistence',
    ARRAY['biodiversity', 'ecosystem', 'habitat corridor', 'species impact', 'nature coexistence'], 100),
  (101, 73, 'extreme-events',      'Extreme Weather Events',            'Bushfires, floods, heatwaves, drought as they relate to energy/climate',
    ARRAY['extreme weather', 'bushfire', 'flood', 'heatwave', 'drought', 'natural disaster'], 101),
  (102, 74, 'climate-health',      'Climate & Health',                  'Heat-related illness, air quality, vector-borne disease',
    ARRAY['climate health', 'heat illness', 'air quality', 'vector-borne disease', 'health impact'], 102),
  (103, 75, 'cleantech-rd',        'Cleantech Research & Innovation',   'CSIRO programs, university research, ARENA-funded R&D',
    ARRAY['cleantech R&D', 'ARENA', 'CSIRO program', 'university research', 'innovation'], 103)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Cross-Cutting Tags (5)
-- =============================================================================

INSERT INTO taxonomy_tags (id, slug, name, description) VALUES
  (1, 'geopolitics',   'Geopolitics & Trade Wars',          'US-China tensions, tariffs, sanctions, friend-shoring dynamics'),
  (2, 'ai-digital',    'AI & Digitalisation in Energy',     'AI grid management, digital twins, predictive maintenance'),
  (3, 'gender-equity', 'Gender & Equity in Transition',     'Workforce diversity, energy equity, access'),
  (4, 'first-nations', 'First Nations Energy Sovereignty',  'Indigenous-led energy projects, equity models, cultural overlay'),
  (5, 'disinfo',       'Disinformation & Public Debate',    'Climate misinformation, parliamentary inquiries, media narratives')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Category Migration Map: Old 20 categories → new microsector slugs
-- =============================================================================

INSERT INTO category_migration_map (old_category_id, new_microsector_slug) VALUES
  -- solar → utility-solar, rooftop-solar, solar-manufacturing
  ('solar', 'utility-solar'),
  ('solar', 'rooftop-solar'),
  ('solar', 'solar-manufacturing'),
  -- wind → onshore-wind, offshore-wind
  ('wind', 'onshore-wind'),
  ('wind', 'offshore-wind'),
  -- storage → lithium-bess, long-duration-storage, home-battery
  ('storage', 'lithium-bess'),
  ('storage', 'long-duration-storage'),
  ('storage', 'home-battery'),
  -- hydrogen → h2-energy-storage, h2-road-transport, alternative-fuels
  ('hydrogen', 'h2-energy-storage'),
  ('hydrogen', 'h2-road-transport'),
  ('hydrogen', 'alternative-fuels'),
  -- grid → transmission-build, grid-connection, grid-stability
  ('grid', 'transmission-build'),
  ('grid', 'grid-connection'),
  ('grid', 'grid-stability'),
  -- transport → passenger-ev, ev-charging, fleet-electrification
  ('transport', 'passenger-ev'),
  ('transport', 'ev-charging'),
  ('transport', 'fleet-electrification'),
  -- buildings → building-efficiency, building-electrification
  ('buildings', 'building-efficiency'),
  ('buildings', 'building-electrification'),
  -- heavy-industry → green-steel, cement-decarb, aluminium-decarb
  ('heavy-industry', 'green-steel'),
  ('heavy-industry', 'cement-decarb'),
  ('heavy-industry', 'aluminium-decarb'),
  -- ccs → ccs-storage, engineered-removal
  ('ccs', 'ccs-storage'),
  ('ccs', 'engineered-removal'),
  -- nature → forestry, deforestation, soil-carbon
  ('nature', 'forestry'),
  ('nature', 'deforestation'),
  ('nature', 'soil-carbon'),
  -- finance → renewable-finance, green-bonds, carbon-investment
  ('finance', 'renewable-finance'),
  ('finance', 'green-bonds'),
  ('finance', 'carbon-investment'),
  -- policy → federal-energy-policy, federal-climate-policy
  ('policy', 'federal-energy-policy'),
  ('policy', 'federal-climate-policy'),
  -- science → climate-science
  ('science', 'climate-science'),
  -- adaptation → physical-adaptation, extreme-events
  ('adaptation', 'physical-adaptation'),
  ('adaptation', 'extreme-events'),
  -- minerals → lithium-extraction, rare-earth-elements, battery-minerals
  ('minerals', 'lithium-extraction'),
  ('minerals', 'rare-earth-elements'),
  ('minerals', 'battery-minerals'),
  -- nuclear → nuclear-smr
  ('nuclear', 'nuclear-smr'),
  -- fossil-transition → coal-retirement, gas-transition, lng-upstream
  ('fossil-transition', 'coal-retirement'),
  ('fossil-transition', 'gas-transition'),
  ('fossil-transition', 'lng-upstream'),
  -- circular → waste-circular, battery-recycling
  ('circular', 'waste-circular'),
  ('circular', 'battery-recycling'),
  -- water → ag-water
  ('water', 'ag-water'),
  -- climatetech → cleantech-rd, advanced-manufacturing
  ('climatetech', 'cleantech-rd'),
  ('climatetech', 'advanced-manufacturing')
ON CONFLICT DO NOTHING;
