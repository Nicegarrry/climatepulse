import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/learn/concepts/:slug[?context=<disambiguation_context>]
 *
 * Returns the minimal payload needed to render an inline concept tooltip or
 * the full concept page. When `slug` is ambiguous (multiple disambiguation
 * contexts), the default shape is the top-ranked row (editor_authored >
 * editor_reviewed > ai_drafted) and `alternates` lists the others.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(_req.url);
  const context = url.searchParams.get("context") ?? undefined;

  const { rows } = await pool.query<{
    id: string;
    slug: string;
    term: string;
    abbrev: string | null;
    disambiguation_context: string;
    inline_summary: string;
    full_body: string;
    key_mechanisms: { title: string; body: string }[] | null;
    related_terms: string[];
    visual_type: string;
    visual_spec: Record<string, unknown> | null;
    uncertainty_flags: string[];
    source_citations: { type: string; ref: string; title: string; quote?: string; accessed_at: string }[];
    primary_domain: string | null;
    microsector_ids: number[];
    entity_ids: number[];
    editorial_status: string;
    reviewed_at: string | null;
    ai_drafted: boolean;
    version: number;
    content_hash: string;
    updated_at: string;
  }>(
    `SELECT id, slug, term, abbrev, disambiguation_context, inline_summary, full_body,
            key_mechanisms, related_terms, visual_type, visual_spec,
            uncertainty_flags, source_citations, primary_domain, microsector_ids,
            entity_ids, editorial_status, reviewed_at, ai_drafted, version,
            content_hash, updated_at
       FROM concept_cards
      WHERE slug = $1 AND superseded_by IS NULL
      ORDER BY
        CASE editorial_status
          WHEN 'editor_authored' THEN 0
          WHEN 'editor_reviewed' THEN 1
          WHEN 'previously_reviewed_stale' THEN 2
          WHEN 'ai_drafted' THEN 3
          ELSE 4
        END,
        updated_at DESC`,
    [slug],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const primary = context
    ? (rows.find((r) => r.disambiguation_context === context) ?? rows[0])
    : rows[0];

  const alternates = rows
    .filter((r) => r.id !== primary.id)
    .map((r) => ({
      id: r.id,
      disambiguation_context: r.disambiguation_context,
      primary_domain: r.primary_domain,
    }));

  return NextResponse.json({
    concept: primary,
    alternates,
    ambiguous: rows.length > 1,
  });
}
