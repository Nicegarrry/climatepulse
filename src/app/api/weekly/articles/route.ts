import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

// GET /api/weekly/articles?from=YYYY-MM-DD&to=YYYY-MM-DD&domain=slug&minSignificance=40&limit=50
// Returns enriched articles (joined with raw_articles) for the week range,
// filtered by significance and optional domain. Used by the editor story picker.
export async function GET(req: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const domain = searchParams.get("domain");
  const minSignificance = Math.max(
    0,
    parseInt(searchParams.get("minSignificance") || "40", 10) || 40
  );
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "50", 10) || 50,
    200
  );

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required params: from, to (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const params: (string | number)[] = [from, to, minSignificance];
    let domainClause = "";
    if (domain && domain !== "all") {
      params.push(domain);
      domainClause = `AND (ea.primary_domain = $${params.length} OR ea.secondary_domain = $${params.length})`;
    }
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT
         ea.id,
         ea.primary_domain AS domain,
         ea.secondary_domain,
         ea.signal_type,
         ea.sentiment,
         ea.significance_composite AS significance,
         ea.quantitative_data,
         ra.title,
         ra.source_name AS source,
         ra.article_url AS url,
         ra.published_at,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'name', e.canonical_name,
             'type', e.entity_type
           ) ORDER BY e.canonical_name)
            FROM article_entities ae
            JOIN entities e ON e.id = ae.entity_id
            WHERE ae.enriched_article_id = ea.id),
           '[]'::json
         ) AS entities
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ra.published_at >= $1::date
         AND ra.published_at < ($2::date + INTERVAL '1 day')
         AND ea.significance_composite IS NOT NULL
         AND ea.significance_composite >= $3
         ${domainClause}
       ORDER BY ea.significance_composite DESC, ra.published_at DESC
       LIMIT $${params.length}`,
      params
    );

    const articles = rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      url: row.url,
      published_at: row.published_at,
      domain: row.domain,
      secondary_domain: row.secondary_domain,
      signal_type: row.signal_type,
      sentiment: row.sentiment,
      significance: Number(row.significance) || 0,
      quantitative_data: row.quantitative_data,
      entities: row.entities ?? [],
    }));

    return NextResponse.json({ articles });
  } catch (err) {
    console.error("weekly articles search:", err);
    // Return empty list on schema/data issues rather than breaking the UI
    return NextResponse.json({ articles: [] });
  }
}
