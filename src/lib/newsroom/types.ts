// Shared types for the Newsroom feature.
//
// `raw_article_id` is the canonical UUID FK to `raw_articles.id`.
// `user_id` is TEXT (matches `user_profiles.id`).

export type Urgency = 1 | 2 | 3 | 4 | 5;

export type InteractionType =
  | "read"
  | "expand"
  | "thumbs_up"
  | "thumbs_down"
  | "save"
  | "unsave";

export interface NewsroomItem {
  id: string;
  raw_article_id: string;
  primary_domain: string;
  urgency: Urgency;
  teaser: string;
  classifier_model: string;
  classifier_version: string;
  classified_at: string;
  published_at: string;
  source_name: string;
  duplicate_of_id: string | null;
  editor_override: Record<string, unknown> | null;
}

export interface NewsroomFeedRow extends NewsroomItem {
  title: string;
  article_url: string;
  is_saved?: boolean;
}

export interface ClassifierInput {
  id: string;
  title: string;
  snippet: string;
  source: string;
  published_at: string | null;
}

export interface ClassifierOutput {
  id: string;
  primary_domain: string;
  urgency: Urgency;
  teaser: string;
}

export interface IngestRunSummary {
  trigger: "cron" | "manual";
  ingested: number;
  deduped: number;
  classified: number;
  urgency5_pushes: number;
  cost_cents: number;
  duration_ms: number;
  skipped_reason?: "outside-hours" | null;
  error?: string;
  fetcher_breakdown?: Record<string, number>;
}

export interface InteractionSummary {
  byArticle: Map<
    string,
    { reads: number; thumbs: -1 | 0 | 1; saved: boolean }
  >;
  byEntity: Map<
    string,
    { reads: number; positive: number; negative: number; saves: number }
  >;
}

// Push payload contract — also implemented by public/sw.js (must stay in sync).
export interface NewsroomPushPayload {
  v: 1;
  kind: "newsroom_urgency5";
  item_id: string;
  raw_article_id: string;
  title: string;
  teaser: string;
  source: string;
  domain: string;
  url: string;
  published_at: string;
}
