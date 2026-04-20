/**
 * DELETE /api/admin/surfaces/:slug/uploads/:contentId — hard delete.
 *
 * Purges embeddings, deletes Blob (best effort), soft-deletes the row, and
 * audits into knowledge_surface_analytics. Owner or global admin only.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { fetchSurfaceBySlug } from "@/lib/surfaces/access";
import { hardDelete, UploadError } from "@/lib/surfaces/uploads";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; contentId: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug, contentId } = await params;

  const surface = await fetchSurfaceBySlug(slug);
  if (!surface) {
    return NextResponse.json({ error: "Surface not found" }, { status: 404 });
  }
  const userRole = auth.profile.user_role ?? "reader";
  if (surface.owner_user_id !== auth.user.id && userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await hardDelete(contentId, auth.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(
      `[api/admin/surfaces/${slug}/uploads/${contentId}] delete failed:`,
      err,
    );
    return NextResponse.json(
      { error: "delete_failed", detail: String(err) },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
