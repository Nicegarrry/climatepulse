/**
 * editorial_status mirrors the DB enum defined in 001-learn-prelude.sql.
 * Keep in sync with that enum — do not add values here without a migration.
 */
export type EditorialStatus =
  | "editor_authored"
  | "editor_reviewed"
  | "previously_reviewed_stale"
  | "ai_drafted"
  | "user_generated";

export enum BlockType {
  NicksLens = "nicks_lens",
  Fundamentals = "fundamentals",
  KeyMechanisms = "key_mechanisms",
  AustralianContext = "australian_context",
  CurrentState = "current_state",
  WhatsMoving = "whats_moving",
  Watchlist = "watchlist",
  Related = "related",
}

export enum CadencePolicy {
  Manual = "manual",
  Daily = "daily",
  Weekly = "weekly",
  Quarterly = "quarterly",
  Yearly = "yearly",
}

/** Canonical cadence window in milliseconds for each policy value. */
export const CADENCE_WINDOW_MS: Record<CadencePolicy, number> = {
  [CadencePolicy.Manual]: Infinity,
  [CadencePolicy.Daily]: 24 * 60 * 60 * 1000,
  [CadencePolicy.Weekly]: 7 * 24 * 60 * 60 * 1000,
  [CadencePolicy.Quarterly]: 90 * 24 * 60 * 60 * 1000,
  [CadencePolicy.Yearly]: 365 * 24 * 60 * 60 * 1000,
};

/** Default cadence policies per block type — overridable per brief. */
export const DEFAULT_CADENCE: Record<BlockType, CadencePolicy> = {
  [BlockType.NicksLens]: CadencePolicy.Manual,
  [BlockType.Fundamentals]: CadencePolicy.Yearly,
  [BlockType.KeyMechanisms]: CadencePolicy.Yearly,
  [BlockType.AustralianContext]: CadencePolicy.Yearly,
  [BlockType.CurrentState]: CadencePolicy.Weekly,
  [BlockType.WhatsMoving]: CadencePolicy.Daily,
  [BlockType.Watchlist]: CadencePolicy.Quarterly,
  [BlockType.Related]: CadencePolicy.Quarterly,
};

export interface MicrosectorBrief {
  id: string;
  microsector_id: number;
  title: string;
  tagline: string | null;
  regime_change_flagged: boolean;
  regime_change_source_ids: string[];
  regime_change_flagged_at: string | null;
  primary_domain: string | null;
  editorial_status: EditorialStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MicrosectorBriefBlock {
  id: string;
  brief_id: string;
  block_type: BlockType;
  body: string | null;
  body_json: Record<string, unknown> | null;
  cadence_policy: CadencePolicy;
  last_generated_at: string | null;
  last_input_hash: string | null;
  content_hash: string | null;
  editorial_status: EditorialStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type BlockGenerationResult =
  | { skipped: "inputs_unchanged" }
  | { skipped: "nicks_lens_manual_only" }
  | { skipped: "related_derived_not_generated" }
  | {
      blockId: string;
      briefId: string;
      blockType: BlockType;
      inputHash: string;
      inputTokens: number;
      outputTokens: number;
      durationMs: number;
      version: number;
    };
