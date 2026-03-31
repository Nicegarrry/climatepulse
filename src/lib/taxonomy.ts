export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  theme: "energy" | "nature" | "policy" | "tech";
}

export const TAXONOMY: Category[] = [
  {
    id: "solar",
    name: "Solar",
    description: "Solar PV, concentrated solar, solar manufacturing, rooftop and utility-scale solar installations",
    keywords: ["solar", "photovoltaic", "PV", "panels", "modules", "inverter", "rooftop"],
    theme: "energy",
  },
  {
    id: "wind",
    name: "Wind",
    description: "Onshore and offshore wind energy, turbine technology, wind farm development and operations",
    keywords: ["wind", "turbine", "offshore", "onshore", "wind farm", "blade"],
    theme: "energy",
  },
  {
    id: "storage",
    name: "Energy Storage & Batteries",
    description: "Battery technologies, grid-scale storage, pumped hydro, long-duration energy storage, battery manufacturing",
    keywords: ["battery", "storage", "lithium", "BESS", "pumped hydro", "LDES", "grid-scale"],
    theme: "energy",
  },
  {
    id: "hydrogen",
    name: "Hydrogen & Green Fuels",
    description: "Green and blue hydrogen production, ammonia, e-fuels, sustainable aviation fuel, electrolysers",
    keywords: ["hydrogen", "H2", "electrolyser", "ammonia", "e-fuel", "SAF", "green fuel"],
    theme: "energy",
  },
  {
    id: "grid",
    name: "Grid & Transmission",
    description: "Electricity grid infrastructure, interconnectors, distributed energy resources, virtual power plants, market design",
    keywords: ["grid", "transmission", "interconnector", "DER", "VPP", "flexibility", "curtailment"],
    theme: "energy",
  },
  {
    id: "transport",
    name: "Transport Electrification",
    description: "Electric vehicles, EV charging infrastructure, fleet electrification, electric shipping, electric aviation",
    keywords: ["EV", "electric vehicle", "charging", "fleet", "electric bus", "e-truck", "Tesla"],
    theme: "tech",
  },
  {
    id: "buildings",
    name: "Buildings & Energy Efficiency",
    description: "Building energy efficiency, heat pumps, retrofits, embodied carbon in construction, energy codes and ratings",
    keywords: ["heat pump", "retrofit", "building", "efficiency", "NatHERS", "insulation", "HVAC"],
    theme: "tech",
  },
  {
    id: "heavy-industry",
    name: "Heavy Industry Decarbonisation",
    description: "Decarbonising steel, cement, aluminium, chemicals, and other hard-to-abate industrial processes",
    keywords: ["steel", "cement", "aluminium", "industrial", "green steel", "DRI", "kiln"],
    theme: "tech",
  },
  {
    id: "ccs",
    name: "Carbon Capture & Removal",
    description: "CCS, CCUS, direct air capture, BECCS, enhanced weathering, biochar, carbon dioxide removal technologies",
    keywords: ["CCS", "CCUS", "DAC", "carbon capture", "removal", "CDR", "sequestration", "biochar"],
    theme: "tech",
  },
  {
    id: "nature",
    name: "Nature, Land Use & Agriculture",
    description: "Nature-based solutions, forestry, agriculture emissions, blue carbon, biodiversity, methane from livestock",
    keywords: ["forest", "agriculture", "methane", "biodiversity", "land use", "blue carbon", "regenerative"],
    theme: "nature",
  },
  {
    id: "finance",
    name: "Climate Finance & Carbon Markets",
    description: "Green bonds, carbon credits, carbon markets, ESG, blended finance, climate-related investment and divestment",
    keywords: ["carbon market", "carbon credit", "ESG", "green bond", "climate finance", "divestment", "ACCU"],
    theme: "policy",
  },
  {
    id: "policy",
    name: "Policy & Regulation",
    description: "Government climate and energy policy, carbon pricing, clean energy standards, permitting, NDCs, legislation",
    keywords: ["policy", "regulation", "legislation", "carbon price", "mandate", "target", "NDC", "COP"],
    theme: "policy",
  },
  {
    id: "science",
    name: "Climate Science & Research",
    description: "Climate research, IPCC findings, temperature records, extreme weather attribution, tipping points",
    keywords: ["IPCC", "research", "study", "warming", "temperature", "emissions data", "tipping point"],
    theme: "nature",
  },
  {
    id: "adaptation",
    name: "Adaptation & Resilience",
    description: "Climate adaptation, resilience planning, flood protection, heat mitigation, climate risk, insurance",
    keywords: ["adaptation", "resilience", "flood", "heat", "drought", "insurance", "climate risk"],
    theme: "nature",
  },
  {
    id: "minerals",
    name: "Mining & Critical Minerals",
    description: "Lithium, cobalt, rare earths, nickel, supply chains, mining, recycling of energy transition minerals",
    keywords: ["lithium", "cobalt", "rare earth", "nickel", "mining", "critical mineral", "supply chain"],
    theme: "tech",
  },
  {
    id: "nuclear",
    name: "Nuclear",
    description: "Small modular reactors, nuclear fusion, existing nuclear fleet, nuclear waste, nuclear policy debates",
    keywords: ["nuclear", "SMR", "fusion", "reactor", "uranium", "fission"],
    theme: "energy",
  },
  {
    id: "fossil-transition",
    name: "Oil, Gas & Fossil Fuel Transition",
    description: "Fossil fuel phase-out, stranded assets, gas transition, coal closure, oil company strategy, just transition",
    keywords: ["oil", "gas", "coal", "fossil", "phase-out", "stranded", "LNG", "just transition"],
    theme: "policy",
  },
  {
    id: "circular",
    name: "Circular Economy & Waste",
    description: "Circular economy, recycling, waste-to-energy, plastics, e-waste, product lifecycle",
    keywords: ["circular", "recycling", "waste", "plastics", "e-waste", "lifecycle"],
    theme: "nature",
  },
  {
    id: "water",
    name: "Water & Oceans",
    description: "Water scarcity, desalination, ocean energy, ocean health, water-energy nexus",
    keywords: ["water", "ocean", "desalination", "tidal", "wave energy", "sea level"],
    theme: "nature",
  },
  {
    id: "climatetech",
    name: "Climate Tech & Startups",
    description: "Climate technology startups, venture capital deals, accelerators, new technology announcements",
    keywords: ["startup", "venture", "funding", "Series A", "accelerator", "climate tech", "innovation"],
    theme: "tech",
  },
];

export const VALID_CATEGORY_IDS = new Set(TAXONOMY.map((c) => c.id));

export const THEME_COLORS: Record<string, string> = {
  energy: "bg-status-info",
  nature: "bg-status-success",
  policy: "bg-accent-amber",
  tech: "bg-chart-1",
};
