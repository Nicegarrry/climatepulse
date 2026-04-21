import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { savePath } from "@/lib/learn/path-generator/persister";
import type { PathPlan, Intent } from "@/lib/learn/path-generator/types";

/**
 * POST /api/learn/paths
 * Persist a user-generated path plan.
 *
 * Body: { plan, intent?, freeText?, title? }
 * Returns: { slug, id }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    plan?: PathPlan;
    intent?: Intent;
    freeText?: string;
    title?: string;
    goal?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.plan || !Array.isArray(body.plan.items)) {
    return NextResponse.json(
      { error: "plan.items is required" },
      { status: 400 },
    );
  }

  const title =
    (body.title?.trim() ||
      body.freeText?.trim().slice(0, 80) ||
      "Generated path").slice(0, 200);

  const goal = body.goal?.trim() || body.freeText?.trim() || null;

  try {
    const pathId = await savePath(body.plan, auth.user.id, {
      update_policy: "frozen",
      editorial_status: "user_generated",
      title,
      goal: goal ?? undefined,
      intent: body.intent,
    });

    const { rows } = await pool.query<{ slug: string }>(
      `SELECT slug FROM learning_paths WHERE id = $1`,
      [pathId],
    );
    const slug = rows[0]?.slug;
    if (!slug) {
      return NextResponse.json(
        { error: "Saved but could not resolve slug" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: pathId, slug });
  } catch (err) {
    console.error("[api/learn/paths POST] save failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
