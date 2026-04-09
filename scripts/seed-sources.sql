-- Seed RSS sources (Tier 1)
INSERT INTO sources (name, feed_url, source_type, tier) VALUES
  ('Carbon Brief', 'https://www.carbonbrief.org/feed', 'rss', 1),
  ('Canary Media', 'https://www.canarymedia.com/rss-feed', 'rss', 1),
  ('CleanTechnica', 'https://cleantechnica.com/feed', 'rss', 1),
  ('Electrek', 'https://electrek.co/feed', 'rss', 1),
  ('Guardian Environment', 'https://www.theguardian.com/environment/rss', 'rss', 1),
  ('Inside Climate News', 'https://insideclimatenews.org/feed', 'rss', 1),
  ('Grist', 'https://grist.org/feed', 'rss', 1),
  ('RealClearEnergy', 'https://www.realclearenergy.org/rss/', 'rss', 1),
  ('PV Magazine', 'https://www.pv-magazine.com/feed', 'rss', 1),
  ('Energy Storage News', 'https://www.energy-storage.news/feed', 'rss', 1),
  ('Renewables Now', 'https://renewablesnow.com/feeds/', 'rss', 1),
  ('Bloomberg Green', 'https://feeds.bloomberg.com/green/news.rss', 'rss', 1),
  ('RenewEconomy', 'https://reneweconomy.com.au/feed', 'rss', 1),
  ('The Driven', 'https://thedriven.io/feed', 'rss', 1),
  ('Utility Dive', 'https://www.utilitydive.com/feeds/news/', 'rss', 1),
  ('Recharge News', 'https://www.rechargenews.com/rss', 'rss', 1),
  ('Carbon Tracker', 'https://carbontracker.org/feed/', 'rss', 1),
  ('Climate Home News', 'https://www.climatechangenews.com/feed/', 'rss', 1),
  ('Ember Climate', 'https://ember-climate.org/feed/', 'rss', 1),
  ('DeSmog', 'https://www.desmog.com/feed/', 'rss', 1)
ON CONFLICT (name) DO NOTHING;

-- Seed RSS sources (Tier 2)
INSERT INTO sources (name, feed_url, source_type, tier) VALUES
  ('DCCEEW Australia', 'https://www.dcceew.gov.au/about/news/stay-informed/rss', 'rss', 2),
  -- CSIRO: blog.csiro.au/feed/ is dead (redirects to HTML). Disabled 2026-03-31.
  -- ('CSIRO Climate', 'https://blog.csiro.au/feed/', 'rss', 2),
  ('IEA', 'https://www.iea.org/news/rss', 'rss', 2),
  ('IRENA', 'https://www.irena.org/rssfeed', 'rss', 2),
  ('EIA Today in Energy', 'https://www.eia.gov/rss/todayinenergy.xml', 'rss', 2),
  ('NOAA Climate', 'https://www.climate.gov/feeds/news-features/highlights.rss', 'rss', 2),
  ('Nature Climate Change', 'https://www.nature.com/nclimate.rss', 'rss', 2),
  ('CTVC', 'https://www.ctvc.co/rss/', 'rss', 2),
  ('PV Magazine Australia', 'https://www.pv-magazine-australia.com/feed', 'rss', 2),
  ('CEFC Media', 'https://www.cefc.com.au/media/media-releases/feed/', 'rss', 2),
  ('World Resources Institute', 'https://www.wri.org/feed', 'rss', 2),
  ('Climate Council Australia', 'https://www.climatecouncil.org.au/feed/', 'rss', 2),
  ('Bellona', 'https://bellona.org/feed', 'rss', 2)
ON CONFLICT (name) DO NOTHING;

-- Seed scrape sources (Tier 3)
INSERT INTO sources (name, feed_url, source_type, tier) VALUES
  ('ARENA News', 'https://arena.gov.au/news/', 'scrape', 3),
  ('AEMO Media', 'https://aemo.com.au/newsroom', 'scrape', 3),
  ('Clean Energy Council', 'https://www.cleanenergycouncil.org.au/news', 'scrape', 3),
  ('RMI Insights', 'https://rmi.org/insights/', 'scrape', 3),
  ('CEFC Media Releases', 'https://www.cefc.com.au/media/media-releases/', 'scrape', 3),
  ('CSIRO News', 'https://www.csiro.au/en/news/all', 'scrape', 3),
  ('ImpactAlpha Dealflow', 'https://impactalpha.com/category/dealflow/', 'scrape', 3),
  ('IEA Reports', 'https://www.iea.org/reports', 'scrape', 3),
  ('IRENA Publications', 'https://www.irena.org/Publications', 'scrape', 3),
  ('CER News', 'https://www.cleanenergyregulator.gov.au/About/Pages/News-and-updates.aspx', 'scrape', 3)
ON CONFLICT (name) DO NOTHING;
