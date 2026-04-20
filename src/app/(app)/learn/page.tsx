import Link from "next/link";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { EditorialStatusBadge, type EditorialStatus } from "@/components/learn/editorial-status-badge";
import "@/components/learn/learn.css";

export const dynamic = "force-dynamic";

/**
 * True if the error is Postgres "relation does not exist" (SQLSTATE 42P01).
 * Happens when the Phase 1 Learn migrations haven't been applied yet.
 * Treated as an empty-data state rather than a crash.
 */
function isMissingRelation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code === "42P01";
}

interface LandingConcept {
  id: string;
  slug: string;
  term: string;
  abbrev: string | null;
  inline_summary: string;
  editorial_status: EditorialStatus;
  updated_at: string;
  primary_domain: string | null;
}

interface LandingPath {
  id: string;
  slug: string;
  title: string;
  goal: string | null;
  editorial_status: EditorialStatus;
  item_count: number;
  update_policy: string;
}

interface DomainGroup {
  slug: string;
  name: string;
  microsectors: Array<{
    id: number;
    slug: string;
    name: string;
    brief_id: string | null;
    editorial_status: EditorialStatus | null;
    regime_change_flagged: boolean;
    block_count: number;
  }>;
}

interface Totals {
  concept_count: number;
  concept_reviewed: number;
  brief_count: number;
  path_count: number;
}

async function fetchTodayConcept(): Promise<LandingConcept | null> {
  try {
    const { rows } = await pool.query<LandingConcept>(
      `SELECT id, slug, term, abbrev, inline_summary, editorial_status,
              updated_at::text AS updated_at, primary_domain
         FROM concept_cards
        WHERE superseded_by IS NULL
        ORDER BY
          CASE editorial_status
            WHEN 'editor_authored' THEN 0
            WHEN 'editor_reviewed' THEN 1
            WHEN 'previously_reviewed_stale' THEN 2
            WHEN 'ai_drafted' THEN 3
            ELSE 4
          END,
          updated_at DESC
        LIMIT 1`,
    );
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingRelation(err)) return null;
    throw err;
  }
}

async function fetchFeaturedPaths(limit = 6): Promise<LandingPath[]> {
  try {
    const { rows } = await pool.query<LandingPath>(
      `SELECT lp.id, lp.slug, lp.title, lp.goal, lp.editorial_status,
              lp.update_policy,
              (SELECT COUNT(*)::int FROM learning_path_items lpi
                WHERE lpi.path_id = lp.id) AS item_count
         FROM learning_paths lp
        WHERE lp.editorial_status IN ('editor_authored','editor_reviewed')
        ORDER BY
          CASE lp.editorial_status
            WHEN 'editor_authored' THEN 0
            WHEN 'editor_reviewed' THEN 1
            ELSE 2
          END,
          lp.updated_at DESC
        LIMIT $1`,
      [limit],
    );
    return rows;
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}

async function fetchDomainGroups(): Promise<DomainGroup[]> {
  try {
    return await fetchDomainGroupsInner();
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}

async function fetchDomainGroupsInner(): Promise<DomainGroup[]> {
  const { rows } = await pool.query<{
    domain_slug: string;
    domain_name: string;
    microsector_id: number;
    microsector_slug: string;
    microsector_name: string;
    brief_id: string | null;
    editorial_status: EditorialStatus | null;
    regime_change_flagged: boolean | null;
    block_count: string | null;
  }>(
    `SELECT
        td.slug AS domain_slug,
        td.name AS domain_name,
        tm.id AS microsector_id,
        tm.slug AS microsector_slug,
        tm.name AS microsector_name,
        mb.id AS brief_id,
        mb.editorial_status,
        mb.regime_change_flagged,
        (SELECT COUNT(*) FROM microsector_brief_blocks mbb
          WHERE mbb.brief_id = mb.id) AS block_count
       FROM taxonomy_microsectors tm
       JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
       JOIN taxonomy_domains td ON td.id = ts.domain_id
  LEFT JOIN microsector_briefs mb ON mb.microsector_id = tm.id
      WHERE tm.deprecated_at IS NULL
      ORDER BY td.sort_order NULLS LAST, td.name, tm.sort_order NULLS LAST, tm.name`,
  );

  const byDomain = new Map<string, DomainGroup>();
  for (const r of rows) {
    if (!byDomain.has(r.domain_slug)) {
      byDomain.set(r.domain_slug, {
        slug: r.domain_slug,
        name: r.domain_name,
        microsectors: [],
      });
    }
    byDomain.get(r.domain_slug)!.microsectors.push({
      id: r.microsector_id,
      slug: r.microsector_slug,
      name: r.microsector_name,
      brief_id: r.brief_id,
      editorial_status: r.editorial_status,
      regime_change_flagged: r.regime_change_flagged ?? false,
      block_count: r.block_count ? parseInt(r.block_count, 10) : 0,
    });
  }
  return Array.from(byDomain.values());
}

async function fetchTotals(): Promise<Totals> {
  try {
    const { rows } = await pool.query<{
      concept_count: string;
      concept_reviewed: string;
      brief_count: string;
      path_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM concept_cards WHERE superseded_by IS NULL) AS concept_count,
         (SELECT COUNT(*) FROM concept_cards WHERE superseded_by IS NULL
           AND editorial_status IN ('editor_authored','editor_reviewed')) AS concept_reviewed,
         (SELECT COUNT(*) FROM microsector_briefs) AS brief_count,
         (SELECT COUNT(*) FROM learning_paths
           WHERE editorial_status IN ('editor_authored','editor_reviewed','user_generated')) AS path_count`,
    );
    const r = rows[0];
    return {
      concept_count: parseInt(r.concept_count, 10),
      concept_reviewed: parseInt(r.concept_reviewed, 10),
      brief_count: parseInt(r.brief_count, 10),
      path_count: parseInt(r.path_count, 10),
    };
  } catch (err) {
    if (isMissingRelation(err)) {
      return { concept_count: 0, concept_reviewed: 0, brief_count: 0, path_count: 0 };
    }
    throw err;
  }
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return `${Math.floor(diff / (30 * day))}mo ago`;
}

export default async function LearnLandingPage() {
  const [todayConcept, featuredPaths, domainGroups, totals] = await Promise.all([
    fetchTodayConcept(),
    fetchFeaturedPaths(),
    fetchDomainGroups(),
    fetchTotals(),
  ]);

  return (
    <div className="cp-learn">
      <div className="main-inner" style={{ padding: "32px 24px 80px", maxWidth: 1040, margin: "0 auto" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginBottom: 40,
            paddingBottom: 24,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
                marginBottom: 10,
              }}
            >
              ClimatePulse · Learn
            </div>
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 44,
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: "-0.5px",
                color: COLORS.ink,
                margin: 0,
              }}
            >
              Understand the substrate.
            </h1>
            <p
              style={{
                marginTop: 12,
                maxWidth: 560,
                fontSize: 15,
                lineHeight: 1.55,
                color: COLORS.inkSec,
              }}
            >
              Concept cards, microsector briefs, and sequenced learning paths —
              hand-edited where it matters, AI-drafted where it doesn&rsquo;t.
              Every item carries a provenance badge.
            </p>
            <nav
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 20,
                fontFamily: FONTS.sans,
                fontSize: 13,
              }}
            >
              <Link href="/learn/concepts" style={{ color: COLORS.forest }}>
                Concept cards →
              </Link>
              <Link href="/learn/microsectors" style={{ color: COLORS.forest }}>
                Microsector briefs →
              </Link>
              <Link href="/learn/paths" style={{ color: COLORS.forest }}>
                Learning paths →
              </Link>
              <Link href="/learn/search" style={{ color: COLORS.forest }}>
                Search →
              </Link>
            </nav>
          </div>
          <div style={{ textAlign: "right", minWidth: 180 }}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
              }}
            >
              Substrate
            </div>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontWeight: 350,
                fontSize: 40,
                letterSpacing: "-0.4px",
                marginTop: 6,
              }}
            >
              {totals.concept_count}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 4 }}>
              concepts · {totals.concept_reviewed} editor-reviewed
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 2 }}>
              {totals.brief_count} microsector briefs · {totals.path_count} paths
            </div>
          </div>
        </header>

        {/* Today's concept */}
        {todayConcept && (
          <section style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
                marginBottom: 12,
              }}
            >
              Featured concept
            </h2>
            <Link
              href={`/learn/concepts/${todayConcept.slug}`}
              style={{
                display: "block",
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                padding: "28px 28px 24px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: COLORS.forestMid,
                  }}
                >
                  {todayConcept.primary_domain ?? "Concept"}
                </div>
                <EditorialStatusBadge
                  status={todayConcept.editorial_status}
                  compact
                  timestamp={relTime(todayConcept.updated_at)}
                />
              </div>
              <h3
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 32,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.4px",
                  margin: "0 0 12px",
                }}
              >
                {todayConcept.term}
                {todayConcept.abbrev && (
                  <span style={{ color: COLORS.plum, fontWeight: 400, marginLeft: 10 }}>
                    {todayConcept.abbrev}
                  </span>
                )}
              </h3>
              <p
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 18,
                  lineHeight: 1.45,
                  color: COLORS.inkSec,
                  margin: 0,
                  maxWidth: 720,
                }}
              >
                {todayConcept.inline_summary}
              </p>
              <div
                style={{
                  marginTop: 16,
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.forest,
                }}
              >
                Read the full card →
              </div>
            </Link>
          </section>
        )}

        {/* Featured paths */}
        {featuredPaths.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  margin: 0,
                }}
              >
                Featured paths
              </h2>
              <Link
                href="/learn/paths"
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: COLORS.forest,
                }}
              >
                All paths →
              </Link>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {featuredPaths.map((p) => (
                <Link
                  key={p.id}
                  href={`/learn/paths/${p.slug}`}
                  style={{
                    display: "block",
                    border: `1px solid ${COLORS.border}`,
                    padding: "16px 18px",
                    background: COLORS.surface,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <EditorialStatusBadge status={p.editorial_status} compact />
                    <span
                      style={{
                        fontSize: 10,
                        color: COLORS.inkMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {p.update_policy}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontFamily: FONTS.serif,
                      fontSize: 19,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      margin: 0,
                      color: COLORS.ink,
                    }}
                  >
                    {p.title}
                  </h3>
                  {p.goal && (
                    <p
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: COLORS.inkSec,
                      }}
                    >
                      {p.goal.length > 140 ? `${p.goal.slice(0, 140)}…` : p.goal}
                    </p>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: COLORS.inkMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {p.item_count} items
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Browse by domain → microsector */}
        {domainGroups.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  margin: 0,
                }}
              >
                Browse by domain
              </h2>
              <Link
                href="/learn/microsectors"
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: COLORS.forest,
                }}
              >
                All microsectors →
              </Link>
            </div>
            <div style={{ display: "grid", gap: 24 }}>
              {domainGroups.map((d) => (
                <div key={d.slug}>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: COLORS.forestMid,
                      marginBottom: 8,
                      borderBottom: `1px solid ${COLORS.borderLight}`,
                      paddingBottom: 4,
                    }}
                  >
                    {d.name} · {d.microsectors.length}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: 6,
                    }}
                  >
                    {d.microsectors.map((m) => {
                      const hasBrief = m.brief_id !== null && m.block_count > 0;
                      return (
                        <Link
                          key={m.id}
                          href={`/learn/microsectors/${m.slug}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 10px",
                            border: `1px solid ${COLORS.borderLight}`,
                            background: hasBrief ? COLORS.surface : COLORS.paperDark,
                            fontSize: 13,
                            color: hasBrief ? COLORS.ink : COLORS.inkMuted,
                            textDecoration: "none",
                          }}
                        >
                          <span>{m.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              color: m.regime_change_flagged
                                ? COLORS.plum
                                : COLORS.inkFaint,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {m.regime_change_flagged
                              ? "regime shift"
                              : hasBrief
                                ? `${m.block_count} blocks`
                                : "no brief"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!todayConcept && featuredPaths.length === 0 && domainGroups.length === 0 && (
          <div
            style={{
              padding: "32px 24px",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.paperDark,
              fontSize: 14,
              color: COLORS.inkSec,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: COLORS.ink, fontFamily: FONTS.serif, fontSize: 16 }}>
              Learn is ready — no content yet.
            </strong>
            <p style={{ margin: "8px 0 12px" }}>
              If the Phase 1 migrations haven&rsquo;t been applied to this
              environment, apply them first:
            </p>
            <code style={{ display: "block", fontSize: 12, marginBottom: 16 }}>
              psql $DATABASE_URL -f scripts/migrations/learn/001-learn-prelude.sql
              <br />
              psql $DATABASE_URL -f scripts/migrations/learn/010-concept-cards.sql
              <br />
              psql $DATABASE_URL -f scripts/migrations/learn/020-microsector-briefs.sql
              <br />
              psql $DATABASE_URL -f scripts/migrations/learn/030-learning-paths.sql
              <br />
              psql $DATABASE_URL -f scripts/migrations/learn/040-knowledge-surfaces.sql
            </code>
            <p style={{ margin: "8px 0" }}>
              Then seed candidates + brief rows with{" "}
              <code>scripts/learn/generate-concept-cards.ts</code> and{" "}
              <code>scripts/learn/refresh-brief-blocks.ts</code>, or author
              content directly via <Link href="/teaching" style={{ color: COLORS.forest }}>Teaching</Link>.
            </p>
          </div>
        )}

        <footer
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: COLORS.inkMuted,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <span>Substrate updated continuously</span>
          <span>Editor-reviewed &middot; AI-assisted</span>
        </footer>
      </div>
    </div>
  );
}
