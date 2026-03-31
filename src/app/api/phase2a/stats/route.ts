import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const [totalRes, uncatRes, distRes, avgRes] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM categorised_articles"),
    pool.query(
      `SELECT COUNT(*) as count FROM raw_articles ra
       LEFT JOIN categorised_articles ca ON ca.raw_article_id = ra.id
       WHERE ca.id IS NULL`
    ),
    pool.query(
      `SELECT primary_category as category, COUNT(*) as count
       FROM categorised_articles
       GROUP BY primary_category
       ORDER BY count DESC`
    ),
    pool.query(
      `SELECT AVG(array_length(secondary_categories, 1)) as avg
       FROM categorised_articles
       WHERE array_length(secondary_categories, 1) > 0`
    ),
  ]);

  const totalCategorised = parseInt(totalRes.rows[0].count);

  // Rough cost estimate: ~500 tokens per batch of 20, ~200 output tokens
  // $0.10/1M input, $0.40/1M output
  const estimatedBatches = Math.ceil(totalCategorised / 20);
  const estimatedCost =
    (estimatedBatches * 500 * 0.1) / 1_000_000 +
    (estimatedBatches * 200 * 0.4) / 1_000_000;

  return NextResponse.json({
    total_categorised: totalCategorised,
    uncategorised_count: parseInt(uncatRes.rows[0].count),
    distribution: distRes.rows.map((r) => ({
      category: r.category,
      count: parseInt(r.count),
    })),
    avg_secondaries: parseFloat(avgRes.rows[0]?.avg ?? "0") || 0,
    estimated_cost_usd: estimatedCost,
  });
}
