import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { rows } = await pool.query(
    `SELECT name, fulltext_supported, fulltext_tested_at FROM sources ORDER BY name`
  );
  return NextResponse.json(rows);
}
