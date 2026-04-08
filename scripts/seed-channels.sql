-- =============================================================================
-- Seed Transmission Channels (v2) — 50 expert-authored causal relationships
-- Replaces original 27 channels with higher-quality, micro-sector-informed set
-- =============================================================================
-- Domain IDs:
--  1=Energy-Generation, 2=Energy-Storage, 3=Energy-Grid, 4=Carbon&Emissions,
--  5=Transport, 6=Industry, 7=Agriculture, 8=Built Environment,
--  9=Critical Minerals, 10=Finance, 11=Policy, 12=Workforce&Adaptation

DELETE FROM transmission_channels;

INSERT INTO transmission_channels (source_domain_id, target_domain_id, label, description, mechanism, strength) VALUES

-- TC-01
(4, 4, 'EU Carbon Price → Australian Carbon Credibility',
  'EU ETS price movements set global carbon price expectations, influencing credibility of Australian safeguard mechanism and ACCU markets.',
  'EU ETS price shift → global carbon price benchmark recalibration → Australian Safeguard Mechanism stringency pressure → ACCU demand/supply balance adjustment → compliance strategy revision',
  'moderate'),

-- TC-02
(4, 6, 'CBAM Implementation → Australian Export Competitiveness',
  'EU carbon border adjustment mechanism directly impacts cost competitiveness of Australian steel, aluminium, and cement exports.',
  'CBAM phase-in schedule advance → embedded emissions cost for exports → green steel/aluminium/cement price premium narrows vs carbon-intensive product → Australian industrial decarbonisation investment case strengthens',
  'strong'),

-- TC-03
(4, 4, 'ACCU Supply Dynamics → Safeguard Compliance Cost',
  'ACCU availability and nature-based offset supply determine compliance costs under the Safeguard Mechanism for mining and LNG operators.',
  'ACCU issuance rate change → offset supply/demand imbalance → spot ACCU price movement → Safeguard Mechanism compliance cost for mining and LNG emitters → abatement vs offset decision shift',
  'strong'),

-- TC-04
(4, 10, 'Voluntary Carbon Market Integrity → Corporate Offset Strategy',
  'Integrity concerns in international voluntary carbon markets and greenwashing enforcement reshape corporate ESG disclosure and governance.',
  'VCM integrity scandal or standard tightening → corporate offset retirement scrutiny → ESG disclosure restatement risk → board-level climate governance review → shift from offsets to direct abatement',
  'moderate'),

-- TC-05
(4, 6, 'CCS Performance Data → Hydrogen and Industrial Decarbonisation Credibility',
  'CCS project performance outcomes influence confidence in hydrogen and industrial decarbonisation pathways that rely on carbon capture.',
  'CCS project underperformance or cost overrun → technology credibility erosion → green hydrogen vs blue hydrogen debate shift → chemical/LNG/steel decarbonisation pathway reassessment',
  'moderate'),

-- TC-06
(4, 6, 'Emissions Measurement Technology → Fugitive Emissions Accountability',
  'Advances in emissions MRV technology (satellite, continuous monitoring) expose fugitive emissions from LNG and mining operations.',
  'MRV technology deployment → fugitive methane detection improvement → LNG/mining emissions profile revision upward → regulatory and investor pressure → operational emissions reduction investment',
  'strong'),

-- TC-07
(4, 4, 'EU ETS Reform → Global Carbon Market Architecture',
  'EU ETS structural reforms ripple through to other compliance markets and CBAM design, reshaping global carbon market architecture.',
  'EU ETS reform (e.g., MSR adjustment, scope expansion) → compliance market design precedent → other jurisdictions adopt similar mechanisms → CBAM linkage rules evolve → international carbon market convergence pressure',
  'moderate'),

-- TC-08
(4, 11, 'Carbon Removal Technology Costs → Net Zero Strategy Viability',
  'Cost trajectories for engineered and nature-based removal technologies determine whether national net zero targets are achievable.',
  'DAC/nature-based removal cost trajectory → residual emissions budget calculation → federal climate policy target feasibility review → corporate net zero commitment credibility assessment',
  'weak'),

-- TC-09
(2, 3, 'BESS Cost Curve → Coal Retirement Timeline',
  'Falling battery storage costs (lithium-ion, long-duration, sodium-ion) accelerate coal plant retirement by replacing dispatchable capacity.',
  'Battery cost decline → firming cost reduction → coal plant dispatch economics deterioration → accelerated retirement announcement → electricity market reform to manage transition',
  'strong'),

-- TC-10
(2, 9, 'Sodium-Ion Commercialisation → Lithium Market Dynamics',
  'Commercial-scale sodium-ion battery deployment reduces lithium and cobalt demand, reshaping critical mineral market dynamics.',
  'Sodium-ion cost/performance milestone → lithium demand growth forecast revision → lithium/battery mineral price pressure → mining project investment case reassessment',
  'moderate'),

-- TC-11
(2, 3, 'Home Battery Deployment → Distribution Network Transformation',
  'Residential battery and VPP aggregation transforms distribution network load profiles and market participation models.',
  'Home battery + VPP penetration increase → distribution network peak demand reduction → demand response capacity growth → electricity market reform for DER participation',
  'strong'),

-- TC-12
(1, 3, 'Offshore Wind Policy → Port and Maritime Infrastructure',
  'Offshore wind development requires major transmission, port infrastructure, and workforce investment with long lead times.',
  'Offshore wind zone declaration → transmission connection planning → port upgrade investment → workforce training pipeline activation → community engagement and social licence requirements',
  'moderate'),

-- TC-13
(9, 1, 'Solar Manufacturing Reshoring → Project Cost and Timeline',
  'Domestic solar manufacturing and supply chain diversification policies affect panel costs and project delivery timelines.',
  'Supply chain diversification policy → domestic processing investment → solar panel cost premium vs imports → project cost and timeline impact → renewable deployment rate adjustment',
  'moderate'),

-- TC-14
(2, 2, 'Pumped Hydro Delays → Alternative Storage Demand',
  'Delays in pumped hydro projects (e.g., Snowy 2.0) create urgency for alternative long-duration and grid-scale storage solutions.',
  'Pumped hydro project delay/cost overrun → long-duration storage gap → lithium-ion BESS and alternative storage demand surge → electricity market reform for storage services',
  'strong'),

-- TC-15
(1, 3, 'Coal Plant Life Extension → Grid Connection Queue',
  'Decisions to extend coal plant life reduce short-term grid stress but distort connection queue priorities and renewable investment signals.',
  'Coal life extension announcement → grid connection queue reprioritisation → renewable project commissioning delay → electricity market reform signal confusion',
  'strong'),

-- TC-16
(3, 8, 'Gas Price Volatility → Electricity Price and Electrification',
  'Gas-peaking plant costs flow through to electricity prices, accelerating building electrification and heat pump adoption.',
  'Gas price spike → gas-peaking generation cost increase → electricity price rise → building electrification economic case strengthens → heat pump adoption acceleration',
  'strong'),

-- TC-17
(3, 10, 'Grid Connection Delays → Renewable Investment Risk',
  'Prolonged grid connection and transmission queues increase project risk, raising the cost of capital for renewable investment.',
  'Grid connection queue lengthening → project commissioning delay → revenue uncertainty increase → renewable project finance risk premium rise → investment pipeline slowdown',
  'strong'),

-- TC-18
(3, 3, 'Transmission Cost Overruns → Consumer Price Pressure',
  'Transmission build cost overruns flow through to network charges, creating consumer price pressure and political backlash.',
  'Transmission project cost escalation → network tariff increase → consumer electricity price rise → political pressure on federal energy policy → community opposition to new transmission',
  'strong'),

-- TC-19
(3, 11, 'REZ Delivery Progress → State vs Federal Policy Alignment',
  'Renewable Energy Zone delivery outcomes test state-federal policy coordination and community engagement models.',
  'REZ project milestone or delay → state delivery credibility assessment → federal-state policy alignment pressure → community engagement model review',
  'moderate'),

-- TC-20
(3, 3, 'Data Centre Demand → Grid Capacity Competition',
  'Rapid data centre load growth competes with renewable projects for scarce grid connection and transmission capacity.',
  'Data centre demand surge → grid connection capacity competition → transmission upgrade prioritisation conflict → electricity market reform for load allocation',
  'strong'),

-- TC-21
(3, 10, 'Market Design Reform → Investment Signal Quality',
  'Electricity market design changes (capacity mechanisms, CfDs) reshape investment signals for renewable project finance.',
  'Market reform announcement → revenue certainty change for generators → renewable project finance terms adjustment → investment pipeline acceleration or pause',
  'moderate'),

-- TC-22
(2, 3, 'DER Penetration → Market Rule Adequacy',
  'High penetration of distributed energy resources (VPPs, home batteries, rooftop solar) challenges existing market rules.',
  'DER fleet growth → minimum demand events → market rule inadequacy for two-way flows → distribution network operational stress → market reform urgency',
  'strong'),

-- TC-23
(3, 3, 'Interconnector Performance → Regional Price Divergence',
  'Interconnector capacity and reliability directly determine regional electricity price spreads across NEM regions.',
  'Interconnector outage or constraint → regional price divergence → arbitrage opportunity shift → generator dispatch pattern change → consumer cost impact',
  'strong'),

-- TC-24
(11, 10, 'Federal Election Cycle → Policy Stability Risk',
  'Election cycles create policy uncertainty that directly impacts renewable project finance and infrastructure fund allocation.',
  'Election campaign → energy/climate policy uncertainty → renewable project finance hesitation → infrastructure fund allocation pause → pipeline velocity reduction',
  'moderate'),

-- TC-25
(11, 1, 'Environmental Approval Reform → Project Pipeline Velocity',
  'Changes to environmental approval processes directly accelerate or constrain renewable generation project delivery.',
  'Approval process reform → assessment timeline change → utility-scale solar and wind project pipeline velocity shift → deployment target achievement impact',
  'strong'),

-- TC-26
(11, 1, 'Community Opposition → Approval Timeline and Cost',
  'Community engagement failures and social licence challenges delay onshore wind and solar project approvals.',
  'Community opposition escalation → planning approval delay → project cost increase → developer risk reassessment → deployment location shift',
  'strong'),

-- TC-27
(11, 1, 'Indigenous Engagement Models → Project Precedent',
  'Quality of Indigenous engagement and land access agreements sets precedent for future renewable project development.',
  'Indigenous engagement outcome → land access agreement model → project approval precedent → future onshore wind/solar development approach → industry-wide practice change',
  'moderate'),

-- TC-28
(11, 11, 'International Climate Agreements → Domestic Policy Ratchet',
  'International climate commitments (COP outcomes, trade agreements) create ratchet pressure on domestic policy ambition.',
  'International agreement milestone → domestic target adequacy review → federal climate/energy policy tightening → regulatory framework update → compliance requirement escalation',
  'moderate'),

-- TC-29
(11, 10, 'State Policy Divergence → Regulatory Complexity Cost',
  'Divergent state REZ, planning, and climate policies increase regulatory complexity and compliance costs for national investors.',
  'State policy divergence → multi-jurisdictional compliance burden → renewable project finance due diligence cost increase → investment allocation inefficiency',
  'weak'),

-- TC-30
(4, 10, 'Greenwashing Enforcement → Corporate Climate Claims',
  'ACCC and ASIC greenwashing enforcement actions force corporate climate governance and ESG disclosure overhaul.',
  'Greenwashing enforcement action → corporate climate claim scrutiny → ESG disclosure standard tightening → board-level governance review → corporate climate strategy recalibration',
  'strong'),

-- TC-31
(10, 10, 'Directors'' Duties Litigation → Board Climate Oversight',
  'Climate-related directors'' duties litigation reshapes board oversight of climate risk, ESG disclosure, and insurance.',
  'Directors'' duties case outcome → board fiduciary duty interpretation shift → climate risk oversight enhancement → ESG disclosure upgrade → climate risk insurance demand increase',
  'moderate'),

-- TC-32
(10, 1, 'Interest Rate Environment → Project Finance Cost',
  'Interest rate changes directly affect the cost of capital for renewable energy projects and infrastructure investment.',
  'Interest rate movement → project finance cost change → utility-scale solar/wind IRR impact → investment commitment decision → deployment pipeline adjustment',
  'strong'),

-- TC-33
(3, 1, 'PPA Price Trends → Generation Investment Returns',
  'PPA price movements determine revenue certainty for new generation investment and project finance bankability.',
  'PPA price trend shift → generation revenue forecast revision → utility-scale solar/wind investment return recalculation → project finance bankability assessment → renewable project finance terms adjustment',
  'strong'),

-- TC-34
(10, 4, 'ESG Reporting Mandates → Corporate Data Investment',
  'Mandatory ESG reporting (ISSB/ASRS) drives corporate investment in emissions measurement and MRV technology.',
  'ESG reporting mandate commencement → corporate emissions data gap identification → MRV technology investment → emissions measurement capability uplift → reporting quality improvement',
  'strong'),

-- TC-35
(10, 1, 'Insurance Retreat → Stranded Asset Acceleration',
  'Insurance withdrawal from fossil fuel assets accelerates stranding of coal generation and forces earlier retirement.',
  'Insurance premium increase or coverage withdrawal → fossil asset operating cost increase → coal plant economic viability deterioration → accelerated retirement decision → replacement capacity urgency',
  'strong'),

-- TC-36
(10, 3, 'Green Bond Market Growth → Transmission Finance',
  'Green bond and sustainable debt market growth improves financing conditions for major transmission infrastructure.',
  'Green bond market expansion → transmission project financing cost reduction → infrastructure investment case improvement → transmission build program acceleration',
  'moderate'),

-- TC-37
(10, 10, 'Infrastructure Fund Allocation Shifts → Deal Competition',
  'Large infrastructure fund allocation to clean energy intensifies deal competition and compresses project finance returns.',
  'Infrastructure fund clean energy allocation increase → deal competition intensification → renewable project finance return compression → M&A asset transaction price inflation',
  'moderate'),

-- TC-38
(12, 3, 'Workforce Shortfall → Project Delivery Timeline',
  'Skilled workforce shortages delay transmission, renewable generation, and storage project delivery timelines.',
  'Workforce skills gap persistence → transmission project delivery delay → utility-scale solar/wind commissioning slowdown → BESS installation backlog → deployment target achievement risk',
  'strong'),

-- TC-39
(11, 9, 'China Trade Tensions → Supply Chain Cost',
  'Geopolitical tensions and trade policy shifts with China affect critical mineral supply chain costs and diversification urgency.',
  'Trade tension escalation → critical mineral supply chain disruption risk → supply chain diversification policy acceleration → domestic processing investment → component cost increase',
  'strong'),

-- TC-40
(9, 2, 'Critical Minerals Policy → Battery Supply Chain Security',
  'Critical minerals extraction, processing, and trade policies determine battery supply chain security and cost.',
  'Critical minerals policy change → lithium/rare-earth supply trajectory shift → battery manufacturing input cost change → lithium-ion BESS and sodium-ion economics impact → storage deployment rate adjustment',
  'moderate'),

-- TC-41
(12, 1, 'Just Transition Program Quality → Political Licence for Coal Closure',
  'Quality and credibility of just transition programs determine political and community acceptance of coal plant closures.',
  'Reskilling/transition program outcome → affected community sentiment → political licence for coal closure → retirement timeline adherence → replacement generation urgency',
  'moderate'),

-- TC-42
(12, 3, 'Apprenticeship Pipeline → Medium-Term Workforce Capacity',
  'Apprenticeship and training pipeline adequacy determines medium-term workforce capacity for transmission and grid projects.',
  'Workforce training pipeline assessment → skills gap projection → transmission project scheduling constraint → medium-term grid build capacity determination',
  'strong'),

-- TC-43
(12, 9, 'Battery Recycling Infrastructure → Circular Economy Viability',
  'Battery recycling and waste-to-energy infrastructure development affects critical mineral recovery and circular economy economics.',
  'Battery recycling infrastructure investment → lithium/cobalt recovery rate improvement → secondary mineral supply contribution → virgin extraction demand reduction → circular economy viability assessment',
  'weak'),

-- TC-44
(5, 3, 'EV Adoption Rate → Distribution Network Stress',
  'Rapid EV adoption and charging infrastructure deployment creates significant distribution network loading challenges.',
  'EV fleet growth acceleration → residential/commercial charging load increase → distribution transformer and feeder stress → network upgrade investment requirement → smart charging/V2G solution demand',
  'strong'),

-- TC-45
(2, 6, 'Hydrogen Cost Trajectory → Hard-to-Abate Sector Viability',
  'Green hydrogen cost trajectory determines economic viability of decarbonisation for steel, chemicals, and heavy industry.',
  'Hydrogen production cost decline → green steel/chemical feedstock economics improvement → industrial decarbonisation pathway viability → hard-to-abate sector transition investment decision',
  'moderate'),

-- TC-46
(7, 4, 'Methane Reduction Technology → Livestock Sector Emissions Profile',
  'Ruminant methane reduction technologies reshape livestock sector emissions profiles and carbon credit generation potential.',
  'Methane reduction technology validation → livestock emissions factor revision → ACCU generation opportunity → Safeguard Mechanism agriculture sector interaction → offset market supply impact',
  'weak'),

-- TC-47
(6, 3, 'Industrial Heat Electrification → Electricity Demand Step-Change',
  'Electrification of industrial heat processes in chemicals, cement, and aluminium creates step-change electricity demand growth.',
  'Industrial electrification commitment → large-load connection request → transmission capacity requirement → grid connection queue pressure → electricity market reform for industrial load',
  'moderate'),

-- TC-48
(5, 3, 'SAF Mandate Trajectory → Aviation Cost and Competition',
  'Sustainable aviation fuel mandates increase electricity demand for e-fuel production and affect electricity price dynamics.',
  'SAF mandate adoption → e-fuel production electricity demand → electricity price impact → aviation operational cost increase → competitive dynamics shift',
  'weak'),

-- TC-49
(12, 10, 'Extreme Weather Events → Political Urgency and Insurance Pricing',
  'Extreme weather events drive political urgency for climate action and repricing of climate risk insurance.',
  'Extreme weather event → insurance claim surge → climate risk insurance repricing → political urgency for federal climate policy → physical adaptation investment acceleration',
  'moderate'),

-- TC-50
(12, 11, 'Climate Science Updates → Target and Budget Revisions',
  'Updated climate science and modelling outputs drive revision of emissions targets and carbon budget calculations.',
  'Climate science update → carbon budget revision → federal climate policy target reassessment → international climate commitment review → domestic policy ratchet pressure',
  'weak');
