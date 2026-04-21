import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { requireAuth } from "@/lib/supabase/server";
import { LibraryUploadForm } from "./LibraryUploadForm";
import { LibraryRowActions } from "./LibraryRowActions";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  publication: string | null;
  published_year: number | null;
  file_type: string;
  external_url: string | null;
  byte_size: number | null;
  primary_domain: string | null;
  tags: string[];
  indexed_at: string | null;
  indexed_chunks: number;
  indexing_skipped: boolean;
  indexing_error: string | null;
  uploaded_at: string;
}

async function fetchRows(): Promise<{ rows: Row[]; migrationsMissing: boolean }> {
  try {
    const { rows } = await pool.query<Row>(
      `SELECT id, slug, title, author, publication, published_year,
              file_type, external_url, byte_size,
              primary_domain, tags,
              indexed_at::text AS indexed_at, indexed_chunks,
              indexing_skipped, indexing_error,
              uploaded_at::text AS uploaded_at
         FROM library_documents
        WHERE deleted_at IS NULL
        ORDER BY uploaded_at DESC
        LIMIT 200`,
    );
    return { rows, migrationsMissing: false };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "42P01") {
      return { rows: [], migrationsMissing: true };
    }
    throw err;
  }
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`;
}

export default async function LibraryPage() {
  const auth = await requireAuth("admin");
  if ("error" in auth) notFound();

  const { rows, migrationsMissing } = await fetchRows();
  const indexed = rows.filter((r) => r.indexed_at).length;
  const pdfs = rows.filter((r) => r.file_type === "pdf").length;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.ink }}>
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "40px 24px 72px",
          fontFamily: FONTS.sans,
        }}
      >
        <nav
          style={{
            fontSize: 12,
            color: COLORS.inkMuted,
            marginBottom: 18,
          }}
        >
          <Link href="/teaching" style={{ color: COLORS.inkMuted }}>
            Teaching
          </Link>
          {" · "}Library
        </nav>
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 36,
              fontWeight: 500,
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            Library
          </h1>
          <p
            style={{
              marginTop: 8,
              color: COLORS.inkSec,
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Canonical reference documents — IEA WEO, CER guidance, ARENA
            reports, peer-reviewed papers. Text / Markdown / HTML are indexed
            inline and become retrievable immediately. PDFs are stored and
            catalogued; text extraction ships in a follow-up so PDF uploads
            currently land with <code>indexing_skipped</code> until the
            extractor is wired.
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 16,
              fontSize: 12,
              color: COLORS.inkMuted,
            }}
          >
            <span>{rows.length} documents</span>
            <span>· {indexed} indexed</span>
            <span>· {pdfs} PDFs</span>
          </div>
        </header>

        {migrationsMissing && (
          <div
            style={{
              padding: "16px 18px",
              background: COLORS.plumLight,
              border: `1px solid ${COLORS.plum}`,
              color: COLORS.plum,
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 24,
            }}
          >
            <strong>
              <code>library_documents</code> table missing.
            </strong>{" "}
            Apply{" "}
            <code>scripts/migrations/learn/050-library-documents.sql</code>{" "}
            against <code>$DATABASE_URL</code> (and the Phase 1 migrations
            too, if not already), then reload.
          </div>
        )}

        <section
          style={{
            marginBottom: 32,
            padding: "24px",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
          }}
        >
          <h2
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              margin: "0 0 14px",
            }}
          >
            Upload a document
          </h2>
          <LibraryUploadForm />
        </section>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "24px",
              border: `1px solid ${COLORS.borderLight}`,
              background: COLORS.paperDark,
              fontSize: 13,
              color: COLORS.inkSec,
            }}
          >
            No library documents yet. Upload your first report above.
          </div>
        ) : (
          <div style={{ border: `1px solid ${COLORS.borderLight}` }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 90px 120px 80px 120px",
                gap: 12,
                padding: "10px 16px",
                background: COLORS.paperDark,
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
                borderBottom: `1px solid ${COLORS.borderLight}`,
              }}
            >
              <span>Title</span>
              <span>Author / publication</span>
              <span>Type</span>
              <span>Indexed</span>
              <span>Size</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {rows.map((r) => {
              const subtitle = [r.author, r.publication, r.published_year]
                .filter(Boolean)
                .join(" · ");
              const indexedLabel = r.indexed_at
                ? `${r.indexed_chunks} chunks`
                : r.indexing_skipped
                  ? "skipped"
                  : r.indexing_error
                    ? "error"
                    : "pending";
              return (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 90px 120px 80px 120px",
                    gap: 12,
                    padding: "14px 16px",
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                    fontSize: 13,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 16, fontWeight: 500 }}>
                      {r.title}
                    </div>
                    {r.tags.length > 0 && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: COLORS.inkMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {r.tags.join(" · ")}
                      </div>
                    )}
                  </div>
                  <div style={{ color: COLORS.inkSec }}>{subtitle || "—"}</div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: COLORS.inkSec,
                    }}
                  >
                    {r.file_type}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        r.indexed_at
                          ? COLORS.forest
                          : r.indexing_error
                            ? COLORS.plum
                            : COLORS.inkMuted,
                    }}
                  >
                    {indexedLabel}
                  </div>
                  <div style={{ color: COLORS.inkMuted, fontSize: 12 }}>
                    {formatBytes(r.byte_size)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <LibraryRowActions
                      id={r.id}
                      canReindex={r.file_type !== "pdf"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
