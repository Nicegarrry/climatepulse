import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { upsertMember } from "@/lib/surfaces/access";
import type { AccessLevel } from "@/lib/surfaces/types";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ slug: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const ACCESS_LEVELS: AccessLevel[] = ["viewer", "contributor", "admin"];

async function loadSurfaceIdAndOwner(slug: string) {
  const { rows } = await pool.query<{ id: string; owner_user_id: string }>(
    `SELECT id, owner_user_id FROM knowledge_surfaces WHERE slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

function isOwnerOrAdmin(
  owner_user_id: string,
  auth: { user: { id: string }; profile: { user_role: string } },
): boolean {
  return (
    auth.profile.user_role === "admin" || owner_user_id === auth.user.id
  );
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await ctx.params;
  const surface = await loadSurfaceIdAndOwner(slug);
  if (!surface) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOwnerOrAdmin(surface.owner_user_id, auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.user_id, m.email, m.domain, m.access_level,
              m.redeemed_via_code, m.granted_by, m.granted_at, m.revoked_at,
              u.name AS user_name, u.email AS user_email
         FROM knowledge_surface_members m
         LEFT JOIN user_profiles u ON u.id = m.user_id
         WHERE m.surface_id = $1
         ORDER BY
           CASE WHEN m.revoked_at IS NULL THEN 0 ELSE 1 END,
           m.granted_at DESC`,
      [surface.id],
    );
    return NextResponse.json({ members: rows });
  } catch (err) {
    console.error("[admin/surfaces members GET]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

interface PostBody {
  user_id?: string;
  email?: string;
  domain?: string;
  access_level?: AccessLevel;
}

export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await ctx.params;
  const surface = await loadSurfaceIdAndOwner(slug);
  if (!surface) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOwnerOrAdmin(surface.owner_user_id, auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() || null;
  const domain = body.domain?.trim().toLowerCase() || null;
  const user_id = body.user_id?.trim() || null;
  const access_level: AccessLevel = ACCESS_LEVELS.includes(
    body.access_level as AccessLevel,
  )
    ? (body.access_level as AccessLevel)
    : "viewer";

  if (!email && !domain && !user_id) {
    return NextResponse.json(
      { error: "Provide one of user_id, email, or domain" },
      { status: 400 },
    );
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email", field: "email" },
      { status: 400 },
    );
  }
  if (domain && !DOMAIN_RE.test(domain)) {
    return NextResponse.json(
      { error: "Invalid domain", field: "domain" },
      { status: 400 },
    );
  }

  try {
    const memberId = await upsertMember(surface.id, {
      user_id,
      email,
      domain,
      access_level,
      granted_by: auth.user.id,
      reason: "admin_invite",
    });
    return NextResponse.json({ id: memberId, ok: true }, { status: 201 });
  } catch (err) {
    console.error("[admin/surfaces members POST]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
