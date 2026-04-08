import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT * FROM taxonomy_tags ORDER BY name");
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, name, description } = body;

    const result = await pool.query(
      `INSERT INTO taxonomy_tags (slug, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [slug, name, description || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
