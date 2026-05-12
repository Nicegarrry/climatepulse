import type { Lever } from './types';

// All levers from lever-db-v2.yaml mapped to the Lever type.
// Source: /Users/sa/sidekick/qubit/products/automacc/lever-db-v2.yaml (2026-05-08)
// Total: 52 levers (50 full + 2 stubs)
//
// typicalAbatementPct derivation notes:
//   - Industrial (cement, steel, aluminium, mining) levers: based on mechanism descriptions
//     and published intensity-reduction ranges for AU built-environment/professional services context
//   - Built-environment levers: validated against v1 stubs (LED 60%, HVAC 25%, PV 35%, etc.)
//   - Transport levers: based on EV/modal shift emission reduction data
//   - Stubs (IND-015, IND-016): typicalAbatementPct: 0 (applicable_to: [], effectively excluded)
//
// capexAud midpoint parsing:
//   "$25k–$60k" → 42_500; "$1M–$5M" → 3_000_000; "nil"/"Nil" → 0
// opexDeltaAudAnnual: negative = annual savings

export const leverDbV2: Lever[] = [
  // ─── PART 1 — INDUSTRIAL (IND-001 to IND-016) ─────────────────────────

  {
    leverId: 'IND-001',
    name: 'Clinker substitution — supplementary cementitious materials (SCMs)',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'cement_manufacturing' },
      { source: 'process', endUse: 'cement_clinker' },
    ],
    // 30–50% substitution → 25–45% GHG reduction; mid ~35%
    typicalAbatementPct: 35,
    // capex: "$5M–$40M ... nil for procurement shift" → procurement shift most accessible; mid ~22.5M but use nil-procurement mid: ~0 for small ops. Use $22.5M for integrated.
    capexAud: 22_500_000,
    // opex: "-$10 to +$15/t cement" → mid +$2.50/t — small positive for typical org; use 0 as neutral mid
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['industrial', 'construction'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Cement Industry Federation AU Sustainability Report 2023', primarySourceYear: 2023 },
  },

  {
    leverId: 'IND-002',
    name: 'Alternative fuels in cement kilns — refuse-derived fuel and biomass co-firing',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'cement_manufacturing' },
    ],
    // 15–60% thermal substitution → proportional fossil reduction; mid ~35%
    typicalAbatementPct: 35,
    // capex: "$5M–$15M per kiln (RDF handling)" → mid $10M
    capexAud: 10_000_000,
    // opex: "-$5M to +$2M/year per kiln" → mid -$1.5M (gate-fee income typically makes negative)
    opexDeltaAudAnnual: -1_500_000,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CIF Alternative Fuels in Australian Cement Industry 2021', primarySourceYear: 2021 },
  },

  {
    leverId: 'IND-003',
    name: 'Cement kiln CCUS readiness and partial electrification (pre-calciner)',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'cement_manufacturing' },
      { source: 'process', endUse: 'cement_clinker' },
    ],
    // Full CCUS: 85–95% capture; capture-ready only: 0 direct; for mixed mid ~45%
    typicalAbatementPct: 45,
    // capex: "full CCUS $150M–$500M per kiln" → mid $325M
    capexAud: 325_000_000,
    // opex: "adds $80–$140/tCO2e in operating cost" — positive (cost increase); approximate mid large kiln ~$200k/yr additional
    opexDeltaAudAnnual: 200_000,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'IEA CCUS in Clean Energy Transitions 2020', primarySourceYear: 2020 },
  },

  {
    leverId: 'IND-004',
    name: 'EAF scrap maximisation — increased recycled scrap charge in electric arc furnace steelmaking',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'steel_manufacturing' },
      { source: 'electricity', endUse: 'steel_manufacturing' },
    ],
    // EAF vs BF-BOF: ~70–80% emission intensity reduction; scrap optimisation mid ~75%
    typicalAbatementPct: 75,
    // capex: "Scrap optimisation $500k–$5M" → mid $2.75M
    capexAud: 2_750_000,
    // opex: "EAF electricity at $40–$80/t steel" — variable; modest positive for grid transition; ~$50k/yr
    opexDeltaAudAnnual: 50_000,
    sectorApplicability: ['industrial', 'construction'],
    isEnabler: false,
    mutexPartners: ['IND-005'],
    evidence: { primarySource: 'BlueScope ClimateAction Report 2023', primarySourceYear: 2023 },
  },

  {
    leverId: 'IND-005',
    name: 'Hydrogen direct reduction of iron — H-DRI EAF steelmaking route',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'steel_manufacturing' },
      { source: 'process', endUse: 'ironmaking' },
    ],
    // H-DRI: ~90–95% reduction vs BF-BOF; mid ~92%
    typicalAbatementPct: 92,
    // capex: "$1.5B–$4B for 1 Mt/yr" → mid $2.75B
    capexAud: 2_750_000_000,
    // opex: dominant cost green H2 ($220–$440/t DRI); large opex increase; approximate mid $330k/yr for model unit
    opexDeltaAudAnnual: 330_000,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: ['IND-004', 'IND-015', 'IND-016'],
    evidence: { primarySource: 'ARENA HySupply Study 2022', primarySourceYear: 2022 },
  },

  {
    leverId: 'IND-006',
    name: 'BF-BOF process improvements — top-gas recycling, bio-coke, and heat integration',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'steel_manufacturing' },
      { source: 'process', endUse: 'ironmaking' },
    ],
    // 10–25% carbon intensity reduction; mid ~17%
    typicalAbatementPct: 17,
    // capex: "Oxygen/heat improvements $5M–$30M/BF" → mid $17.5M
    capexAud: 17_500_000,
    // opex: "Bio-coke premium $50–$120/t bio-coke" — additional opex; approximate mid $85k/yr
    opexDeltaAudAnnual: 85_000,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'IEA Iron and Steel Technology Roadmap 2020', primarySourceYear: 2020 },
  },

  {
    leverId: 'IND-007',
    name: 'Aluminium smelter renewable energy PPA — full smelter renewable electricity procurement',
    applicableTo: [
      { source: 'electricity', endUse: 'aluminium_smelting' },
    ],
    // Grid → renewable PPA: ~85–95% Scope 2 reduction; mid ~90%
    typicalAbatementPct: 90,
    // capex: "Smelter-side minimal $1M–$10M" → mid $5.5M
    capexAud: 5_500_000,
    // opex: "PPA tariff $50–$80/MWh vs NEM industrial tariff; approximately cost-neutral" → 0
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Australian Aluminium Council Net Zero Roadmap 2021', primarySourceYear: 2021 },
  },

  {
    leverId: 'IND-008',
    name: 'Inert anode technology — eliminating CO2 process emissions from aluminium electrolysis',
    applicableTo: [
      { source: 'process', endUse: 'aluminium_smelting' },
      { source: 'electricity', endUse: 'aluminium_smelting' },
    ],
    // Process CO2 elimination ~1.5–1.8 tCO2e/t Al; process fraction ~15–20% of total; with grid decarbonisation ~20%
    typicalAbatementPct: 20,
    // capex: "Retrofit $200M–$600M per 100 kt/yr" → mid $400M
    capexAud: 400_000_000,
    // opex: "anode replacement cost eliminated (~$150–$250/t Al); offset by 5–10% higher electricity" → roughly neutral; use 0
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ELYSIS Technology Platform 2022', primarySourceYear: 2022 },
  },

  {
    leverId: 'IND-009',
    name: 'Green ammonia — electrolytic hydrogen-based Haber-Bosch production',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'ammonia_production' },
      { source: 'process', endUse: 'ammonia_production' },
    ],
    // SMR → green H2: ~90–100% process CO2 reduction; mid ~95%
    typicalAbatementPct: 95,
    // capex: "Electrolyser for 100 kt/yr $400M–$900M" → mid $650M
    capexAud: 650_000_000,
    // opex: "Green ammonia $700–$1,500/t vs SMR ammonia $400–$600/t" → significant premium; mid +$600/t * ~100kt → very large; use mid per-unit ~$600k additional
    opexDeltaAudAnnual: 600_000,
    sectorApplicability: ['industrial', 'mining', 'agriculture'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ARENA Green Hydrogen Superpowers 2021', primarySourceYear: 2021 },
  },

  {
    leverId: 'IND-010',
    name: 'Electrified steam crackers — electric furnace heating for ethylene and olefin production',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'petrochemical_manufacturing' },
    ],
    // Eliminates furnace combustion; combustion ~40–60% of cracker emissions; mid ~50%
    typicalAbatementPct: 50,
    // capex: "Furnace electrification retrofit $200M–$600M per furnace bank" → mid $400M
    capexAud: 400_000_000,
    // opex: "adds ~$80–$150/t ethylene" → positive cost increase; mid $115k/yr per unit scale
    opexDeltaAudAnnual: 115_000,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Shell/SABIC/LyondellBasell Electric Cracking Technology Programme 2022–2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'IND-011',
    name: 'Haul truck electrification — battery-electric and trolley-assist for open-cut mining',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'mining_haulage' },
      { source: 'mobile_combustion', endUse: 'open_cut_mining' },
    ],
    // Diesel reduction 60–100% per tonne-km; BEV mid ~80%
    typicalAbatementPct: 80,
    // capex: "BEV premium $500k–$2M/unit" → mid $1.25M
    capexAud: 1_250_000,
    // opex: "Diesel eliminated ($15M–$30M/yr per 50-truck fleet); replaced by electricity ($10M–$20M/yr)" → net saving mid ~$7.5M/50 trucks fleet = $150k/truck; use per-truck mid -$7_500
    opexDeltaAudAnnual: -150_000,
    sectorApplicability: ['industrial', 'mining'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'MRIWA Electrification of Mine Vehicles 2023', primarySourceYear: 2023 },
  },

  {
    leverId: 'IND-012',
    name: 'Mining ventilation efficiency — ventilation-on-demand (VOD) systems and VSD fans',
    applicableTo: [
      { source: 'electricity', endUse: 'underground_mining_ventilation' },
      { source: 'electricity', endUse: 'mining' },
    ],
    // VOD: 25–50% ventilation electricity reduction; mid ~37%
    typicalAbatementPct: 37,
    // capex: "VOD installation $2M–$15M per mine" → mid $8.5M
    capexAud: 8_500_000,
    // opex: "Electricity savings 25–50% of ventilation electricity bill; for $10M/yr: saving $2.5M–$5M/yr" → mid -$3.75M
    opexDeltaAudAnnual: -3_750_000,
    sectorApplicability: ['industrial', 'mining'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'MRIWA Energy Efficiency in Underground Mines — VOD 2021', primarySourceYear: 2021 },
  },

  {
    leverId: 'IND-013',
    name: 'Mining process plant electrification — renewable energy PPA for comminution and concentration',
    applicableTo: [
      { source: 'electricity', endUse: 'mining_processing' },
      { source: 'mobile_combustion', endUse: 'mining_processing' },
    ],
    // Renewable PPA displaces grid coal/gas; ~85–95% Scope 2 reduction; mid ~90%
    typicalAbatementPct: 90,
    // capex: "Process optimisation $20M–$150M per circuit" → mid $85M
    capexAud: 85_000_000,
    // opex: "Renewable PPA $50–$75/MWh (lower than diesel gen-set $120–$200/MWh)" → net saving; mid ~-$1M/yr for representative mine
    opexDeltaAudAnnual: -1_000_000,
    sectorApplicability: ['industrial', 'mining'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'MCA Mining Towards Net Zero Roadmap 2022', primarySourceYear: 2022 },
  },

  {
    leverId: 'IND-014',
    name: 'Fugitive methane management — coal mine methane drainage, flaring, and VAM oxidation',
    applicableTo: [
      { source: 'fugitive', endUse: 'coal_mine_methane' },
    ],
    // Gas drainage + flaring + VAM: 50–80% fugitive CH4 abatement; mid ~65%
    typicalAbatementPct: 65,
    // capex: "Gas drainage and power generation $5M–$20M" → mid $12.5M
    capexAud: 12_500_000,
    // opex: "Gas drainage with power generation near-neutral to positive; flaring $500k–$2M/yr" → mid -$250k (near neutral, slight positive)
    opexDeltaAudAnnual: -250_000,
    sectorApplicability: ['industrial', 'mining'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'DCCEEW National Greenhouse Gas Inventory Coal Mining Fugitive Emissions 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'IND-015',
    name: 'Electric smelting furnace (ESF) — near-zero-emission ironmaking via electric arc smelting',
    // stub — applicable_to: [] per YAML
    applicableTo: [],
    // TRL 5 stub; ~85% potential GHG reduction when commercial
    typicalAbatementPct: 85,
    // capex: TBD stub — use 0
    capexAud: 0,
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: ['IND-004', 'IND-005', 'IND-016'],
    evidence: { primarySource: 'BHP Climate Transition Action Plan 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'IND-016',
    name: 'Molten oxide electrolysis — zero-emission ironmaking via direct electrolysis of iron ore',
    // stub — applicable_to: [] per YAML
    applicableTo: [],
    // TRL 5 stub; ~95% potential GHG reduction when commercial
    typicalAbatementPct: 95,
    // capex: TBD stub — use 0
    capexAud: 0,
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['industrial'],
    isEnabler: false,
    mutexPartners: ['IND-004', 'IND-005', 'IND-015'],
    evidence: { primarySource: 'BHP Climate Transition Action Plan 2024', primarySourceYear: 2024 },
  },

  // ─── PART 2 — BUILT ENVIRONMENT (BLT-001 to BLT-010) ─────────────────

  {
    leverId: 'BLT-001',
    name: 'HVAC efficiency upgrade — chillers, VRF, variable-speed drives',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: 'hvac' },
    ],
    // VSD retrofits 30–50%; full system upgrade 30–50% of HVAC circuit; mid ~35%
    typicalAbatementPct: 35,
    // capex: "chiller replacement (200 kW) $180,000–$350,000" → mid $265_000
    capexAud: 265_000,
    // opex: "Electricity savings 30–50% of HVAC circuit" — savings; typical office mid ~-$15k/yr
    opexDeltaAudAnnual: -15_000,
    sectorApplicability: ['built_environment', 'services', 'retail', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'AIRAH HVAC Energy Efficiency Guide 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-002',
    name: 'HVAC electrification — gas boiler to heat pump conversion',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'space_heating' },
      { source: 'stationary_combustion', endUse: 'hvac' },
    ],
    // Gas boiler → heat pump at COP 3.0, NSW grid 2026: ~80% reduction; matches v1 BLT-007 (80%)
    typicalAbatementPct: 80,
    // capex: "Air-source HP ... full project (200 kW load) $150,000–$350,000" → mid $250_000
    capexAud: 250_000,
    // opex: "Gas cost eliminated; electricity increase at COP 3.0; net opex sensitive to energy price" → approximately -$3_500 (consistent with v1 stub)
    opexDeltaAudAnnual: -3_500,
    sectorApplicability: ['built_environment', 'services', 'retail'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ARENA Buildings Electrification Technology Review 2023', primarySourceYear: 2023 },
  },

  {
    leverId: 'BLT-003',
    name: 'LED and smart lighting — occupancy sensing and daylight harvesting',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: 'lighting' },
    ],
    // LED + controls: 60–75% lighting circuit reduction; consistent with v1 BLT-001 (60%); mid ~65%
    typicalAbatementPct: 65,
    // capex: "LED + occupancy sensors $2,500–$5,000 per 100 m2; full smart controls $4,000–$8,000" → per 100m2 mid ~$6_000; typical 500m2 office ~$30_000
    capexAud: 30_000,
    // opex: "Electricity savings 60–75% of lighting circuit; maintenance savings" → mid ~-$9_000/yr for typical office
    opexDeltaAudAnnual: -9_000,
    sectorApplicability: ['built_environment', 'services', 'retail', 'industrial', 'warehouse'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Sustainability Victoria LED Lighting Guide 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-004',
    name: 'Building envelope retrofit — insulation, double glazing, draught sealing',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'stationary_combustion', endUse: 'space_heating' },
    ],
    // HVAC energy reduction 15–30%; mid ~22%
    typicalAbatementPct: 22,
    // capex: "full envelope package 2,000 m2 $120,000–$400,000" → mid $260_000
    capexAud: 260_000,
    // opex: "HVAC energy reduction 15–30%" → savings ~-$5_000/yr
    opexDeltaAudAnnual: -5_000,
    sectorApplicability: ['built_environment', 'services'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'NatHERS Technical Note Commercial Building Thermal Performance 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-005',
    name: 'Rooftop solar PV — commercial scale 100 kW–1 MW',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: null },
    ],
    // 100 kW in Sydney: ~93 tCO2e/yr displaced; as fraction of typical office ~35%; consistent with v1 BLT-005 (35%)
    typicalAbatementPct: 35,
    // capex: "100 kW system $80,000–$140,000" → mid $110_000; "300 kW $210,000–$360,000" → mid $285_000; use 100kW mid $110_000
    capexAud: 110_000,
    // opex: "Near-zero; panel cleaning $500–$2,000/yr" → mid ~-$1_250 (near-zero net; use savings midpoint)
    opexDeltaAudAnnual: -1_250,
    sectorApplicability: ['built_environment', 'services', 'retail', 'industrial', 'warehouse'],
    isEnabler: false,
    mutexPartners: ['BLT-006'],
    evidence: { primarySource: 'ARENA Commercial Solar Market Update 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-006',
    name: 'Behind-the-meter battery — commercial scale 50 kWh–2 MWh',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: null },
    ],
    // Solar-paired additional abatement: 30–80 tCO2e/yr; standalone grid-arbitrage: 10–40 tCO2e/yr; as fraction ~10%
    typicalAbatementPct: 10,
    // capex: "100 kWh $80,000–$150,000" → mid $115_000
    capexAud: 115_000,
    // opex: "Demand charge reduction $5,000–$50,000/yr" → mid -$27_500
    opexDeltaAudAnnual: -27_500,
    sectorApplicability: ['built_environment', 'services', 'retail', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ARENA Behind-the-Meter Battery Storage 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-007',
    name: 'Building management system optimisation and AI-driven controls',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: 'data' },
    ],
    // BMS tuning alone: 5,000 m2 office 20–50 tCO2e/yr; AI overlay further 8–20 tCO2e/yr; as % of building electricity ~25%; consistent with v1 BLT-002 (25%)
    typicalAbatementPct: 25,
    // capex: "BMS recommissioning $5,000–$25,000; hardware $15,000–$60,000/floor; AI $40,000–$200,000" → mid BMS+AI $120_000
    capexAud: 120_000,
    // opex: "SaaS AI platform $5,000–$30,000/yr" → net savings after SaaS mid ~-$10_000
    opexDeltaAudAnnual: -10_000,
    sectorApplicability: ['built_environment', 'services', 'retail', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'NABERS Energy Opportunity Guide 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-008',
    name: 'Embodied carbon reduction — low-carbon concrete and fitout materials',
    applicableTo: [
      { source: 'process', endUse: 'construction_materials' },
    ],
    // SCM concrete 30–50% clinker replacement reduces embodied carbon 30–50%; for professional services fitout ~35%
    typicalAbatementPct: 35,
    // capex: "total embodied carbon premium on $1M fitout $30,000–$120,000" → mid $75_000
    capexAud: 75_000,
    // opex: "Nil once construction complete"
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['built_environment', 'construction'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Green Building Council Australia Green Star Buildings 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'BLT-009',
    name: 'Green leases and tenancy alignment',
    applicableTo: [
      { source: 'electricity', endUse: null },
      { source: 'stationary_combustion', endUse: null },
    ],
    // Enabler lever — unlocks other BLT levers; 0% direct abatement; consistent with v1 BLT-009 (0%)
    typicalAbatementPct: 0,
    // capex: "Legal costs only $3,000–$10,000" → mid $6_500
    capexAud: 6_500,
    // opex: "Nil direct (enabler lever)"
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['built_environment', 'services', 'retail'],
    isEnabler: true,
    mutexPartners: [],
    evidence: { primarySource: 'Property Council of Australia Green Lease Toolkit 2022', primarySourceYear: 2022 },
  },

  {
    leverId: 'BLT-010',
    name: 'NABERS uplift programme — rating-led operational optimisation',
    applicableTo: [
      { source: 'electricity', endUse: 'lighting_hvac' },
      { source: 'electricity', endUse: null },
    ],
    // 1.0-star improvement 5,000 m2: 20–50 tCO2e/yr; 2.0-star: 50–100 tCO2e/yr; as % ~20%
    typicalAbatementPct: 20,
    // capex: "assessment $3k–$8k; gap analysis $8k–$25k; implementation $20k–$200k" → mid $116_500
    capexAud: 116_500,
    // opex: electricity savings from implemented measures; mid ~-$8_000/yr
    opexDeltaAudAnnual: -8_000,
    sectorApplicability: ['built_environment', 'services', 'retail'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'NABERS National Australian Built Environment Rating System 2024', primarySourceYear: 2024 },
  },

  // ─── PART 3 — TRANSPORT (TRP-001 to TRP-010) ──────────────────────────

  {
    leverId: 'TRP-001',
    name: 'BEV light fleet — passenger and light commercial vehicle electrification',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_light_vehicles' },
      { source: 'mobile_combustion', endUse: 'passenger_transport' },
      // 'fleet' is the ConsultCo fixture endUse for R5 (petrol & diesel cars)
      { source: 'mobile_combustion', endUse: 'fleet' },
      // 'business_travel' — professional services staff travel (ground); air travel policy lever
      { source: 'mobile_combustion', endUse: 'business_travel' },
    ],
    // ICE ~2.1 tCO2e/vehicle/yr; EV residual ~0.3 tCO2e; ~85% abatement; consistent with v1 TRV-001 (70% for fleet)
    typicalAbatementPct: 75,
    // capex: "$15,000–$40,000 premium per vehicle + charging" → mid $27_500 per vehicle + $5k charging = $32_500
    capexAud: 32_500,
    // opex: "Fuel cost reduction $1,500–$3,000/vehicle/yr; servicing $400–$800/vehicle/yr" → mid -$2_350/vehicle
    opexDeltaAudAnnual: -2_350,
    sectorApplicability: ['transport', 'services', 'retail', 'industrial', 'built_environment'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'EV Council AU State of Electric Vehicles 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-002',
    name: 'BEV and hydrogen heavy freight — rigid and articulated truck electrification',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles' },
      { source: 'mobile_combustion', endUse: 'freight_transport' },
    ],
    // BEV short-haul heavy: ~80% diesel elimination; fuel → electricity residual; mid ~75%
    typicalAbatementPct: 75,
    // capex: "BEV rigid $150,000–$350,000 premium" → mid $250_000
    capexAud: 250_000,
    // opex: "Fuel cost reduction $15,000–$40,000/vehicle/yr" → mid -$27_500
    opexDeltaAudAnnual: -27_500,
    sectorApplicability: ['transport', 'industrial', 'mining'],
    isEnabler: false,
    mutexPartners: ['TRP-003'],
    evidence: { primarySource: 'NHVR Zero Emission Truck Trials 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-003',
    name: 'Biofuels — HVO and renewable diesel',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles' },
      { source: 'mobile_combustion', endUse: 'fleet_light_vehicles' },
      { source: 'mobile_combustion', endUse: 'mining_haulage' },
    ],
    // Lifecycle CO2-e reduction 70–90% vs fossil diesel; mid ~80%
    typicalAbatementPct: 80,
    // capex: "Negligible (drop-in fuel, no vehicle modification)" → 0
    capexAud: 0,
    // opex: "HVO premium $0.30–$0.70/L over diesel" → mid $0.50/L; for 50,000L/yr fleet ~$25k additional
    opexDeltaAudAnnual: 25_000,
    sectorApplicability: ['transport', 'industrial', 'mining'],
    isEnabler: false,
    mutexPartners: ['TRP-002'],
    evidence: { primarySource: 'Neste MY Renewable Diesel 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-004',
    name: 'Biomethane — CNG/LNG replacement with renewable natural gas',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles' },
    ],
    // Lifecycle reduction 60–100% vs fossil CNG/LNG; mid ~80%
    typicalAbatementPct: 80,
    // capex: "Near-zero if via existing CNG/LNG station (drop-in)" → 0
    capexAud: 0,
    // opex: "Biomethane premium over fossil CNG/LNG ~20–60%" → mid 40% premium; ~$40k/yr additional for typical fleet
    opexDeltaAudAnnual: 40_000,
    sectorApplicability: ['transport', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ARENA Bioenergy Strategy 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-005',
    name: 'Modal shift to rail — interstate freight',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'freight_transport' },
    ],
    // Rail ~5x less CO2-e per tonne-km vs diesel road; ~80% emission reduction per tonne-km; mid ~80%
    typicalAbatementPct: 80,
    // capex: "Nil to $50,000 (logistics integration)" → mid $25_000
    capexAud: 25_000,
    // opex: "Rail freight typically cost-competitive with road on corridors >700 km" → approximately neutral mid 0
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['transport', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Infrastructure Australia Corridor Freight Analysis 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-006',
    name: 'Rail freight electrification and locomotive energy management',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'freight_transport' },
    ],
    // Loco EMS: 5–12% fuel reduction; full electrification NEM: 80–95% vs diesel; loco EMS applicable mid ~8%
    typicalAbatementPct: 8,
    // capex: "Loco EMS retrofit $50,000–$200,000 per loco" → mid $125_000
    capexAud: 125_000,
    // opex: "Loco EMS: near-zero delta; fuel savings offset cost" → mid 0
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['transport'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Aurizon Decarbonisation Roadmap 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-007',
    name: 'Logistics and route optimisation — telematics and AI dispatch',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles' },
      { source: 'mobile_combustion', endUse: 'fleet_light_vehicles' },
      { source: 'mobile_combustion', endUse: 'freight_transport' },
      // 'fleet' and 'business_travel' for professional services context (travel policy + routing)
      { source: 'mobile_combustion', endUse: 'fleet' },
      { source: 'mobile_combustion', endUse: 'business_travel' },
    ],
    // Fuel consumption reduction 6–15%; mid ~10%
    typicalAbatementPct: 10,
    // capex: "Hardware $300–$1,500 per vehicle; SaaS zero-capex option" → mid $900 per vehicle; 10-vehicle fleet ~$9_000; use $9_000
    capexAud: 9_000,
    // opex: "Fuel savings 6–15% of fuel bill; SaaS offset by fuel savings" → net saving mid ~-$5_000/yr for 10-vehicle fleet
    opexDeltaAudAnnual: -5_000,
    sectorApplicability: ['transport', 'industrial', 'services', 'retail'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Geotab Fleet Efficiency Benchmark 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-008',
    name: 'Warehouse and DC electrification — forklift and material handling equipment',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'warehouse_mhe' },
      { source: 'stationary_combustion', endUse: 'warehouse_mhe' },
    ],
    // LPG forklift ~3.5–5.0 tCO2e/unit/yr; electric abates 3–4 tCO2e/unit/yr; ~80% reduction
    typicalAbatementPct: 80,
    // capex: "$5,000–$25,000 premium per unit" → mid $15_000
    capexAud: 15_000,
    // opex: "LPG cost eliminated; electricity increase ~$500–$1,500/unit/yr; net positive" → mid -$500 net saving
    opexDeltaAudAnnual: -500,
    sectorApplicability: ['transport', 'industrial', 'retail', 'warehouse'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Toyota Material Handling Australia Electric Forklift TCO 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-009',
    name: 'Last-mile EV and cargo bike — urban deliveries',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_light_vehicles' },
      { source: 'mobile_combustion', endUse: 'freight_transport' },
    ],
    // E-van 2.0–4.0 tCO2e/vehicle/yr abated; ~85% per vehicle; mid ~82%
    typicalAbatementPct: 82,
    // capex: "E-van $20,000–$45,000 premium" → mid $32_500
    capexAud: 32_500,
    // opex: "Fuel savings $3,000–$6,000/van/yr" → mid -$4_500
    opexDeltaAudAnnual: -4_500,
    sectorApplicability: ['transport', 'retail', 'services'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'EV Council AU Commercial EV Delivery Van TCO 2024', primarySourceYear: 2024 },
  },

  {
    leverId: 'TRP-010',
    name: 'Eco-driving and telematics behavioural programme',
    applicableTo: [
      { source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles' },
      { source: 'mobile_combustion', endUse: 'fleet_light_vehicles' },
      // 'fleet' is the ConsultCo fixture endUse for R5 (petrol & diesel cars)
      { source: 'mobile_combustion', endUse: 'fleet' },
    ],
    // Fuel reduction 3–8%; mid ~5%
    typicalAbatementPct: 5,
    // capex: "Basic telematics $300–$800/vehicle; in-cab coaching $200–$600/vehicle; programme design $5,000–$30,000" → per vehicle mid $800; 10-vehicle fleet: $8k + programme mid $17.5k = $25_500
    capexAud: 25_500,
    // opex: "Fuel savings 3–8% of fuel bill; programme maintenance $2,000–$10,000/yr" → net saving mid ~-$3_000/yr
    opexDeltaAudAnnual: -3_000,
    sectorApplicability: ['transport', 'industrial', 'services', 'retail'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'Teletrac Navman Driver Behaviour and Fuel Savings 2024', primarySourceYear: 2024 },
  },

  // ─── PART 4 — POWER SECTOR (PWR-001 to PWR-008) ───────────────────────

  {
    leverId: 'PWR-001',
    name: 'Utility-scale solar PV — ground-mounted, greater than 5 MW AC',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // Displaces grid coal/gas; abatement as % of site electricity ~85% (renewable fraction)
    typicalAbatementPct: 85,
    // capex: "$1,100–$1,500/kW AC" → mid $1_300/kW; for 100 MW = $130M
    capexAud: 130_000_000,
    // opex: "$15–$25/kW/yr (fixed O&M)" → mid $20/kW; for 100 MW = $2M
    opexDeltaAudAnnual: 2_000_000,
    sectorApplicability: ['power', 'industrial', 'mining'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO GenCost 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'PWR-002',
    name: 'Onshore wind — utility-scale, greater than 10 MW',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // Higher capacity factor than solar; ~85% displacement of grid emissions
    typicalAbatementPct: 85,
    // capex: "$2,100–$2,700/kW installed" → mid $2_400/kW; for 200 MW = $480M
    capexAud: 480_000_000,
    // opex: "$40–$70/kW/yr" → mid $55/kW; for 200 MW = $11M
    opexDeltaAudAnnual: 11_000_000,
    sectorApplicability: ['power', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO GenCost 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'PWR-003',
    name: 'Offshore wind — utility-scale, fixed-bottom or floating',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // 45–55% capacity factor; ~87% NEM grid displacement; mid ~87%
    typicalAbatementPct: 87,
    // capex: "$4,500–$6,500/kW (fixed-bottom)" → mid $5_500/kW; for 1 GW = $5.5B
    capexAud: 5_500_000_000,
    // opex: "$80–$140/kW/yr" → mid $110/kW; for 1 GW = $110M
    opexDeltaAudAnnual: 110_000_000,
    sectorApplicability: ['power'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO GenCost 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'PWR-004',
    name: 'Utility-scale BESS — 4-hour duration, grid-connected',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // Gas peaker displacement; ~50% of charged energy used; mid ~30% system abatement
    typicalAbatementPct: 30,
    // capex: "$700–$1,000/kWh (4-hour system)" → mid $850/kWh; for 100 MW/400 MWh = $340M
    capexAud: 340_000_000,
    // opex: "$15–$25/kWh/yr" → mid $20/kWh; for 400 MWh = $8M
    opexDeltaAudAnnual: 8_000_000,
    sectorApplicability: ['power'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO GenCost 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'PWR-005',
    name: 'Pumped hydro — utility-scale',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // System-level enabling; ~30% effective displacement of gas peakers
    typicalAbatementPct: 30,
    // capex: "$1,500–$3,500/kW (generic)" → mid $2_500/kW; for 2 GW Snowy 2.0 ~ $5B (simplified use generic mid)
    capexAud: 5_000_000_000,
    // opex: "$30–$60/kW/yr" → mid $45/kW; for 2 GW = $90M
    opexDeltaAudAnnual: 90_000_000,
    sectorApplicability: ['power'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO GenCost 2025', primarySourceYear: 2025 },
  },

  {
    leverId: 'PWR-006',
    name: 'Demand response — industrial and commercial, NEM wholesale and RERT',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // Avoided gas peaker dispatch; ~200–600 tCO2e/yr per MW enrolled; as % ~20% of peak demand
    typicalAbatementPct: 20,
    // capex: "$10,000–$80,000 per site" → mid $45_000
    capexAud: 45_000,
    // opex: "Revenue from RERT availability payments; net opex typically positive" → mid -$10_000 net saving
    opexDeltaAudAnnual: -10_000,
    sectorApplicability: ['power', 'industrial', 'built_environment', 'services'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'AEMO RERT information', primarySourceYear: 2024 },
  },

  {
    leverId: 'PWR-007',
    name: 'Behind-the-meter aggregation and virtual power plant',
    applicableTo: [
      { source: 'electricity', endUse: null },
    ],
    // Per SME battery (50 kWh): 3–10 tCO2e/yr; as fraction of site ~8%
    typicalAbatementPct: 8,
    // capex: "SME battery (30–100 kWh) $2,500–$4,000/kWh; 50 kWh system ~$162_500"
    capexAud: 162_500,
    // opex: "VPP revenue variable" → mid -$2_500/yr
    opexDeltaAudAnnual: -2_500,
    sectorApplicability: ['power', 'built_environment', 'services'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'ARENA Virtual Power Plants Program', primarySourceYear: 2024 },
  },

  {
    leverId: 'PWR-008',
    name: 'Coal plant early retirement with renewable replacement bundle',
    applicableTo: [
      { source: 'stationary_combustion', endUse: 'electricity_generation' },
    ],
    // Cessation of coal combustion; full retirement ~90–95% of station emissions; mid ~92%
    typicalAbatementPct: 92,
    // capex: "Replacement generation $1,100–$2,700/kW + storage; decommissioning $200M–$600M" → use decommissioning mid $400M
    capexAud: 400_000_000,
    // opex: "Stranded asset write-down + replacement generation opex; net opex positive at scale" → mid 0 (revenue roughly offset)
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['power'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'AEMO 2025 ESOO', primarySourceYear: 2025 },
  },

  // ─── PART 5 — AGRICULTURE + WASTE (AGR-001 to WST-004) ────────────────

  {
    leverId: 'AGR-001',
    name: 'Livestock methane reduction via feed additives',
    applicableTo: [
      { source: 'process', endUse: 'livestock_enteric_fermentation' },
      { source: 'process', endUse: 'livestock' },
    ],
    // 3-NOP: 20–30% CH4 reduction; Asparagopsis: 50–80%; mid across approaches ~35%
    typicalAbatementPct: 35,
    // capex: "$50k–$500k per operation (dosing infrastructure)" → mid $275_000
    capexAud: 275_000,
    // opex: "Additive input cost $0.10–$0.50/head/day" → mid $0.30/head/day; 1000 head: ~$109k/yr
    opexDeltaAudAnnual: 109_000,
    sectorApplicability: ['agriculture'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CER Reducing GHG from Beef Cattle methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'AGR-002',
    name: 'Nitrogen-use efficiency in cropping — fertiliser optimisation',
    applicableTo: [
      { source: 'process', endUse: 'cropping_nitrogen_fertiliser' },
      { source: 'process', endUse: 'agriculture' },
    ],
    // N2O reduction from N-efficiency; 20–40% N2O emission reduction; mid ~30%
    typicalAbatementPct: 30,
    // capex: "$20k–$150k per farm (precision application hardware)" → mid $85_000
    capexAud: 85_000,
    // opex: "enhanced-efficiency fertiliser premium 5–15%; partially offset by yield and reduced N input" → mid +$5k/yr
    opexDeltaAudAnnual: 5_000,
    sectorApplicability: ['agriculture'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CSIRO Nitrogen Use Efficiency Research', primarySourceYear: 2024 },
  },

  {
    leverId: 'AGR-003',
    name: 'Soil carbon sequestration — cropland and grazing',
    applicableTo: [
      { source: 'land_use', endUse: 'cropping' },
      { source: 'land_use', endUse: 'grazing' },
    ],
    // 0.2–1.5 tCO2e/ha/yr; as % of agricultural baseline ~25%
    typicalAbatementPct: 25,
    // capex: "$30k–$200k per property (baseline sampling, project registration)" → mid $115_000
    capexAud: 115_000,
    // opex: "Project management $5k–$20k/yr; ACCU revenue offset" → mid +$12.5k but ACCU offsets; net ~$0
    opexDeltaAudAnnual: 0,
    sectorApplicability: ['agriculture'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CER Soil Carbon Measurement Methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'AGR-004',
    name: 'Savanna burning — early dry-season cool burns',
    applicableTo: [
      { source: 'land_use', endUse: 'savanna_burning' },
    ],
    // Replacing late-season wildfires; CH4+N2O reduction from fire; ~40% of fire emissions
    typicalAbatementPct: 40,
    // capex: "$100k–$1M+ (aerial burning, remote monitoring, registration)" → mid $550_000
    capexAud: 550_000,
    // opex: "Ranger and aerial operations; offset by ACCU revenue (typically net positive)" → mid -$5_000 net
    opexDeltaAudAnnual: -5_000,
    sectorApplicability: ['agriculture'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CER Savanna Fire Management methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'WST-001',
    name: 'Organics diversion — FOGO collection and composting',
    applicableTo: [
      { source: 'process', endUse: 'organic_waste' },
      { source: 'process', endUse: 'waste' },
    ],
    // 0.3–0.5 tCO2e per tonne diverted; as % of organic waste CH4 abatement ~60%
    typicalAbatementPct: 60,
    // capex: "$200k–$5M for commercial food waste composting facility" → mid $2_600_000
    capexAud: 2_600_000,
    // opex: "Gate fee savings vs landfill; ACCU revenue; compost off-take revenue" → net saving mid -$50k
    opexDeltaAudAnnual: -50_000,
    sectorApplicability: ['waste', 'industrial', 'services', 'retail'],
    isEnabler: false,
    mutexPartners: ['WST-003'],
    evidence: { primarySource: 'CER Avoidance of Methane Production from Organic Waste Sent to Landfill methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'WST-002',
    name: 'Landfill gas capture and utilisation or flare',
    applicableTo: [
      { source: 'process', endUse: 'landfill_waste' },
      { source: 'fugitive', endUse: 'landfill_methane' },
    ],
    // Active LFG capture ~50% of CH4; flaring destroys ~98% of captured CH4; net ~50% of total landfill CH4
    typicalAbatementPct: 50,
    // capex: "$500k–$5M (well-field, header, flare only)" → mid $2_750_000
    capexAud: 2_750_000,
    // opex: "Flaring $100k–$500k/yr" → mid +$300_000 (cost) but LFG-to-energy revenue offsets; net mid ~$100_000
    opexDeltaAudAnnual: 100_000,
    sectorApplicability: ['waste'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'CER Landfill Gas Capture and Combustion methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'WST-003',
    name: 'Anaerobic digestion — industrial, wastewater, and agricultural waste',
    applicableTo: [
      { source: 'process', endUse: 'organic_waste' },
      { source: 'process', endUse: 'food_processing_effluent' },
    ],
    // Controlled digestion + biogas capture; ~70% CH4 captured vs uncontrolled; mid ~70%
    typicalAbatementPct: 70,
    // capex: "$500k–$5M (small-to-medium food processing AD)" → mid $2_750_000
    capexAud: 2_750_000,
    // opex: "CHP revenue or biomethane injection revenue partially offsets; ACCU revenue" → net saving mid -$30_000
    opexDeltaAudAnnual: -30_000,
    sectorApplicability: ['waste', 'industrial', 'agriculture'],
    isEnabler: false,
    mutexPartners: ['WST-001'],
    evidence: { primarySource: 'CER Avoided Emissions from Biomass — Anaerobic Digestion methodology', primarySourceYear: 2024 },
  },

  {
    leverId: 'WST-004',
    name: 'Wastewater treatment optimisation — energy efficiency and N2O reduction',
    applicableTo: [
      { source: 'electricity', endUse: 'wastewater_treatment' },
      { source: 'process', endUse: 'wastewater_treatment' },
    ],
    // Energy efficiency: 20–40% electricity reduction + N2O 30–50% reduction; combined mid ~30%
    typicalAbatementPct: 30,
    // capex: "Energy optimisation $50k–$2M" → mid $1_025_000
    capexAud: 1_025_000,
    // opex: "Electricity savings 20–40% of aeration energy; CHP biogas revenue" → mid -$100_000
    opexDeltaAudAnnual: -100_000,
    sectorApplicability: ['waste', 'industrial'],
    isEnabler: false,
    mutexPartners: [],
    evidence: { primarySource: 'WSAA Energy Efficiency and N2O Reduction in Australian Wastewater Treatment', primarySourceYear: 2024 },
  },
];

// Filter levers applicable to a given sector and set of source rows.
export function getLeversForFixture(
  orgSector: string,
  sourcesPresent: Array<{ source: string; endUse: string | null }>,
): Lever[] {
  return leverDbV2.filter(lever => {
    const sectorMatch = lever.sectorApplicability.includes(orgSector);
    const sourceMatch = lever.applicableTo.some(a =>
      sourcesPresent.some(
        s => s.source === a.source && (a.endUse === null || a.endUse === s.endUse),
      ),
    );
    return sectorMatch || sourceMatch;
  });
}
