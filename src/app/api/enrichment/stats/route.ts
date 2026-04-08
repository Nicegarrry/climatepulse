import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [
      enrichedRes, unenrichedRes, domainRes, signalRes, sentimentRes,
      entityRes, costRes, significanceRes, pipelineVersionRes
    ] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM enriched_articles"),
        pool.query(
          `SELECT COUNT(*) as count FROM raw_articles ra
           LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
           WHERE ea.id IS NULL`
        ),
        pool.query(
          `SELECT d.name as domain, COUNT(DISTINCT ea.id) as count
           FROM enriched_articles ea, UNNEST(ea.microsector_ids) as mid
           JOIN taxonomy_microsectors m ON m.id = mid
           JOIN taxonomy_sectors s ON s.id = m.sector_id
           JOIN taxonomy_domains d ON d.id = s.domain_id
           GROUP BY d.name
           ORDER BY count DESC`
        ),
        pool.query(
          `SELECT signal_type as signal, COUNT(*) as count
           FROM enriched_articles
           GROUP BY signal_type
           ORDER BY count DESC`
        ),
        pool.query(
          `SELECT sentiment, COUNT(*) as count
           FROM enriched_articles
           GROUP BY sentiment
           ORDER BY count DESC`
        ),
        pool.query("SELECT COUNT(*) as count FROM entities"),
        pool.query("SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM enrichment_runs"),
        pool.query(
          `SELECT
            COALESCE(AVG(significance_composite), 0) as avg_significance,
            COUNT(*) FILTER (WHERE significance_composite < 20) as bucket_0_20,
            COUNT(*) FILTER (WHERE significance_composite >= 20 AND significance_composite < 40) as bucket_20_40,
            COUNT(*) FILTER (WHERE significance_composite >= 40 AND significance_composite < 60) as bucket_40_60,
            COUNT(*) FILTER (WHERE significance_composite >= 60 AND significance_composite < 80) as bucket_60_80,
            COUNT(*) FILTER (WHERE significance_composite >= 80) as bucket_80_100
          FROM enriched_articles
          WHERE significance_composite IS NOT NULL`
        ),
        pool.query(
          `SELECT COALESCE(pipeline_version, 1) as version, COUNT(*) as count
           FROM enriched_articles
           GROUP BY COALESCE(pipeline_version, 1)
           ORDER BY version`
        ),
      ]);

    return NextResponse.json({
      total_enriched: parseInt(enrichedRes.rows[0].count),
      unenriched_count: parseInt(unenrichedRes.rows[0].count),
      domain_distribution: domainRes.rows.map((r) => ({
        domain: r.domain,
        count: parseInt(r.count),
      })),
      signal_distribution: signalRes.rows.map((r) => ({
        signal: r.signal,
        count: parseInt(r.count),
      })),
      sentiment_distribution: sentimentRes.rows.map((r) => ({
        sentiment: r.sentiment,
        count: parseInt(r.count),
      })),
      entity_count: parseInt(entityRes.rows[0].count),
      estimated_cost_usd: parseFloat(costRes.rows[0].total),
      significance: {
        avg: parseFloat(significanceRes.rows[0]?.avg_significance ?? 0),
        histogram: {
          "0-20": parseInt(significanceRes.rows[0]?.bucket_0_20 ?? 0),
          "20-40": parseInt(significanceRes.rows[0]?.bucket_20_40 ?? 0),
          "40-60": parseInt(significanceRes.rows[0]?.bucket_40_60 ?? 0),
          "60-80": parseInt(significanceRes.rows[0]?.bucket_60_80 ?? 0),
          "80-100": parseInt(significanceRes.rows[0]?.bucket_80_100 ?? 0),
        },
      },
      pipeline_versions: pipelineVersionRes.rows.map((r) => ({
        version: parseInt(r.version),
        count: parseInt(r.count),
      })),
    });
  } catch (err) {
    console.error("Enrichment stats failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch enrichment stats" },
      { status: 500 }
    );
  }
}
