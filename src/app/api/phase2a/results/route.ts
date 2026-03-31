import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const hours = params.get("hours");

  let query = `
    SELECT
      ca.id, ca.raw_article_id, ca.primary_category, ca.secondary_categories,
      ca.categorised_at, ca.model_used,
      ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at
    FROM categorised_articles ca
    JOIN raw_articles ra ON ra.id = ca.raw_article_id
    WHERE 1=1
  `;
  const values: (string | number)[] = [];
  let idx = 1;

  if (category) {
    query += ` AND ca.primary_category = $${idx++}`;
    values.push(category);
  }

  if (hours && hours !== "0") {
    query += ` AND ca.categorised_at > NOW() - INTERVAL '${parseInt(hours)} hours'`;
  }

  query += ` ORDER BY ca.categorised_at DESC LIMIT 500`;

  const { rows } = await pool.query(query, values);
  return NextResponse.json(rows);
}
