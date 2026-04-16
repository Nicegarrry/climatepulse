import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const hours = params.get("hours");
  const source = params.get("source");
  const page = parseInt(params.get("page") ?? "1");
  const limit = parseInt(params.get("limit") ?? "50");
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      ca.id, ca.raw_article_id, ca.primary_category, ca.secondary_categories,
      ca.categorised_at, ca.model_used,
      ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at,
      ft.content as full_text, ft.word_count as full_text_word_count
    FROM categorised_articles ca
    JOIN raw_articles ra ON ra.id = ca.raw_article_id
    LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
    WHERE 1=1
  `;

  let countQuery = `
    SELECT COUNT(*) as total
    FROM categorised_articles ca
    JOIN raw_articles ra ON ra.id = ca.raw_article_id
    WHERE 1=1
  `;

  const values: (string | number)[] = [];
  const countValues: (string | number)[] = [];
  let idx = 1;
  let countIdx = 1;

  if (category) {
    query += ` AND ca.primary_category = $${idx++}`;
    countQuery += ` AND ca.primary_category = $${countIdx++}`;
    values.push(category);
    countValues.push(category);
  }

  if (source) {
    query += ` AND ra.source_name = $${idx++}`;
    countQuery += ` AND ra.source_name = $${countIdx++}`;
    values.push(source);
    countValues.push(source);
  }

  if (hours && hours !== "0") {
    const interval = `${parseInt(hours)} hours`;
    query += ` AND ca.categorised_at > NOW() - INTERVAL '${interval}'`;
    countQuery += ` AND ca.categorised_at > NOW() - INTERVAL '${interval}'`;
  }

  query += ` ORDER BY ca.categorised_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  values.push(limit, offset);

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, countValues),
  ]);

  const total = parseInt(countRows[0].total);

  return NextResponse.json({
    articles: rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
}
