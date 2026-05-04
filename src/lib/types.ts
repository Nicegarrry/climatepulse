export interface RawArticle {
  id: string;
  title: string;
  snippet: string | null;
  source_name: string;
  source_url: string;
  article_url: string;
  published_at: string | null;
  fetched_at: string;
  created_at: string;
}

export interface Source {
  id: string;
  name: string;
  feed_url: string;
  source_type: "rss" | "scrape" | "api";
  tier: number;
  last_polled: string | null;
  last_successful_poll: string | null;
  consecutive_failures: number;
  total_articles_found: number;
  is_active: boolean;
  created_at: string;
}

export interface DiscoveryStats {
  total_articles: number;
  articles_last_24h: number;
  articles_by_source: Record<string, number>;
  articles_by_hour: Record<string, number>;
  active_sources: number;
  failed_sources: number;
}

export interface DiscoveryRunResult {
  feeds_polled: number;
  feeds_scraped: number;
  new_articles: number;
  duplicates_skipped: number;
  errors: number;
  duration_ms: number;
}

export interface CategorisedArticle {
  id: string;
  raw_article_id: string;
  primary_category: string;
  secondary_categories: string[];
  categorised_at: string;
  model_used: string;
  // Joined fields from raw_articles
  title: string;
  snippet: string | null;
  source_name: string;
  article_url: string;
  published_at: string | null;
  full_text: string | null;
  full_text_word_count: number | null;
}

export interface CategoryStats {
  total_categorised: number;
  uncategorised_count: number;
  distribution: { category: string; count: number }[];
  avg_secondaries: number;
  estimated_cost_usd: number;
}

export interface NewsApiRunResult {
  source: string;
  new_articles: number;
  duplicates_skipped: number;
  full_text_stored: number;
  errors: number;
  duration_ms: number;
  error_details: Array<{ query: string; error: string }>;
}

export interface FulltextTestResult {
  source_name: string;
  success: boolean;
  article_title: string | null;
  article_url: string | null;
  word_count: number;
  error: string | null;
}

export interface FulltextStatus {
  name: string;
  fulltext_supported: boolean | null;
  fulltext_tested_at: string | null;
}

// ─── Context Quality ────────────────────────────────────────────────────────

export type ContextQuality = "headline_only" | "snippet" | "full_text";

// ─── Enrichment Pipeline Types ──────────────────────────────────────────────

export type SignalType =
  | "market_move"
  | "policy_change"
  | "project_milestone"
  | "corporate_action"
  | "enforcement"
  | "personnel"
  | "technology_advance"
  | "international"
  | "community_social";

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";

export type EntityType =
  | "company"
  | "project"
  | "regulation"
  | "person"
  | "technology";

export type EntityStatus = "candidate" | "promoted" | "archived" | "dormant";

export type EntityRole = "subject" | "actor";

// ─── Two-Stage Pipeline Types ──────────────────────────────────────────────

export interface Stage1Result {
  raw_article_id: string;
  primary_domain: string; // domain slug or "uncertain"
  secondary_domain: string | null;
  signal_type: SignalType;
  headline_entities: { name: string; likely_type: string }[];
  context_quality: ContextQuality;
}

export interface SignificanceFactorScore {
  score: number;
  rationale: string;
}

export interface SignificanceScores {
  impact_breadth: SignificanceFactorScore;
  novelty: SignificanceFactorScore;
  decision_forcing: SignificanceFactorScore;
  quantitative_magnitude: SignificanceFactorScore;
  source_authority: SignificanceFactorScore;
  temporal_urgency: SignificanceFactorScore;
}

export const SIGNIFICANCE_WEIGHTS = {
  impact_breadth: 25,
  novelty: 20,
  decision_forcing: 20,
  quantitative_magnitude: 15,
  source_authority: 10,
  temporal_urgency: 10,
} as const;

export interface QuantitativeData {
  primary_metric: {
    value: string;
    unit: string;
    context: string;
  } | null;
  delta: {
    value: string;
    unit: string;
    period: string;
  } | null;
}

export type SentimentValue = "positive" | "negative" | "neutral" | "mixed";

export interface Stage2Result {
  microsectors: { slug: string; confidence: "high" | "medium" | "low" }[];
  entities: { name: string; type: string; role: EntityRole; context: string }[];
  jurisdictions: string[];
  regulations_referenced: string[];
  technologies_referenced: string[];
  quantitative_data: QuantitativeData | null;
  transmission_channels_triggered: string[];
  significance: SignificanceScores;
  sentiment: SentimentValue;
}

export interface CalibrationExample {
  domain: string;
  title: string;
  composite: number;
  condensed: string; // pre-formatted for prompt injection
}

// ─── Taxonomy Types ─────────────────────────────────────────────────────────

export interface TaxonomyDomain {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  article_count?: number;
}

export interface TaxonomySector {
  id: number;
  domain_id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  article_count?: number;
}

export interface TaxonomyMicrosector {
  id: number;
  sector_id: number;
  slug: string;
  name: string;
  description: string | null;
  keywords: string[];
  sort_order: number;
  article_count?: number;
}

export interface TaxonomyTag {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface TaxonomyTreeNode {
  domain: TaxonomyDomain;
  sectors: {
    sector: TaxonomySector;
    microsectors: TaxonomyMicrosector[];
  }[];
}

// ─── Entity Types ───────────────────────────────────────────────────────────

export interface Entity {
  id: number;
  canonical_name: string;
  entity_type: EntityType;
  aliases: string[];
  metadata: Record<string, unknown>;
  status: EntityStatus;
  mention_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

// ─── Enriched Article Types ─────────────────────────────────────────────────

export interface EnrichedArticle {
  id: string;
  raw_article_id: string;
  microsector_ids: number[];
  tag_ids: number[];
  signal_type: SignalType | null;
  sentiment: Sentiment;
  jurisdictions: string[];
  raw_entities: unknown;
  model_used: string;
  used_full_text: boolean;
  enriched_at: string;
  // Two-stage pipeline fields
  significance_scores: SignificanceScores | null;
  significance_composite: number | null;
  context_quality: ContextQuality | null;
  primary_domain: string | null;
  secondary_domain: string | null;
  confidence_levels: Record<string, string> | null; // slug -> "high"|"medium"|"low"
  quantitative_data: QuantitativeData | null;
  regulations_referenced: string[];
  technologies_referenced: string[];
  transmission_channels_triggered: string[];
  pipeline_version: number;
  // Contradicts-prior signal (set by checkContradictsPrior after enrichment)
  contradicts_prior?: boolean;
  contradicted_source_ids?: string[];
  // Joined fields from raw_articles
  title: string;
  snippet: string | null;
  source_name: string;
  article_url: string;
  published_at: string | null;
  full_text: string | null;
  full_text_word_count: number | null;
  // Joined entity names (for display)
  entities?: { id: number; name: string; type: EntityType; role: string }[];
  // Resolved microsector names (for display)
  microsector_names?: string[];
}

// ─── Transmission Channels ──────────────────────────────────────────────────

export interface TransmissionChannel {
  id: number;
  source_domain_id: number | null;
  target_domain_id: number | null;
  label: string;
  description: string | null;
  mechanism: string | null;
  strength: "weak" | "moderate" | "strong";
  is_active: boolean;
  created_at: string;
  // Joined domain names
  source_domain_name?: string;
  target_domain_name?: string;
}

// ─── Enrichment Stats ───────────────────────────────────────────────────────

export interface EnrichmentStats {
  total_enriched: number;
  unenriched_count: number;
  domain_distribution: { domain: string; count: number }[];
  signal_distribution: { signal: string; count: number }[];
  sentiment_distribution: { sentiment: string; count: number }[];
  entity_count: number;
  estimated_cost_usd: number;
}

export interface EnrichmentBatchResult {
  articles_processed: number;
  errors: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  total_remaining: number;
  total_batches_remaining: number;
  done: boolean;
  entities_created: number;
  entities_matched: number;
  entities_dormant?: number;
  stage1_duration_ms?: number;
  stage2_duration_ms?: number;
  pipeline_version?: number;
}

// ─── User Personalisation Types ────────────────────────────────────────────

export type RoleLens =
  | "investor"
  | "corporate_sustainability"
  | "policy_analyst"
  | "project_developer"
  | "board_director"
  | "researcher"
  | "general";

export type BriefingDepth = "quick" | "standard" | "deep";

export interface RoleLensInfo {
  id: RoleLens;
  label: string;
  framing: string;
}

export const ROLE_LENS_OPTIONS: RoleLensInfo[] = [
  { id: "investor", label: "Investor / Fund Manager", framing: "Financial impact, asset valuation, portfolio implications, deal flow signals" },
  { id: "corporate_sustainability", label: "Corporate Sustainability Manager", framing: "Compliance obligations, reporting requirements, peer benchmarking, risk to operations" },
  { id: "policy_analyst", label: "Policy Analyst / Government", framing: "Policy precedent, regulatory trajectory, implementation feasibility, political dynamics" },
  { id: "project_developer", label: "Project Developer / Engineer", framing: "Project pipeline impact, approval timeline, cost drivers, technical feasibility" },
  { id: "board_director", label: "Board Director / Executive", framing: "Governance obligations, strategic risk, stakeholder expectations, fiduciary implications" },
  { id: "researcher", label: "Researcher / Academic", framing: "Evidence quality, methodology, knowledge gaps, research implications" },
  { id: "general", label: "General Interest", framing: "Plain-language explanation, why this matters to Australia, what happens next" },
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role_lens: RoleLens;
  primary_sectors: string[];
  jurisdictions: string[];
  followed_entities: string[];
  followed_storylines: string[];
  triage_history: Record<string, { swipe_right: number; swipe_left: number }>;
  accordion_opens: Record<string, string>;
  story_ring_taps: Record<string, string>;
  briefing_depth: BriefingDepth;
  digest_time: string;
}

// ─── Scored Story (personalised) ───────────────────────────────────────────

export interface ScoredStory {
  id: string;
  title: string;
  source_name: string;
  article_url: string;
  snippet: string | null;
  full_text: string | null;
  signal_type: SignalType | null;
  primary_domain: string | null;
  secondary_domain: string | null;
  microsector_slugs: string[];
  secondary_microsector_slugs: string[];
  entities: { id?: number; name: string; type: string }[];
  quantitative_data: QuantitativeData | null;
  jurisdictions: string[];
  inherent_score: number;
  context_quality: ContextQuality | null;
  source_authority: number;
  linked_storylines: string[];
  transmission_channels_triggered: string[];
  // Personalisation fields
  personal_score: number;
  relevance_boost: number;
  boost_breakdown: { condition: string; boost: number }[];
  designation: "hero" | "compact";
}

// ─── Digest Output (from Claude Sonnet) ────────────────────────────────────

export interface DigestDailyNumber {
  value: string;
  label: string;
  context: string;
  trend: string | null;
}

export interface TriggeredIndicatorUpdate {
  indicator_slug: string;
  indicator_name: string;
  new_value: number;
  unit: string;
  direction_good: "down" | "up" | "neutral";
}

export interface DigestHeroStory {
  rank: number;
  headline: string;
  source: string;
  url: string;
  expert_take: string;
  key_metric: { value: string; unit: string; delta?: string } | null;
  so_what?: string | null;
  connected_storyline: { title: string; context: string } | null;
  micro_sectors: string[];
  entities_mentioned: string[];
  triggered_indicator_update?: TriggeredIndicatorUpdate | null;
}

export interface DigestCompactStory {
  rank: number;
  headline: string;
  source: string;
  url: string;
  one_line_take: string;
  key_metric: { value: string; unit: string; delta?: string } | null;
  triggered_indicator_update?: TriggeredIndicatorUpdate | null;
}

export interface DigestCrossConnection {
  story_ranks: number[];
  connection: string;
}

export interface DigestOutput {
  narrative: string;
  daily_number: DigestDailyNumber;
  hero_stories: DigestHeroStory[];
  compact_stories: DigestCompactStory[];
  cross_story_connections: DigestCrossConnection[] | null;
  // Set when the briefing falls back to sample content (no pipeline data yet,
  // zero stories passed personalisation, or Claude errored). The next cron run
  // overwrites with a real briefing.
  is_sample?: boolean;
  sample_reason?: "no_articles" | "no_personalisation_match" | "ai_error";
  // Annotated post-Claude in src/lib/digest/generate.ts: total indicator
  // values inserted today across all articles. Hidden in the UI when 0.
  indicators_updated_today?: number;
}

export interface DailyBriefing {
  id: string;
  user_id: string;
  date: string;
  stories: ScoredStory[];
  digest: DigestOutput;
  generated_at: string;
  articles_analysed?: number;
}

// ─── Gamification & Tracking ──────────────────────────────────────────────

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  streak_started_date: string | null;
  briefed_today: boolean;
}

export interface BriefingCompletionResult {
  streak: number;
  longest_streak: number;
  is_new_record: boolean;
}

export interface SectorCoverageItem {
  sector_slug: string;
  sector_name: string;
  stories_published: number;
  stories_read: number;
}

export interface SectorCoverageData {
  sectors: SectorCoverageItem[];
  nudge: {
    sector_name: string;
    stories_available: number;
    last_read_date: string | null;
  } | null;
}

export interface WeeklyPulse {
  week_start: string;
  stories_read: number;
  briefings_completed: number;
  total_reading_time_seconds: number | null;
  sectors_covered: number;
  sectors_subscribed: number;
  current_streak: number;
  stories_read_percentile: number | null;
  briefings_completed_percentile: number | null;
  cohort_size: number | null;
  cohort_avg_stories: number | null;
}

// ─── Podcast ──────────────────────────────────────────────────────────────────

export interface PodcastTurn {
  speaker: "host" | "analyst";
  text: string;
}

export interface PodcastScript {
  title: string;
  turns: PodcastTurn[];
  estimated_duration_seconds: number;
  word_count: number;
}

export interface PodcastEpisode {
  id: string;
  briefing_date: string;
  user_id: string | null;
  script: PodcastScript;
  audio_url: string;
  audio_duration_seconds: number | null;
  audio_size_bytes: number | null;
  audio_format: string;
  generated_at: string;
  tier?: "daily" | "themed" | "flagship";
  archetype?: "commercial" | "academic" | "public" | "general" | null;
  theme_slug?: string | null;
  flagship_episode_id?: string | null;
  character_ids?: string[];
  music_bed_url?: string | null;
}

export interface PodcastArchiveItem {
  id: string;
  briefing_date: string;
  tier: "daily" | "themed" | "flagship";
  archetype: "commercial" | "academic" | "public" | "general" | null;
  theme_slug: string | null;
  flagship_episode_id: string | null;
  audio_url: string;
  audio_duration_seconds: number | null;
  audio_format: string;
  generated_at: string;
  title: string | null;
}

// ─── Weekly Digest ───────────────────────────────────────────────────────────

export interface WeeklyThemeCluster {
  cluster_id: string;
  label: string;
  domain: string;
  articles: {
    id: string;
    title: string;
    source: string;
    url: string;
    significance: number;
  }[];
  entity_overlap: string[];
  sentiment_agg: { positive: number; negative: number; neutral: number; mixed: number };
  key_numbers: { value: string; unit: string; context: string }[];
}

export interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  status: "draft" | "ready" | "superseded";
  theme_clusters: WeeklyThemeCluster[];
  top_numbers: {
    value: string;
    unit: string;
    context: string;
    source_article_id: string;
    delta?: string;
  }[];
  sentiment_summary: {
    overall: string;
    by_domain: Record<string, Record<string, number>>;
  };
  storyline_updates: {
    storyline_id: number;
    title: string;
    article_count: number;
    latest_development: string;
  }[];
  transmission_activity: {
    channel_label: string;
    triggered_count: number;
    example_article_ids: string[];
  }[];
  article_ids_included: string[];
  model_used: string;
  generated_at: string;
}

export interface WeeklyCuratedStory {
  article_id?: string;
  headline: string;
  source: string;
  url: string;
  editor_take: string;
  severity: "alert" | "watch" | "ready" | "clear";
  sector: string;
  key_metric?: { value: string; unit: string; delta?: string };
}

export interface WeeklyDigest {
  id: string;
  report_id: string | null;
  week_start: string;
  week_end: string;
  status: "draft" | "published" | "archived";
  headline: string;
  editor_narrative: string;
  weekly_number: {
    value: string;
    unit: string;
    label: string;
    context: string;
    trend: string | null;
  } | null;
  curated_stories: WeeklyCuratedStory[];
  theme_commentary: { theme_label: string; commentary: string }[] | null;
  outlook: string | null;
  published_at: string | null;
  banner_expires_at: string | null;
  linkedin_draft: string | null;
  created_at: string;
  // Optional byline + scheduling — populated once migrate-editorial-extras lands.
  author_user_id?: string | null;
  author_name?: string | null;
  scheduled_for?: string | null;
}
