// AutoMACC v4 — emission source factor table.
// Mirrors docs/automacc/source-factors.md. Single source of truth for
// arithmetic in Screen 1 and the /api/automacc/normalise route.
//
// Citations: NGER Determination (AU), AEMO grid intensity, IEA upstream
// defaults, IPCC AR6 for agriculture and nature. See the .md for full notes.

import type { SourceFactor } from "./v4-types";

export const SOURCE_FACTORS: SourceFactor[] = [
  // ─── 1. Stationary electricity ─────────────────────────────────────────────
  // Usage-based entries. State grid intensity is applied as a multiplier at
  // compute time via STATE_GRID_INTENSITY (see below). The factor value here
  // is the national-average grid intensity used when state = "mixed" or unset.
  {
    id: "elec_building",
    bucket: "stationary_electricity",
    label: "Grid electricity — building (HVAC, lighting, plug load)",
    numerical: {
      name: "Annual electricity use",
      unit: "MWh",
      hint: "e.g. 1,200 MWh for a mid-size office",
    },
    factor: {
      value: 0.62,
      unitOut: "tCO2e",
      source: "AEMO",
      year: 2024,
      notes: "National-average grid intensity; state-specific value applied at compute time.",
    },
    costFactorAudPerUnit: 220,
  },
  {
    id: "elec_process",
    bucket: "stationary_electricity",
    label: "Grid electricity — industrial process",
    numerical: {
      name: "Annual electricity use",
      unit: "MWh",
      hint: "e.g. 1,200 MWh for a mid-size office",
    },
    factor: {
      value: 0.62,
      unitOut: "tCO2e",
      source: "AEMO",
      year: 2024,
      notes: "National-average grid intensity; state-specific value applied at compute time.",
    },
    costFactorAudPerUnit: 180,
  },
  {
    id: "elec_datacentre",
    bucket: "stationary_electricity",
    label: "Data-centre IT load (colocated)",
    numerical: {
      name: "Annual electricity use",
      unit: "MWh",
      hint: "rack-kW × 8,760 h ÷ 1,000",
    },
    factor: {
      value: 0.93,
      unitOut: "tCO2e",
      source: "AEMO",
      year: 2024,
      notes: "National-average grid intensity (incl. PUE ~1.5 uplift); state-specific value applied at compute time.",
    },
    costFactorAudPerUnit: 220,
  },
  {
    id: "elec_other",
    bucket: "stationary_electricity",
    label: "Grid electricity — other / mixed",
    numerical: {
      name: "Annual electricity use",
      unit: "MWh",
      hint: "e.g. 1,200 MWh for a mid-size office",
    },
    factor: {
      value: 0.62,
      unitOut: "tCO2e",
      source: "AEMO",
      year: 2024,
      notes: "National-average grid intensity; state-specific value applied at compute time.",
    },
    costFactorAudPerUnit: 220,
  },
  {
    id: "elec_onsite_solar_offset",
    bucket: "stationary_electricity",
    label: "On-site solar PV (avoided grid)",
    numerical: {
      name: "Annual solar generation",
      unit: "MWh",
      hint: "name-plate kW × ~1,600 h ≈ MWh/y",
    },
    factor: {
      value: -0.66,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Negative entry; NSW-equivalent displaced grid factor.",
    },
    costFactorAudPerUnit: -180,
  },

  // ─── 2. Stationary fuel use ────────────────────────────────────────────────
  {
    id: "fuel_gas_heating",
    bucket: "stationary_fuel",
    label: "Natural gas — space & water heating",
    numerical: {
      name: "Annual gas use",
      unit: "GJ",
      hint: "e.g. 8,000 GJ for a 5,000 m² office",
    },
    factor: {
      value: 0.0561,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Combustion 51.4 + ~4.7 kgCO2e/GJ fugitive uplift.",
    },
    costFactorAudPerUnit: 15,
  },
  {
    id: "fuel_gas_process",
    bucket: "stationary_fuel",
    label: "Natural gas — process heat (boilers, kilns)",
    numerical: {
      name: "Annual gas use",
      unit: "GJ",
      hint: "e.g. 50,000 GJ for a mid-size factory",
    },
    factor: {
      value: 0.0561,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Same factor as heating; intensity is fuel-driven.",
    },
    costFactorAudPerUnit: 14,
  },
  {
    id: "fuel_lpg",
    bucket: "stationary_fuel",
    label: "LPG — heating or process",
    numerical: {
      name: "Annual LPG use",
      unit: "kL",
      hint: "e.g. 25 kL for a regional kitchen",
    },
    factor: {
      value: 1.58,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "60.2 kgCO2e/GJ × 26.2 GJ/kL.",
    },
    costFactorAudPerUnit: 1100,
  },
  {
    id: "fuel_diesel_stationary",
    bucket: "stationary_fuel",
    label: "Diesel — stationary generators",
    numerical: {
      name: "Annual diesel use",
      unit: "kL",
      hint: "e.g. 60 kL for off-grid mine backup",
    },
    factor: {
      value: 2.71,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "70.2 kgCO2e/GJ × 38.6 GJ/kL.",
    },
    costFactorAudPerUnit: 1850,
  },
  {
    id: "fuel_heating_oil",
    bucket: "stationary_fuel",
    label: "Heating oil / industrial fuel oil",
    numerical: {
      name: "Annual oil use",
      unit: "kL",
      hint: "e.g. 20 kL for a process boiler",
    },
    factor: {
      value: 2.78,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Slightly higher CI than diesel.",
    },
    costFactorAudPerUnit: 1700,
  },
  {
    id: "fuel_coal_thermal",
    bucket: "stationary_fuel",
    label: "Black coal — process / steam raising",
    numerical: {
      name: "Annual coal use",
      unit: "t",
      hint: "e.g. 5,000 t for a small industrial boiler",
    },
    factor: {
      value: 2.42,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "90.2 kgCO2e/GJ × 26.7 GJ/t.",
    },
    costFactorAudPerUnit: 220,
  },
  {
    id: "fuel_coal_brown",
    bucket: "stationary_fuel",
    label: "Brown coal (lignite) — process",
    numerical: {
      name: "Annual coal use",
      unit: "t",
      hint: "Victorian mine-mouth feedstock",
    },
    factor: {
      value: 1.18,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "High moisture so lower per-t intensity than black coal.",
    },
    costFactorAudPerUnit: 50,
  },
  {
    id: "fuel_biomass_wood",
    bucket: "stationary_fuel",
    label: "Wood / biomass — boilers",
    numerical: {
      name: "Annual fuel use",
      unit: "t",
      hint: "Biogenic; reported zero Scope 1",
    },
    factor: {
      value: 0.0,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Combustion CO2 biogenic; minor non-CO2 omitted.",
    },
    costFactorAudPerUnit: 200,
  },
  {
    id: "fuel_biogas",
    bucket: "stationary_fuel",
    label: "Biogas — on-site captured",
    numerical: {
      name: "Annual gas use",
      unit: "GJ",
      hint: "Biogenic CO2; residual CH4/N2O minor",
    },
    factor: {
      value: 0.005,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Treated as ~zero Scope 1; residual non-CO2 only.",
    },
    costFactorAudPerUnit: 10,
  },
  {
    id: "fuel_hydrogen_green",
    bucket: "stationary_fuel",
    label: "Hydrogen — green (renewables-derived)",
    numerical: {
      name: "Annual hydrogen use",
      unit: "t",
      hint: "Zero combustion CO2",
    },
    factor: {
      value: 0.0,
      unitOut: "tCO2e",
      source: "DCCEEW",
      year: 2024,
      notes: "Excludes Scope 3 from production.",
    },
    costFactorAudPerUnit: 5500,
  },

  // ─── 3. Mobility ───────────────────────────────────────────────────────────
  {
    id: "mob_car_petrol",
    bucket: "mobility",
    label: "Passenger car — petrol (ICE)",
    numerical: {
      name: "Annual fuel use",
      unit: "L",
      hint: "or estimate km × 0.10 L/km",
    },
    factor: {
      value: 0.00234,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "67.4 kgCO2e/GJ × 34.2 MJ/L.",
    },
    costFactorAudPerUnit: 2.0,
  },
  {
    id: "mob_car_diesel",
    bucket: "mobility",
    label: "Passenger car — diesel",
    numerical: {
      name: "Annual fuel use",
      unit: "L",
      hint: "or estimate km × 0.08 L/km",
    },
    factor: {
      value: 0.0027,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "70.2 × 38.6 ÷ 1000.",
    },
    costFactorAudPerUnit: 1.85,
  },
  {
    id: "mob_lcv_diesel",
    bucket: "mobility",
    label: "Light commercial vehicle — diesel (utes, vans)",
    numerical: {
      name: "Annual fuel use",
      unit: "L",
      hint: "Fleet of 10 utes ≈ 25,000 L/y",
    },
    factor: {
      value: 0.0027,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Same combustion factor as diesel car.",
    },
    costFactorAudPerUnit: 1.85,
  },
  {
    id: "mob_truck_diesel_heavy",
    bucket: "mobility",
    label: "Heavy truck / rigid — diesel",
    numerical: {
      name: "Annual fuel use",
      unit: "kL",
      hint: "Linehaul prime mover ~80–120 kL/y",
    },
    factor: {
      value: 2.71,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Per kL diesel.",
    },
    costFactorAudPerUnit: 1850,
  },
  {
    id: "mob_bus_diesel",
    bucket: "mobility",
    label: "Bus — diesel",
    numerical: {
      name: "Annual fuel use",
      unit: "kL",
      hint: "Charter / staff shuttle fleet",
    },
    factor: {
      value: 2.71,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Per kL diesel.",
    },
    costFactorAudPerUnit: 1850,
  },
  {
    id: "mob_flight_domestic_short",
    bucket: "mobility",
    label: "Domestic flight — short-haul (<1,500 km)",
    numerical: {
      name: "Short-haul flight sectors per year",
      unit: "sector",
      hint: "MEL–SYD return = 2 sectors",
    },
    factor: {
      value: 0.21,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "~0.142 kg/pkm × ~1,000 km avg + RFI uplift ~1.9×.",
    },
  },
  {
    id: "mob_flight_domestic_long",
    bucket: "mobility",
    label: "Domestic flight — long-haul (>1,500 km)",
    numerical: {
      name: "Long-haul domestic sectors per year",
      unit: "sector",
      hint: "PER–SYD return = 2 sectors",
    },
    factor: {
      value: 0.55,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "~0.12 kg/pkm × ~3,500 km + RFI uplift.",
    },
  },
  {
    id: "mob_flight_intl_short",
    bucket: "mobility",
    label: "International flight — regional (Asia-Pacific)",
    numerical: {
      name: "Regional international sectors per year",
      unit: "sector",
      hint: "SYD–SIN return = 2 sectors",
    },
    factor: {
      value: 1.1,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "Economy; premium cabins ~2-3× higher.",
    },
  },
  {
    id: "mob_flight_intl_long",
    bucket: "mobility",
    label: "International flight — long-haul (Europe/Americas)",
    numerical: {
      name: "Long-haul international sectors per year",
      unit: "sector",
      hint: "SYD–LHR return = 2 sectors",
    },
    factor: {
      value: 2.8,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "Economy class; business ~2.5×, first ~4×.",
    },
  },
  {
    id: "mob_rail_pax",
    bucket: "mobility",
    label: "Passenger rail (metro / intercity)",
    numerical: {
      name: "Passenger-km per year",
      unit: "pkm",
      hint: "Commuter rail per FTE × 220 days",
    },
    factor: {
      value: 0.00004,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "Electric, AU grid weighted.",
    },
  },
  {
    id: "mob_rail_freight_diesel",
    bucket: "mobility",
    label: "Freight rail — diesel",
    numerical: {
      name: "Tonne-km per year",
      unit: "tkm",
      hint: "Bulk haulage rule-of-thumb",
    },
    factor: {
      value: 0.000022,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Diesel-electric locomotive.",
    },
    costFactorAudPerUnit: 0.04,
  },
  {
    id: "mob_marine_bunker",
    bucket: "mobility",
    label: "Marine bunker — shipping / barges",
    numerical: {
      name: "Annual marine fuel use",
      unit: "kL",
      hint: "Heavy fuel oil or marine diesel",
    },
    factor: {
      value: 3.11,
      unitOut: "tCO2e",
      source: "IEA",
      year: 2024,
      notes: "MGO/HFO blended, Scope 1 only.",
    },
    costFactorAudPerUnit: 1300,
  },
  {
    id: "mob_ev_fleet_grid",
    bucket: "mobility",
    label: "EV fleet — grid-charged",
    numerical: {
      name: "Annual energy drawn",
      unit: "MWh",
      hint: "Fleet kWh ÷ 1,000",
    },
    factor: {
      value: 0.66,
      unitOut: "tCO2e",
      source: "AEMO",
      year: 2024,
      notes: "Uses NSW grid intensity; tailpipe zero.",
    },
    costFactorAudPerUnit: 200,
  },

  // ─── 4. Industrial processes ───────────────────────────────────────────────
  {
    id: "proc_cement_clinker",
    bucket: "industrial_process",
    label: "Cement — clinker production (calcination only)",
    numerical: {
      name: "Clinker produced",
      unit: "t",
      hint: "Excludes kiln fuel (book under stationary_fuel)",
    },
    factor: {
      value: 0.52,
      unitOut: "tCO2e",
      source: "DCCEEW",
      year: 2024,
      notes: "CaCO3 → CaO process CO2 only.",
    },
  },
  {
    id: "proc_lime",
    bucket: "industrial_process",
    label: "Lime production",
    numerical: {
      name: "Lime produced",
      unit: "t",
      hint: "Quicklime / hydrated lime",
    },
    factor: {
      value: 0.75,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "Process CO2 from calcination.",
    },
  },
  {
    id: "proc_steel_bof",
    bucket: "industrial_process",
    label: "Steel — blast furnace / BOF route",
    numerical: {
      name: "Crude steel produced",
      unit: "t",
      hint: "Integrated mill output",
    },
    factor: {
      value: 1.85,
      unitOut: "tCO2e",
      source: "IEA",
      year: 2024,
      notes: "Includes coking coal carbon as process emission.",
    },
  },
  {
    id: "proc_steel_eaf",
    bucket: "industrial_process",
    label: "Steel — electric arc furnace (scrap)",
    numerical: {
      name: "Crude steel produced",
      unit: "t",
      hint: "Scrap-fed EAF; excludes grid electricity",
    },
    factor: {
      value: 0.1,
      unitOut: "tCO2e",
      source: "IEA",
      year: 2024,
      notes: "Electrode + slag CO2 only.",
    },
  },
  {
    id: "proc_aluminium_smelt",
    bucket: "industrial_process",
    label: "Aluminium smelting — process (PFC + anode)",
    numerical: {
      name: "Aluminium produced",
      unit: "t",
      hint: "Excludes smelter electricity",
    },
    factor: {
      value: 1.65,
      unitOut: "tCO2e",
      source: "DCCEEW",
      year: 2024,
      notes: "Anode CO2 + PFC GWP-weighted.",
    },
  },
  {
    id: "proc_ammonia",
    bucket: "industrial_process",
    label: "Ammonia production (SMR feedstock)",
    numerical: {
      name: "Ammonia produced",
      unit: "t",
      hint: "Process CO2 from steam methane reforming",
    },
    factor: {
      value: 1.85,
      unitOut: "tCO2e",
      source: "IEA",
      year: 2024,
      notes: "Process emissions; excludes utility steam.",
    },
  },
  {
    id: "proc_refrigerants_hfc",
    bucket: "industrial_process",
    label: "HFC refrigerant leakage — industrial chillers",
    numerical: {
      name: "Refrigerant lost or topped-up",
      unit: "kg",
      hint: "Annual top-up of R-410A / R-134a",
    },
    factor: {
      value: 2.0,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "Blended GWP100 ~2,000 across common HFCs.",
    },
  },
  {
    id: "proc_sf6_switchgear",
    bucket: "industrial_process",
    label: "SF6 leakage — high-voltage switchgear",
    numerical: {
      name: "SF6 lost",
      unit: "kg",
      hint: "Switchgear nameplate × ~0.5%/y leak rate",
    },
    factor: {
      value: 23.5,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "GWP100 = 23,500.",
    },
  },

  // ─── 5. Agriculture & nature ───────────────────────────────────────────────
  {
    id: "ag_beef_enteric",
    bucket: "ag_nature",
    label: "Beef cattle — enteric methane",
    numerical: {
      name: "Head of cattle",
      unit: "head",
      hint: "Annual average head on-station",
    },
    factor: {
      value: 3.07,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "~110 kg CH4/head × GWP100 27.9.",
    },
  },
  {
    id: "ag_dairy_enteric",
    bucket: "ag_nature",
    label: "Dairy cattle — enteric methane",
    numerical: {
      name: "Head of dairy cattle",
      unit: "head",
      hint: "Milking herd headcount",
    },
    factor: {
      value: 3.63,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "~130 kg CH4/head × 27.9.",
    },
  },
  {
    id: "ag_sheep_enteric",
    bucket: "ag_nature",
    label: "Sheep — enteric methane",
    numerical: {
      name: "Head of sheep",
      unit: "head",
      hint: "Annual flock headcount",
    },
    factor: {
      value: 0.22,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "~8 kg CH4/head × 27.9.",
    },
  },
  {
    id: "ag_manure_mgmt",
    bucket: "ag_nature",
    label: "Manure management — CH4 + N2O",
    numerical: {
      name: "Cattle-equivalent head",
      unit: "head",
      hint: "Use cattle headcount; sheep ~0.1×",
    },
    factor: {
      value: 0.65,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Pasture + lagoon weighted AU avg.",
    },
  },
  {
    id: "ag_fertiliser_n",
    bucket: "ag_nature",
    label: "Synthetic N fertiliser application",
    numerical: {
      name: "Nitrogen applied",
      unit: "t",
      hint: "Tonnes of nitrogen, not tonnes of urea",
    },
    factor: {
      value: 4.4,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "Direct + indirect N2O, EF1 = 1%, GWP100 273.",
    },
  },
  {
    id: "ag_urea_application",
    bucket: "ag_nature",
    label: "Urea — hydrolysis CO2 + N2O",
    numerical: {
      name: "Urea applied",
      unit: "t",
      hint: "Tonnes of urea product as applied",
    },
    factor: {
      value: 2.1,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "0.20 t CO2/t urea + N2O from N content.",
    },
  },
  {
    id: "ag_rice_paddy",
    bucket: "ag_nature",
    label: "Rice — flooded paddy CH4",
    numerical: {
      name: "Area cultivated",
      unit: "ha",
      hint: "Annual harvested area",
    },
    factor: {
      value: 3.5,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "Mid-range AU irrigated rice.",
    },
  },
  {
    id: "ag_land_clearing",
    bucket: "ag_nature",
    label: "Land clearing — above-ground biomass loss",
    numerical: {
      name: "Area cleared",
      unit: "ha",
      hint: "Native vegetation to pasture/crop",
    },
    factor: {
      value: 250,
      unitOut: "tCO2e",
      source: "DCCEEW",
      year: 2024,
      notes: "One-off pulse; AU avg woodland biomass C × 44/12.",
    },
  },
  {
    id: "ag_soil_carbon_loss_crop",
    bucket: "ag_nature",
    label: "Soil carbon loss — continuous cropping",
    numerical: {
      name: "Cropped area",
      unit: "ha",
      hint: "Annual loss; decades to plateau",
    },
    factor: {
      value: 1.2,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "Mid-range; sites vary 0.5–3 tCO2/ha/y.",
    },
  },

  // ─── 6. Other ──────────────────────────────────────────────────────────────
  {
    id: "other_landfill_mixed",
    bucket: "other",
    label: "Mixed municipal waste — landfill",
    numerical: {
      name: "Waste landfilled",
      unit: "t",
      hint: "Annual tonnes to landfill",
    },
    factor: {
      value: 1.2,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "AU avg DOC, no LFG capture assumed.",
    },
  },
  {
    id: "other_landfill_organic",
    bucket: "other",
    label: "Organic / food waste — landfilled",
    numerical: {
      name: "Organic waste landfilled",
      unit: "t",
      hint: "High methane potential",
    },
    factor: {
      value: 1.9,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Higher DOCf than mixed stream.",
    },
  },
  {
    id: "other_wastewater",
    bucket: "other",
    label: "Wastewater treatment — CH4 + N2O",
    numerical: {
      name: "Population equivalent served",
      unit: "PE",
      hint: "Approx headcount, includes industrial load",
    },
    factor: {
      value: 0.1,
      unitOut: "tCO2e",
      source: "IPCC",
      year: 2024,
      notes: "AU avg aerobic + anaerobic mix.",
    },
  },
  {
    id: "other_refrigerants_buildings",
    bucket: "other",
    label: "Refrigerant leakage — buildings HVAC",
    numerical: {
      name: "Refrigerant top-up",
      unit: "kg",
      hint: "Annual gas top-up across all units",
    },
    factor: {
      value: 2.0,
      unitOut: "tCO2e",
      source: "NGER",
      year: 2024,
      notes: "Blended HFC GWP, building-stock weighted.",
    },
  },
  {
    id: "other_paper_consumption",
    bucket: "other",
    label: "Paper consumption — printed / office",
    numerical: {
      name: "Paper purchased",
      unit: "t",
      hint: "Reams × ~2.5 kg per ream",
    },
    factor: {
      value: 1.1,
      unitOut: "tCO2e",
      source: "ClimateActive",
      year: 2024,
      notes: "Scope 3 cat. 1; cradle-to-gate avg.",
    },
  },
];

/** State grid intensities (tCO2e/MWh) applied as multipliers to any
 *  stationary_electricity source. Mixed = national-average passthrough.
 *  Sources: AEMO FY24 NEM regional intensity + NGER WA SWIS.
 */
export const STATE_GRID_INTENSITY: Record<string, number> = {
  NSW: 0.66,
  VIC: 0.85,
  QLD: 0.71,
  WA: 0.51,
  SA: 0.21,
  TAS: 0.15,
  NT: 0.61,
  ACT: 0.66,
  mixed: 0.62,
};

export const SOURCE_FACTOR_BY_ID: Record<string, SourceFactor> = Object.fromEntries(
  SOURCE_FACTORS.map((f) => [f.id, f]),
);

export function factorsForBucket(bucket: string): SourceFactor[] {
  return SOURCE_FACTORS.filter((f) => f.bucket === bucket);
}
