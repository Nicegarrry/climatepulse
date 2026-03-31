export interface RSSSource {
  name: string;
  feedUrl: string;
  tier: 1 | 2;
}

export interface ScrapeTarget {
  name: string;
  url: string;
  articleSelector: string;
  titleSelector: string;
  linkSelector: string;
  snippetSelector?: string;
  dateSelector?: string;
}

export const RSS_SOURCES: RSSSource[] = [
  // Tier 1 — high frequency news
  { name: "Carbon Brief", feedUrl: "https://www.carbonbrief.org/feed", tier: 1 },
  { name: "Canary Media", feedUrl: "https://www.canarymedia.com/rss.rss", tier: 1 },
  { name: "CleanTechnica", feedUrl: "https://cleantechnica.com/feed", tier: 1 },
  { name: "Electrek", feedUrl: "https://electrek.co/feed", tier: 1 },
  { name: "Guardian Environment", feedUrl: "https://www.theguardian.com/environment/rss", tier: 1 },
  { name: "Inside Climate News", feedUrl: "https://insideclimatenews.org/feed", tier: 1 },
  { name: "Grist", feedUrl: "https://grist.org/feed", tier: 1 },
  // RealClearEnergy: DataDome WAF blocks server-side fetching. Disabled 2026-03-31.
  // { name: "RealClearEnergy", feedUrl: "https://www.realclearenergy.org/rss/", tier: 1 },
  { name: "PV Magazine", feedUrl: "https://www.pv-magazine.com/feed", tier: 1 },
  { name: "Energy Storage News", feedUrl: "https://www.energy-storage.news/feed", tier: 1 },
  // Renewables Now: 403 — WAF blocks server-side fetching. Disabled 2026-03-31.
  // { name: "Renewables Now", feedUrl: "https://renewablesnow.com/feeds/", tier: 1 },
  { name: "Bloomberg Green", feedUrl: "https://feeds.bloomberg.com/green/news.rss", tier: 1 },
  // Tier 2 — government, institutional, research
  // DCCEEW Australia: 403 — government WAF blocks server-side fetching. Disabled 2026-03-31.
  // { name: "DCCEEW Australia", feedUrl: "https://www.dcceew.gov.au/about/news/stay-informed/rss", tier: 2 },
  // CSIRO: blog.csiro.au/feed/ is dead (redirects to HTML). Disabled 2026-03-31.
  // { name: "CSIRO Climate", feedUrl: "https://blog.csiro.au/feed/", tier: 2 },
  // IEA: 403 — WAF blocks server-side fetching. Disabled 2026-03-31.
  // { name: "IEA", feedUrl: "https://www.iea.org/news/rss", tier: 2 },
  // IRENA: 403 — WAF blocks server-side fetching. Disabled 2026-03-31.
  // { name: "IRENA", feedUrl: "https://www.irena.org/rssfeed", tier: 2 },
  { name: "EIA Today in Energy", feedUrl: "https://www.eia.gov/rss/todayinenergy.xml", tier: 2 },
  { name: "NOAA Climate", feedUrl: "https://www.climate.gov/feeds/news-features/highlights.rss", tier: 2 },
  { name: "Nature Climate Change", feedUrl: "https://www.nature.com/nclimate.rss", tier: 2 },
  { name: "CTVC", feedUrl: "https://www.ctvc.co/rss/", tier: 2 },
  { name: "PV Magazine Australia", feedUrl: "https://www.pv-magazine-australia.com/feed", tier: 2 },
];

export const SCRAPE_TARGETS: ScrapeTarget[] = [
  {
    name: "ARENA News",
    url: "https://arena.gov.au/news/",
    articleSelector: ".news-listing article, .news-item, .post-item, .wp-block-post",
    titleSelector: "h2 a, h3 a, .title a, .wp-block-post-title a",
    linkSelector: "h2 a, h3 a, .title a, .wp-block-post-title a",
    snippetSelector: ".excerpt, .summary, .wp-block-post-excerpt, p",
  },
  // AEMO Media: 403 — WAF blocks server-side fetching. Disabled 2026-03-31.
  // {
  //   name: "AEMO Media",
  //   url: "https://aemo.com.au/newsroom",
  //   articleSelector: ".news-item, .media-release, article, .card",
  //   titleSelector: "h2 a, h3 a, .title a, .card-title a",
  //   linkSelector: "h2 a, h3 a, .title a, a",
  //   snippetSelector: ".description, .summary, .card-text, p",
  //   dateSelector: ".date, time, .card-date",
  // },
  {
    name: "Clean Energy Council",
    url: "https://www.cleanenergycouncil.org.au/news",
    articleSelector: ".news-item, article, .post-item, .card",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "h2 a, h3 a, .title a, a",
    snippetSelector: ".excerpt, .summary, p",
  },
  {
    name: "RMI Insights",
    url: "https://rmi.org/insights/",
    articleSelector: ".insight-card, article, .post-item, .card",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "h2 a, h3 a, .title a, a",
    snippetSelector: ".excerpt, .description, p",
  },
];
