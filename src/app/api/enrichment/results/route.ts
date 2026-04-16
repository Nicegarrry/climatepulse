import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = request.nextUrl.searchParams;
    const domain = params.get("domain");
    const signal_type = params.get("signal_type");
    const sentiment = params.get("sentiment");
    const entity_id = params.get("entity_id");
    const min_significance = params.get("min_significance");
    const max_significance = params.get("max_significance");
    const sort = params.get("sort"); // "significance" or default (published_at)
    const page = parseInt(params.get("page") ?? "1");
    const limit = parseInt(params.get("limit") ?? "50");
    const offset = (page - 1) * limit;

    let query = `
      SELECT ea.*, ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at,
             ft.content as full_text, ft.word_count as full_text_word_count
      FROM enriched_articles ea
      JOIN raw_articles ra ON ra.id = ea.raw_article_id
      LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM enriched_articles ea
      JOIN raw_articles ra ON ra.id = ea.raw_article_id
      WHERE 1=1
    `;

    const values: (string | number)[] = [];
    const countValues: (string | number)[] = [];
    let idx = 1;
    let countIdx = 1;

    if (domain) {
      const domainFilter = ` AND EXISTS (SELECT 1 FROM UNNEST(ea.microsector_ids) mid JOIN taxonomy_microsectors m ON m.id = mid JOIN taxonomy_sectors s ON s.id = m.sector_id JOIN taxonomy_domains d ON d.id = s.domain_id WHERE d.slug = $`;
      query += domainFilter + `${idx++})`;
      countQuery += domainFilter + `${countIdx++})`;
      values.push(domain);
      countValues.push(domain);
    }

    if (signal_type) {
      query += ` AND ea.signal_type = $${idx++}`;
      countQuery += ` AND ea.signal_type = $${countIdx++}`;
      values.push(signal_type);
      countValues.push(signal_type);
    }

    if (sentiment) {
      query += ` AND ea.sentiment = $${idx++}`;
      countQuery += ` AND ea.sentiment = $${countIdx++}`;
      values.push(sentiment);
      countValues.push(sentiment);
    }

    if (entity_id) {
      const entityFilter = ` AND EXISTS (SELECT 1 FROM article_entities ae WHERE ae.enriched_article_id = ea.id AND ae.entity_id = $`;
      query += entityFilter + `${idx++})`;
      countQuery += entityFilter + `${countIdx++})`;
      values.push(entity_id);
      countValues.push(entity_id);
    }

    if (min_significance) {
      query += ` AND ea.significance_composite >= $${idx++}`;
      countQuery += ` AND ea.significance_composite >= $${countIdx++}`;
      values.push(parseFloat(min_significance));
      countValues.push(parseFloat(min_significance));
    }

    if (max_significance) {
      query += ` AND ea.significance_composite <= $${idx++}`;
      countQuery += ` AND ea.significance_composite <= $${countIdx++}`;
      values.push(parseFloat(max_significance));
      countValues.push(parseFloat(max_significance));
    }

    const orderBy = sort === "significance"
      ? `ea.significance_composite DESC NULLS LAST`
      : `ra.published_at DESC NULLS LAST`;
    query += ` ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`;
    values.push(limit, offset);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, countValues),
    ]);

    const total = parseInt(countRows[0].total);

    return NextResponse.json({
      articles: rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Enrichment results failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch enrichment results" },
      { status: 500 }
    );
  }
}
