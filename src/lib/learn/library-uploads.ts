/**
 * Library document upload + indexing.
 *
 * Canonical reference PDFs (IEA WEO, CER guidance, ARENA reports, etc.) that
 * feed the general retrieval substrate — NOT tied to any particular knowledge
 * surface. Writes to `library_documents` and indexes chunks into
 * `content_embeddings` with `content_type='report_pdf'` and
 * `metadata.library_document_id` set.
 *
 * Storage mirrors src/lib/surfaces/uploads.ts (Vercel Blob in prod, local
 * fallback in dev). Size cap 50 MB.
 *
 * PDF text extraction is deferred — uploads land with `indexing_skipped=true`
 * and `file_type='pdf'`. Text / markdown / HTML upload paths index inline.
 * When a PDF extractor ships, re-run `indexLibraryDocument` for the backlog.
 */
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import pool from "@/lib/db";
import { chunkText } from "@/lib/intelligence/chunker";
import { embedQuery } from "@/lib/intelligence/embedder";

export const MAX_LIBRARY_UPLOAD_BYTES = 50 * 1024 * 1024;

export const LIBRARY_ALLOWED_CONTENT_TYPES: ReadonlyArray<string> = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
];

export type LibraryFileType = "pdf" | "markdown" | "text" | "html";

export interface LibraryUploadInput {
  title: string;
  author?: string | null;
  publication?: string | null;
  published_year?: number | null;
  summary?: string | null;
  primary_domain?: string | null;
  microsector_ids?: number[];
  jurisdictions?: string[];
  tags?: string[];
  external_url?: string | null;
}

export interface LibraryFileInput {
  bytes: Buffer | Uint8Array;
  filename: string;
  content_type: string;
}

export interface LibraryUploadResult {
  id: string;
  slug: string;
  title: string;
  file_type: LibraryFileType;
  blob_url: string | null;
  blob_path: string | null;
  byte_size: number;
  indexing_skipped: boolean;
}

export class LibraryUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LibraryUploadError";
  }
}

function slugify(input: string, suffix = randomUUID().slice(0, 8)): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "library"}-${suffix}`;
}

function fileTypeFromContentType(ct: string): LibraryFileType {
  if (ct === "application/pdf") return "pdf";
  if (ct === "text/markdown") return "markdown";
  if (ct === "text/html") return "html";
  return "text";
}

function sanitiseFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "file";
}

async function putToBlob(
  blobPath: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<{ url: string }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const result = await put(blobPath, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { url: result.url };
  }
  const dir = join(
    process.cwd(),
    "public",
    "library-uploads",
    ...blobPath.split("/").slice(0, -1),
  );
  await mkdir(dir, { recursive: true });
  const name = blobPath.split("/").pop() ?? "file";
  await writeFile(join(dir, name), Buffer.from(bytes));
  return { url: `/library-uploads/${blobPath}` };
}

async function readFromBlob(
  blobUrl: string | null,
  blobPath: string | null,
): Promise<Buffer | null> {
  if (!blobUrl && !blobPath) return null;
  if (blobUrl && /^https?:\/\//.test(blobUrl)) {
    try {
      const res = await fetch(blobUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  if (blobPath) {
    try {
      return await readFile(
        join(process.cwd(), "public", "library-uploads", blobPath),
      );
    } catch {
      return null;
    }
  }
  return null;
}

async function deleteFromBlob(
  blobUrl: string | null,
  blobPath: string | null,
): Promise<boolean> {
  if (process.env.BLOB_READ_WRITE_TOKEN && blobUrl && /^https?:\/\//.test(blobUrl)) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blobUrl);
      return true;
    } catch {
      return false;
    }
  }
  if (blobPath) {
    try {
      await unlink(join(process.cwd(), "public", "library-uploads", blobPath));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function uploadLibraryDocument(
  meta: LibraryUploadInput,
  file: LibraryFileInput | null,
  uploaderUserId: string,
): Promise<LibraryUploadResult> {
  if (!meta.title || !meta.title.trim()) {
    throw new LibraryUploadError("title is required", 400);
  }
  if (!file && !meta.external_url) {
    throw new LibraryUploadError("provide either a file or external_url", 400);
  }

  let blobUrl: string | null = null;
  let blobPath: string | null = null;
  let byteSize = 0;
  let fileType: LibraryFileType = "text";

  if (file) {
    const ct = (file.content_type || "").toLowerCase();
    if (!LIBRARY_ALLOWED_CONTENT_TYPES.includes(ct)) {
      throw new LibraryUploadError(
        `content_type not allowed: ${ct}. Allowed: ${LIBRARY_ALLOWED_CONTENT_TYPES.join(", ")}`,
        415,
      );
    }
    if (file.bytes.length === 0) {
      throw new LibraryUploadError("empty file", 400);
    }
    if (file.bytes.length > MAX_LIBRARY_UPLOAD_BYTES) {
      throw new LibraryUploadError(
        `file exceeds ${MAX_LIBRARY_UPLOAD_BYTES} bytes`,
        413,
      );
    }
    fileType = fileTypeFromContentType(ct);
    byteSize = file.bytes.length;

    const safeName = sanitiseFilename(file.filename);
    const id = randomUUID();
    blobPath = `library/${id}/${safeName}`;
    const { url } = await putToBlob(blobPath, file.bytes, ct);
    blobUrl = url;
  } else if (meta.external_url) {
    const lower = meta.external_url.toLowerCase();
    if (lower.endsWith(".pdf")) fileType = "pdf";
    else if (lower.endsWith(".md")) fileType = "markdown";
    else if (lower.endsWith(".html") || lower.endsWith(".htm")) fileType = "html";
    else fileType = "text";
  }

  const slug = slugify(meta.title);
  const indexingSkipped = fileType === "pdf";

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO library_documents (
       slug, title, author, publication, published_year, summary,
       file_type, blob_url, blob_path, external_url, byte_size,
       primary_domain, microsector_ids, jurisdictions, tags,
       indexing_skipped, uploaded_by, editorial_status
     ) VALUES ($1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11,
               $12, $13, $14, $15,
               $16, $17, 'editor_authored')
     RETURNING id`,
    [
      slug,
      meta.title.trim(),
      meta.author ?? null,
      meta.publication ?? null,
      meta.published_year ?? null,
      meta.summary ?? null,
      fileType,
      blobUrl,
      blobPath,
      meta.external_url ?? null,
      byteSize,
      meta.primary_domain ?? null,
      meta.microsector_ids ?? [],
      meta.jurisdictions ?? [],
      meta.tags ?? [],
      indexingSkipped,
      uploaderUserId,
    ],
  );

  return {
    id: rows[0].id,
    slug,
    title: meta.title.trim(),
    file_type: fileType,
    blob_url: blobUrl,
    blob_path: blobPath,
    byte_size: byteSize,
    indexing_skipped: indexingSkipped,
  };
}

export interface IndexLibraryResult {
  id: string;
  chunks: number;
  skipped: boolean;
  skip_reason?: string;
}

export async function indexLibraryDocument(
  libraryDocId: string,
): Promise<IndexLibraryResult> {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    file_type: LibraryFileType;
    blob_url: string | null;
    blob_path: string | null;
    primary_domain: string | null;
    microsector_ids: number[];
    jurisdictions: string[];
    tags: string[];
  }>(
    `SELECT id, title, file_type, blob_url, blob_path, primary_domain,
            microsector_ids, jurisdictions, tags
       FROM library_documents WHERE id = $1 AND deleted_at IS NULL`,
    [libraryDocId],
  );
  const doc = rows[0];
  if (!doc) throw new LibraryUploadError("library document not found", 404);

  if (doc.file_type === "pdf") {
    await pool.query(
      `UPDATE library_documents
          SET indexing_skipped = TRUE,
              indexing_error = 'pdf_extraction_not_implemented'
        WHERE id = $1`,
      [libraryDocId],
    );
    return {
      id: libraryDocId,
      chunks: 0,
      skipped: true,
      skip_reason: "pdf_extraction_not_implemented",
    };
  }

  const buf = await readFromBlob(doc.blob_url, doc.blob_path);
  if (!buf) {
    await pool.query(
      `UPDATE library_documents SET indexing_error = 'source_not_readable' WHERE id = $1`,
      [libraryDocId],
    );
    throw new LibraryUploadError("source not readable", 500);
  }

  const raw = buf.toString("utf8");
  if (!raw.trim()) {
    return { id: libraryDocId, chunks: 0, skipped: true, skip_reason: "empty" };
  }

  await pool.query(
    `DELETE FROM content_embeddings
       WHERE content_type = 'report_pdf' AND source_id = $1`,
    [libraryDocId],
  );

  const chunks = chunkText(raw, { prefix: doc.title });
  let inserted = 0;
  for (const chunk of chunks) {
    let embedding: number[];
    try {
      embedding = await embedQuery(chunk.text);
    } catch (err) {
      console.error(
        `[library-uploads] embed failed for chunk ${chunk.chunk_index} of ${libraryDocId}:`,
        err,
      );
      continue;
    }
    const vector = `[${embedding.join(",")}]`;
    await pool.query(
      `INSERT INTO content_embeddings (
         content_type, source_id, chunk_index, chunk_text, embedding,
         primary_domain, microsector_ids, jurisdictions, metadata
       ) VALUES ('report_pdf', $1, $2, $3, $4::vector, $5, $6, $7, $8::jsonb)
       ON CONFLICT (content_type, source_id, chunk_index) DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata`,
      [
        libraryDocId,
        chunk.chunk_index,
        chunk.text,
        vector,
        doc.primary_domain,
        doc.microsector_ids,
        doc.jurisdictions,
        JSON.stringify({
          library_document_id: libraryDocId,
          title: doc.title,
          tags: doc.tags,
        }),
      ],
    );
    inserted++;
  }

  await pool.query(
    `UPDATE library_documents
        SET indexed_at = NOW(),
            indexed_chunks = $2,
            indexing_error = NULL,
            indexing_skipped = FALSE
      WHERE id = $1`,
    [libraryDocId, inserted],
  );
  return { id: libraryDocId, chunks: inserted, skipped: false };
}

export async function hardDeleteLibraryDocument(
  libraryDocId: string,
): Promise<{ embeddings_deleted: number; blob_deleted: boolean }> {
  const { rows } = await pool.query<{
    blob_url: string | null;
    blob_path: string | null;
  }>(
    `SELECT blob_url, blob_path FROM library_documents WHERE id = $1`,
    [libraryDocId],
  );
  const doc = rows[0];
  if (!doc) throw new LibraryUploadError("library document not found", 404);

  const { rowCount: embDel } = await pool.query(
    `DELETE FROM content_embeddings
       WHERE content_type = 'report_pdf' AND source_id = $1`,
    [libraryDocId],
  );
  const blobDeleted = await deleteFromBlob(doc.blob_url, doc.blob_path);

  await pool.query(
    `UPDATE library_documents
        SET deleted_at = NOW(), blob_url = NULL, blob_path = NULL
      WHERE id = $1`,
    [libraryDocId],
  );

  return { embeddings_deleted: embDel ?? 0, blob_deleted: blobDeleted };
}
