import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/surfaces/taxonomy
 * Returns the domain + microsector tree the surface wizard needs for its
 * scope picker. Thinner than /api/taxonomy/tree — no article counts, no
 * sector intermediate layer required.
 */
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [domains, microsectors] = await Promise.all([
      pool.query(
        `SELECT id, slug, name, sort_order
           FROM taxonomy_domains
          ORDER BY sort_order, name`,
      ),
      pool.query(
        `SELECT m.id, m.slug, m.name, m.sort_order,
                s.name AS sector_name, s.domain_id
           FROM taxonomy_microsectors m
           JOIN taxonomy_sectors s ON s.id = m.sector_id
          ORDER BY s.domain_id, s.sort_order, m.sort_order`,
      ),
    ]);

    return NextResponse.json({
      domains: domains.rows,
      microsectors: microsectors.rows,
    });
  } catch (err) {
    console.error("[admin/surfaces/taxonomy]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
