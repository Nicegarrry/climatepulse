import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(
    `SELECT name, fulltext_supported, fulltext_tested_at FROM sources ORDER BY name`
  );
  return NextResponse.json(rows);
}
