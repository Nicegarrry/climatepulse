import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import {
  hardDeleteLibraryDocument,
  indexLibraryDocument,
  LibraryUploadError,
} from "@/lib/learn/library-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/teaching/library/:id  →  hard delete (blob + embeddings + row)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  try {
    const result = await hardDeleteLibraryDocument(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LibraryUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[teaching/library] delete failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * POST /api/teaching/library/:id/reindex  (noted as POST on the same path
 * with query ?action=reindex since Next App Router doesn't support
 * arbitrary verb routing without an extra path segment — so we mount reindex
 * as a POST on the same :id resource).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "reindex") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  try {
    const result = await indexLibraryDocument(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LibraryUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[teaching/library] reindex failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
