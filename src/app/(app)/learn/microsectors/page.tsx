import Link from "next/link";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import "@/components/learn/learn.css";

interface IndexRow {
  brief_id: string;
  microsector_id: number;
  microsector_slug: string;
  microsector_name: string;
  title: string;
  tagline: string | null;
  regime_change_flagged: boolean;
  sector_name: string;
  domain_slug: string;
  domain_name: string;
}

async function fetchBriefs(): Promise<IndexRow[]> {
  const { rows } = await pool.query<IndexRow>(
    `SELECT
        mb.id           AS brief_id,
        tm.id           AS microsector_id,
        tm.slug         AS microsector_slug,
        tm.name         AS microsector_name,
        mb.title,
        mb.tagline,
        mb.regime_change_flagged,
        ts.name         AS sector_name,
        td.slug         AS domain_slug,
        td.name         AS domain_name
      FROM microsector_briefs mb
      JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
      JOIN taxonomy_sectors ts      ON ts.id = tm.sector_id
      JOIN taxonomy_domains td      ON td.id = ts.domain_id
      WHERE tm.deprecated_at IS NULL
      ORDER BY td.name, ts.name, tm.name`,
  );
  return rows;
}

export default async function MicrosectorsIndexPage() {
  const rows = await fetchBriefs();
  const grouped = new Map<string, IndexRow[]>();
  for (const r of rows) {
    const key = r.domain_name;
    const bucket = grouped.get(key) ?? [];
    bucket.push(r);
    grouped.set(key, bucket);
  }
  const domainNames = Array.from(grouped.keys());

  return (
    <div className="cp-learn">
      <div className="main-inner" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Link
            href="/learn"
            className="micro"
            style={{ color: "var(--ink-3)", textDecoration: "none" }}
          >
            ← LEARN
          </Link>
          <span style={{ color: "var(--ink-5)" }}>/</span>
          <span className="micro" style={{ color: "var(--ink-3)" }}>
            MICROSECTORS
          </span>
        </div>

        <header style={{ marginBottom: 32 }}>
          <h1 className="display-lg" style={{ margin: 0, color: "var(--ink)" }}>
            Microsector briefs
          </h1>
          <p
            className="body-lg"
            style={{
              maxWidth: 680,
              marginTop: 10,
              color: "var(--ink-2)",
            }}
          >
            One brief per microsector. Composed of independently-cadenced blocks —
            daily movement, quarterly context, yearly fundamentals, and editorial
            lenses. Regime-change flags mark material policy or market shifts.
          </p>
        </header>

        {domainNames.length === 0 && (
          <p style={{ color: "var(--ink-3)", fontFamily: FONTS.sans, fontSize: 14 }}>
            No briefs published yet.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {domainNames.map((domain) => {
            const items = grouped.get(domain) ?? [];
            return (
              <section key={domain}>
                <div
                  className="micro-ink"
                  style={{
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--ink)",
                    marginBottom: 16,
                  }}
                >
                  {domain.toUpperCase()}
                  <span
                    className="tabular"
                    style={{
                      marginLeft: 10,
                      color: "var(--ink-4)",
                      fontWeight: 400,
                    }}
                  >
                    {items.length}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 14,
                  }}
                >
                  {items.map((item) => (
                    <Link
                      key={item.brief_id}
                      href={`/learn/microsectors/${item.microsector_slug}`}
                      style={{
                        display: "block",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        padding: "14px 16px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          className="micro"
                          style={{ color: "var(--ink-4)" }}
                        >
                          {item.sector_name.toUpperCase()}
                        </span>
                        {item.regime_change_flagged && (
                          <span
                            className="micro"
                            style={{
                              background: COLORS.plumLight,
                              color: COLORS.plum,
                              padding: "1px 6px",
                              letterSpacing: "0.08em",
                            }}
                          >
                            REGIME
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 18,
                          lineHeight: 1.3,
                          color: "var(--ink)",
                          fontWeight: 420,
                          marginBottom: item.tagline ? 6 : 0,
                        }}
                      >
                        {item.title || item.microsector_name}
                      </div>
                      {item.tagline && (
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            lineHeight: 1.45,
                            color: "var(--ink-3)",
                          }}
                        >
                          {item.tagline}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
