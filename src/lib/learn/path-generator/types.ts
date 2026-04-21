export type LearningLevel = "intro" | "intermediate" | "advanced";
export type TimeBudget = "15m" | "30m" | "1h" | "2h" | "half_day" | "full_day";

export interface Intent {
  in_scope_microsectors: number[];
  learning_level: LearningLevel;
  orientation: string;
  time_budget: TimeBudget;
  audience_context: string;
}

export type PathItemType =
  | "concept_card"
  | "microsector_brief"
  | "microsector_brief_block"
  | "briefing"
  | "deep_dive"
  | "podcast"
  | "quiz";

export interface PathItem {
  item_type: PathItemType;
  item_id: string;
  item_version?: number;
  chapter: string;
  position: number;
  completion_required: boolean;
  note?: string;
}

export interface Chapter {
  label: string;
  position: number;
}

export interface PathPlan {
  items: PathItem[];
  chapters: Chapter[];
}

export type RefusalReason =
  | "thin_substrate"
  | "over_broad"
  | "over_narrow"
  | "off_topic";

export interface Warning {
  code: string;
  message: string;
}

export interface Revision {
  description: string;
  items_affected: number;
}

export type PathGenerationResult =
  | { plan: PathPlan; warnings: Warning[]; refused?: never }
  | { refused: RefusalReason; plan?: never; warnings?: never };

export interface ConceptCardRef {
  id: string;
  term: string;
  version: number;
  hop_distance: number;
}
