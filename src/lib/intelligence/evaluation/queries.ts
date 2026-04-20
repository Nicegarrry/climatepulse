import type { QueryDef } from "./types";

/**
 * The evaluation query set. Lives in source so PRs that change retrieval
 * behaviour can be diffed against a stable benchmark.
 *
 * Distribution:
 *   - 10 entity_walk    — single-entity-anchored queries
 *   - 8  thematic       — domain-level queries; should be similar across backends (sanity check)
 *   - 6  multi_hop      — require ≥2 typed relationship hops to answer well
 *   - 4  contradiction  — queries about contradictory or reversed coverage
 *   - 2  calibration    — trivially easy queries; if any backend fails these, it's broken
 *
 * Seed entities are NAMES — the harness resolves them to entities.id at run time.
 * If a name doesn't resolve, the seedEntityIds passed to backends will be []
 * and graph-walk degrades to vector-only behaviour. That's fine for the spike;
 * we'll audit unresolved names in the comparison doc.
 */

export const EVALUATION_QUERIES: QueryDef[] = [
  // ─── Entity walk (10) ──────────────────────────────────────────────────────

  {
    id: "ew-01",
    category: "entity_walk",
    query: "What has Origin Energy done in renewables and storage in the last quarter?",
    seedEntities: ["Origin Energy"],
    notes: "Single-entity recent-activity query. All backends should find recent Origin coverage.",
  },
  {
    id: "ew-02",
    category: "entity_walk",
    query: "AGL Energy coal exit timeline and replacement projects",
    seedEntities: ["AGL Energy", "AGL"],
    notes: "Should pull coverage of Loy Yang, Bayswater, and AGL's replacement-build plans.",
  },
  {
    id: "ew-03",
    category: "entity_walk",
    query: "Snowy Hydro 2.0 project status and cost overruns",
    seedEntities: ["Snowy Hydro", "Snowy 2.0"],
    notes: "Project-anchored. Graph-walk should pick up entities related to the project.",
  },
  {
    id: "ew-04",
    category: "entity_walk",
    query: "Fortescue green hydrogen progress",
    seedEntities: ["Fortescue", "Fortescue Future Industries", "FFI"],
    notes: "Tests alias resolution as well as entity walk.",
  },
  {
    id: "ew-05",
    category: "entity_walk",
    query: "What is ARENA funding right now?",
    seedEntities: ["ARENA", "Australian Renewable Energy Agency"],
    notes: "Agency-anchored. Should surface funded projects.",
  },
  {
    id: "ew-06",
    category: "entity_walk",
    query: "AEMO recent rule changes and market interventions",
    seedEntities: ["AEMO", "Australian Energy Market Operator"],
    notes: "Regulator-anchored. Should pull rule-change coverage.",
  },
  {
    id: "ew-07",
    category: "entity_walk",
    query: "Tesla Megapack deployments in Australia",
    seedEntities: ["Tesla", "Megapack"],
    notes: "Technology + company. Tests company↔technology relationship walk.",
  },
  {
    id: "ew-08",
    category: "entity_walk",
    query: "Andrew Forrest's recent climate or energy positions",
    seedEntities: ["Andrew Forrest"],
    notes: "Person-anchored. Should walk person→company (Fortescue) relationships.",
  },
  {
    id: "ew-09",
    category: "entity_walk",
    query: "Iberdrola Australia project pipeline",
    seedEntities: ["Iberdrola Australia", "Iberdrola"],
    notes: "International developer with AU subsidiary — tests subsidiary_of walk.",
  },
  {
    id: "ew-10",
    category: "entity_walk",
    query: "What is Origin Energy doing with Octopus Energy?",
    seedEntities: ["Origin Energy", "Octopus Energy"],
    notes: "Two-entity query — relationship between the two should rank high.",
  },

  // ─── Thematic (8) — should be similar across backends ──────────────────────

  {
    id: "th-01",
    category: "thematic",
    query: "Recent shifts in Australian wholesale electricity prices",
    notes: "Domain-level. No specific entities; pure vector should match well.",
  },
  {
    id: "th-02",
    category: "thematic",
    query: "Critical minerals processing investment in Australia",
    notes: "Thematic. Should surface cross-company coverage of lithium, rare earths.",
  },
  {
    id: "th-03",
    category: "thematic",
    query: "Carbon credit market integrity concerns",
    notes: "Policy-thematic. Likely to pull Safeguard Mechanism, ACCU coverage.",
  },
  {
    id: "th-04",
    category: "thematic",
    query: "Offshore wind project development in Bass Strait and Gippsland",
    notes: "Geo + sector thematic.",
  },
  {
    id: "th-05",
    category: "thematic",
    query: "Battery storage deployment costs and economics",
    notes: "Tech-thematic.",
  },
  {
    id: "th-06",
    category: "thematic",
    query: "EV charging infrastructure rollout pace",
    notes: "Sector-thematic. Spans companies, councils, federal funding.",
  },
  {
    id: "th-07",
    category: "thematic",
    query: "Agricultural emissions reduction policies and methane",
    notes: "Cross-domain (agriculture + carbon).",
  },
  {
    id: "th-08",
    category: "thematic",
    query: "Climate adaptation funding for coastal infrastructure",
    notes: "Adaptation thematic — typically lower-volume coverage.",
  },

  // ─── Multi-hop (6) — require ≥2 typed relationship hops ────────────────────

  {
    id: "mh-01",
    category: "multi_hop",
    query: "Which projects funded by ARENA have hit milestones in the last quarter?",
    seedEntities: ["ARENA"],
    notes: "ARENA →funds→ Project →[milestone signal]. 2-hop query.",
  },
  {
    id: "mh-02",
    category: "multi_hop",
    query: "How does Origin Energy connect to Octopus Energy and the wholesale gas market?",
    seedEntities: ["Origin Energy", "Octopus Energy"],
    notes: "Multi-entity, multi-relationship. Tests bidirectional walk.",
  },
  {
    id: "mh-03",
    category: "multi_hop",
    query: "Which Australian companies use CATL battery technology in their projects?",
    seedEntities: ["CATL"],
    notes: "CATL ←uses_technology← Company →develops→ Project. 2-hop.",
  },
  {
    id: "mh-04",
    category: "multi_hop",
    query: "What projects are operated by subsidiaries of European utilities in Australia?",
    seedEntities: ["Iberdrola", "EDF", "Engie"],
    notes: "Parent →subsidiary_of← AU sub →operates→ Project. 3-hop. Hardest query in the set.",
  },
  {
    id: "mh-05",
    category: "multi_hop",
    query: "What regulations supersede the 2007 Renewable Energy Target framework?",
    seedEntities: ["Renewable Energy Target", "RET"],
    notes: "Regulation →supersedes→ Regulation walk. Tests vocab coverage.",
  },
  {
    id: "mh-06",
    category: "multi_hop",
    query: "Which projects developed by AGL replace its retiring coal capacity?",
    seedEntities: ["AGL Energy", "Loy Yang"],
    notes: "AGL →develops→ Project, contextually linked to the coal retirement.",
  },

  // ─── Contradiction (4) ──────────────────────────────────────────────────────

  {
    id: "co-01",
    category: "contradiction",
    query: "When has policy on offshore wind in Australia been reversed or contradicted?",
    notes: "Should surface coverage flagged with contradicts_prior=TRUE if any.",
  },
  {
    id: "co-02",
    category: "contradiction",
    query: "Conflicting forecasts for Australian gas demand to 2030",
    notes: "Tests retrieval of contrasting coverage on the same theme.",
  },
  {
    id: "co-03",
    category: "contradiction",
    query: "Government statements on net-zero pathway that have shifted",
    notes: "Policy-shift contradiction.",
  },
  {
    id: "co-04",
    category: "contradiction",
    query: "Cost overruns vs initial budget claims on major transmission projects",
    notes: "Project-level contradictions over time.",
  },

  // ─── Calibration (2) — trivially easy ──────────────────────────────────────

  {
    id: "ca-01",
    category: "calibration",
    query: "What is the latest news about Australian electricity prices?",
    notes: "Should return high-quality recent coverage from all backends.",
  },
  {
    id: "ca-02",
    category: "calibration",
    query: "Climate policy news from this week",
    notes: "Recency + thematic. All backends should perform.",
  },
];

export const QUERIES_BY_ID = new Map<string, QueryDef>(
  EVALUATION_QUERIES.map((q) => [q.id, q])
);
