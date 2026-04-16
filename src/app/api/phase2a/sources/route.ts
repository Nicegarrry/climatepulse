import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT ra.source_name, COUNT(*) as count
     FROM categorised_articles ca
     JOIN raw_articles ra ON ra.id = ca.raw_article_id
     GROUP BY ra.source_name
     ORDER BY count DESC`
  );
  return NextResponse.json(rows);
}
