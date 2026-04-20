import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import {
  validateUpsert,
  SurfaceConfigError,
  type SurfaceUpsertInput,
} from "@/lib/surfaces/config";
import { hashCohortCode } from "@/lib/surfaces/access";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/surfaces — list surfaces visible to the caller.
 *  - admins see everything.
 *  - non-admins see their own surfaces.
 *
 * Query params: ?q=&limit=&cursor=<updated_at ISO>
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const isAdmin = auth.profile.user_role === "admin";
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const cursor = searchParams.get("cursor");

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!isAdmin) {
    params.push(auth.user.id);
    clauses.push(`owner_user_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`title ILIKE $${params.length}`);
  }
  if (cursor) {
    params.push(cursor);
    clauses.push(`updated_at < $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);

  try {
    const { rows } = await pool.query(
      `SELECT
         s.id, s.slug, s.title, s.template, s.lifecycle,
         s.owner_user_id, s.version, s.created_at, s.updated_at,
         s.published_at, s.archived_at,
         u.email AS owner_email,
         u.name  AS owner_name,
         (SELECT COUNT(*)::int FROM knowledge_surface_members m
           WHERE m.surface_id = s.id AND m.revoked_at IS NULL) AS member_count
       FROM knowledge_surfaces s
       LEFT JOIN user_profiles u ON u.id = s.owner_user_id
       ${where}
       ORDER BY s.updated_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const next = rows.length === limit ? rows[rows.length - 1].updated_at : null;

    return NextResponse.json({ surfaces: rows, next_cursor: next });
  } catch (err) {
    console.error("[admin/surfaces GET] db error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

interface CreateBody extends SurfaceUpsertInput {
  cohort_code_plaintext?: string;
}

/**
 * POST /api/admin/surfaces — create a new surface.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const isAdmin = auth.profile.user_role === "admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Hash plaintext cohort code into access.cohort_code_hash before validation.
  const rawAccess: Record<string, unknown> =
    body.access && typeof body.access === "object" && !Array.isArray(body.access)
      ? { ...(body.access as Record<string, unknown>) }
      : { kind: "authenticated" };

  if (
    rawAccess.kind === "cohort_code" &&
    typeof body.cohort_code_plaintext === "string" &&
    body.cohort_code_plaintext.length > 0
  ) {
    rawAccess.cohort_code_hash = hashCohortCode(body.cohort_code_plaintext);
  }

  const upsertInput: SurfaceUpsertInput = {
    slug: body.slug,
    title: body.title,
    template: body.template,
    scope: body.scope,
    access: rawAccess,
    overlay: body.overlay,
    layout: body.layout,
    branding: body.branding,
    lifecycle: body.lifecycle ?? "draft",
    owner_user_id: auth.user.id,
  };

  let validated;
  try {
    validated = validateUpsert(upsertInput);
  } catch (err) {
    if (err instanceof SurfaceConfigError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }
    throw err;
  }

  try {
    // Slug uniqueness pre-check (friendlier than hitting the UNIQUE constraint).
    const existing = await pool.query(
      "SELECT 1 FROM knowledge_surfaces WHERE slug = $1",
      [validated.slug],
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Slug already in use", field: "slug" },
        { status: 409 },
      );
    }

    const { rows } = await pool.query<{ id: string; slug: string }>(
      `INSERT INTO knowledge_surfaces
         (slug, title, template, scope, access, overlay, layout, branding,
          lifecycle, owner_user_id, published_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,
               CASE WHEN $9 = 'published' THEN NOW() ELSE NULL END)
       RETURNING id, slug`,
      [
        validated.slug,
        validated.title,
        validated.template,
        JSON.stringify(validated.scope),
        JSON.stringify(validated.access),
        JSON.stringify(validated.overlay),
        JSON.stringify(validated.layout),
        JSON.stringify(validated.branding),
        validated.lifecycle,
        validated.owner_user_id,
      ],
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[admin/surfaces POST] db error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
