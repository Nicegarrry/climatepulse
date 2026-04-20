import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import { COLORS, FONTS } from "@/lib/design-tokens";

// Public article-preview landing.
//   /share/story?u=<article_url>&utm_source=...&utm_campaign=...&ref=<hash>
//
// LinkedIn / Twitter / email recipients land here, see a ClimatePulse-framed
// preview of the story with two CTAs:
//   1. "Read source" → /api/share/click?u=... (logs + 302)
//   2. "See today's briefing" → /login (anon) or /dashboard (authed)
//
// The page is fully server-rendered so OG metadata is accurate for the
// unfurl crawlers.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Preview {
  headline: string;
  source_name: string | null;
  snippet: string | null;
  published_at: string | null;
  sentiment: string | null;
  domain_label: string | null;
  microsector_label: string | null;
  entity_names: string[];
}

function parseArticleUrl(raw: string | undefined | null): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function loadPreview(articleUrl: string): Promise<Preview | null> {
  try {
    const { rows } = await pool.query<{
      title: string;
      source_name: string | null;
      snippet: string | null;
      published_at: string | null;
      sentiment: string | null;
      domain_label: string | null;
      microsector_label: string | null;
      entity_names: string[] | null;
    }>(
      `
      SELECT
        ra.title,
        ra.source_name,
        ra.snippet,
        ra.published_at::text AS published_at,
        ea.sentiment::text AS sentiment,
        td.name AS domain_label,
        tm.name AS microsector_label,
        ARRAY(
          SELECT e.canonical_name
          FROM article_entities ae
          JOIN entities e ON e.id = ae.entity_id
          WHERE ae.enriched_article_id = ea.id
          ORDER BY e.id
          LIMIT 4
        ) AS entity_names
      FROM raw_articles ra
      LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
      LEFT JOIN taxonomy_microsectors tm ON tm.id = ea.microsector_ids[1]
      LEFT JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
      LEFT JOIN taxonomy_domains td ON td.id = ts.domain_id
      WHERE ra.article_url = $1
      LIMIT 1
      `,
      [articleUrl]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      headline: row.title,
      source_name: row.source_name,
      snippet: row.snippet,
      published_at: row.published_at,
      sentiment: row.sentiment,
      domain_label: row.domain_label,
      microsector_label: row.microsector_label,
      entity_names: row.entity_names ?? [],
    };
  } catch {
    return null;
  }
}

function formatPublished(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function sentimentColor(s: string | null): { label: string; color: string } | null {
  if (!s) return null;
  const map: Record<string, { label: string; color: string }> = {
    strong_positive: { label: "Strong positive", color: COLORS.forest },
    positive: { label: "Positive", color: COLORS.forestMid },
    neutral: { label: "Neutral", color: COLORS.inkMuted },
    negative: { label: "Negative", color: "#8C3A2E" },
    strong_negative: { label: "Strong negative", color: "#6B2019" },
  };
  return map[s] ?? null;
}

// ─── Metadata for OG unfurl ──────────────────────────────────────────────

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const u = typeof sp.u === "string" ? sp.u : null;
  const parsed = parseArticleUrl(u);
  if (!parsed) {
    return { title: "Shared story — ClimatePulse" };
  }
  const preview = await loadPreview(parsed.toString());
  const title = preview?.headline
    ? `${preview.headline} — via ClimatePulse`
    : "Shared story — ClimatePulse";
  const description =
    preview?.snippet ??
    "A story from today's ClimatePulse briefing — AI-curated climate, energy & sustainability intelligence.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "ClimatePulse",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────

export default async function ShareStoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const u = typeof sp.u === "string" ? sp.u : null;
  const parsed = parseArticleUrl(u);
  if (!parsed) notFound();

  const preview = await loadPreview(parsed.toString());

  // If we have no record of this URL at all, just bounce to the source — no
  // point showing an empty preview card.
  if (!preview) {
    redirect(parsed.toString());
  }

  const authed = await getAuthUser();
  const published = formatPublished(preview.published_at);
  const sent = sentimentColor(preview.sentiment);
  const sector = preview.microsector_label ?? preview.domain_label;

  // Forward the tracking params to the click endpoint.
  const clickParams = new URLSearchParams();
  clickParams.set("u", parsed.toString());
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
    const v = sp[key];
    if (typeof v === "string") clickParams.set(key, v);
  }
  const readHref = `/api/share/click?${clickParams.toString()}`;

  // Returning users → dashboard. Anon → login with ref preserved.
  let briefingHref = "/login";
  if (authed) {
    briefingHref = "/dashboard";
  } else if (typeof sp.ref === "string") {
    briefingHref = `/login?ref=${encodeURIComponent(sp.ref)}`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        padding: "clamp(24px, 6vw, 64px) 20px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        {/* Wordmark */}
        <a
          href="/"
          style={{
            display: "inline-block",
            marginBottom: 28,
            textDecoration: "none",
            fontFamily: FONTS.serif,
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.forest,
            letterSpacing: "-0.01em",
          }}
        >
          ClimatePulse
        </a>

        {/* Card */}
        <article
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "clamp(24px, 4vw, 40px)",
          }}
        >
          {/* Chips row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              marginBottom: 16,
              fontFamily: FONTS.sans,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {sector && <span style={{ color: COLORS.forest, fontWeight: 600 }}>{sector}</span>}
            {preview.source_name && (
              <span style={{ color: COLORS.inkMuted }}>{preview.source_name}</span>
            )}
            {published && <span style={{ color: COLORS.inkFaint }}>{published}</span>}
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 500,
              lineHeight: 1.2,
              color: COLORS.ink,
              margin: 0,
            }}
          >
            {preview.headline}
          </h1>

          {/* Teaser */}
          {preview.snippet && (
            <p
              style={{
                fontFamily: FONTS.sans,
                fontSize: 15,
                lineHeight: 1.55,
                color: COLORS.inkSec,
                margin: "16px 0 0",
              }}
            >
              {preview.snippet}
            </p>
          )}

          {/* Sentiment + entities meta row */}
          {(sent || preview.entity_names.length > 0) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${COLORS.borderLight}`,
                fontFamily: FONTS.sans,
                fontSize: 11,
                color: COLORS.inkMuted,
              }}
            >
              {sent && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: sent.color,
                      display: "inline-block",
                    }}
                  />
                  {sent.label}
                </span>
              )}
              {preview.entity_names.length > 0 && (
                <span>
                  <span style={{ color: COLORS.inkFaint, marginRight: 6 }}>Mentions:</span>
                  {preview.entity_names.join(" · ")}
                </span>
              )}
            </div>
          )}

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 28,
            }}
          >
            <a
              href={readHref}
              rel="noopener noreferrer"
              style={{
                flex: "1 1 220px",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "13px 20px",
                backgroundColor: COLORS.forest,
                color: "#fff",
                borderRadius: 6,
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.01em",
              }}
            >
              Read the source {"\u2197"}
            </a>
            <a
              href={briefingHref}
              style={{
                flex: "1 1 220px",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "13px 20px",
                backgroundColor: COLORS.surface,
                color: COLORS.ink,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {authed ? "Open today's briefing" : "See today's briefing"}
            </a>
          </div>
        </article>

        {/* Footer pitch — only shown to anon visitors */}
        {!authed && (
          <p
            style={{
              marginTop: 24,
              fontFamily: FONTS.sans,
              fontSize: 13,
              lineHeight: 1.55,
              color: COLORS.inkMuted,
              textAlign: "center",
            }}
          >
            ClimatePulse reads the day's climate, energy &amp; sustainability news so you
            don't have to — one five-minute briefing each morning, plus a two-speaker audio
            edition. Free to try.
          </p>
        )}
      </div>
    </main>
  );
}
