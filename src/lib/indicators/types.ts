export type IndicatorStatus = "live" | "review" | "dormant";
export type IndicatorDirection = "down" | "up" | "neutral";
export type IndicatorValueType = "currency" | "percent" | "count" | "physical";
export type IndicatorSourceType = "article" | "scraper" | "manual";
export type IndicatorReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded";

// Filter dropdowns + lint of new catalogue rows.
// Detector may still propose unknown regions — those land in the review queue.
export const KNOWN_GEOGRAPHIES = [
  "Global",
  "AU",
  "EU",
  "US",
  "China",
  "India",
  "UK",
  "Japan",
] as const;

export type Indicator = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sector: string;
  geography: string;
  unit: string;
  value_type: IndicatorValueType;
  direction_good: IndicatorDirection;
  status: IndicatorStatus;
  current_value: number | null;
  prior_value: number | null;
  last_updated_at: string | null;
  last_source_article_id: string | null;
  last_source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type IndicatorValueRow = {
  id: string;
  indicator_id: string;
  value: number;
  unit: string;
  geography: string;
  observed_at: string;
  source_type: IndicatorSourceType;
  source_article_id: string | null;
  source_url: string | null;
  source_scraper: string | null;
  evidence_quote: string | null;
  confidence: number;
  created_at: string;
};

export type IndicatorWithHistory = Indicator & {
  history: { observed_at: string; value: number }[];
};

// Confidence thresholds for the LLM detector. Used by step 3.
// Live ≥ 0.85 → indicator_values insert.
// 0.6 ≤ x < 0.85 → indicator_review_queue insert.
// < 0.6 → drop (logged in step result, not persisted).
export const DETECTOR_LIVE_THRESHOLD = 0.85;
export const DETECTOR_QUEUE_THRESHOLD = 0.6;
