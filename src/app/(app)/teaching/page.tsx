/**
 * Teaching — editorial cockpit for the Learn system.
 *
 * "Editor" is to the Daily Digest what "Teaching" is to Learn: a single
 * admin surface where you review candidates, author paths + cards, and
 * upload canonical library PDFs that feed the general retrieval substrate.
 *
 * Admin-gated server component. Sections degrade gracefully when the
 * Phase 1 Learn migrations haven't been applied (tables missing).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  DocumentArrowUpIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { requireAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isMissingRelation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "42P01";
}

interface Stats {
  candidates_pending: number;
  candidates_approved: number;
  concept_cards: number;
  concept_cards_reviewed: number;
  paths: number;
  paths_editor: number;
  briefs: number;
  briefs_with_blocks: number;
  library_docs: number;
  library_indexed: number;
  surfaces: number;
  surfaces_published: number;
  migrations_missing: boolean;
}

async function fetchStats(): Promise<Stats> {
  const base: Stats = {
    candidates_pending: 0,
    candidates_approved: 0,
    concept_cards: 0,
    concept_cards_reviewed: 0,
    paths: 0,
    paths_editor: 0,
    briefs: 0,
    briefs_with_blocks: 0,
    library_docs: 0,
    library_indexed: 0,
    surfaces: 0,
    surfaces_published: 0,
    migrations_missing: false,
  };

  const queries: Array<[keyof Stats, string]> = [
    ["candidates_pending", `SELECT COUNT(*)::int AS c FROM concept_card_candidates WHERE status='pending_review'`],
    ["candidates_approved", `SELECT COUNT(*)::int AS c FROM concept_card_candidates WHERE status='approved'`],
    ["concept_cards", `SELECT COUNT(*)::int AS c FROM concept_cards WHERE superseded_by IS NULL`],
    ["concept_cards_reviewed", `SELECT COUNT(*)::int AS c FROM concept_cards WHERE superseded_by IS NULL AND editorial_status IN ('editor_authored','editor_reviewed')`],
    ["paths", `SELECT COUNT(*)::int AS c FROM learning_paths`],
    ["paths_editor", `SELECT COUNT(*)::int AS c FROM learning_paths WHERE editorial_status IN ('editor_authored','editor_reviewed')`],
    ["briefs", `SELECT COUNT(*)::int AS c FROM microsector_briefs`],
    ["briefs_with_blocks", `SELECT COUNT(DISTINCT brief_id)::int AS c FROM microsector_brief_blocks`],
    ["library_docs", `SELECT COUNT(*)::int AS c FROM library_documents WHERE deleted_at IS NULL`],
    ["library_indexed", `SELECT COUNT(*)::int AS c FROM library_documents WHERE deleted_at IS NULL AND indexed_at IS NOT NULL`],
    ["surfaces", `SELECT COUNT(*)::int AS c FROM knowledge_surfaces`],
    ["surfaces_published", `SELECT COUNT(*)::int AS c FROM knowledge_surfaces WHERE lifecycle='published'`],
  ];

  for (const [key, sql] of queries) {
    try {
      const { rows } = await pool.query<{ c: number }>(sql);
      (base[key] as number) = rows[0]?.c ?? 0;
    } catch (err) {
      if (isMissingRelation(err)) {
        base.migrations_missing = true;
      } else {
        console.error("[teaching/stats]", key, err);
      }
    }
  }
  return base;
}

export default async function TeachingCockpitPage() {
  const auth = await requireAuth("admin");
  if ("error" in auth) notFound();
  const stats = await fetchStats();

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
        <header style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              marginBottom: 10,
            }}
          >
            ClimatePulse · Teaching
          </div>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: "-0.4px",
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Teach the substrate.
          </h1>
          <p
            style={{
              marginTop: 10,
              maxWidth: 620,
              fontSize: 15,
              lineHeight: 1.55,
              color: COLORS.inkSec,
            }}
          >
            Review AI-drafted candidates, author cards and paths by hand, and
            upload canonical reference documents (IEA WEO, CER guidance,
            ARENA reports). Everything here feeds the same substrate that
            powers the reader-facing Learn surface.
          </p>
        </header>

        {stats.migrations_missing && (
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
            <strong>Phase 1 Learn migrations not applied.</strong> Some
            sections below show zeroes. Paste{" "}
            <code>scripts/migrations/learn/_APPLY-ALL.sql</code> into the
            Supabase SQL editor and run, then reload.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          <CockpitCard
            icon={<BookOpenIcon width={20} height={20} />}
            title="Library"
            primary={`${stats.library_docs} documents`}
            secondary={`${stats.library_indexed} indexed into RAG`}
            href="/teaching/library"
            cta="Upload + manage"
          />
          <CockpitCard
            icon={<ClipboardDocumentListIcon width={20} height={20} />}
            title="Candidate queue"
            primary={`${stats.candidates_pending} pending`}
            secondary={`${stats.candidates_approved} approved, ready to promote`}
            href="/teaching/candidates"
            cta="Review queue"
          />
          <CockpitCard
            icon={<AcademicCapIcon width={20} height={20} />}
            title="Concept cards"
            primary={`${stats.concept_cards} live`}
            secondary={`${stats.concept_cards_reviewed} editor-reviewed`}
            href="/learn/concepts"
            cta="Browse live cards →"
          />
          <CockpitCard
            icon={<PuzzlePieceIcon width={20} height={20} />}
            title="Learning paths"
            primary={`${stats.paths} total`}
            secondary={`${stats.paths_editor} editor-authored`}
            href="/learn/paths"
            cta="View + author"
          />
          <CockpitCard
            icon={<Squares2X2Icon width={20} height={20} />}
            title="Microsector briefs"
            primary={`${stats.briefs} briefs`}
            secondary={`${stats.briefs_with_blocks} with generated blocks`}
            href="/learn/microsectors"
            cta="View substrate →"
          />
          <CockpitCard
            icon={<DocumentArrowUpIcon width={20} height={20} />}
            title="Knowledge surfaces"
            primary={`${stats.surfaces} surfaces`}
            secondary={`${stats.surfaces_published} published`}
            href="/admin/surfaces"
            cta="Manage surfaces"
          />
        </div>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              marginBottom: 12,
            }}
          >
            Quick actions
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 13,
            }}
          >
            <QuickLink href="/teaching/library">Upload a PDF</QuickLink>
            <QuickLink href="/teaching/candidates">Review candidates</QuickLink>
            <QuickLink href="/admin/surfaces/new">Create a surface</QuickLink>
            <QuickLink href="/learn">View /learn as a reader →</QuickLink>
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              marginBottom: 12,
            }}
          >
            Automation vs. editorial
          </h2>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: COLORS.inkSec,
              maxWidth: 620,
            }}
          >
            Candidates extracted from the briefing corpus and entity registry
            flow into the review queue automatically. You approve, the
            pipeline drafts via Gemini, and the drafts land as{" "}
            <code>ai_drafted</code>. Promote them to{" "}
            <code>editor_reviewed</code> here, or author from scratch — either
            way the same card renders under <code>/learn</code>. Library
            uploads enter the retrieval substrate directly; the digest + Q&amp;A
            can cite them without a separate pipeline.
          </p>
        </section>
      </div>
    </div>
  );
}

function CockpitCard({
  icon,
  title,
  primary,
  secondary,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  primary: string;
  secondary: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        padding: "18px 20px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: COLORS.forest,
          marginBottom: 8,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.forest,
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.15,
          marginBottom: 4,
        }}
      >
        {primary}
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 10 }}>
        {secondary}
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLORS.forest,
        }}
      >
        {cta} →
      </div>
    </Link>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 10px",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        color: COLORS.ink,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
