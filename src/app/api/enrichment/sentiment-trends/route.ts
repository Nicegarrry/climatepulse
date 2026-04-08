import { NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/enrichment/sentiment-trends
 * Returns sentiment distribution per domain per week over the last 60 days.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(180, Math.max(7, parseInt(searchParams.get("days") || "60")));
    const granularity = searchParams.get("granularity") === "daily" ? "day" : "week";

    const { rows } = await pool.query(
      `SELECT
        ea.primary_domain AS domain,
        DATE_TRUNC($1, ea.enriched_at) AS period,
        ea.sentiment,
        COUNT(*) AS count
      FROM enriched_articles ea
      WHERE ea.enriched_at > NOW() - ($2 || ' days')::INTERVAL
        AND ea.primary_domain IS NOT NULL
        AND ea.sentiment IS NOT NULL
      GROUP BY ea.primary_domain, DATE_TRUNC($1, ea.enriched_at), ea.sentiment
      ORDER BY period, domain, sentiment`,
      [granularity, String(days)]
    );

    // Pivot into per-domain time series
    const byDomain: Record<string, Array<{
      period: string;
      positive: number;
      negative: number;
      neutral: number;
      mixed: number;
      total: number;
    }>> = {};

    for (const row of rows) {
      const domain = row.domain as string;
      const period = new Date(row.period).toISOString().split("T")[0];
      const sentiment = row.sentiment as string;
      const count = parseInt(row.count);

      if (!byDomain[domain]) byDomain[domain] = [];

      let entry = byDomain[domain].find((e) => e.period === period);
      if (!entry) {
        entry = { period, positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0 };
        byDomain[domain].push(entry);
      }

      if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral" || sentiment === "mixed") {
        entry[sentiment] = count;
      }
      entry.total += count;
    }

    // Sort each domain's entries by period
    for (const domain of Object.keys(byDomain)) {
      byDomain[domain].sort((a, b) => a.period.localeCompare(b.period));
    }

    return NextResponse.json({ trends: byDomain, days, granularity });
  } catch (error) {
    console.error("Error fetching sentiment trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentiment trends" },
      { status: 500 }
    );
  }
}
