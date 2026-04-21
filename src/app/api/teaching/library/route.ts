import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import {
  uploadLibraryDocument,
  indexLibraryDocument,
  LibraryUploadError,
  type LibraryUploadInput,
} from "@/lib/learn/library-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingRelation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "42P01";
}

/**
 * GET /api/teaching/library  →  list all non-deleted library documents
 */
export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, author, publication, published_year,
              file_type, external_url, byte_size,
              primary_domain, microsector_ids, tags,
              indexed_at, indexed_chunks, indexing_skipped, indexing_error,
              uploaded_at
         FROM library_documents
        WHERE deleted_at IS NULL
        ORDER BY uploaded_at DESC
        LIMIT 200`,
    );
    return NextResponse.json({ documents: rows });
  } catch (err) {
    if (isMissingRelation(err)) {
      return NextResponse.json({ documents: [], migrations_missing: true });
    }
    console.error("[teaching/library] list failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * POST /api/teaching/library  →  multipart upload
 *
 * Body fields (all strings unless noted):
 *   title (required)
 *   author, publication, summary, primary_domain, external_url
 *   published_year  (int)
 *   microsector_ids (JSON array of ints)
 *   jurisdictions   (JSON array of strings)
 *   tags            (JSON array of strings)
 *   file            (File — optional if external_url is supplied)
 *   index_now       ("true" | "false", default "true")
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  function parseJsonArray(name: string): unknown[] | undefined {
    const raw = form.get(name);
    if (raw == null) return undefined;
    try {
      const v = JSON.parse(String(raw));
      return Array.isArray(v) ? v : undefined;
    } catch {
      return undefined;
    }
  }

  const meta: LibraryUploadInput = {
    title,
    author: (form.get("author") as string | null)?.trim() || null,
    publication: (form.get("publication") as string | null)?.trim() || null,
    summary: (form.get("summary") as string | null)?.trim() || null,
    primary_domain:
      (form.get("primary_domain") as string | null)?.trim() || null,
    external_url: (form.get("external_url") as string | null)?.trim() || null,
    published_year: form.get("published_year")
      ? Number(form.get("published_year"))
      : null,
    microsector_ids: (parseJsonArray("microsector_ids") ?? []) as number[],
    jurisdictions: (parseJsonArray("jurisdictions") ?? []) as string[],
    tags: (parseJsonArray("tags") ?? []) as string[],
  };

  const fileValue = form.get("file");
  let filePayload: { bytes: Buffer; filename: string; content_type: string } | null = null;
  if (fileValue && fileValue instanceof File && fileValue.size > 0) {
    const ab = await fileValue.arrayBuffer();
    filePayload = {
      bytes: Buffer.from(ab),
      filename: fileValue.name || "upload",
      content_type: fileValue.type || "application/octet-stream",
    };
  }

  const indexNow = String(form.get("index_now") ?? "true") !== "false";

  try {
    const uploaded = await uploadLibraryDocument(
      meta,
      filePayload,
      auth.user.id,
    );
    let indexed: { chunks: number; skipped: boolean; skip_reason?: string } | null = null;
    if (indexNow && !uploaded.indexing_skipped && filePayload) {
      try {
        const res = await indexLibraryDocument(uploaded.id);
        indexed = {
          chunks: res.chunks,
          skipped: res.skipped,
          skip_reason: res.skip_reason,
        };
      } catch (err) {
        console.error("[teaching/library] indexing failed:", err);
      }
    }
    return NextResponse.json({ document: uploaded, indexed });
  } catch (err) {
    if (err instanceof LibraryUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (isMissingRelation(err)) {
      return NextResponse.json(
        { error: "library_documents table missing — apply migration 050" },
        { status: 503 },
      );
    }
    console.error("[teaching/library] upload failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
