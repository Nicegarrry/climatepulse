import Link from "next/link";
import type { Metadata } from "next";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import "@/components/learn/learn.css";

export const metadata: Metadata = {
  title: "Concepts — ClimatePulse Learn",
  description: "Browse the ClimatePulse concept library.",
};

interface IndexRow {
  id: string;
  slug: string;
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  inline_summary: string;
  primary_domain: string | null;
  editorial_status: EditorialStatus;
  reviewed_at: string | null;
  updated_at: string;
}

const UNCATEGORISED = "Other";

function groupByDomain(rows: IndexRow[]): Array<[string, IndexRow[]]> {
  const map = new Map<string, IndexRow[]>();
  for (const r of rows) {
    const key = r.primary_domain?.trim() || UNCATEGORISED;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  // Sort domain names alphabetically, with UNCATEGORISED last.
  const entries = Array.from(map.entries()).sort(([a], [b]) => {
    if (a === UNCATEGORISED) return 1;
    if (b === UNCATEGORISED) return -1;
    return a.localeCompare(b);
  });
  // Sort each domain's cards by term.
  for (const [, list] of entries) {
    list.sort((a, b) => a.term.localeCompare(b.term));
  }
  return entries;
}

export default async function ConceptsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = sp.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";

  const params: string[] = [];
  let where = "superseded_by IS NULL";
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (term ILIKE $1 OR abbrev ILIKE $1)`;
  }

  const { rows } = await pool.query<IndexRow>(
    `SELECT id, slug, term, abbrev, disambiguation_context, inline_summary,
            primary_domain, editorial_status, reviewed_at, updated_at
       FROM concept_cards
      WHERE ${where}
      ORDER BY primary_domain NULLS LAST, term ASC`,
    params,
  );

  const grouped = groupByDomain(rows);

  return (
    <div className="cp-learn" style={{ minHeight: "100vh", padding: "32px 0 80px" }}>
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "0 24px",
          fontFamily: FONTS.sans,
          color: COLORS.ink,
        }}
      >
        {/* back nav */}
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/dashboard"
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.inkSec,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textDecoration: "none",
            }}
          >
            ← Back to ClimatePulse
          </Link>
        </div>

        {/* header */}
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: COLORS.forest,
              marginBottom: 10,
            }}
          >
            Concept library
          </div>
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
            Concepts
          </h1>
          <p
            style={{
              fontFamily: FONTS.serif,
              fontStyle: "italic",
              fontSize: 18,
              color: COLORS.inkSec,
              margin: "12px 0 0",
            }}
          >
            {rows.length} term{rows.length === 1 ? "" : "s"}, grouped by domain.
          </p>
        </header>

        {/* search */}
        <form
          method="GET"
          action="/learn/concepts"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            padding: "10px 14px",
            marginBottom: 32,
            borderRadius: 2,
          }}
        >
          <MagnifyingGlassIcon
            width={16}
            height={16}
            strokeWidth={1.6}
            aria-hidden="true"
            style={{ color: COLORS.inkMuted, flex: "none" }}
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search concepts"
            aria-label="Search concepts"
            style={{
              all: "unset",
              flex: 1,
              fontFamily: FONTS.sans,
              fontSize: 14,
              color: COLORS.ink,
            }}
          />
          {q && (
            <Link
              href="/learn/concepts"
              style={{
                fontSize: 12,
                color: COLORS.inkSec,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textDecoration: "none",
              }}
            >
              Clear
            </Link>
          )}
        </form>

        {/* results */}
        {rows.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: COLORS.inkMuted,
              border: `1px dashed ${COLORS.border}`,
              fontFamily: FONTS.serif,
              fontStyle: "italic",
              fontSize: 16,
            }}
          >
            {q
              ? `No concepts match “${q}”.`
              : "No concept cards have been published yet."}
          </div>
        ) : (
          grouped.map(([domain, list]) => (
            <section key={domain} style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.forest,
                  margin: "0 0 12px",
                  paddingBottom: 8,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                {domain}
                <span
                  style={{
                    marginLeft: 8,
                    color: COLORS.inkMuted,
                    fontWeight: 400,
                    letterSpacing: "0.04em",
                  }}
                >
                  · {list.length}
                </span>
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {list.map((card) => {
                  const href = card.disambiguation_context
                    ? `/learn/concepts/${card.slug}?context=${encodeURIComponent(card.disambiguation_context)}`
                    : `/learn/concepts/${card.slug}`;
                  return (
                    <li
                      key={card.id}
                      style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}
                    >
                      <Link
                        href={href}
                        style={{
                          display: "block",
                          padding: "16px 4px",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: FONTS.serif,
                              fontSize: 20,
                              fontWeight: 500,
                              color: COLORS.ink,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {card.term}
                          </span>
                          {card.abbrev && (
                            <span
                              style={{
                                color: COLORS.plum,
                                fontFamily: FONTS.serif,
                                fontSize: 15,
                              }}
                            >
                              · {card.abbrev}
                            </span>
                          )}
                          {card.disambiguation_context && (
                            <span
                              style={{
                                fontFamily:
                                  "JetBrains Mono, ui-monospace, monospace",
                                fontSize: 10,
                                textTransform: "uppercase",
                                color: COLORS.inkMuted,
                                letterSpacing: "0.08em",
                              }}
                            >
                              ({card.disambiguation_context})
                            </span>
                          )}
                          <span style={{ marginLeft: "auto" }}>
                            <EditorialStatusBadge
                              status={card.editorial_status}
                              compact
                            />
                          </span>
                        </div>
                        {card.inline_summary && (
                          <p
                            style={{
                              margin: 0,
                              fontFamily: FONTS.sans,
                              fontSize: 14,
                              lineHeight: 1.55,
                              color: COLORS.inkSec,
                            }}
                          >
                            {card.inline_summary}
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
