export interface ASXTicker {
  id: number;
  ticker: string;
  company_name: string;
  sub_sector: string;
  entity_id: number | null;
  is_active: boolean;
}

export interface ASXAnnouncement {
  id: number;
  ticker: string;
  title: string;
  pdf_url: string | null;
  released_at: string;
  is_market_sensitive: boolean;
  should_extract_pdf: boolean;
  raw_article_id: string | null;
  fetched_at: string;
}

export interface ASXPrice {
  ticker: string;
  trade_date: string;
  open_price: number;
  close_price: number;
  day_high: number;
  day_low: number;
  volume: number;
  change_percent: number;
}

export interface ASXCurrentPrice {
  ticker: string;
  last_price: number;
  change_price: number;
  change_percent: number;
  volume: number;
  day_high: number;
  day_low: number;
  previous_close: number;
}

export interface WatchlistEntry {
  ticker: string;
  company_name: string;
  sub_sector: string;
  current_price: ASXCurrentPrice | null;
  sparkline: number[]; // 30 close prices
}

export interface AnnouncementFetchResult {
  tickers_fetched: number;
  new_announcements: number;
  errors: number;
  duration_ms: number;
}

export interface PriceFetchResult {
  tickers_fetched: number;
  prices_stored: number;
  errors: number;
  duration_ms: number;
}
