import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import { ConceptTooltipScope } from "@/components/learn/inline-concept-tooltip";
import "@/components/learn/learn.css";
import { KeyMechanismsAccordion } from "./ConceptCardView";

// ---------- types ----------

interface ConceptRow {
  id: string;
  slug: string;
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  inline_summary: string;
  full_body: string;
  key_mechanisms: { title: string; body: string }[] | null;
  related_terms: string[] | null;
  visual_type: string;
  visual_spec: Record<string, unknown> | null;
  uncertainty_flags: unknown;
  source_citations: Array<{
    type?: string;
    ref?: string;
    title?: string;
    quote?: string;
    accessed_at?: string;
  }> | null;
  primary_domain: string | null;
  microsector_ids: number[] | null;
  entity_ids: number[] | null;
  editorial_status: EditorialStatus;
  reviewed_at: string | null;
  ai_drafted: boolean;
  version: number;
  content_hash: string;
  updated_at: string;
}

// ---------- helpers ----------

const STATUS_PRIORITY: Record<string, number> = {
  editor_authored: 0,
  editor_reviewed: 1,
  previously_reviewed_stale: 2,
  ai_drafted: 3,
  user_generated: 4,
};

function pickPrimary(rows: ConceptRow[], context: string | undefined): ConceptRow {
  if (context !== undefined) {
    const match = rows.find((r) => r.disambiguation_context === context);
    if (match) return match;
  }
  // editor_authored > editor_reviewed > ai_drafted > other, then newest.
  return [...rows].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.editorial_status] ?? 5;
    const pb = STATUS_PRIORITY[b.editorial_status] ?? 5;
    if (pa !== pb) return pa - pb;
    return (
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  })[0];
}

export function termToSlug(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(days / 365);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

function coerceUncertaintyFlags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as { claim?: unknown; reason?: unknown };
          const claim = typeof obj.claim === "string" ? obj.claim : null;
          const reason = typeof obj.reason === "string" ? obj.reason : null;
          if (claim && reason) return `${claim} — ${reason}`;
          return claim ?? reason ?? "";
        }
        return "";
      })
      .filter((s): s is string => Boolean(s));
  }
  return [];
}

async function loadRowsBySlug(slug: string): Promise<ConceptRow[]> {
  const { rows } = await pool.query<ConceptRow>(
    `SELECT id, slug, term, abbrev, disambiguation_context, inline_summary, full_body,
            key_mechanisms, related_terms, visual_type, visual_spec,
            uncertainty_flags, source_citations, primary_domain, microsector_ids,
            entity_ids, editorial_status, reviewed_at, ai_drafted, version,
            content_hash, updated_at
       FROM concept_cards
      WHERE slug = $1 AND superseded_by IS NULL
      ORDER BY updated_at DESC`,
    [slug],
  );
  return rows;
}

// ---------- metadata ----------

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ context?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const contextRaw = sp.context;
  const context = Array.isArray(contextRaw) ? contextRaw[0] : contextRaw;

  const rows = await loadRowsBySlug(slug);
  if (rows.length === 0) {
    return { title: "Concept not found — ClimatePulse Learn" };
  }
  const primary = pickPrimary(rows, context);
  return {
    title: `${primary.term} — ClimatePulse Learn`,
    description: (primary.inline_summary ?? "").slice(0, 160),
  };
}

// ---------- page ----------

export default async function ConceptCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ context?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const contextRaw = sp.context;
  const context = Array.isArray(contextRaw) ? contextRaw[0] : contextRaw;

  const rows = await loadRowsBySlug(slug);
  if (rows.length === 0) notFound();

  const primary = pickPrimary(rows, context);
  const alternates = rows.filter((r) => r.id !== primary.id);

  const uncertaintyFlags = coerceUncertaintyFlags(primary.uncertainty_flags);
  const citations = Array.isArray(primary.source_citations)
    ? primary.source_citations
    : [];
  const paragraphs = (primary.full_body ?? "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const relatedTerms = primary.related_terms ?? [];
  const mechanisms = primary.key_mechanisms ?? [];

  return (
    <div className="cp-learn" style={{ minHeight: "100vh", padding: "32px 0 80px" }}>
      <ConceptTooltipScope>
        <article
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "0 24px",
            fontFamily: FONTS.sans,
            color: COLORS.ink,
          }}
        >
          {/* back nav */}
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/learn/concepts"
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.inkSec,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textDecoration: "none",
              }}
            >
              ← All concepts
            </Link>
          </div>

          {/* disambiguation banner */}
          {alternates.length > 0 && (
            <div
              role="note"
              style={{
                border: `1px solid ${COLORS.border}`,
                background: COLORS.paperDark,
                padding: "10px 14px",
                marginBottom: 24,
                fontSize: 13,
                color: COLORS.inkSec,
                borderRadius: 2,
              }}
            >
              <span style={{ fontWeight: 500, color: COLORS.ink }}>
                This term has other meanings.
              </span>{" "}
              Currently viewing
              {primary.disambiguation_context ? (
                <>
                  {" "}
                  <em style={{ color: COLORS.forest }}>
                    {primary.disambiguation_context}
                  </em>
                </>
              ) : (
                " the default definition"
              )}
              . Also see:{" "}
              {alternates.map((alt, i) => (
                <span key={alt.id}>
                  <Link
                    href={`/learn/concepts/${slug}?context=${encodeURIComponent(alt.disambiguation_context)}`}
                    style={{ color: COLORS.forest, textDecoration: "underline" }}
                  >
                    {alt.disambiguation_context || "default"}
                  </Link>
                  {i < alternates.length - 1 ? ", " : ""}
                </span>
              ))}
              .
            </div>
          )}

          {/* header */}
          <header style={{ marginBottom: 20 }}>
            {primary.primary_domain && (
              <div
                style={{
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: COLORS.forest,
                  marginBottom: 12,
                }}
              >
                {primary.primary_domain}
              </div>
            )}
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 44,
                fontWeight: 400,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
                color: COLORS.ink,
              }}
            >
              {primary.term}
              {primary.abbrev && (
                <span
                  style={{
                    color: COLORS.plum,
                    marginLeft: 12,
                    fontSize: 28,
                    letterSpacing: "-0.01em",
                  }}
                >
                  · {primary.abbrev}
                </span>
              )}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <EditorialStatusBadge
                status={primary.editorial_status}
                timestamp={
                  primary.reviewed_at
                    ? `reviewed ${relativeTime(primary.reviewed_at)}`
                    : null
                }
              />
              <span style={{ fontSize: 12, color: COLORS.inkMuted }}>
                Updated {relativeTime(primary.updated_at)}
              </span>
            </div>
          </header>

          {/* inline summary — lead */}
          {primary.inline_summary && (
            <p
              style={{
                fontFamily: FONTS.serif,
                fontStyle: "italic",
                fontSize: 20,
                lineHeight: 1.45,
                color: COLORS.inkSec,
                margin: "24px 0 32px",
                borderLeft: `2px solid ${COLORS.forestMid}`,
                paddingLeft: 16,
              }}
            >
              {primary.inline_summary}
            </p>
          )}

          {/* full body prose */}
          {paragraphs.length > 0 && (
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 15.5,
                lineHeight: 1.65,
                color: COLORS.ink,
                marginBottom: 40,
              }}
            >
              {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: "0 0 1.2em" }}>
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* key mechanisms */}
          {mechanisms.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.inkSec,
                  margin: "0 0 12px",
                }}
              >
                Key mechanisms
              </h2>
              <KeyMechanismsAccordion mechanisms={mechanisms} />
            </section>
          )}

          {/* visual placeholder */}
          {primary.visual_type && primary.visual_type !== "none" && (
            <section style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.inkSec,
                  margin: "0 0 12px",
                }}
              >
                Visual · {primary.visual_type}
              </h2>
              <div
                style={{
                  border: `1px dashed ${COLORS.border}`,
                  background: COLORS.paperDark,
                  padding: "40px 24px",
                  textAlign: "center",
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  color: COLORS.inkMuted,
                  borderRadius: 2,
                  fontStyle: "italic",
                }}
              >
                {(primary.visual_spec &&
                  typeof primary.visual_spec === "object" &&
                  typeof (primary.visual_spec as { description?: unknown })
                    .description === "string" &&
                  (primary.visual_spec as { description: string })
                    .description) ||
                  "Visual placeholder — to be rendered"}
              </div>
            </section>
          )}

          {/* uncertainty flags */}
          {uncertaintyFlags.length > 0 && (
            <section
              style={{
                marginBottom: 40,
                padding: "16px 18px",
                background: COLORS.paperDark,
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: 2,
              }}
            >
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.inkSec,
                  margin: "0 0 10px",
                }}
              >
                Uncertainty & caveats
              </h2>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: COLORS.inkSec,
                }}
              >
                {uncertaintyFlags.map((f, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* related terms */}
          {relatedTerms.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.inkSec,
                  margin: "0 0 12px",
                }}
              >
                Related terms
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {relatedTerms.map((t) => (
                  <Link
                    key={t}
                    href={`/learn/concepts/${termToSlug(t)}`}
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      color: COLORS.ink,
                      fontSize: 13,
                      fontFamily: FONTS.sans,
                      textDecoration: "none",
                      borderRadius: 2,
                    }}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* source citations */}
          {citations.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.inkSec,
                  margin: "0 0 12px",
                }}
              >
                Sources
              </h2>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 22,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: COLORS.inkSec,
                  fontFamily: FONTS.sans,
                }}
              >
                {citations.map((c, i) => {
                  const title = c.title ?? c.ref ?? "Untitled source";
                  const isUrl = typeof c.ref === "string" && /^https?:\/\//.test(c.ref);
                  return (
                    <li key={i} style={{ marginBottom: 8 }}>
                      {isUrl ? (
                        <a
                          href={c.ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: COLORS.forest, textDecoration: "underline" }}
                        >
                          {title}
                        </a>
                      ) : (
                        <span style={{ color: COLORS.ink }}>{title}</span>
                      )}
                      {c.type && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontFamily: "JetBrains Mono, ui-monospace, monospace",
                            fontSize: 10,
                            textTransform: "uppercase",
                            color: COLORS.inkMuted,
                            letterSpacing: "0.08em",
                          }}
                        >
                          · {c.type}
                        </span>
                      )}
                      {c.quote && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingLeft: 8,
                            borderLeft: `2px solid ${COLORS.border}`,
                            fontStyle: "italic",
                            color: COLORS.inkMuted,
                          }}
                        >
                          “{c.quote}”
                        </div>
                      )}
                      {c.accessed_at && (
                        <span style={{ fontSize: 11, color: COLORS.inkMuted }}>
                          {" "}· accessed {c.accessed_at}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* footer */}
          <footer
            style={{
              marginTop: 48,
              paddingTop: 16,
              borderTop: `1px solid ${COLORS.border}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: 11,
              color: COLORS.inkMuted,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span>v{primary.version}</span>
            <span>hash {primary.content_hash.slice(0, 8)}</span>
            {primary.disambiguation_context && (
              <span>ctx · {primary.disambiguation_context}</span>
            )}
          </footer>
        </article>
      </ConceptTooltipScope>
    </div>
  );
}
