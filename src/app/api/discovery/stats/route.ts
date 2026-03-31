import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const [totalRes, last24hRes, bySourceRes, byHourRes, sourcesRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM raw_articles`),
    pool.query(`SELECT COUNT(*)::int AS count FROM raw_articles WHERE fetched_at > NOW() - INTERVAL '24 hours'`),
    pool.query(
      `SELECT source_name, COUNT(*)::int AS count FROM raw_articles
       WHERE fetched_at > NOW() - INTERVAL '24 hours'
       GROUP BY source_name ORDER BY count DESC`
    ),
    pool.query(
      `SELECT date_trunc('hour', COALESCE(published_at, fetched_at)) AS hour, COUNT(*)::int AS count
       FROM raw_articles
       WHERE fetched_at > NOW() - INTERVAL '24 hours'
       GROUP BY hour ORDER BY hour`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active AND consecutive_failures <= 3)::int AS active,
         COUNT(*) FILTER (WHERE consecutive_failures > 3)::int AS failed
       FROM sources`
    ),
  ]);

  const articlesBySource: Record<string, number> = {};
  for (const row of bySourceRes.rows) {
    articlesBySource[row.source_name] = row.count;
  }

  const articlesByHour: Record<string, number> = {};
  for (const row of byHourRes.rows) {
    articlesByHour[new Date(row.hour).toISOString()] = row.count;
  }

  return NextResponse.json({
    total_articles: totalRes.rows[0].count,
    articles_last_24h: last24hRes.rows[0].count,
    articles_by_source: articlesBySource,
    articles_by_hour: articlesByHour,
    active_sources: sourcesRes.rows[0].active,
    failed_sources: sourcesRes.rows[0].failed,
  });
}
