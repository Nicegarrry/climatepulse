import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sector_id");

    let query = "SELECT * FROM taxonomy_microsectors";
    const params: any[] = [];

    if (sectorId) {
      query += " WHERE sector_id = $1";
      params.push(parseInt(sectorId));
    }

    query += " ORDER BY sort_order";

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching microsectors:", error);
    return NextResponse.json(
      { error: "Failed to fetch microsectors" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { sector_id, slug, name, description, keywords } = body;

    // Validate slug uniqueness
    const existing = await pool.query(
      "SELECT id FROM taxonomy_microsectors WHERE slug = $1",
      [slug]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "A microsector with this slug already exists" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO taxonomy_microsectors (sector_id, slug, name, description, keywords)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sector_id, slug, name, description || null, keywords || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating microsector:", error);
    return NextResponse.json(
      { error: "Failed to create microsector" },
      { status: 500 }
    );
  }
}
