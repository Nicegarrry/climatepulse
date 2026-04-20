// Shared types for the Learn system.
// Mirrors the editorial_status enum defined in scripts/migrations/learn/001-learn-prelude.sql.

export type EditorialStatus =
  | "editor_authored"
  | "editor_reviewed"
  | "previously_reviewed_stale"
  | "ai_drafted"
  | "user_generated";

export type ExtractionSource =
  | "briefing_corpus"
  | "entity_registry"
  | "manual_seed"
  | "canonical_source";

export type RelationshipType =
  | "prereq"
  | "related"
  | "supersedes"
  | "contrasts_with"
  | "peer";

export type RelationshipSourceType = "editor" | "llm" | "backfill";

export type CandidateStatus = "pending_review" | "approved" | "rejected" | "promoted";

export interface SourceCitation {
  type: "url" | "document" | "internal";
  ref: string;
  title: string;
  quote?: string;
  accessed_at: string;
}

export interface KeyMechanism {
  title: string;
  body: string;
}

export interface ConceptCard {
  id: string;
  slug: string;
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  inline_summary: string;
  full_body: string;
  key_mechanisms: KeyMechanism[] | null;
  related_terms: string[];
  visual_type: "none" | "chart" | "map" | "diagram" | "photo";
  visual_spec: Record<string, unknown> | null;
  uncertainty_flags: string[];
  source_citations: SourceCitation[];
  primary_domain: string | null;
  microsector_ids: number[];
  entity_ids: number[];
  editorial_status: EditorialStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ai_drafted: boolean;
  version: number;
  superseded_by: string | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface ConceptCardCandidate {
  id: string;
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  proposed_inline_summary: string | null;
  extraction_source: ExtractionSource;
  source_refs: SourceCitation[];
  signal_count: number;
  dedupe_group_id: string | null;
  status: CandidateStatus;
  promoted_to: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface ConceptCardRelationship {
  id: string;
  subject_card_id: string;
  object_card_id: string;
  relationship_type: RelationshipType;
  confidence: number;
  evidence: string | null;
  source_type: RelationshipSourceType;
  source_id: string | null;
  first_observed: string;
  last_observed: string;
  observation_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GenerationResult<T> {
  result: T | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  refused?: string;
  parseError?: string;
}

export interface ConceptCardLlmOutput {
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  inline_summary: string;
  full_body: string;
  key_mechanisms: KeyMechanism[];
  related_terms: string[];
  visual_type: "none" | "chart" | "map" | "diagram" | "photo";
  uncertainty_flags: string[];
  source_citations: SourceCitation[];
  primary_domain: string | null;
  microsector_ids: number[];
  entity_ids: number[];
}
