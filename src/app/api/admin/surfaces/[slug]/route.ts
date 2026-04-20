import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import {
  parseSurface,
  SurfaceConfigError,
  validateAccess,
  validateBranding,
  validateLayout,
  validateLifecycle,
  validateOverlay,
  validateScope,
  validateSlug,
  validateTemplate,
} from "@/lib/surfaces/config";
import { hashCohortCode } from "@/lib/surfaces/access";
import type { SurfaceLifecycle } from "@/lib/surfaces/types";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ slug: string }>;
}

async function loadSurface(slug: string) {
  const { rows } = await pool.query(
    `SELECT * FROM knowledge_surfaces WHERE slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

async function assertOwnerOrAdmin(
  surface: { owner_user_id: string },
  auth: { user: { id: string }; profile: { user_role: string } },
) {
  if (auth.profile.user_role === "admin") return true;
  return surface.owner_user_id === auth.user.id;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await ctx.params;

  try {
    const row = await loadSurface(slug);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await assertOwnerOrAdmin(row, auth))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const surface = parseSurface(row);

    // Never leak the cohort code hash in the payload returned to editors —
    // they only need to know whether one is set, not what it is.
    const redactedAccess = { ...surface.access };
    const cohortSet =
      surface.access.kind === "cohort_code" && !!surface.access.cohort_code_hash;
    if (redactedAccess.cohort_code_hash) {
      delete redactedAccess.cohort_code_hash;
    }

    return NextResponse.json({
      surface: { ...surface, access: redactedAccess },
      cohort_code_set: cohortSet,
    });
  } catch (err) {
    console.error("[admin/surfaces GET slug]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

interface PatchBody {
  title?: string;
  slug?: string;
  template?: string;
  scope?: unknown;
  access?: Record<string, unknown>;
  cohort_code_plaintext?: string;
  overlay?: unknown;
  layout?: unknown;
  branding?: unknown;
  lifecycle?: SurfaceLifecycle;
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const row = await loadSurface(slug);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await assertOwnerOrAdmin(row, auth))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const current = parseSurface(row);
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const push = (sql: string, v: unknown) => {
      updates.push(`${sql} = $${idx++}`);
      params.push(v);
    };

    if (body.title != null) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json(
          { error: "Title required", field: "title" },
          { status: 400 },
        );
      }
      push("title", body.title.trim());
    }

    if (body.slug != null) {
      const s = validateSlug(body.slug);
      if (s !== current.slug) {
        const dupe = await pool.query(
          "SELECT 1 FROM knowledge_surfaces WHERE slug = $1 AND id <> $2",
          [s, current.id],
        );
        if (dupe.rows.length) {
          return NextResponse.json(
            { error: "Slug already in use", field: "slug" },
            { status: 409 },
          );
        }
      }
      push("slug", s);
    }

    if (body.template != null) push("template", validateTemplate(body.template));
    if (body.scope != null) {
      push("scope", JSON.stringify(validateScope(body.scope)));
      updates[updates.length - 1] = updates[updates.length - 1] + "::jsonb";
    }

    if (body.access != null) {
      const raw = { ...body.access };
      if (
        raw.kind === "cohort_code" &&
        typeof body.cohort_code_plaintext === "string" &&
        body.cohort_code_plaintext.length > 0
      ) {
        raw.cohort_code_hash = hashCohortCode(body.cohort_code_plaintext);
      } else if (
        raw.kind === "cohort_code" &&
        !raw.cohort_code_hash &&
        current.access.kind === "cohort_code" &&
        current.access.cohort_code_hash
      ) {
        // Preserve existing hash if no new plaintext provided.
        raw.cohort_code_hash = current.access.cohort_code_hash;
      }
      const validated = validateAccess(raw);
      updates.push(`access = $${idx++}::jsonb`);
      params.push(JSON.stringify(validated));
    }

    if (body.overlay != null) {
      updates.push(`overlay = $${idx++}::jsonb`);
      params.push(JSON.stringify(validateOverlay(body.overlay)));
    }
    if (body.layout != null) {
      updates.push(`layout = $${idx++}::jsonb`);
      params.push(JSON.stringify(validateLayout(body.layout)));
    }
    if (body.branding != null) {
      updates.push(`branding = $${idx++}::jsonb`);
      params.push(JSON.stringify(validateBranding(body.branding)));
    }

    let transitioningToPublished = false;
    if (body.lifecycle != null) {
      const lc = validateLifecycle(body.lifecycle);
      push("lifecycle", lc);
      if (lc === "published" && current.lifecycle !== "published") {
        transitioningToPublished = true;
        updates.push(`published_at = NOW()`);
      }
      if (lc === "archived" && current.lifecycle !== "archived") {
        updates.push(`archived_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ surface: current, unchanged: true });
    }

    updates.push(`version = version + 1`);
    updates.push(`updated_at = NOW()`);
    params.push(current.id);

    const { rows: updated } = await pool.query(
      `UPDATE knowledge_surfaces SET ${updates.join(", ")}
         WHERE id = $${idx}
       RETURNING *`,
      params,
    );

    const next = parseSurface(updated[0]);
    const redactedAccess = { ...next.access };
    if (redactedAccess.cohort_code_hash) delete redactedAccess.cohort_code_hash;

    return NextResponse.json({
      surface: { ...next, access: redactedAccess },
      published: transitioningToPublished,
    });
  } catch (err) {
    if (err instanceof SurfaceConfigError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }
    console.error("[admin/surfaces PATCH]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await ctx.params;

  try {
    const row = await loadSurface(slug);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await assertOwnerOrAdmin(row, auth))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(
      `UPDATE knowledge_surfaces
          SET lifecycle = 'archived',
              archived_at = NOW(),
              updated_at = NOW(),
              version = version + 1
        WHERE id = $1`,
      [row.id],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/surfaces DELETE]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
