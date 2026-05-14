# AutoMACC v4 — Curated Emission Source Factor Table

Source-of-truth for the Screen 1 baseline arithmetic. Each row gives:

- **ID** — stable slug, referenced from `SOURCE_FACTORS` in `src/lib/automacc/factors.ts`.
- **Label** — student-facing name.
- **Numerical input** — the single number we ask the student for (or that Gemini Call 1 fills in), with unit + UI hint.
- **Factor** — tCO2e per 1 unit of the numerical. Multiplied directly.
- **Source / year / notes** — anchored on AU-authoritative references (NGER 2024, AEMO FY24, DCCEEW, IPCC AR6, IEA, Climate Active).

All factors are calibrated for **Australian context** unless noted. They are designed for **order-of-magnitude defensibility** in a teaching setting — not 4-significant-figure compliance accuracy.

Where a `costFactorAudPerUnit` is shown it is the **avoided AUD per unit** used by Screen 2 lifetime-savings logic (retail/landed AU prices, FY24/25).

---

## 1. Stationary electricity

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes | AUD / unit |
|---|---|---|---|---|---|
| `elec_grid_nsw` | Grid electricity — NSW (Scope 2) | Annual electricity use · MWh · "e.g. 1,200 MWh for a mid-size office" | 0.66 | AEMO/DCCEEW · 2024 · NEM NSW1 residual mix | 200 |
| `elec_grid_vic` | Grid electricity — VIC (Scope 2) | Annual electricity use · MWh · "e.g. 1,200 MWh for a mid-size office" | 0.85 | AEMO/DCCEEW · 2024 · Brown-coal heavy mix | 200 |
| `elec_grid_qld` | Grid electricity — QLD (Scope 2) | Annual electricity use · MWh · "e.g. 1,200 MWh for a mid-size office" | 0.71 | AEMO/DCCEEW · 2024 · Black-coal dominant | 200 |
| `elec_grid_wa` | Grid electricity — WA (Scope 2) | Annual electricity use · MWh · "e.g. 1,200 MWh for a mid-size office" | 0.51 | NGER · 2024 · SWIS grid factor | 220 |
| `elec_grid_sa` | Grid electricity — SA (Scope 2) | Annual electricity use · MWh · "e.g. 800 MWh for a mid-size office" | 0.21 | AEMO/DCCEEW · 2024 · High renewable penetration | 220 |
| `elec_grid_tas` | Grid electricity — TAS (Scope 2) | Annual electricity use · MWh · "e.g. 500 MWh for a small site" | 0.15 | AEMO/DCCEEW · 2024 · Hydro dominant | 200 |
| `elec_onsite_solar_offset` | On-site solar PV (avoided grid) | Annual generation · MWh · "name-plate kW × ~1,600 h ≈ MWh/y" | -0.66 | NGER · 2024 · Negative entry; uses NSW-equivalent displaced factor | -180 |
| `elec_datacentre_it` | Data-centre IT load (colocated) | Annual IT load energy · MWh · "rack-kW × 8,760 h ÷ 1,000" | 0.75 | NGER · 2024 · Includes PUE 1.5 uplift over national average grid | 220 |

---

## 2. Stationary fuel use

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes | AUD / unit |
|---|---|---|---|---|---|
| `fuel_gas_heating` | Natural gas — space & water heating | Annual gas use · GJ · "e.g. 8,000 GJ for a 5,000 m² office" | 0.0561 | NGER Sch.1 · 2024 · Combustion 51.4 + fugitive ~4.7 kgCO2e/GJ | 15 |
| `fuel_gas_process` | Natural gas — process heat (boilers, kilns) | Annual gas use · GJ · "e.g. 50,000 GJ for a mid-size factory" | 0.0561 | NGER Sch.1 · 2024 · Same as heating; emissions intensity is fuel-driven | 14 |
| `fuel_lpg` | LPG — heating or process | Annual LPG use · kL · "e.g. 25 kL for a regional kitchen" | 1.58 | NGER Sch.1 · 2024 · 60.2 kgCO2e/GJ × 26.2 GJ/kL | 1100 |
| `fuel_diesel_stationary` | Diesel — stationary generators | Annual diesel use · kL · "e.g. 60 kL for off-grid mine site backup" | 2.71 | NGER Sch.1 · 2024 · 70.2 kgCO2e/GJ × 38.6 GJ/kL | 1850 |
| `fuel_heating_oil` | Heating oil / industrial fuel oil | Annual oil use · kL · "e.g. 20 kL for a process boiler" | 2.78 | NGER Sch.1 · 2024 · Slightly higher CI than diesel | 1700 |
| `fuel_coal_thermal` | Black coal — process / steam raising | Annual coal use · t · "e.g. 5,000 t for a small industrial boiler" | 2.42 | NGER Sch.1 · 2024 · 90.2 kgCO2e/GJ × 26.7 GJ/t | 220 |
| `fuel_coal_brown` | Brown coal (lignite) — process | Annual coal use · t · "Victoria mine-mouth feedstock" | 1.18 | NGER Sch.1 · 2024 · High moisture so lower per-t intensity | 50 |
| `fuel_biomass_wood` | Wood / biomass — boilers | Annual fuel use · t · "Considered biogenic; reported as zero Scope 1" | 0.00 | NGER Sch.1 · 2024 · Combustion CO2 biogenic; small non-CO2 ignored | 200 |
| `fuel_biogas` | Biogas — on-site captured | Annual gas use · GJ · "Biogenic CO2 only; CH4/N2O minor" | 0.005 | NGER Sch.1 · 2024 · Treated as ~zero Scope 1; residual non-CO2 | 10 |
| `fuel_hydrogen_green` | Hydrogen — green (renewables-derived) | Annual hydrogen use · t · "Zero combustion CO2; upstream excluded" | 0.00 | DCCEEW · 2024 · Excludes Scope 3 from production | 5500 |

---

## 3. Mobility

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes | AUD / unit |
|---|---|---|---|---|---|
| `mob_car_petrol` | Passenger car — petrol (ICE) | Annual fuel use · L · "or estimate km × 0.10 L/km" | 0.00234 | NGER Sch.1 · 2024 · 67.4 kgCO2e/GJ × 34.2 MJ/L | 2.00 |
| `mob_car_diesel` | Passenger car — diesel | Annual fuel use · L · "or estimate km × 0.08 L/km" | 0.00270 | NGER Sch.1 · 2024 · 70.2 × 38.6 ÷ 1000 | 1.85 |
| `mob_lcv_diesel` | Light commercial vehicle — diesel (utes, vans) | Annual fuel use · L · "Fleet of 10 utes ≈ 25,000 L/y" | 0.00270 | NGER Sch.1 · 2024 · Same combustion factor as diesel car | 1.85 |
| `mob_truck_diesel_heavy` | Heavy truck / rigid — diesel | Annual fuel use · kL · "Linehaul prime mover ~80–120 kL/y" | 2.71 | NGER Sch.1 · 2024 · Per kL diesel | 1850 |
| `mob_bus_diesel` | Bus — diesel | Annual fuel use · kL · "Charter / staff shuttle fleet" | 2.71 | NGER Sch.1 · 2024 · Per kL diesel | 1850 |
| `mob_flight_domestic_short` | Domestic flight — short-haul (<1,500 km) | Sectors flown per year · sector · "MEL–SYD return = 2 sectors" | 0.21 | Climate Active / NGER · 2024 · ~0.142 kg/pkm × ~1,000 km avg + RFI uplift | 350 |
| `mob_flight_domestic_long` | Domestic flight — long-haul (>1,500 km) | Sectors flown per year · sector · "PER–SYD return = 2 sectors" | 0.55 | Climate Active / NGER · 2024 · ~0.12 kg/pkm × ~3,500 km + RFI uplift | 700 |
| `mob_flight_intl_short` | International flight — regional (Asia-Pacific) | Sectors flown per year · sector · "SYD–SIN return = 2 sectors" | 1.10 | Climate Active · 2024 · ~0.11 kg/pkm × ~7,000 km + RFI uplift | 1500 |
| `mob_flight_intl_long` | International flight — long-haul (Europe/Americas) | Sectors flown per year · sector · "SYD–LHR return = 2 sectors" | 2.80 | Climate Active · 2024 · Economy; premium cabins ~2-3× higher | 3500 |
| `mob_rail_pax` | Passenger rail (metro / intercity) | Passenger-km per year · pkm · "Commuter rail per FTE × 220 days" | 0.00004 | NGER / Climate Active · 2024 · Electric, AU grid weighted | 0.10 |
| `mob_rail_freight_diesel` | Freight rail — diesel | Tonne-km per year · tkm · "Bulk haulage rule-of-thumb" | 0.000022 | NGER Sch.1 · 2024 · Diesel-electric locomotive | 0.04 |
| `mob_marine_bunker` | Marine bunker — shipping / barges | Annual fuel use · kL · "Heavy fuel oil or marine diesel" | 3.11 | IEA / NGER · 2024 · MGO/HFO blended, scope 1 only | 1300 |
| `mob_ev_fleet_grid` | EV fleet — grid-charged | Annual energy drawn · MWh · "Fleet kWh ÷ 1,000" | 0.66 | AEMO · 2024 · Uses NSW grid intensity; tailpipe zero | 200 |

---

## 4. Industrial processes

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes |
|---|---|---|---|---|
| `proc_cement_clinker` | Cement — clinker production (calcination only) | Clinker produced · t · "Excludes kiln fuel; that's stationary_fuel" | 0.52 | DCCEEW / IPCC AR6 · 2024 · CaCO3 → CaO process CO2 only |
| `proc_lime` | Lime production | Lime produced · t · "Quicklime / hydrated lime" | 0.75 | IPCC AR6 / DCCEEW · 2024 · Process CO2 from calcination |
| `proc_steel_bof` | Steel — blast furnace / BOF route | Crude steel produced · t · "Integrated mill output" | 1.85 | IEA / DCCEEW · 2024 · Includes coking coal carbon as process |
| `proc_steel_eaf` | Steel — electric arc furnace (scrap) | Crude steel produced · t · "Scrap-fed EAF; excludes grid electricity" | 0.10 | IEA · 2024 · Electrode + slag CO2 only; electricity booked under elec_grid_* |
| `proc_aluminium_smelt` | Aluminium smelting — process emissions (PFC + anode) | Aluminium produced · t · "Excludes smelter electricity" | 1.65 | IPCC AR6 / DCCEEW · 2024 · Anode CO2 + PFC GWP-weighted |
| `proc_ammonia` | Ammonia production (SMR feedstock) | Ammonia produced · t · "Process CO2 from steam methane reforming" | 1.85 | IEA · 2024 · Process emissions; excludes utility steam |
| `proc_refrigerants_hfc` | HFC refrigerant leakage — industrial / large chillers | Refrigerant lost or topped-up · kg · "Annual top-up of R-410A/R-134a" | 2.00 | IPCC AR6 / NGER · 2024 · Blended GWP100 ~2,000 across common HFCs |
| `proc_sf6_switchgear` | SF6 leakage — high-voltage switchgear | SF6 lost · kg · "Switchgear nameplate × ~0.5%/y leak rate" | 23.50 | IPCC AR6 · 2024 · GWP100 = 23,500 |

---

## 5. Agriculture & nature

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes |
|---|---|---|---|---|
| `ag_beef_enteric` | Beef cattle — enteric methane | Head of cattle · head · "Annual average head on-station" | 3.07 | IPCC AR6 / DCCEEW NIR · 2024 · ~110 kg CH4/head × GWP100 27.9 |
| `ag_dairy_enteric` | Dairy cattle — enteric methane | Head of dairy cattle · head · "Milking herd headcount" | 3.63 | IPCC AR6 / DCCEEW NIR · 2024 · ~130 kg CH4/head × 27.9 |
| `ag_sheep_enteric` | Sheep — enteric methane | Head of sheep · head · "Annual flock headcount" | 0.22 | IPCC AR6 / DCCEEW NIR · 2024 · ~8 kg CH4/head × 27.9 |
| `ag_manure_mgmt` | Manure management — CH4 + N2O | Head equivalent (cattle-equiv.) · head · "Use cattle headcount; sheep ~0.1×" | 0.65 | IPCC AR6 / NGER · 2024 · Pasture + lagoon weighted AU avg |
| `ag_fertiliser_n` | Synthetic N fertiliser application | N applied · t · "Tonnes of nitrogen, not tonnes of urea" | 4.40 | IPCC AR6 · 2024 · Direct + indirect N2O, EF1 = 1%, GWP100 273 |
| `ag_urea_application` | Urea — hydrolysis CO2 + N2O | Urea applied · t · "Tonnes of urea product as applied" | 2.10 | IPCC AR6 / NGER · 2024 · 0.20 t CO2/t urea + N2O from N content |
| `ag_rice_paddy` | Rice — flooded paddy CH4 | Area cultivated · ha · "Annual harvested area" | 3.50 | IPCC AR6 · 2024 · Mid-range AU irrigated rice |
| `ag_land_clearing` | Land clearing — above-ground biomass loss | Area cleared · ha · "Native vegetation to pasture/crop" | 250 | DCCEEW NIR · 2024 · One-off pulse; AU avg woodland biomass C × 44/12 |
| `ag_soil_carbon_loss_crop` | Soil carbon loss — continuous cropping | Area · ha · "Annual loss while cultivated, decades to plateau" | 1.20 | IPCC AR6 / DCCEEW · 2024 · Mid-range; sites vary 0.5–3 tCO2/ha/y |

---

## 6. Other

| ID | Label | Numerical (name · unit · hint) | Factor (tCO2e / unit) | Source · Year · Notes |
|---|---|---|---|---|
| `other_landfill_mixed` | Mixed municipal waste — landfill | Waste landfilled · t · "Annual tonnes to landfill" | 1.20 | NGER Sch.3 · 2024 · AU avg DOC, no LFG capture |
| `other_landfill_organic` | Organic / food waste — landfilled | Organic waste landfilled · t · "High methane potential" | 1.90 | NGER Sch.3 · 2024 · Higher DOCf than mixed stream |
| `other_wastewater` | Wastewater treatment — CH4 + N2O | Population equivalent · PE · "Approx headcount served, includes industrial" | 0.10 | IPCC AR6 / NGER · 2024 · AU avg aerobic + anaerobic mix |
| `other_refrigerants_buildings` | Refrigerant leakage — buildings HVAC | Refrigerant top-up · kg · "Annual gas top-up across all units" | 2.00 | IPCC AR6 / NGER · 2024 · Blended HFC GWP, building-stock weighted |
| `other_paper_consumption` | Paper consumption — printed / office | Paper purchased · t · "Reams × ~2.5 kg per ream" | 1.10 | DCCEEW / Climate Active · 2024 · Scope 3 cat. 1; cradle-to-gate avg |

---

## Notes on simplifications

- **Aviation RFI uplift**: factors are economy class and include a contrail/RFI multiplier of ~1.9 (consistent with Climate Active 2024). Premium cabins, freight bellyhold and short turn-arounds are not separately broken out — students round to economy-equivalent sectors.
- **Grid electricity** is residual-mix Scope 2 by NEM region for the most recent published full year (FY24). On-site PV is entered as a negative `elec_onsite_solar_offset` rather than as a behind-the-meter modifier on the grid line — this keeps the arithmetic transparent for the class.
- **Process emissions** intentionally exclude the fuel used to drive the process (kiln gas, smelter electricity). Students enter those under stationary_fuel / stationary_electricity to mirror corporate inventory practice.
- **CH4 GWP100 = 27.9** and **N2O GWP100 = 273** are AR6 values. NGER 2024 still references AR5 GWPs in the Determination — for teaching we use AR6 for consistency with IPCC narrative; this introduces ≲5% drift versus NGER-compliant inventories.
- **Hydrogen / biogas / biomass** are treated as zero Scope 1 (biogenic or non-combustion). This is deliberately optimistic to let the class see what fuel-switch levers do on the chart.
- **Land clearing** is recorded as the year-one pulse (above-ground biomass × 44/12). For ongoing soil respiration use `ag_soil_carbon_loss_crop`.

---

## Citations (full publication titles)

1. **NGER** — *National Greenhouse and Energy Reporting (Measurement) Determination 2008* (as amended July 2024). DCCEEW. Schedules 1 (energy combustion), 3 (waste). https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-and-energy-reporting-scheme
2. **AEMO/DCCEEW** — *National Greenhouse Accounts Factors, August 2024* — state-by-state Scope 2 electricity emission factors derived from AEMO ISP-aligned generation mix (FY24 NEM data, SWIS published separately).
3. **DCCEEW NIR** — *Australia's National Inventory Report 2022*, submitted 2024 under UNFCCC. Used for land use, agriculture, industrial process defaults.
4. **IPCC AR6 WG3** — *Climate Change 2022: Mitigation of Climate Change. Contribution of Working Group III to the Sixth Assessment Report of the IPCC.* Cambridge University Press. AR6 GWP100 values: CH4 = 27.9 (fossil) / 27.0 (biogenic — we use the fossil value as a conservative blend); N2O = 273; SF6 = 23,500.
5. **IEA** — *Energy Technology Perspectives 2024* (chemicals, iron & steel chapters) and *Aviation Tracking Report 2024*.
6. **Climate Active** — *Climate Active Carbon Neutral Standard — Emission Factor Database*, 2024 edition. DCCEEW. Used for flight, paper, business-travel factors.
