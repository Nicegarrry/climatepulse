import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM taxonomy_domains ORDER BY sort_order"
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching domains:", error);
    return NextResponse.json(
      { error: "Failed to fetch domains" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, name, description } = body;

    const result = await pool.query(
      `INSERT INTO taxonomy_domains (slug, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [slug, name, description || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating domain:", error);
    return NextResponse.json(
      { error: "Failed to create domain" },
      { status: 500 }
    );
  }
}
