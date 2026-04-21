import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { requireAuth } from "@/lib/supabase/server";
import { CandidateActions } from "./CandidateActions";

export const dynamic = "force-dynamic";

interface Candidate {
  id: string;
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  proposed_inline_summary: string | null;
  extraction_source: string;
  signal_count: number;
  status: "pending_review" | "approved" | "rejected" | "promoted";
  created_at: string;
}

async function fetchCandidates(): Promise<{
  pending: Candidate[];
  approved: Candidate[];
  promoted: Candidate[];
  migrationsMissing: boolean;
}> {
  try {
    const { rows } = await pool.query<Candidate>(
      `SELECT id, term, abbrev, disambiguation_context, proposed_inline_summary,
              extraction_source, signal_count, status,
              created_at::text AS created_at
         FROM concept_card_candidates
        WHERE status IN ('pending_review','approved','promoted')
        ORDER BY status, signal_count DESC, created_at DESC
        LIMIT 300`,
    );
    return {
      pending: rows.filter((r) => r.status === "pending_review"),
      approved: rows.filter((r) => r.status === "approved"),
      promoted: rows.filter((r) => r.status === "promoted"),
      migrationsMissing: false,
    };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "42P01") {
      return { pending: [], approved: [], promoted: [], migrationsMissing: true };
    }
    throw err;
  }
}

export default async function CandidatesPage() {
  const auth = await requireAuth("admin");
  if ("error" in auth) notFound();

  const { pending, approved, promoted, migrationsMissing } = await fetchCandidates();

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
        <nav style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 18 }}>
          <Link href="/teaching" style={{ color: COLORS.inkMuted }}>
            Teaching
          </Link>
          {" · "}Candidate queue
        </nav>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 36,
              fontWeight: 500,
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            Concept card candidates
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
            Approve promising candidates to queue them for AI drafting, or
            promote straight to a live card. Rejected candidates disappear
            from the queue but stay in the DB for audit.
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 12,
              fontSize: 12,
              color: COLORS.inkMuted,
            }}
          >
            <span>{pending.length} pending</span>
            <span>· {approved.length} approved</span>
            <span>· {promoted.length} promoted</span>
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
              marginBottom: 24,
            }}
          >
            Apply <code>scripts/migrations/learn/010-concept-cards.sql</code>{" "}
            first, then run{" "}
            <code>scripts/learn/generate-concept-cards.ts</code> or the
            extractor to populate the queue.
          </div>
        )}

        {pending.length > 0 && (
          <Section title={`Pending review · ${pending.length}`}>
            {pending.map((c) => (
              <CandidateRow key={c.id} c={c} actions={["approve", "reject"]} />
            ))}
          </Section>
        )}

        {approved.length > 0 && (
          <Section title={`Approved, ready to promote · ${approved.length}`}>
            {approved.map((c) => (
              <CandidateRow key={c.id} c={c} actions={["promote", "reject"]} />
            ))}
          </Section>
        )}

        {promoted.length > 0 && (
          <Section title={`Promoted · ${promoted.length}`}>
            {promoted.slice(0, 25).map((c) => (
              <CandidateRow key={c.id} c={c} actions={[]} />
            ))}
            {promoted.length > 25 && (
              <div
                style={{
                  padding: "10px 16px",
                  fontSize: 12,
                  color: COLORS.inkMuted,
                }}
              >
                +{promoted.length - 25} more
              </div>
            )}
          </Section>
        )}

        {!migrationsMissing && pending.length + approved.length + promoted.length === 0 && (
          <div
            style={{
              padding: "24px",
              border: `1px solid ${COLORS.borderLight}`,
              background: COLORS.paperDark,
              fontSize: 13,
              color: COLORS.inkSec,
            }}
          >
            Queue is empty. Run{" "}
            <code>
              npx tsx -e &quot;import('./src/lib/learn/concept-cards/extractor').then(m =&gt; m.extractFromBriefingCorpus())&quot;
            </code>{" "}
            to extract new candidates from recent briefings.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <div style={{ border: `1px solid ${COLORS.borderLight}` }}>{children}</div>
    </section>
  );
}

function CandidateRow({
  c,
  actions,
}: {
  c: Candidate;
  actions: Array<"approve" | "reject" | "promote">;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.8fr 0.8fr 0.5fr 0.9fr",
        gap: 12,
        padding: "12px 16px",
        borderBottom: `1px solid ${COLORS.borderLight}`,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 16, fontWeight: 500 }}>
          {c.term}
          {c.abbrev && (
            <span style={{ color: COLORS.plum, marginLeft: 6, fontWeight: 400 }}>
              {c.abbrev}
            </span>
          )}
        </div>
        {c.proposed_inline_summary && (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: COLORS.inkSec,
              lineHeight: 1.4,
            }}
          >
            {c.proposed_inline_summary}
          </div>
        )}
        {c.disambiguation_context && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: COLORS.inkMuted,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            context: {c.disambiguation_context}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: COLORS.inkSec,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {c.extraction_source.replace(/_/g, " ")}
      </div>
      <div
        style={{
          fontSize: 12,
          color: COLORS.inkMuted,
          textAlign: "right",
        }}
      >
        ×{c.signal_count}
      </div>
      <div style={{ textAlign: "right" }}>
        {actions.length === 0 ? (
          <span style={{ fontSize: 11, color: COLORS.inkMuted }}>—</span>
        ) : (
          <CandidateActions id={c.id} actions={actions} />
        )}
      </div>
    </div>
  );
}
