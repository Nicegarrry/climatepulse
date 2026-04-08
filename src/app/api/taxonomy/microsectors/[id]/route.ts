import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, keywords, sort_order } = body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }
    if (keywords !== undefined) {
      fields.push(`keywords = $${idx++}`);
      values.push(keywords);
    }
    if (sort_order !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(sort_order);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE taxonomy_microsectors SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Microsector not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating microsector:", error);
    return NextResponse.json(
      { error: "Failed to update microsector" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      "DELETE FROM taxonomy_microsectors WHERE id = $1 RETURNING id",
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Microsector not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting microsector:", error);
    return NextResponse.json(
      { error: "Failed to delete microsector" },
      { status: 500 }
    );
  }
}
