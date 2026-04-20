import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { revokeMember } from "@/lib/surfaces/access";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ slug: string; memberId: string }>;
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug, memberId } = await ctx.params;

  try {
    const { rows } = await pool.query<{ id: string; owner_user_id: string }>(
      `SELECT s.id, s.owner_user_id
         FROM knowledge_surfaces s
         JOIN knowledge_surface_members m ON m.surface_id = s.id
        WHERE s.slug = $1 AND m.id = $2`,
      [slug, memberId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isAdmin = auth.profile.user_role === "admin";
    if (!isAdmin && rows[0].owner_user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await revokeMember(memberId, auth.user.id, "admin_revoke");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/surfaces members DELETE]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
