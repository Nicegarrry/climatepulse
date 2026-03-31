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
  source_type: "rss" | "scrape";
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
}

export interface CategoryStats {
  total_categorised: number;
  uncategorised_count: number;
  distribution: { category: string; count: number }[];
  avg_secondaries: number;
  estimated_cost_usd: number;
}
