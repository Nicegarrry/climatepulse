import type { RoleLens } from "@/lib/types";

export type PodcastArchetype = "commercial" | "academic" | "public" | "general";

export const ALL_ARCHETYPES: PodcastArchetype[] = [
  "commercial",
  "academic",
  "public",
  "general",
];

const MAPPING: Record<RoleLens, PodcastArchetype> = {
  investor: "commercial",
  corporate_sustainability: "commercial",
  board_director: "commercial",
  researcher: "academic",
  policy_analyst: "public",
  project_developer: "public",
  general: "general",
};

export function roleLensToArchetype(roleLens: RoleLens | null | undefined): PodcastArchetype {
  if (!roleLens) return "general";
  return MAPPING[roleLens] ?? "general";
}

export interface ArchetypeFraming {
  archetype: PodcastArchetype;
  label: string;
  short: string;
  directive: string;
}

export const ARCHETYPE_FRAMINGS: Record<PodcastArchetype, ArchetypeFraming> = {
  commercial: {
    archetype: "commercial",
    label: "Commercial / Investor lens",
    short: "Commercial lens",
    directive: `Bias intros and analysis toward capital flows, unit economics, deal pipeline, and strategic risk.
When a story has both an emissions outcome and a commercial outcome, lead with commercial and let emissions follow.
Cite valuations, PPAs, capex curves, and multiples where the article supports it.
Avoid activist framing. Prefer "the numbers said to watch for" over "the right thing to do".`,
  },
  academic: {
    archetype: "academic",
    label: "Academic / Researcher lens",
    short: "Researcher lens",
    directive: `Bias intros toward evidence quality, methodology, and knowledge gaps.
Flag where today's data extends, contradicts, or reframes a prior study or IPCC scenario.
When numbers are claimed, ask what the confidence interval or replication status is.
Prefer "what the literature says" over "what the market expects".`,
  },
  public: {
    archetype: "public",
    label: "Policy / Public lens",
    short: "Policy lens",
    directive: `Bias intros toward regulatory precedent, implementation feasibility, and political dynamics.
When a story has both a commercial and a policy dimension, lead with the policy pathway.
Flag whether an announcement is a target, a regulation, a pilot, or funded delivery.
Prefer "what this sets as precedent" over "what this does to the share price".`,
  },
  general: {
    archetype: "general",
    label: "General interest",
    short: "General lens",
    directive: `Plain-language framing. Assume an educated but non-specialist listener.
Explain acronyms on first use. Link today's story to daily life in Australia where possible.
Avoid insider jargon. Keep analytical depth but trim technical digressions.`,
  },
};

export function getArchetypeDirective(archetype: PodcastArchetype): string {
  return ARCHETYPE_FRAMINGS[archetype].directive;
}
