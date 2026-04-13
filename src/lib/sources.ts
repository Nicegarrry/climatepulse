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
  { name: "RenewEconomy", feedUrl: "https://reneweconomy.com.au/feed", tier: 1 },
  { name: "The Driven", feedUrl: "https://thedriven.io/feed", tier: 1 },
  { name: "Utility Dive", feedUrl: "https://www.utilitydive.com/feeds/news/", tier: 1 },
  // Recharge News: paywalled behind NHST SSO, no public RSS. Disabled 2026-04-13.
  // { name: "Recharge News", feedUrl: "https://www.rechargenews.com/rss", tier: 1 },
  { name: "Carbon Tracker", feedUrl: "https://carbontracker.org/feed/", tier: 1 },
  { name: "Climate Home News", feedUrl: "https://www.climatechangenews.com/feed/", tier: 1 },
  { name: "Ember Climate", feedUrl: "https://ember-climate.org/feed/", tier: 1 },
  { name: "DeSmog", feedUrl: "https://www.desmog.com/feed/", tier: 1 },
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
  // CEFC Media: feed URL dead (404), no replacement RSS. Disabled 2026-04-13.
  // { name: "CEFC Media", feedUrl: "https://www.cefc.com.au/media/media-releases/feed/", tier: 2 },
  // WRI: feed URL dead (404), no replacement RSS. Disabled 2026-04-13.
  // { name: "World Resources Institute", feedUrl: "https://www.wri.org/feed", tier: 2 },
  { name: "The Fifth Estate", feedUrl: "https://thefifthestate.com.au/feed/", tier: 2 },
  { name: "ScienceDaily Renewables", feedUrl: "https://www.sciencedaily.com/rss/earth_climate/renewable_energy.xml", tier: 2 },
  { name: "Climate Council Australia", feedUrl: "https://www.climatecouncil.org.au/feed/", tier: 2 },
  { name: "Bellona", feedUrl: "https://bellona.org/feed", tier: 2 },
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
  {
    name: "CEFC Media Releases",
    url: "https://www.cefc.com.au/media/?type=media+release",
    articleSelector: ".media-release, article, .post-item, .card, .listing-item, a[href*='/media/media-release/']",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "h2 a, h3 a, .title a, a",
    snippetSelector: ".excerpt, .summary, p",
  },
  {
    name: "CSIRO News",
    url: "https://www.csiro.au/en/news/all",
    articleSelector: ".news-item, article, .card, .listing-item",
    titleSelector: "h2 a, h3 a, .title a, .card-title a",
    linkSelector: "h2 a, h3 a, .title a, a",
    snippetSelector: ".description, .summary, .card-text, p",
  },
  {
    name: "ImpactAlpha Dealflow",
    url: "https://impactalpha.com/category/dealflow/",
    articleSelector: "article, .post, .entry",
    titleSelector: "h2 a, h3 a, .entry-title a",
    linkSelector: "h2 a, h3 a, .entry-title a, a",
    snippetSelector: ".excerpt, .entry-summary, p",
  },
  // IEA Reports: 403 — WAF blocks server-side fetching. Disabled 2026-04-13.
  // IRENA Publications: 403 — WAF blocks server-side fetching. Disabled 2026-04-13.
  {
    name: "CER News",
    url: "https://cer.gov.au/news-and-media/media-centre",
    articleSelector: ".news-item, article, .card, .listing-item, .views-row",
    titleSelector: "h2 a, h3 a, .title a, a",
    linkSelector: "h2 a, h3 a, .title a, a",
    snippetSelector: ".description, .summary, .field-content, p",
    dateSelector: ".date, time, .datetime",
  },
];
