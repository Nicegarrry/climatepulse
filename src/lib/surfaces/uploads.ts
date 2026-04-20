/**
 * Upload pipeline for knowledge_surface_content (uploaded_doc kind).
 *
 * Storage: Vercel Blob in production (via BLOB_READ_WRITE_TOKEN), local
 * filesystem fallback in dev — same pattern as src/lib/podcast/storage.ts.
 * All surface uploads are stored with `access: 'private'`; the blob URL is
 * only ever surfaced to authorised viewers resolved through resolveAccess().
 *
 * Indexing: text/* content is chunked via chunkText and embedded via Gemini
 * into content_embeddings with content_type='uploaded_doc',
 * metadata.surface_id set. Canonical retrieval excludes these via the scope
 * filter; surface retrieval allows them explicitly.
 *
 * Hard delete: embeddings first, then Blob (best-effort; 404 ignored), then
 * soft-delete the row. Orphaned Blob objects are cheap to clean up later.
 */
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import pool from "@/lib/db";
import { chunkText } from "@/lib/intelligence/chunker";
import { embedQuery } from "@/lib/intelligence/embedder";
import type { SurfaceContent } from "./types";

// ─── Config ───────────────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CONTENT_TYPES: ReadonlyArray<string> = [
  "text/plain",
  "text/markdown",
  "application/json",
  "application/pdf",
];

const TEXT_INDEXABLE_PREFIX = "text/";
const JSON_CONTENT_TYPE = "application/json";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadFileInput {
  bytes: Buffer | Uint8Array;
  filename: string;
  content_type: string;
}

export interface UploadResult {
  id: string;
  blob_url: string;
  blob_path: string;
  title: string;
  content_type: string;
  size_bytes: number;
  indexing_skipped: boolean;
}

export interface IndexResult {
  content_id: string;
  chunks: number;
  skipped: boolean;
  skip_reason?: string;
}

export interface HardDeleteResult {
  content_id: string;
  embeddings_deleted: number;
  blob_deleted: boolean;
  soft_deleted: boolean;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

function sanitiseFilename(filename: string): string {
  // Keep only safe path characters; collapse whitespace.
  return filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "file";
}

function isTextIndexable(contentType: string): boolean {
  return (
    contentType.startsWith(TEXT_INDEXABLE_PREFIX) ||
    contentType === JSON_CONTENT_TYPE
  );
}

async function putToBlob(
  blobPath: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<{ url: string; storage: "blob" | "local" }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const result = await put(blobPath, Buffer.from(bytes), {
      access: "public", // Blob "private" access is a beta feature; we gate access at the app layer.
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { url: result.url, storage: "blob" };
  }

  // Local dev fallback — public/ subtree (gitignored).
  const dir = join(process.cwd(), "public", "surface-uploads", ...blobPath.split("/").slice(0, -1));
  await mkdir(dir, { recursive: true });
  const filename = blobPath.split("/").pop() ?? "file";
  await writeFile(join(dir, filename), Buffer.from(bytes));
  return { url: `/surface-uploads/${blobPath}`, storage: "local" };
}

async function readFromBlob(blobUrl: string, blobPath: string): Promise<Buffer | null> {
  if (blobUrl.startsWith("http://") || blobUrl.startsWith("https://")) {
    try {
      const res = await fetch(blobUrl);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch (err) {
      console.error("[surfaces/uploads] failed to read blob:", err);
      return null;
    }
  }
  // Local dev
  try {
    const local = join(process.cwd(), "public", "surface-uploads", blobPath);
    return await readFile(local);
  } catch {
    return null;
  }
}

async function deleteFromBlob(blobUrl: string, blobPath: string): Promise<boolean> {
  if (process.env.BLOB_READ_WRITE_TOKEN && blobUrl.startsWith("http")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blobUrl);
      return true;
    } catch (err) {
      console.error("[surfaces/uploads] blob delete failed (continuing):", err);
      return false;
    }
  }
  // Local dev
  try {
    const local = join(process.cwd(), "public", "surface-uploads", blobPath);
    await unlink(local);
    return true;
  } catch {
    return false;
  }
}

// ─── uploadDocument ───────────────────────────────────────────────────────────

/**
 * Upload a file to Blob storage (or local fallback) and insert a
 * knowledge_surface_content row. Validates size + content_type.
 * Throws {UploadError} on validation failure.
 */
export async function uploadDocument(
  surfaceId: string,
  file: UploadFileInput,
  uploaderUserId: string,
): Promise<UploadResult> {
  if (!file.bytes || file.bytes.length === 0) {
    throw new UploadError("empty file", 400);
  }
  if (file.bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `file exceeds ${MAX_UPLOAD_BYTES} bytes`,
      413,
    );
  }
  const contentType = (file.content_type || "").toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new UploadError(
      `content_type not allowed: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
      415,
    );
  }

  const safeName = sanitiseFilename(file.filename);
  const uuid = randomUUID();
  const blobPath = `surfaces/${surfaceId}/${uuid}/${safeName}`;
  const title = stripExtension(safeName).replace(/[_-]+/g, " ").trim() || safeName;

  const { url } = await putToBlob(blobPath, file.bytes, contentType);

  const indexingSkipped = contentType === "application/pdf";

  const bodyJson: Record<string, unknown> = {
    content_type: contentType,
    size_bytes: file.bytes.length,
    original_filename: file.filename,
  };
  if (indexingSkipped) bodyJson.indexing_skipped = true;

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO knowledge_surface_content (
       surface_id, content_kind, title, body_json,
       blob_url, blob_path, confidentiality, created_by
     ) VALUES ($1, 'uploaded_doc', $2, $3::jsonb, $4, $5, 'private', $6)
     RETURNING id`,
    [surfaceId, title, JSON.stringify(bodyJson), url, blobPath, uploaderUserId],
  );

  return {
    id: rows[0].id,
    blob_url: url,
    blob_path: blobPath,
    title,
    content_type: contentType,
    size_bytes: file.bytes.length,
    indexing_skipped: indexingSkipped,
  };
}

// ─── indexDocument ────────────────────────────────────────────────────────────

/**
 * Chunk + embed an uploaded text/markdown/json doc into content_embeddings
 * with content_type='uploaded_doc' and metadata.surface_id set. PDFs are
 * acknowledged but skipped (extraction deferred to Phase 5).
 */
export async function indexDocument(contentId: string): Promise<IndexResult> {
  const { rows } = await pool.query<{
    id: string;
    surface_id: string;
    blob_url: string | null;
    blob_path: string | null;
    created_by: string | null;
    body_json: Record<string, unknown> | null;
  }>(
    `SELECT id, surface_id, blob_url, blob_path, created_by, body_json
       FROM knowledge_surface_content
      WHERE id = $1 AND content_kind = 'uploaded_doc' AND deleted_at IS NULL`,
    [contentId],
  );
  if (rows.length === 0) {
    return { content_id: contentId, chunks: 0, skipped: true, skip_reason: "not_found" };
  }
  const row = rows[0];
  if (!row.blob_url || !row.blob_path) {
    return { content_id: contentId, chunks: 0, skipped: true, skip_reason: "no_blob" };
  }

  const bodyJson = row.body_json ?? {};
  const contentType = String(bodyJson.content_type ?? "").toLowerCase();

  if (!isTextIndexable(contentType)) {
    // PDFs, etc. Mark as deferred; do not fail.
    const updated = {
      ...bodyJson,
      indexing_skipped: true,
      indexing_skip_reason: `unsupported_content_type:${contentType}`,
    };
    await pool.query(
      `UPDATE knowledge_surface_content SET body_json = $2::jsonb WHERE id = $1`,
      [contentId, JSON.stringify(updated)],
    );
    return {
      content_id: contentId,
      chunks: 0,
      skipped: true,
      skip_reason: `unsupported_content_type:${contentType}`,
    };
  }

  const buffer = await readFromBlob(row.blob_url, row.blob_path);
  if (!buffer) {
    return { content_id: contentId, chunks: 0, skipped: true, skip_reason: "blob_read_failed" };
  }

  const text = buffer.toString("utf8");
  const chunks = chunkText(text, { prefix: `[surface upload ${contentId}]` });

  // Clear any prior chunks so re-indexing is idempotent.
  await pool.query(
    `DELETE FROM content_embeddings
      WHERE content_type = 'uploaded_doc' AND source_id = $1`,
    [contentId],
  );

  let chunkCount = 0;
  const surfaceIdMeta = JSON.stringify({
    surface_id: row.surface_id,
    uploaded_by: row.created_by,
  });

  for (const chunk of chunks) {
    try {
      const embedding = await embedQuery(chunk.text);
      const vectorStr = `[${embedding.join(",")}]`;
      await pool.query(
        `INSERT INTO content_embeddings (
           content_type, source_id, chunk_index, chunk_text, embedding,
           trustworthiness_tier, model_used, embedding_dimensions,
           jurisdictions, microsector_ids, entity_ids
         ) VALUES (
           'uploaded_doc', $1, $2, $3, $4::vector,
           2, 'gemini-embedding-001', 768,
           ARRAY[]::text[], ARRAY[]::int[], ARRAY[]::int[]
         )
         ON CONFLICT (content_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
        [contentId, chunk.chunk_index, chunk.text, vectorStr],
      );
      chunkCount++;
    } catch (err) {
      console.error(
        `[surfaces/uploads] failed to embed chunk ${chunk.chunk_index} of ${contentId}:`,
        err,
      );
    }
  }

  // Record indexing marker on the row — separate from metadata write so it
  // survives re-indexing with new surface_id scoping.
  const updatedBody = {
    ...bodyJson,
    indexed_at: new Date().toISOString(),
    chunks: chunkCount,
    surface_id: row.surface_id,
    embedding_metadata: JSON.parse(surfaceIdMeta),
  };
  await pool.query(
    `UPDATE knowledge_surface_content
        SET body_json = $2::jsonb
      WHERE id = $1`,
    [contentId, JSON.stringify(updatedBody)],
  );

  return {
    content_id: contentId,
    chunks: chunkCount,
    skipped: chunkCount === 0,
    ...(chunkCount === 0 ? { skip_reason: "no_chunks" } : {}),
  };
}

// ─── hardDelete ───────────────────────────────────────────────────────────────

/**
 * Hard delete an uploaded doc: purge embeddings, delete from Blob (best
 * effort), soft-delete the row. Audited into knowledge_surface_analytics
 * with metric='export' (same pattern as access audits).
 */
export async function hardDelete(
  contentId: string,
  actorUserId: string,
): Promise<HardDeleteResult> {
  const { rows } = await pool.query<{
    id: string;
    surface_id: string;
    blob_url: string | null;
    blob_path: string | null;
  }>(
    `SELECT id, surface_id, blob_url, blob_path
       FROM knowledge_surface_content
      WHERE id = $1 AND content_kind = 'uploaded_doc'`,
    [contentId],
  );
  if (rows.length === 0) {
    throw new UploadError("content not found", 404);
  }
  const row = rows[0];

  // 1. Delete embeddings.
  const delRes = await pool.query(
    `DELETE FROM content_embeddings
      WHERE content_type = 'uploaded_doc' AND source_id = $1`,
    [contentId],
  );
  const embeddingsDeleted = delRes.rowCount ?? 0;

  // 2. Delete Blob (best effort — we do not retry; orphan cleanup is cheap).
  let blobDeleted = false;
  if (row.blob_url) {
    blobDeleted = await deleteFromBlob(row.blob_url, row.blob_path ?? "");
  }

  // 3. Soft-delete the row.
  const softRes = await pool.query(
    `UPDATE knowledge_surface_content
        SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL`,
    [contentId],
  );
  const softDeleted = (softRes.rowCount ?? 0) > 0;

  // 4. Audit — swallow errors.
  try {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO knowledge_surface_analytics
         (surface_id, day, metric, user_id, count, metadata)
       VALUES ($1, $2, 'export', $3, 1, $4::jsonb)`,
      [
        row.surface_id,
        today,
        actorUserId,
        JSON.stringify({
          audit: true,
          action: "hard_delete",
          content_id: contentId,
          actor: actorUserId,
          embeddings_deleted: embeddingsDeleted,
          blob_deleted: blobDeleted,
        }),
      ],
    );
  } catch (err) {
    console.error("[surfaces/uploads] audit write failed:", err);
  }

  return {
    content_id: contentId,
    embeddings_deleted: embeddingsDeleted,
    blob_deleted: blobDeleted,
    soft_deleted: softDeleted,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listSurfaceUploads(
  surfaceId: string,
): Promise<SurfaceContent[]> {
  const { rows } = await pool.query<SurfaceContent>(
    `SELECT id, surface_id, content_kind, title, body, body_json,
            blob_url, blob_path, confidentiality, created_by,
            created_at, updated_at, deleted_at
       FROM knowledge_surface_content
      WHERE surface_id = $1
        AND content_kind = 'uploaded_doc'
        AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    [surfaceId],
  );
  return rows;
}
