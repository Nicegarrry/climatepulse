import { NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/storylines — list storylines with article counts
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // suggested, active, dormant, archived
    const includeArticles = searchParams.get("include_articles") === "true";

    let whereClause = "";
    const params: string[] = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE s.status = $1`;
    } else {
      whereClause = `WHERE s.status IN ('suggested', 'active')`;
    }

    const { rows: storylines } = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM storyline_articles sa WHERE sa.storyline_id = s.id) AS live_article_count
       FROM storylines s
       ${whereClause}
       ORDER BY s.last_seen_at DESC NULLS LAST, s.created_at DESC
       LIMIT 50`,
      params
    );

    if (includeArticles && storylines.length > 0) {
      const storylineIds = storylines.map((s) => s.id);
      const { rows: articles } = await pool.query(
        `SELECT sa.storyline_id, sa.match_reason, sa.added_at,
                ra.title, ra.source_name, ra.url, ea.signal_type, ea.sentiment,
                ea.significance_composite
         FROM storyline_articles sa
         JOIN enriched_articles ea ON ea.id = sa.enriched_article_id
         JOIN raw_articles ra ON ra.id = ea.raw_article_id
         WHERE sa.storyline_id = ANY($1)
         ORDER BY sa.added_at DESC`,
        [storylineIds]
      );

      const articlesByStoryline = new Map<number, typeof articles>();
      for (const a of articles) {
        const list = articlesByStoryline.get(a.storyline_id) || [];
        list.push(a);
        articlesByStoryline.set(a.storyline_id, list);
      }

      for (const s of storylines) {
        (s as Record<string, unknown>).articles = articlesByStoryline.get(s.id) || [];
      }
    }

    return NextResponse.json({ storylines });
  } catch (error) {
    console.error("Error fetching storylines:", error);
    return NextResponse.json({ error: "Failed to fetch storylines" }, { status: 500 });
  }
}

/**
 * POST /api/storylines — create a manual storyline or approve a suggestion
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, storyline_id, title, description, entity_ids, microsector_slugs, domain_ids, signal_types } = body;

    // Approve a suggested storyline
    if (action === "approve" && storyline_id) {
      await pool.query(
        `UPDATE storylines SET status = 'active' WHERE id = $1 AND status = 'suggested'`,
        [storyline_id]
      );
      return NextResponse.json({ success: true });
    }

    // Dismiss a suggested storyline
    if (action === "dismiss" && storyline_id) {
      await pool.query(
        `UPDATE storylines SET status = 'archived' WHERE id = $1 AND status = 'suggested'`,
        [storyline_id]
      );
      return NextResponse.json({ success: true });
    }

    // Create a new manual storyline
    if (title) {
      const { rows } = await pool.query(
        `INSERT INTO storylines (title, description, entity_ids, microsector_slugs, domain_ids, signal_types, status, auto_discovered)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', false)
         RETURNING *`,
        [
          title,
          description || null,
          entity_ids || [],
          microsector_slugs || [],
          domain_ids || [],
          signal_types || [],
        ]
      );
      return NextResponse.json(rows[0], { status: 201 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error managing storyline:", error);
    return NextResponse.json({ error: "Failed to manage storyline" }, { status: 500 });
  }
}
