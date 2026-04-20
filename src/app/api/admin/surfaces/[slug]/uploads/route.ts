/**
 * POST /api/admin/surfaces/:slug/uploads — multipart upload of a surface-private doc.
 * GET  /api/admin/surfaces/:slug/uploads — list active uploads for the surface.
 *
 * Authorisation: requireAuth, plus the caller must be the surface owner OR
 * have the global admin role. Everyone else gets 403.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { fetchSurfaceBySlug } from "@/lib/surfaces/access";
import {
  uploadDocument,
  indexDocument,
  listSurfaceUploads,
  MAX_UPLOAD_BYTES,
  ALLOWED_CONTENT_TYPES,
  UploadError,
} from "@/lib/surfaces/uploads";

async function requireSurfaceAdmin(
  slug: string,
  userId: string,
  userRole: string,
) {
  const surface = await fetchSurfaceBySlug(slug);
  if (!surface) {
    return { error: "Surface not found", status: 404 as const };
  }
  if (surface.owner_user_id !== userId && userRole !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { surface };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await params;

  const guard = await requireSurfaceAdmin(slug, auth.user.id, auth.profile.user_role ?? "reader");
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { surface } = guard;

  // Multipart parsing. Next 16 App Router supports request.formData().
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "invalid multipart body", detail: String(err) },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "missing 'file' field" },
      { status: 400 },
    );
  }

  // file is a Blob/File — read bytes and metadata.
  const filename = (file as File).name || "upload";
  const contentType =
    (file as File).type || "application/octet-stream";
  const size = (file as File).size ?? 0;

  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `file exceeds ${MAX_UPLOAD_BYTES} bytes` },
      { status: 413 },
    );
  }
  if (!ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    return NextResponse.json(
      {
        error: `content_type not allowed: ${contentType}`,
        allowed: ALLOWED_CONTENT_TYPES,
      },
      { status: 415 },
    );
  }

  const arrayBuffer = await (file as Blob).arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  try {
    const uploadResult = await uploadDocument(
      surface.id,
      { bytes, filename, content_type: contentType },
      auth.user.id,
    );

    // Inline indexing — the first shipping path is synchronous so the admin
    // gets immediate feedback. Future: move to a background queue.
    let indexResult;
    try {
      indexResult = await indexDocument(uploadResult.id);
    } catch (err) {
      console.error(`[api/admin/surfaces/${slug}/uploads] indexing failed:`, err);
      indexResult = { content_id: uploadResult.id, chunks: 0, skipped: true, skip_reason: "index_error" };
    }

    return NextResponse.json(
      {
        ok: true,
        upload: uploadResult,
        indexing: indexResult,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[api/admin/surfaces/${slug}/uploads] upload failed:`, err);
    return NextResponse.json(
      { error: "upload_failed", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await params;

  const guard = await requireSurfaceAdmin(slug, auth.user.id, auth.profile.user_role ?? "reader");
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const rows = await listSurfaceUploads(guard.surface.id);
    return NextResponse.json({ uploads: rows });
  } catch (err) {
    console.error(`[api/admin/surfaces/${slug}/uploads] list failed:`, err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

// Force Node runtime — @vercel/blob and pg both require Node APIs, and
// uploads handle binary bodies up to 10 MB.
export const runtime = "nodejs";
