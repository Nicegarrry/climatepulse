# ENERGY_GENERATION (1-10)

## utility-scale-solar-pv
**Core**: Large-scale solar photovoltaic farms and projects connected to the transmission or distribution grid, typically 5MW+.
**Include**: solar farm, solar park, utility-scale solar, large-scale solar, MW solar project, tracking systems, bifacial modules, solar irradiance, capacity factor, solar generation record
**Exclude**: Rooftop solar and small-scale systems → rooftop-distributed-solar. Solar panel manufacturing → solar-manufacturing. Solar thermal / CSP → tag here if no better fit.

## rooftop-distributed-solar
**Core**: Residential and commercial rooftop solar installations, community solar projects, and small-scale solar under 5MW.
**Include**: rooftop solar, residential solar, commercial solar, community solar, small-scale, solar rebate, feed-in tariff, behind-the-meter solar, STC, small-scale certificates
**Exclude**: Utility-scale solar farms → utility-scale-solar-pv. Home batteries paired with solar → home-battery-systems. Solar panel manufacturing → solar-manufacturing.

## solar-manufacturing
**Core**: Manufacturing of solar panels, cells, wafers, and related components. Includes domestic manufacturing policy and supply chain for solar equipment.
**Include**: panel manufacturing, cell manufacturing, wafer, ingot, module production, domestic solar manufacturing, solar factory, GW manufacturing capacity, panel supply chain
**Exclude**: Installation of manufactured panels → utility-scale-solar-pv or rooftop-distributed-solar. Raw materials for panels (silicon, silver) → critical-minerals domain.

## onshore-wind
**Core**: Onshore wind farm projects, onshore turbine technology, repowering of existing wind farms, and wind resource assessment for onshore sites.
**Include**: onshore wind, wind farm, wind turbine, MW wind, repowering, wind resource, capacity factor wind, wind generation record, nacelle, blade length
**Exclude**: Offshore wind → offshore-wind. Wind turbine component manufacturing/supply chain → tag here if about the turbines, critical-minerals if about raw materials.

## offshore-wind
**Core**: Offshore wind projects (fixed and floating), offshore wind policy, port infrastructure for offshore wind, and offshore-specific technology.
**Include**: offshore wind, floating wind, fixed-bottom offshore, offshore wind zone, port infrastructure for wind, Star of the South, offshore wind feasibility, offshore wind legislation
**Exclude**: Onshore wind farms → onshore-wind.

## pumped-hydro
**Core**: Pumped hydro energy storage projects and feasibility studies. Includes existing pumped hydro operations and new developments like Snowy 2.0.
**Include**: pumped hydro, Snowy 2.0, Borumba, pumped storage, upper reservoir, dam for storage, PHES
**Exclude**: Conventional run-of-river hydro → conventional-hydro. General storage discussions → check if battery-focused first.

## conventional-hydro
**Core**: Conventional hydroelectric generation from existing dams and run-of-river systems, including environmental flow management.
**Include**: hydro generation, hydroelectric, dam operations, environmental flows, Snowy Hydro generation (not 2.0 specifically), Tasmanian hydro, Hydro Tasmania
**Exclude**: Pumped hydro storage projects → pumped-hydro.

## coal-plant-retirement
**Core**: Closure and retirement of coal-fired power stations, life extension announcements, and community transition planning for coal regions.
**Include**: coal closure, coal retirement, coal plant shutdown, Eraring, Liddell, Yallourn, Bayswater, life extension, coal region transition, coal workers, early closure, accelerated closure
**Exclude**: Coal mining operations (not power generation) → industry domain. Coal generation data as part of overall grid mix → electricity-market-reform or grid-stability-inertia.

## gas-peaking-transition
**Core**: Gas-fired power generation as a transition/firming fuel, new gas peaker plants, gas supply policy for electricity, and the role of gas in the energy transition.
**Include**: gas peaker, gas firming, OCGT, CCGT, gas supply, Kurri Kurri, gas generation, gas as transition fuel, gas reservation, gas trigger, peaking plant
**Exclude**: Upstream gas production and LNG export → lng-upstream-gas in Industry domain. Gas distribution for buildings → building-electrification-heat-pumps.

## nuclear-smr
**Core**: Nuclear energy policy debate in Australia, small modular reactor technology, fusion research, and international nuclear developments relevant to Australia.
**Include**: nuclear, SMR, small modular reactor, nuclear policy, nuclear debate, AUKUS nuclear, fusion, thorium, nuclear waste, nuclear moratorium
**Exclude**: Nuclear-powered submarines (unless energy policy angle) → out of scope.


# ENERGY_STORAGE (11-17)

## lithium-ion-grid-bess
**Core**: Utility-scale lithium-ion battery energy storage systems connected at transmission or distribution level, typically 2-hour and 4-hour duration.
**Include**: BESS, grid battery, utility battery, Megapack, battery farm, MW/MWh capacity, 2-hour battery, 4-hour battery, grid-scale battery, battery commissioning, Capacity Investment Scheme battery
**Exclude**: Home batteries → home-battery-systems. Commercial behind-the-meter → commercial-industrial-storage. Batteries over 8hr → long-duration-storage. Non-lithium chemistries → sodium-ion-alt-chemistry. Pumped hydro → pumped-hydro in Generation.

## long-duration-storage
**Core**: Energy storage technologies with duration of 8 hours or more, including iron-air, compressed air, gravity storage, and other emerging long-duration solutions.
**Include**: long-duration storage, LDES, iron-air battery, compressed air energy storage, CAES, gravity storage, 8-hour, 12-hour, seasonal storage, multi-day storage, Form Energy
**Exclude**: 2-hour and 4-hour lithium-ion BESS → lithium-ion-grid-bess. Pumped hydro → pumped-hydro. Hydrogen for seasonal storage → hydrogen-energy-storage.

## sodium-ion-alt-chemistry
**Core**: Non-lithium battery chemistries for grid or distributed storage, including sodium-ion, zinc-bromine, flow batteries, solid-state, and other alternative chemistries.
**Include**: sodium-ion, Na-ion, CATL sodium, zinc-bromine, vanadium redox, flow battery, solid-state battery, alternative chemistry, non-lithium, manganese-rich
**Exclude**: Lithium-ion grid batteries → lithium-ion-grid-bess. Battery minerals → critical-minerals domain. EV battery chemistry → transport domain.

## home-battery-systems
**Core**: Residential battery storage systems, home battery rebate programs, and virtual power plants aggregating home batteries.
**Include**: home battery, residential battery, Powerwall, household battery, battery rebate, Cheaper Home Batteries, home energy storage, VPP (when aggregating home batteries)
**Exclude**: Grid-scale BESS → lithium-ion-grid-bess. Commercial/industrial batteries → commercial-industrial-storage. Rooftop solar without battery focus → rooftop-distributed-solar.

## commercial-industrial-storage
**Core**: Behind-the-meter battery storage for commercial and industrial customers, demand charge management, and C&I energy management systems.
**Include**: C&I battery, behind-the-meter storage, commercial battery, industrial battery, demand charge, peak shaving, commercial energy management, sub-5MW battery projects
**Exclude**: Home/residential batteries → home-battery-systems. Grid-scale BESS → lithium-ion-grid-bess.

## hydrogen-energy-storage
**Core**: Hydrogen used specifically as an energy storage medium — power-to-gas-to-power, hydrogen for seasonal balancing, and H2 storage infrastructure.
**Include**: power-to-gas, hydrogen storage, seasonal hydrogen, hydrogen cavern, power-to-hydrogen-to-power, H2 for grid balancing
**Exclude**: Hydrogen as transport fuel → hydrogen-road-transport. Hydrogen for industrial use → chemical-industry-transition. Green hydrogen production technology → tag here if storage is the focus, otherwise chemical-industry-transition.

## thermal-mechanical-storage
**Core**: Thermal and mechanical energy storage — molten salt, sand batteries, compressed air (if not long-duration grid-focused), and other non-electrochemical storage.
**Include**: molten salt storage, sand battery, thermal storage, ice storage, cryogenic storage, mechanical storage, flywheel
**Exclude**: Compressed air at grid-scale → long-duration-storage. Battery electrochemistry → other storage micro-sectors.


# ENERGY_GRID (18-25)

## transmission-build-upgrade
**Core**: Construction, upgrade, and planning of high-voltage transmission infrastructure, including new transmission lines, augmentation, and undersea cables.
**Include**: transmission line, HumeLink, EnergyConnect, VNI West, Marinus Link, transmission upgrade, 500kV, 330kV, transmission investment, REZ transmission, undersea cable
**Exclude**: Distribution network → distribution-network. Grid connection queue → grid-connection-pipeline.

## grid-connection-pipeline
**Core**: The queue and process for connecting new generation and storage projects to the grid, including connection studies, approvals, and bottlenecks.
**Include**: grid connection, connection queue, connection agreement, connection point, hosting capacity, AEMO connections scorecard, generator connection, marginal loss factor
**Exclude**: The transmission infrastructure itself → transmission-build-upgrade. Market rules for connection → electricity-market-reform.

## distribution-network
**Core**: Low-voltage and medium-voltage distribution networks (poles and wires), hosting capacity for DER, EV charging impact on networks, and DNSP operations.
**Include**: distribution network, DNSP, poles and wires, hosting capacity, LV network, transformer, EV impact on grid, voltage management, network tariff, smart meter
**Exclude**: High-voltage transmission → transmission-build-upgrade. DER aggregation into VPPs → virtual-power-plants.

## grid-stability-inertia
**Core**: Technical challenges of maintaining grid stability with high renewable penetration — frequency control, system strength, synchronous condensers, and inertia.
**Include**: frequency control, system strength, inertia, synchronous condenser, FCAS, grid stability, system security, rate of change of frequency, RoCoF, fault level, islanding event
**Exclude**: Market mechanisms for stability → electricity-market-reform. Demand response → demand-response-flexibility.

## demand-response-flexibility
**Core**: Demand-side management, flexible loads, time-of-use pricing, load shifting, and demand response programs.
**Include**: demand response, demand management, flexible load, load shifting, time-of-use, controlled load, interruptible load, DR aggregator, peak demand reduction
**Exclude**: VPPs (supply-side flexibility) → virtual-power-plants. Network tariff design → distribution-network.

## virtual-power-plants
**Core**: Aggregation of distributed energy resources (batteries, solar, controllable loads) into virtual power plants that participate in energy markets.
**Include**: VPP, virtual power plant, DER aggregation, battery aggregation, orchestration platform, distributed energy, fleet orchestration, Tesla VPP
**Exclude**: Individual home batteries → home-battery-systems. Grid-scale BESS → lithium-ion-grid-bess. Microgrids → microgrids-islanding.

## microgrids-islanding
**Core**: Remote and community microgrids, islanded power systems, and standalone power systems (SAPS) including hybrid renewable systems.
**Include**: microgrid, islanded system, standalone power system, SAPS, remote power, community energy, hybrid renewable system, off-grid, diesel replacement
**Exclude**: Urban VPPs → virtual-power-plants. Remote area solar farms connected to main grid → utility-scale-solar-pv.

## electricity-market-reform
**Core**: NEM market design, capacity mechanisms, pricing reform, wholesale market rules, and structural changes to how electricity markets operate.
**Include**: NEM reform, capacity mechanism, capacity investment scheme, energy-only market, wholesale market, market design, ESB, Energy Security Board, market body, AEMC rule change, spot price, dispatch
**Exclude**: Transmission infrastructure → transmission-build-upgrade. Financial PPA/contract structures → electricity-price-contract-markets in Finance domain.


# CARBON_EMISSIONS (26-35)

## eu-ets
**Core**: The European Union Emissions Trading System — allowance pricing, market dynamics, reform debates, and regulatory changes specific to the EU ETS.
**Include**: EU ETS, EUA, European carbon, EU allowance, ETS reform, ETS suspension, Market Stability Reserve, MSR, ETS directive, carbon price Europe
**Exclude**: CBAM (separate mechanism) → cbam-carbon-tariffs. Other countries' ETS → other-compliance-markets. Australian carbon pricing → australian-safeguard-mechanism.

## australian-safeguard-mechanism
**Core**: Australia's Safeguard Mechanism — facility baselines, obligation rules, Safeguard Mechanism Credits (SMCs), and policy changes.
**Include**: Safeguard Mechanism, safeguard baseline, SMC, Safeguard Mechanism Credit, safeguard facility, 215 facilities, scope 1 safeguard, safeguard reform
**Exclude**: ACCUs (offset credits) → accus-australian-offsets. EU carbon pricing → eu-ets.

## other-compliance-markets
**Core**: Emissions trading systems outside the EU and Australia — UK ETS, China ETS, California cap-and-trade, South Korea ETS, and emerging compliance markets.
**Include**: UK ETS, China ETS, California cap-and-trade, RGGI, Korea ETS, New Zealand ETS, compliance market, national ETS, carbon market (non-EU, non-Australian)
**Exclude**: EU ETS → eu-ets. Australian Safeguard → australian-safeguard-mechanism. Voluntary markets → international-offsets-vcm.

## cbam-carbon-tariffs
**Core**: The EU Carbon Border Adjustment Mechanism and other carbon border tariff mechanisms, including trade impacts and compliance requirements.
**Include**: CBAM, carbon border, carbon tariff, border adjustment, CBAM reporting, free allowance phase-out, CBAM transitional, carbon leakage, import carbon cost
**Exclude**: EU ETS internal dynamics → eu-ets. General trade policy → international-trade-climate in Policy domain.

## accus-australian-offsets
**Core**: Australian Carbon Credit Units — supply, methodology, integrity, pricing, and market dynamics for Australian domestic offsets.
**Include**: ACCU, Australian carbon credit, offset methodology, human-induced regeneration, HIR, landfill gas, savanna burning, ACCU price, offset integrity, Chubb review
**Exclude**: International voluntary credits → international-offsets-vcm. Safeguard Mechanism Credits → australian-safeguard-mechanism.

## international-offsets-vcm
**Core**: International voluntary carbon markets — Verra, Gold Standard, Article 6, CORSIA, voluntary credit pricing, and market integrity debates.
**Include**: voluntary carbon, Verra, Gold Standard, VCS, VCM, Article 6, corresponding adjustment, voluntary offset, CORSIA, ICAO, carbon credit integrity, Integrity Council
**Exclude**: Australian ACCUs → accus-australian-offsets. Compliance ETS markets → eu-ets or other-compliance-markets.

## nature-based-removal
**Core**: Nature-based carbon dioxide removal — reforestation, blue carbon (mangroves, seagrass), soil carbon sequestration projects, and natural climate solutions.
**Include**: reforestation, afforestation, blue carbon, mangrove restoration, seagrass, natural climate solutions, nature-based, biosequestration, peatland, wetland restoration
**Exclude**: Soil carbon as agricultural practice → soil-carbon-sequestration in Agriculture domain. Engineered removal → engineered-removal-dac.

## engineered-removal-dac
**Core**: Engineered carbon dioxide removal — direct air capture (DAC), biochar, enhanced weathering, ocean alkalinity enhancement, and related technologies.
**Include**: direct air capture, DAC, biochar, enhanced weathering, ocean alkalinity, engineered removal, CDR, carbon dioxide removal technology, Climeworks, Carbon Engineering, negative emissions technology
**Exclude**: CCS on industrial point sources → carbon-capture-storage. Nature-based removal → nature-based-removal.

## carbon-capture-storage
**Core**: Carbon capture and storage on industrial emission sources — capture technology, CO2 transport, geological storage, and CCS project developments.
**Include**: CCS, carbon capture, geological storage, CO2 pipeline, Gorgon CCS, carbon capture rate, flue gas, amine capture, storage site, injection well
**Exclude**: Direct air capture → engineered-removal-dac.

## emissions-measurement-mrv
**Core**: Monitoring, reporting, and verification of greenhouse gas emissions — measurement technology, satellite detection, emissions factors, and reporting frameworks.
**Include**: MRV, emissions monitoring, satellite methane, emissions factor, emissions reporting, greenhouse gas inventory, NGER (as reporting), scope 1/2/3 measurement, methane detection
**Exclude**: ESG reporting frameworks → esg-disclosure-reporting in Finance domain. Specific sector emissions → tag the sector.


# TRANSPORT (36-43)

## passenger-ev-adoption
**Core**: Adoption of electric vehicles by consumers — sales data, model launches, consumer behaviour, total cost of ownership, and EV policy incentives.
**Include**: EV sales, electric car, BEV, PHEV, EV market share, EV uptake, Tesla Model, electric SUV, FBT exemption, EV discount, range anxiety, EV registration
**Exclude**: EV charging infrastructure → ev-charging-infrastructure. Commercial fleet EVs → commercial-fleet-electrification.

## ev-charging-infrastructure
**Core**: EV charging networks and infrastructure — fast chargers, destination charging, charging standards, and investment in charging networks.
**Include**: fast charger, DC fast charging, ultra-rapid, charging network, NRMA charging, Chargefox, OCPP, charging standard, CCS2, destination charger, charger rollout
**Exclude**: EV vehicle sales/adoption → passenger-ev-adoption. Grid impact of EV charging → distribution-network.

## commercial-fleet-electrification
**Core**: Electrification of commercial vehicle fleets — trucks, buses, vans, last-mile delivery, and fleet transition programs.
**Include**: electric truck, electric bus, e-bus, fleet electrification, last-mile EV, electric van, depot charging, fleet transition, BYD bus, Volvo electric truck
**Exclude**: Passenger EVs → passenger-ev-adoption. Hydrogen trucks → hydrogen-road-transport.

## hydrogen-road-transport
**Core**: Hydrogen fuel cell vehicles for road transport — trucks, buses, refuelling infrastructure, and fuel cell technology for transport applications.
**Include**: hydrogen truck, fuel cell vehicle, FCEV, hydrogen bus, hydrogen refuelling, H2 transport, Hyzon, Nikola, fuel cell stack
**Exclude**: Hydrogen for energy storage → hydrogen-energy-storage. Hydrogen for industrial use → chemical-industry-transition.

## aviation-decarbonisation
**Core**: Decarbonisation of aviation — sustainable aviation fuel, electric aircraft, airline climate commitments, and CORSIA compliance.
**Include**: SAF, sustainable aviation fuel, electric aircraft, aviation emissions, airline net zero, CORSIA, flight emissions, aviation biofuel, e-SAF, power-to-liquid aviation
**Exclude**: CORSIA as a carbon market mechanism → international-offsets-vcm (if the focus is the offset market, not aviation).

## maritime-decarbonisation
**Core**: Decarbonisation of shipping — green shipping corridors, alternative marine fuels (ammonia, methanol), IMO regulations, and port decarbonisation.
**Include**: green shipping, shipping emissions, IMO, ammonia fuel shipping, methanol fuel, green corridor, port electrification, shore power, maritime decarbonisation
**Exclude**: Port infrastructure for offshore wind → offshore-wind.

## rail-electrification
**Core**: Electrification and decarbonisation of rail — diesel-to-electric conversion, battery trains, hydrogen rail, and rail infrastructure electrification.
**Include**: rail electrification, battery train, hydrogen train, electric locomotive, diesel rail replacement, catenary, rail decarbonisation
**Exclude**: General transport infrastructure → tag the most relevant transport micro-sector.

## sustainable-alternative-fuels
**Core**: Production and deployment of sustainable and alternative fuels — SAF production, e-fuels, biofuels, renewable diesel, and drop-in fuel replacements.
**Include**: biofuel, renewable diesel, e-fuel, synthetic fuel, power-to-liquid, HVO, drop-in fuel, fuel feedstock, biorefinery, cellulosic ethanol
**Exclude**: SAF specifically for aviation → aviation-decarbonisation. Hydrogen as fuel → hydrogen-road-transport or hydrogen-energy-storage.


# INDUSTRY (44-52)

## green-steel-dri
**Core**: Decarbonisation of steel production — direct reduced iron using hydrogen, electric arc furnaces replacing blast furnaces, and green steel initiatives.
**Include**: green steel, DRI, direct reduced iron, hydrogen steelmaking, EAF, electric arc furnace, blast furnace replacement, steel decarbonisation, HYBRIT, H2 Green Steel
**Exclude**: Steel industry financial results → finance domain. Steel tariffs → policy domain.

## cement-concrete-decarbonisation
**Core**: Decarbonisation of cement and concrete — clinker alternatives, supplementary cementitious materials, carbon-cured concrete, and CCUS in cement.
**Include**: cement decarbonisation, clinker, supplementary cementitious, geopolymer, carbon-cured concrete, cement kiln, calcination, low-carbon concrete, concrete emissions
**Exclude**: Embodied carbon in buildings (broader) → embodied-carbon-construction.

## aluminium-decarbonisation
**Core**: Decarbonisation of aluminium smelting — inert anode technology, renewable-powered smelters, and aluminium recycling.
**Include**: aluminium smelter, inert anode, Elysis, aluminium decarbonisation, smelter power, Tomago, Portland, aluminium recycling, Hall-Heroult
**Exclude**: Bauxite mining → mining-decarbonisation.

## chemical-industry-transition
**Core**: Decarbonisation of the chemical industry — electrification of process heat, green ammonia production, green methanol, and chemical feedstock transition.
**Include**: green ammonia, green methanol, electrification of heat, process heat, industrial heat pump, chemical decarbonisation, Haber-Bosch, ammonia plant, hydrogen as feedstock
**Exclude**: Ammonia as shipping fuel → maritime-decarbonisation.

## mining-decarbonisation
**Core**: Decarbonisation of mining operations — electrification of haul fleets, renewable-powered mine sites, and reduction of fugitive emissions from mining.
**Include**: mining electrification, electric haul truck, mine site solar, diesel displacement mining, autonomous electric mining, fugitive coal mine emissions, mine rehabilitation
**Exclude**: Critical minerals extraction (what is mined) → critical-minerals domain. Coal mining closures linked to power station closure → coal-plant-retirement.

## lng-upstream-gas
**Core**: LNG export operations, upstream gas production, fugitive methane from gas systems, and gas industry transition challenges.
**Include**: LNG, liquefied natural gas, upstream gas, gas production, Woodside, Santos LNG, gas basin, fugitive methane, gas pipeline, gas exploration, Browse, Scarborough, Narrabri
**Exclude**: Gas for electricity generation → gas-peaking-transition. Gas distribution for buildings → building-electrification-heat-pumps.

## data-centre-energy
**Core**: Energy consumption and sourcing for data centres, AI-driven electricity demand growth, and data centre renewable energy procurement.
**Include**: data centre, data center, AI energy demand, hyperscale, cloud energy, data centre PPA, data centre emissions, cooling energy, server farm, AI electricity
**Exclude**: AI technology itself (not energy-focused) → out of scope.

## advanced-manufacturing
**Core**: Cleantech manufacturing, reshoring of clean energy manufacturing, 3D printing for energy components, and advanced manufacturing policy.
**Include**: cleantech manufacturing, manufacturing reshoring, advanced manufacturing, 3D printing energy, additive manufacturing, domestic manufacturing policy, manufacturing investment
**Exclude**: Solar panel manufacturing specifically → solar-manufacturing.

## waste-energy-circular
**Core**: Waste-to-energy facilities, circular economy for energy equipment, panel and turbine recycling policy, and waste processing innovation.
**Include**: waste-to-energy, WtE, circular economy, panel recycling, solar recycling, turbine blade recycling, e-waste, battery end-of-life, product stewardship, landfill methane
**Exclude**: Battery mineral recycling → battery-panel-recycling in Critical Minerals domain.


# AGRICULTURE_LAND (53-61)

## ruminant-methane-reduction
**Core**: Technologies and strategies to reduce methane emissions from ruminant livestock — feed additives like Asparagopsis and 3-NOP, methane inhibitors, and livestock management practices.
**Include**: livestock methane, Asparagopsis, 3-NOP, Bovaer, methane inhibitor, enteric methane, ruminant emissions, cattle methane, sheep methane, feed additive
**Exclude**: Alternative proteins replacing livestock → alternative-proteins. Methane from other sources → emissions-measurement-mrv or lng-upstream-gas.

## alternative-proteins
**Core**: Plant-based proteins, cultivated meat, precision fermentation, and other alternatives to conventional animal agriculture.
**Include**: cultivated meat, plant-based meat, precision fermentation, alternative protein, lab-grown, cell-based meat, Impossible, Beyond Meat, mycoprotein
**Exclude**: Livestock methane reduction (keeping animals, reducing emissions) → ruminant-methane-reduction.

## regenerative-agriculture
**Core**: Regenerative farming practices — no-till, cover crops, rotational grazing, and soil health management for both productivity and carbon outcomes.
**Include**: regenerative agriculture, no-till, cover crop, rotational grazing, soil health, holistic management, pasture cropping, composting, biological farming
**Exclude**: Soil carbon credits specifically → soil-carbon-sequestration. Agricultural emissions measurement → agricultural-emissions-reduction.

## agricultural-emissions-reduction
**Core**: Reducing emissions from cropping systems — fertiliser efficiency, nitrous oxide reduction, precision agriculture, and irrigation energy.
**Include**: nitrogen fertiliser, nitrous oxide, N2O, precision agriculture, variable rate, fertiliser emissions, urea, enhanced efficiency fertiliser, irrigation emissions
**Exclude**: Soil carbon sequestration → soil-carbon-sequestration. Regenerative practices → regenerative-agriculture.

## soil-carbon-sequestration
**Core**: Soil carbon measurement, credits, and projects — including permanence issues and methodology for soil carbon as a carbon offset pathway.
**Include**: soil carbon, soil organic carbon, soil carbon credit, soil carbon methodology, soil carbon permanence, soil testing, soil sampling, SOC
**Exclude**: Regenerative practices (broader) → regenerative-agriculture. ACCUs from soil carbon → tag both this and accus-australian-offsets.

## forestry-reforestation
**Core**: Plantation forestry, native revegetation, agroforestry, and tree-based carbon sequestration projects.
**Include**: reforestation, afforestation, plantation, native revegetation, agroforestry, tree planting, forestry carbon, timber plantation, blue gum, mallee
**Exclude**: Blue carbon (mangroves, seagrass) → nature-based-removal in Carbon domain. Deforestation/clearing → deforestation-land-clearing.

## deforestation-land-clearing
**Core**: Land clearing policy, deforestation drivers, habitat protection, koala habitat, and vegetation management frameworks.
**Include**: land clearing, deforestation, vegetation management, koala habitat, habitat clearing, EPBC biodiversity, offset conditions, remnant vegetation, protected areas
**Exclude**: Forestry/planting → forestry-reforestation. Biodiversity as adaptation → biodiversity-ecosystems in Workforce/Adaptation domain.

## agricultural-water
**Core**: Water management in agriculture — irrigation efficiency, Murray-Darling Basin management, water markets, and climate adaptation for water-dependent agriculture.
**Include**: Murray-Darling, irrigation, water allocation, water market, water buyback, drought, water efficiency, managed aquifer recharge, water scarcity agriculture
**Exclude**: Hydroelectric generation → conventional-hydro.

## food-waste-supply-chain
**Core**: Food system emissions — cold chain, food loss and waste reduction, packaging, and circular food system initiatives.
**Include**: food waste, food loss, cold chain, food miles, packaging, circular food, food recovery, organic waste, anaerobic digestion food
**Exclude**: Waste-to-energy from food waste → waste-energy-circular in Industry domain.


# BUILT_ENVIRONMENT (62-68)

## building-energy-efficiency
**Core**: Energy efficiency in buildings — retrofits, insulation, passive design, NatHERS ratings, and energy performance standards.
**Include**: building efficiency, retrofit, insulation, NatHERS, energy rating, passive design, double glazing, draught sealing, energy audit, minimum energy performance
**Exclude**: Electrification of buildings → building-electrification-heat-pumps. Green building certification → green-building-standards.

## building-electrification-heat-pumps
**Core**: Electrification of buildings — replacing gas with electric alternatives, heat pump adoption, induction cooking, hot water heat pumps, and gas phase-out policy.
**Include**: heat pump, induction, gas phase-out, electrification, gas-to-electric, hot water heat pump, reverse cycle, gas ban, gas substitution roadmap, all-electric
**Exclude**: Building efficiency (insulation, passive) → building-energy-efficiency. Rooftop solar on buildings → rooftop-distributed-solar.

## embodied-carbon-construction
**Core**: Embodied carbon in building materials and construction — lifecycle assessment, mass timber, low-carbon concrete, and material selection for lower embodied emissions.
**Include**: embodied carbon, lifecycle assessment, mass timber, CLT, low-carbon materials, whole-of-life carbon, construction emissions, material passport, EPD, environmental product declaration
**Exclude**: Cement industry decarbonisation → cement-concrete-decarbonisation. Building operational energy → building-energy-efficiency.

## green-building-standards
**Core**: Green building certification and standards — NABERS, Green Star, WELL, net-zero building standards, and building rating schemes.
**Include**: NABERS, Green Star, WELL, LEED, net-zero building, green building certification, building rating, sustainability rating, passive house, carbon neutral building
**Exclude**: NatHERS energy ratings → building-energy-efficiency. Embodied carbon standards → embodied-carbon-construction.

## sustainable-precincts
**Core**: Sustainable urban precincts, integrated energy systems, smart city energy, and precinct-scale sustainability planning.
**Include**: sustainable precinct, smart city, integrated energy, precinct development, net-zero precinct, district energy, urban sustainability, Barangaroo, Fishermans Bend
**Exclude**: Individual building projects → other Built Environment micro-sectors. Microgrid in a precinct → microgrids-islanding.

## cooling-urban-heat
**Core**: Urban heat island effect, cooling infrastructure, district cooling systems, and climate-resilient building design for heat.
**Include**: urban heat island, cooling, district cooling, heat stress, cool roofs, green infrastructure, tree canopy, heatwave building design, passive cooling
**Exclude**: Residential air conditioning efficiency → building-energy-efficiency. Extreme weather events → extreme-weather-events in Adaptation domain.

## heritage-climate-adaptation
**Core**: Adapting existing heritage building stock to climate challenges, heritage constraints on energy upgrades, and heritage building resilience.
**Include**: heritage building, heritage constraint, heritage adaptation, historic building energy, heritage retrofit, heritage overlay
**Exclude**: General building efficiency → building-energy-efficiency.


# CRITICAL_MINERALS (69-76)

## lithium-extraction-processing
**Core**: Lithium mining, extraction (hard rock and brine), direct lithium extraction (DLE), and domestic lithium refining.
**Include**: lithium, spodumene, lithium hydroxide, lithium carbonate, DLE, direct lithium extraction, brine, hard rock lithium, lithium refinery, Pilbara Minerals, Albemarle, IGO
**Exclude**: Lithium-ion battery deployment → lithium-ion-grid-bess. Lithium price as financial metric → tag here and finance domain.

## rare-earth-elements
**Core**: Rare earth element mining, processing, magnet manufacturing, and dependence on Chinese processing.
**Include**: rare earth, REE, neodymium, dysprosium, permanent magnet, magnet manufacturing, Lynas, rare earth processing, Mount Weld
**Exclude**: General supply chain diversification (broader) → supply-chain-diversification.

## battery-minerals-co-ni
**Core**: Battery minerals other than lithium — cobalt, nickel, manganese, and the shift to cobalt-free and high-nickel chemistries.
**Include**: cobalt, nickel, manganese, NMC, NCA, LFP, cobalt-free, nickel laterite, nickel sulphide, ethical cobalt, battery chemistry evolution
**Exclude**: Lithium specifically → lithium-extraction-processing. Battery deployment → energy-storage domain.

## graphite-anode-materials
**Core**: Graphite mining and processing, synthetic graphite production, silicon anode development, and anode material supply chains.
**Include**: graphite, anode, synthetic graphite, natural graphite, silicon anode, anode material, graphite processing, spherical graphite
**Exclude**: Full battery cell manufacturing → advanced-manufacturing.

## copper-supply
**Core**: Copper mining and supply for electrification — demand projections, new mine development, copper recycling, and supply constraints.
**Include**: copper, copper mine, copper demand, copper deficit, electrification copper, copper recycling, copper price, copper smelter
**Exclude**: General mining → mining-decarbonisation.

## domestic-processing-refining
**Core**: Value-adding mineral processing in Australia — mid-stream refining investment, processing hub development, and policy for domestic beneficiation.
**Include**: domestic processing, refining, mid-stream, value-adding, minerals processing, refinery investment, critical minerals facility, cathode, precursor
**Exclude**: Extraction/mining → specific mineral micro-sectors. Manufacturing of finished products → advanced-manufacturing.

## supply-chain-diversification
**Core**: Diversification of clean energy supply chains away from concentrated sources (primarily China), friend-shoring, trade restrictions, and alternative supplier development.
**Include**: friend-shoring, supply chain, diversification, China dependence, trade restrictions, tariffs, alternative suppliers, supply chain resilience, IRA supply chain, reshoring
**Exclude**: Domestic processing specifically → domestic-processing-refining. Trade policy broadly → international-trade-climate in Policy domain.

## battery-panel-recycling
**Core**: End-of-life processing for batteries and solar panels — recycling technology, product stewardship schemes, and urban mining.
**Include**: battery recycling, panel recycling, solar recycling, end-of-life, product stewardship, urban mining, cell recycling, material recovery, second-life battery
**Exclude**: Circular economy broadly → waste-energy-circular in Industry domain.


# FINANCE_INVESTMENT (77-85)

## renewable-project-finance
**Core**: Debt and equity financing for renewable energy projects — project finance structures, CIS tender outcomes, tax equity, and development capital.
**Include**: project finance, debt facility, equity raise, CIS tender, capacity investment scheme funding, financial close, FID, bankability, project IRR, construction finance
**Exclude**: Green bonds (capital markets) → green-bonds-sustainable-debt. Asset transactions → ma-asset-transactions.

## infrastructure-funds-investors
**Core**: Institutional capital flows into clean energy — infrastructure funds, sovereign wealth funds, pension funds, and their investment strategies.
**Include**: infrastructure fund, sovereign wealth, pension fund, institutional investor, AustralianSuper, IFM, Macquarie, asset allocation, infrastructure investment, yield
**Exclude**: Project-level finance → renewable-project-finance. M&A transactions → ma-asset-transactions.

## green-bonds-sustainable-debt
**Core**: Green bonds, sustainability-linked loans, transition bonds, and capital markets instruments for climate finance.
**Include**: green bond, sustainability-linked loan, transition bond, climate bond, ESG bond, green debt, certified climate bond, use of proceeds, KPI-linked
**Exclude**: Project debt (not capital markets) → renewable-project-finance.

## carbon-credit-investment
**Core**: Carbon credits as a financial asset class — forward purchasing, fund strategies, speculation, and carbon credit market dynamics.
**Include**: carbon credit investment, carbon fund, forward purchase, carbon speculation, carbon as asset class, carbon portfolio, carbon trading strategy
**Exclude**: Carbon credit integrity/methodology → accus-australian-offsets or international-offsets-vcm. ETS price movements → eu-ets.

## esg-disclosure-reporting
**Core**: ESG and sustainability disclosure frameworks — ISSB, TCFD, TNFD, Australian ASRS, mandatory climate reporting, and sustainability reporting standards.
**Include**: ESG disclosure, ISSB, TCFD, TNFD, ASRS, mandatory reporting, climate disclosure, sustainability report, annual report ESG, IFRS sustainability, double materiality
**Exclude**: Greenwashing enforcement → greenwashing-integrity. Emissions measurement → emissions-measurement-mrv.

## greenwashing-integrity
**Core**: Greenwashing enforcement actions, claims substantiation, and regulatory scrutiny of environmental and climate claims.
**Include**: greenwashing, ACCC, green claims, misleading environmental, claims substantiation, green marketing, ESG washing, net-zero claim, green label, advertising standards
**Exclude**: ESG reporting frameworks → esg-disclosure-reporting. Carbon credit integrity → accus-australian-offsets or international-offsets-vcm.

## climate-risk-insurance
**Core**: Climate-related financial risk — physical risk assessment, transition risk, stranded assets, insurance sector retreat, and financial stability implications.
**Include**: climate risk, physical risk, transition risk, stranded asset, insurance retreat, uninsurable, climate stress test, APRA climate, financial stability, asset writedown
**Exclude**: ESG disclosure of risks → esg-disclosure-reporting.

## ma-asset-transactions
**Core**: Mergers, acquisitions, and asset transactions in the energy transition — project sales, corporate acquisitions, portfolio trades, and stake sales.
**Include**: acquisition, M&A, asset sale, project sale, stake sale, portfolio transaction, takeover, divestment, farm-down, buyer, vendor
**Exclude**: Financial close on new projects → renewable-project-finance. Institutional fund allocation → infrastructure-funds-investors.

## electricity-price-contract-markets
**Core**: Electricity pricing trends, PPA structures, wholesale price movements, contract market evolution, and new offtake models.
**Include**: PPA, power purchase agreement, wholesale price, electricity price, contract market, offtake, stepped pricing, hybrid PPA, run-of-meter, electricity futures, spot price trend
**Exclude**: NEM market design/rules → electricity-market-reform. Project finance (PPA as part of financing) → renewable-project-finance.


# POLICY_GOVERNANCE (86-95)

## australian-federal-energy-policy
**Core**: Australian federal government energy policy — national targets, energy legislation, ministerial direction on energy, and national energy frameworks.
**Include**: federal energy policy, national energy target, energy minister, energy legislation, Powering Australia, national energy plan, energy white paper, CIS policy
**Exclude**: Climate-specific (not energy) → australian-federal-climate-policy. State-level → state-rez-planning or state-climate-net-zero.

## australian-federal-climate-policy
**Core**: Australian federal government climate policy — NDC, emissions reduction targets, Climate Change Authority, emissions budgets, and climate legislation.
**Include**: NDC, nationally determined contribution, emissions target, Climate Change Authority, climate legislation, climate policy, emissions budget, net zero 2050, climate act
**Exclude**: Energy policy → australian-federal-energy-policy. Safeguard Mechanism → australian-safeguard-mechanism.

## state-rez-planning
**Core**: State-level Renewable Energy Zone planning and delivery — REZ declarations, planning frameworks, state transmission, and REZ governance.
**Include**: REZ, renewable energy zone, Central-West Orana, Hunter, New England, Gippsland, state planning, VicGrid, REZ roadmap, EnergyCo
**Exclude**: Federal CIS (national scheme) → australian-federal-energy-policy. Transmission infrastructure → transmission-build-upgrade.

## state-climate-net-zero
**Core**: State and territory climate and energy targets, state-level EV policy, state building standards, and state net-zero strategies.
**Include**: state target, state net zero, state EV policy, state renewable target, Victoria climate, NSW climate, Queensland target, state climate act
**Exclude**: Federal policy → australian-federal-energy-policy or australian-federal-climate-policy.

## international-climate-agreements
**Core**: International climate agreements and negotiations — Paris Agreement, COP outcomes, NDCs, global stocktake, and multilateral climate frameworks.
**Include**: Paris Agreement, COP, UNFCCC, global stocktake, NDC, climate negotiation, 1.5 degrees, climate summit, multilateral
**Exclude**: Bilateral agreements → international-trade-climate. CORSIA → international-offsets-vcm.

## international-trade-climate
**Core**: Trade agreements with climate provisions, bilateral clean energy partnerships, trade restrictions related to climate, and climate diplomacy.
**Include**: bilateral partnership, trade agreement climate, clean energy partnership, friend-shoring, trade diplomacy climate, climate cooperation, energy MoU
**Exclude**: CBAM specifically → cbam-carbon-tariffs. Paris Agreement → international-climate-agreements.

## environmental-approvals-permitting
**Core**: Environmental impact assessment, EPBC Act reform, bilateral approvals, environmental offsets, and permitting reform for energy projects.
**Include**: EPBC, environmental approval, environmental impact, bilateral approval, offset condition, federal environment, Environment Protection Act, EPA approval, streamlining, Investor Front Door
**Exclude**: Community engagement → community-engagement-social-licence. Indigenous heritage → indigenous-engagement-land.

## community-engagement-social-licence
**Core**: Community engagement processes, social licence for energy projects, benefit-sharing arrangements, community opposition, and consultation requirements.
**Include**: community engagement, social licence, community benefit, benefit sharing, community opposition, NIMBY, community fund, community consultation, community information centre, host community
**Exclude**: Indigenous-specific engagement → indigenous-engagement-land. Environmental approvals → environmental-approvals-permitting.

## indigenous-engagement-land
**Core**: Indigenous engagement in energy projects — Traditional Owner agreements, cultural heritage protection, Indigenous equity participation, and First Nations energy sovereignty.
**Include**: Indigenous, Traditional Owner, First Nations, Aboriginal, cultural heritage, Indigenous equity, native title, land use agreement, ILUA, Indigenous energy, Wamabl Bila
**Exclude**: General community engagement → community-engagement-social-licence.

## corporate-climate-governance
**Core**: Corporate governance obligations related to climate — directors' duties, climate litigation risk, shareholder activism, and board-level climate oversight.
**Include**: directors' duties, climate litigation, shareholder activism, climate resolution, board obligation, fiduciary duty climate, climate governance, proxy season climate
**Exclude**: ESG reporting → esg-disclosure-reporting. Greenwashing → greenwashing-integrity.


# WORKFORCE_ADAPTATION (96-103)

## energy-workforce-skills-gap
**Core**: Skills shortages in the energy sector — trade worker deficits, engineer pipeline, apprenticeship numbers, and workforce projections.
**Include**: workforce shortage, skills gap, energy workers, trade shortage, apprenticeship, engineer shortage, energy jobs, workforce projection, 42000 worker shortfall
**Exclude**: Just transition / reskilling → reskilling-just-transition.

## reskilling-just-transition
**Core**: Transition support for workers and communities affected by fossil fuel phase-out — coal region transition, retraining programs, and community economic development.
**Include**: just transition, reskilling, coal worker transition, regional transition, community transition, transition authority, Latrobe Valley, Hunter transition, retraining
**Exclude**: Active workforce shortages → energy-workforce-skills-gap. Community engagement on new projects → community-engagement-social-licence.

## climate-science-modelling
**Core**: Climate science research, CSIRO and BOM climate programs, IPCC findings, climate projections, and earth system science relevant to policy.
**Include**: CSIRO, BOM, IPCC, climate projection, climate model, climate science, temperature record, sea level, Antarctic ice, carbon budget, attribution science
**Exclude**: Weather events → extreme-weather-events. Climate adaptation responses → physical-climate-adaptation.

## physical-climate-adaptation
**Core**: Adapting physical infrastructure and systems to climate impacts — resilience planning, coastal protection, flood defence, heat planning, and infrastructure hardening.
**Include**: adaptation, resilience, coastal protection, sea wall, flood defence, infrastructure hardening, climate resilient, adaptation plan, heat action plan, disaster resilience
**Exclude**: Extreme weather events (the events themselves) → extreme-weather-events. Building-level adaptation → building-energy-efficiency or cooling-urban-heat.

## biodiversity-ecosystems
**Core**: Intersection of energy transition and biodiversity — species impact of energy projects, habitat corridors, renewable-nature coexistence, and ecological offsets.
**Include**: biodiversity, species impact, habitat corridor, wildlife, renewable nature, bird strike, koala, threatened species, ecological offset, fauna crossing, environmental offset
**Exclude**: Deforestation/land clearing → deforestation-land-clearing. Marine ecosystems and blue carbon → nature-based-removal.

## extreme-weather-events
**Core**: Extreme weather events as they relate to energy and climate systems — bushfires, floods, heatwaves, drought, cyclones, and their impact on energy infrastructure or climate policy.
**Include**: bushfire, flood, heatwave, cyclone, drought, extreme weather, weather event, climate event, storm damage, infrastructure damage, grid outage weather
**Exclude**: Climate science and projections → climate-science-modelling. Adaptation responses → physical-climate-adaptation.

## climate-health
**Core**: Health impacts of climate change — heat-related illness, air quality from bushfire smoke, vector-borne disease expansion, and health system preparedness.
**Include**: climate health, heat illness, air quality, bushfire smoke, vector-borne, health impact climate, heat death, climate anxiety, public health climate
**Exclude**: Urban heat management → cooling-urban-heat. Extreme weather events → extreme-weather-events.

## cleantech-research-innovation
**Core**: Publicly funded cleantech R&D — CSIRO energy programs, university research, ARENA-funded research and development, and emerging technology demonstrations.
**Include**: CSIRO energy, ARENA funding, research grant, demonstration project, pilot plant, innovation fund, university research, R&D, technology readiness, commercialisation
**Exclude**: Specific technology deployments → tag the relevant technology micro-sector. Policy about R&D funding → australian-federal-energy-policy.


# CROSS_CUTTING_TAGS (104-108)

These are supplementary tags applied in addition to domain-specific micro-sectors.

## geopolitics-trade-wars
**Core**: US-China tensions, tariffs, sanctions, and geopolitical dynamics affecting climate and energy.
**Include**: US-China, tariff, sanction, trade war, geopolitical, strategic competition, friend-shoring geopolitics, energy security, AUKUS energy
**Exclude**: Specific bilateral partnerships → international-trade-climate. Supply chain diversification as industry response → supply-chain-diversification.

## ai-digitalisation-energy
**Core**: AI and digital technologies applied to energy systems — grid management AI, digital twins, predictive maintenance, and smart energy systems.
**Include**: AI grid, digital twin, predictive maintenance, smart grid, machine learning energy, AI optimisation, energy AI, smart energy
**Exclude**: Data centre energy consumption → data-centre-energy.

## gender-equity-transition
**Core**: Gender and equity dimensions of the energy transition — workforce diversity, energy poverty, access and affordability, and equity in transition planning.
**Include**: gender, diversity, energy equity, energy poverty, energy affordability, vulnerable households, social equity, women in energy, First Nations equity
**Exclude**: Indigenous engagement specifically → indigenous-engagement-land.

## first-nations-energy-sovereignty
**Core**: Indigenous-led energy projects, First Nations equity ownership in energy infrastructure, and energy sovereignty for Indigenous communities.
**Include**: Indigenous energy, First Nations energy, Indigenous-led, Aboriginal energy, community-owned Indigenous, energy sovereignty, Traditional Owner energy
**Exclude**: Indigenous heritage/land rights in approvals → indigenous-engagement-land.

## disinformation-public-debate
**Core**: Climate and energy misinformation, parliamentary inquiries into disinformation, media narratives, and public discourse on the energy transition.
**Include**: misinformation, disinformation, climate denial, media narrative, parliamentary inquiry disinformation, public debate, social media climate, anti-renewable
**Exclude**: Greenwashing (corporate claims) → greenwashing-integrity.
