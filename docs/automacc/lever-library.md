# AutoMACC v4 — Lever Library

Curated reference for the sanity-check pill on Screen 2. Each entry below corresponds 1:1
to a `LeverRef` in `src/lib/automacc/levers.ts`. Numbers are AUD 2024.

**Primary sources**: `sidekick/qubit/products/automacc/lever-db-v2.md` (52-lever consolidated DB,
2026-05-08); CSIRO GenCost 2024; NGER 2025; ARENA technology roadmaps; in-repo `lever-db.ts` v3.

**Method**: Where source figures are USD/EUR, an Australian uplift of +15–30% has been
applied for labour/supply-chain. Where lever-db-v2 quoted an industry-wide capex range,
we have re-anchored the low/mid/high to the *most natural per-unit basis* a student would
reason about (e.g. AUD/kW installed for energy systems, AUD/vehicle for fleet).

`opexDeltaPctOfCapex` is the annual opex change expressed as % of capex
(negative = annual saving). `abatementEfficiencyPct` is the share of the source's
tCO2/y that the lever removes when fully applied.

---

## 1. Stop doing (3 levers)

### stop_eliminate_business_travel
- **Applies to**: `mob_flight_domestic_short`, `mob_flight_intl_longhaul`
- **Typical capex**: AUD per FTE — low $200, mid $1,000, high $3,000 (video conferencing kit, training)
- **Opex Δ %capex/yr**: -150% (large annual saving — avoided tickets and accommodation)
- **Abatement**: 60% (realistic — some travel persists)
- **Lifetime**: 5 yrs (policy/refresh horizon)
- **Evidence**: ClimateActive. AU corporate travel programmes that mandated video-first policies during 2020–2022 maintained 40–70% reductions on 2019 baseline.

### stop_divest_fossil_assets
- **Applies to**: `fuel_coal_thermal`, `proc_steel_bfbof`
- **Typical capex**: AUD per t CO2/yr of avoided emissions — low $0, mid $20, high $80 (transaction + write-down accounting; no asset replacement)
- **Opex Δ %capex/yr**: -10% (avoided maintenance and carbon liability)
- **Abatement**: 95% (near-total when the asset is retired)
- **Lifetime**: 20 yrs (avoided emission horizon)
- **Evidence**: DCCEEW. Used as a corporate framing lever — emissions counted from the boundary date.

### stop_retire_ice_fleet_early
- **Applies to**: `mob_fleet_light_ice`, `mob_fleet_heavy_diesel`
- **Typical capex**: AUD per vehicle written off — low $5,000, mid $15,000, high $40,000 (residual value lost vs natural EOL)
- **Opex Δ %capex/yr**: -25% (insurance, registration, maintenance avoided)
- **Abatement**: 100% of remaining lifecycle scope-1 of retired vehicle
- **Lifetime**: 8 yrs (avg remaining ICE life at early retirement)
- **Evidence**: NGER. Pull-forward of vehicle retirement is a "stop" rather than "electrify" lever when the replacement is mode-shift, not EV.

---

## 2. Do more efficiently (10 levers)

### eff_led_retrofit
- **Applies to**: `elec_grid_nsw`, `elec_grid_vic`, `elec_grid_qld`, `elec_grid_sa`, `elec_grid_wa_swis`, `elec_grid_tas`
- **Typical capex**: AUD per m² NLA — low $15, mid $30, high $60 (LED only → LED + smart controls)
- **Opex Δ %capex/yr**: -25% (60–75% lighting electricity saving)
- **Abatement**: 12% of facility electricity (lighting share)
- **Lifetime**: 10 yrs
- **Evidence**: Other. Sustainability Victoria LED Lighting Guide 2024; lever-db-v2 BLT-003.

### eff_hvac_vsd_upgrade
- **Applies to**: `elec_grid_nsw`, `elec_grid_vic`, `elec_grid_qld`, `elec_grid_sa`, `elec_grid_wa_swis`
- **Typical capex**: AUD per kW cooling — low $400, mid $800, high $1,400 (VSD retrofit → full VRF)
- **Opex Δ %capex/yr**: -18%
- **Abatement**: 25% of facility electricity (HVAC share)
- **Lifetime**: 15 yrs
- **Evidence**: Other. AIRAH HVAC Efficiency Guide 2024; BLT-001.

### eff_building_envelope
- **Applies to**: `fuel_gas_heating`, `elec_grid_nsw`, `elec_grid_vic`
- **Typical capex**: AUD per m² floor area — low $40, mid $120, high $300 (draught seal + film → full insulation + double glazing)
- **Opex Δ %capex/yr**: -8%
- **Abatement**: 22% (HVAC load reduction 15–30%)
- **Lifetime**: 30 yrs
- **Evidence**: Other. NatHERS Technical Note 2024; BLT-004.

### eff_bms_ai_controls
- **Applies to**: `elec_grid_nsw`, `elec_grid_vic`, `elec_grid_qld`, `fuel_gas_heating`
- **Typical capex**: AUD per m² NLA — low $5, mid $15, high $40
- **Opex Δ %capex/yr**: -30% (BMS tuning is typically <2 year payback)
- **Abatement**: 15%
- **Lifetime**: 10 yrs
- **Evidence**: Other. NABERS Energy Opportunity Guide 2024; BLT-007.

### eff_nabers_uplift
- **Applies to**: `elec_grid_nsw`, `elec_grid_vic`, `elec_grid_qld`
- **Typical capex**: AUD per m² NLA — low $4, mid $30, high $80
- **Opex Δ %capex/yr**: -22%
- **Abatement**: 30% (1–2 star uplift on typical office)
- **Lifetime**: 12 yrs
- **Evidence**: Other. NABERS National Rating System 2024; BLT-010.

### eff_motor_vfd_industrial
- **Applies to**: `proc_aluminium_electrolysis`, `proc_steel_bfbof`, `proc_cement_clinker`, `proc_mining_ventilation`
- **Typical capex**: AUD per kW motor rating — low $80, mid $200, high $500
- **Opex Δ %capex/yr**: -25%
- **Abatement**: 18% of process electricity (pump/fan share)
- **Lifetime**: 15 yrs
- **Evidence**: IEA. ARENA Industrial Energy Efficiency 2023.

### eff_eco_driving_telematics
- **Applies to**: `mob_fleet_light_ice`, `mob_fleet_heavy_diesel`
- **Typical capex**: AUD per vehicle — low $500, mid $1,200, high $2,500
- **Opex Δ %capex/yr**: -60% (6–10% fuel saving, fast payback)
- **Abatement**: 8%
- **Lifetime**: 6 yrs (hardware refresh)
- **Evidence**: Other. Teletrac Navman AU Fleet ROI Study 2024; TRP-010.

### eff_logistics_route_optimisation
- **Applies to**: `mob_fleet_heavy_diesel`, `mob_fleet_light_ice`
- **Typical capex**: AUD per vehicle — low $400, mid $1,000, high $2,000 (SaaS-only zero-capex also common)
- **Opex Δ %capex/yr**: -80% (AI route planning + load consolidation)
- **Abatement**: 12%
- **Lifetime**: 6 yrs
- **Evidence**: Other. Geotab Fleet Efficiency Benchmark 2024; TRP-007.

### eff_mine_ventilation_vod
- **Applies to**: `proc_mining_ventilation`, `proc_mining_diesel_haul`
- **Typical capex**: AUD per mine — low $2,000,000, mid $10,000,000, high $30,000,000
- **Opex Δ %capex/yr**: -30% (electricity savings exceed amortisation — VOD typically cost-negative)
- **Abatement**: 35% of ventilation electricity
- **Lifetime**: 18 yrs
- **Evidence**: Other. MRIWA VOD 2021; OZ Minerals Prominent Hill 2022; IND-012.

### eff_process_heat_recovery
- **Applies to**: `fuel_gas_process_heat`, `proc_cement_clinker`, `proc_steel_bfbof`
- **Typical capex**: AUD per kW thermal recovered — low $300, mid $700, high $1,500
- **Opex Δ %capex/yr**: -15%
- **Abatement**: 12% of process fuel
- **Lifetime**: 20 yrs
- **Evidence**: IEA. ARENA Industrial Process Heat Roadmap 2024.

---

## 3. Electrify (10 levers)

### electrify_heat_pump_space
- **Applies to**: `fuel_gas_heating`
- **Typical capex**: AUD per kW thermal — low $700, mid $1,100, high $1,800 (includes switchboard upgrade)
- **Opex Δ %capex/yr**: -8% (gas avoided; some grid electricity added)
- **Abatement**: 80% (COP 3.0 on NSW grid 0.64 kgCO2/kWh)
- **Lifetime**: 15 yrs
- **Evidence**: ARENA Buildings Electrification Technology Review 2023; BLT-002.

### electrify_heat_pump_water
- **Applies to**: `fuel_gas_heating`, `elec_grid_nsw`, `elec_grid_vic`
- **Typical capex**: AUD per kW thermal — low $900, mid $1,400, high $2,200
- **Opex Δ %capex/yr**: -10%
- **Abatement**: 75%
- **Lifetime**: 12 yrs
- **Evidence**: DCCEEW. CER hot water heat pump methodology; in-repo v3 lever-db.

### electrify_induction_cooking
- **Applies to**: `fuel_gas_heating`
- **Typical capex**: AUD per kW thermal — low $400, mid $800, high $1,400 (commercial kitchen)
- **Opex Δ %capex/yr**: -5%
- **Abatement**: 70%
- **Lifetime**: 10 yrs
- **Evidence**: Other. CEFC Commercial Kitchen Electrification 2023.

### electrify_ev_fleet_light
- **Applies to**: `mob_fleet_light_ice`
- **Typical capex**: AUD per vehicle (premium over ICE) — low $15,000, mid $25,000, high $40,000 (+ $4,000 charger)
- **Opex Δ %capex/yr**: -12% (fuel + maintenance saving)
- **Abatement**: 85% (residual scope 2 ~15% on 2026 NEM)
- **Lifetime**: 12 yrs
- **Evidence**: NGER. EV Council AU State of EVs 2024; TRP-001.

### electrify_ev_fleet_heavy
- **Applies to**: `mob_fleet_heavy_diesel`
- **Typical capex**: AUD per vehicle (premium) — low $150,000, mid $350,000, high $500,000 (rigid → articulated BEV)
- **Opex Δ %capex/yr**: -10% (diesel avoided, electricity offsets partly)
- **Abatement**: 85%
- **Lifetime**: 12 yrs
- **Evidence**: NGER. NHVR Zero Emission Truck Trials 2024; TRP-002.

### electrify_forklift_warehouse
- **Applies to**: `mob_fleet_forklift_lpg`, `fuel_lpg_forklift`
- **Typical capex**: AUD per unit (premium over LPG) — low $5,000, mid $15,000, high $25,000
- **Opex Δ %capex/yr**: -20% (LPG and maintenance saving — common ROI <3 yrs)
- **Abatement**: 90%
- **Lifetime**: 10 yrs
- **Evidence**: NGER. Toyota Material Handling AU Electric Forklift TCO 2024; TRP-008.

### electrify_haul_truck_mining
- **Applies to**: `proc_mining_diesel_haul`
- **Typical capex**: AUD per truck (premium + share of charging infra) — low $700,000, mid $1,500,000, high $2,500,000
- **Opex Δ %capex/yr**: -8% (diesel saving large; capex very high so % is modest)
- **Abatement**: 80% (assumes renewable PPA for charging)
- **Lifetime**: 20 yrs
- **Evidence**: Other. MRIWA Electrification of Mine Vehicles 2023; IND-011.

### electrify_process_heat_lowtemp
- **Applies to**: `fuel_gas_process_heat`
- **Typical capex**: AUD per kW thermal — low $600, mid $1,200, high $2,200
- **Opex Δ %capex/yr**: -3% (electricity slightly more expensive per GJ than gas at 2024 prices)
- **Abatement**: 75% (sub-400°C electric process heat, NEM grid)
- **Lifetime**: 18 yrs
- **Evidence**: ARENA Renewable Energy for Industrial Processes 2024.

### electrify_electric_arc_furnace_steel
- **Applies to**: `proc_steel_bfbof`
- **Typical capex**: AUD per t/yr steel capacity — low $400, mid $800, high $1,500 (existing EAF optimisation → new EAF)
- **Opex Δ %capex/yr**: +2% (scrap + electricity cost; net depends on PPA)
- **Abatement**: 75% (EAF on renewable PPA vs BF-BOF)
- **Lifetime**: 30 yrs
- **Evidence**: Other. BlueScope ClimateAction Report 2023; IND-004.

### electrify_rail_freight
- **Applies to**: `mob_rail_freight_diesel`
- **Typical capex**: AUD per km corridor — low $3,000,000, mid $5,000,000, high $8,000,000 (full corridor electrification; loco EMS retrofit far cheaper at ~$100k/loco)
- **Opex Δ %capex/yr**: -4%
- **Abatement**: 90% (full electrification on renewable PPA)
- **Lifetime**: 35 yrs
- **Evidence**: IEA. Aurizon Decarbonisation Roadmap 2024; TRP-006.

---

## 4. Fuel switch (5 levers)

### fuel_switch_hvo_renewable_diesel
- **Applies to**: `mob_fleet_heavy_diesel`, `fuel_diesel_stationary`, `mob_rail_freight_diesel`
- **Typical capex**: AUD per vehicle — low $0, mid $500, high $2,000 (drop-in; minor tankage/warranty)
- **Opex Δ %capex/yr**: +40% (HVO premium $0.30–0.60/L on diesel — recurring cost)
- **Abatement**: 80% (lifecycle 70–90% vs fossil diesel)
- **Lifetime**: 10 yrs (procurement contract horizon)
- **Evidence**: Other. Neste MY Renewable Diesel 2024; BITRE Biofuels in Australia 2023; TRP-003.

### fuel_switch_green_hydrogen_process
- **Applies to**: `fuel_gas_process_heat`, `proc_ammonia_smr`, `proc_steel_bfbof`
- **Typical capex**: AUD per kW H2 produced (electrolyser) — low $2,000, mid $3,500, high $6,000
- **Opex Δ %capex/yr**: +20% (green H2 $4–8/kg in 2024)
- **Abatement**: 90%
- **Lifetime**: 20 yrs
- **Evidence**: ARENA HySupply 2022.

### fuel_switch_biomethane
- **Applies to**: `fuel_gas_heating`, `fuel_gas_process_heat`
- **Typical capex**: AUD per GJ/yr capacity — low $200, mid $600, high $1,500 (on-site AD; ~zero if pipeline RNG)
- **Opex Δ %capex/yr**: +15% (biomethane premium $8–15/GJ over fossil gas)
- **Abatement**: 80% (lifecycle 60–100%)
- **Lifetime**: 20 yrs
- **Evidence**: ARENA Bioenergy Strategy 2024; TRP-004.

### fuel_switch_biomass_boiler
- **Applies to**: `fuel_gas_process_heat`, `fuel_coal_thermal`
- **Typical capex**: AUD per kW thermal — low $400, mid $800, high $1,400
- **Opex Δ %capex/yr**: -2% (biomass cheaper per GJ than gas in many AU regions if local supply)
- **Abatement**: 85%
- **Lifetime**: 20 yrs
- **Evidence**: Other. ARENA Bioenergy Roadmap 2024.

### fuel_switch_saf_aviation
- **Applies to**: `mob_flight_domestic_short`, `mob_flight_intl_longhaul`
- **Typical capex**: AUD per t fuel/yr — low $200, mid $500, high $1,200 (procurement infrastructure; no aircraft mod)
- **Opex Δ %capex/yr**: +200% (SAF 2–4× jet fuel price — dominant cost is fuel premium)
- **Abatement**: 75% (lifecycle 60–80%)
- **Lifetime**: 10 yrs
- **Evidence**: Other. CEFC Sustainable Aviation Fuels 2024.

---

## 5. Carbon capture (3 levers)

### ccs_post_combust_cement
- **Applies to**: `proc_cement_clinker`
- **Typical capex**: AUD per t CO2/yr capture capacity — low $400, mid $800, high $1,500
- **Opex Δ %capex/yr**: +12% ($80–140/tCO2 operating cost is the dominant burden)
- **Abatement**: 90% (post-combustion amine capture rate)
- **Lifetime**: 25 yrs
- **Evidence**: IEA. IEA CCUS in Clean Energy Transitions 2020; Heidelberg Brevik (Norway); IND-003.

### ccs_gas_fired_power
- **Applies to**: `elec_grid_nsw`, `elec_grid_vic`, `elec_grid_qld`, `fuel_gas_process_heat`
- **Typical capex**: AUD per kW gas capacity — low $1,500, mid $2,500, high $4,000 (capture island only)
- **Opex Δ %capex/yr**: +10% (energy penalty 15–25%)
- **Abatement**: 85%
- **Lifetime**: 25 yrs
- **Evidence**: IEA. Global CCS Institute Project Database 2024.

### ccs_methane_oxidation_vam
- **Applies to**: `fug_coal_methane`, `proc_mining_ventilation`
- **Typical capex**: AUD per shaft (full VAM oxidiser) — low $20,000,000, mid $40,000,000, high $80,000,000
- **Opex Δ %capex/yr**: +5%
- **Abatement**: 80% of ventilation air methane (TRL 7 — reliability issues)
- **Lifetime**: 20 yrs
- **Evidence**: DCCEEW. CER ERF Coal Mine Waste Gas Method 2022; IND-014.

---

## 6. Negative emissions (4 levers)

### neg_afforestation
- **Applies to**: `ag_soil_cropland`, `other_landfill_mixed`, `ag_beef_enteric`
- **Typical capex**: AUD per t CO2 lifecycle credit — low $25, mid $40, high $80 (ACCU project — planting + 25 yr permanence cost)
- **Opex Δ %capex/yr**: +5% (monitoring + permanence insurance)
- **Abatement**: 100% (the credit is the abatement; applied as offset)
- **Lifetime**: 25 yrs (ACCU permanence horizon)
- **Evidence**: DCCEEW. ACCU spot ~A$36/t (Dec 2025 CER QCMR); CER Reforestation methodology.

### neg_soil_carbon
- **Applies to**: `ag_soil_cropland`, `ag_beef_enteric`
- **Typical capex**: AUD per t CO2 — low $30, mid $60, high $120
- **Opex Δ %capex/yr**: +8% (baseline sampling, MRV, 25-yr permanence obligation, reversal risk)
- **Abatement**: 100% (per credited tonne; +/-20-30% measurement uncertainty)
- **Lifetime**: 25 yrs
- **Evidence**: DCCEEW. CER Soil Carbon Measurement Methodology; AGR-003.

### neg_biochar
- **Applies to**: `ag_soil_cropland`, `other_organics_food`
- **Typical capex**: AUD per t CO2 — low $80, mid $150, high $300
- **Opex Δ %capex/yr**: +3% (feedstock + pyrolysis energy)
- **Abatement**: 100% (per credited tonne; permanence 100+ yrs)
- **Lifetime**: 50 yrs (carbon retention horizon)
- **Evidence**: Other. CSIRO Biochar Research 2023; in-repo v3 lever-db.

### neg_savanna_burning
- **Applies to**: `ag_savanna_burn`
- **Typical capex**: AUD per t CO2 — low $5, mid $15, high $30 (operations cost-negative for ranger-led)
- **Opex Δ %capex/yr**: +10%
- **Abatement**: 100% (per credited tonne)
- **Lifetime**: 15 yrs (project crediting period)
- **Evidence**: DCCEEW. CER Savanna Fire Management methodology; AGR-004.

---

## Levers intentionally dropped from lever-db-v2

For a 3-hour bootcamp targeting AU corporate students choosing a top-level approach, the following
were deferred:

- **IND-005 H-DRI**, **IND-008 inert anode**, **IND-010 electrified steam crackers**,
  **IND-015 ESF**, **IND-016 MOE** — TRL ≤5–7, majors-only strategic horizon, not a sanity-check use case.
- **IND-009 green ammonia** — covered indirectly via `fuel_switch_green_hydrogen_process`.
- **PWR-001..PWR-008** generation/storage — students reason about *demand-side* levers; on-site
  PV is captured via efficiency framing only when self-consumed (not added as a separate lever
  to avoid double-counting with grid factor changes).
- **BLT-006 BTM battery**, **BLT-008 embodied carbon**, **BLT-009 green leases** — one-time or
  enabler levers, not abatement-per-source for sanity-check pill.
- **TRP-005 modal-shift rail**, **TRP-009 last-mile cargo bike** — covered by
  `electrify_ev_fleet_heavy` and `electrify_rail_freight`.
- **AGR-001 livestock feed additives**, **AGR-002 fertiliser NUE** — these are operational
  efficiency levers on agriculture and would expand the source-factor table beyond bootcamp scope;
  reserved for v5.
- **WST-001..WST-004 waste-sector levers** — addressable via `neg_biochar` for organics, and the
  remaining methane-capture levers fold into `ccs_methane_oxidation_vam`.
