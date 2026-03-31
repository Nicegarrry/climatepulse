import { NextResponse } from "next/server";
import { pollAllFeeds } from "@/lib/discovery/poller";
import { scrapeAllTargets } from "@/lib/discovery/scraper";
import type { DiscoveryRunResult } from "@/lib/types";

export const maxDuration = 120;

export async function POST() {
  const start = Date.now();

  const [pollResult, scrapeResult] = await Promise.all([
    pollAllFeeds(),
    scrapeAllTargets(),
  ]);

  const result: DiscoveryRunResult = {
    feeds_polled: pollResult.feeds_polled,
    feeds_scraped: scrapeResult.sites_scraped,
    new_articles: pollResult.new_articles + scrapeResult.new_articles,
    duplicates_skipped: pollResult.duplicates_skipped + scrapeResult.duplicates_skipped,
    errors: pollResult.errors + scrapeResult.errors,
    duration_ms: Date.now() - start,
  };

  const errors = [...pollResult.error_details, ...scrapeResult.error_details];

  return NextResponse.json({ ...result, error_details: errors });
}
