import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getPublicDigest, type PublicStory } from "@/lib/digest/public-digest";
import { COLORS, FONTS } from "@/lib/design-tokens";

// Public, zero-login daily board. Cached for 10 minutes (ISR) so a LinkedIn
// traffic spike doesn't hammer the DB; the per-visitor query is read-only and
// there is no AI cost. getPublicDigest swallows errors -> empty state, so this
// is safe to prerender even if the DB is unreachable at build.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Today's Signal Board — ClimatePulse",
  description:
    "The day's highest-signal climate, energy and transition stories, tracked and ranked. Members get it written up and personalised to their sectors.",
  openGraph: {
    title: "Today's Signal Board — ClimatePulse",
    description:
      "The day's highest-signal climate, energy and transition stories, tracked and ranked.",
    type: "website",
  },
};

function prettify(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function sentimentColor(s: string | null): string {
  if (s === "positive") return COLORS.forest;
  if (s === "negative") return "#B23A2E";
  return COLORS.inkMuted;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Australia/Sydney",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function fmtDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${d}T00:00:00`));
  } catch {
    return d;
  }
}

const chipStyle: CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: COLORS.inkSec,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 999,
  padding: "2px 8px",
  whiteSpace: "nowrap",
};

function StoryRow({ story, rank }: { story: PublicStory; rank: number }) {
  const domain = prettify(story.primary_domain);
  const signal = prettify(story.signal_type);
  const time = fmtTime(story.published_at);
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 16,
        padding: "20px 0",
        borderTop: `1px solid ${COLORS.borderLight}`,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 20,
          color: COLORS.inkFaint,
          lineHeight: 1.2,
          paddingTop: 2,
        }}
      >
        {String(rank).padStart(2, "0")}
      </div>
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
          {domain && <span style={chipStyle}>{domain}</span>}
          {signal && <span style={chipStyle}>{signal}</span>}
          {story.sentiment && (
            <span
              aria-label={`sentiment: ${story.sentiment}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: sentimentColor(story.sentiment),
                display: "inline-block",
              }}
            />
          )}
        </div>
        <a
          href={story.article_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: FONTS.serif,
            fontSize: 21,
            lineHeight: 1.3,
            color: COLORS.ink,
            textDecoration: "none",
            display: "block",
          }}
        >
          {story.title}
        </a>
        {story.snippet && (
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              lineHeight: 1.55,
              color: COLORS.inkSec,
              margin: "8px 0 0",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {story.snippet}
          </p>
        )}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.inkMuted,
            marginTop: 10,
          }}
        >
          {story.source_name ?? "Source"}
          {time ? ` · ${time} AEST` : ""}
        </div>
      </div>
    </article>
  );
}

export default async function TodayPage() {
  const digest = await getPublicDigest();
  const hasStories = digest.stories.length > 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.ink,
        paddingBottom: 80,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
        {/* Masthead */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "28px 0 24px",
            borderBottom: `2px solid ${COLORS.ink}`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontSize: 14,
              color: COLORS.ink,
            }}
          >
            ClimatePulse
          </span>
          <Link
            href="/login"
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.surface,
              background: COLORS.forest,
              padding: "8px 14px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Get your briefing →
          </Link>
        </header>

        {/* Hero */}
        <section style={{ padding: "36px 0 20px" }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.forestMid,
              marginBottom: 14,
            }}
          >
            Today&apos;s Signal Board · {fmtDate(digest.date)}
          </div>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 38,
              lineHeight: 1.15,
              fontWeight: 600,
              margin: 0,
              color: COLORS.ink,
              letterSpacing: "-0.01em",
            }}
          >
            What&apos;s moving in climate, energy &amp; the transition
          </h1>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 17,
              lineHeight: 1.6,
              color: COLORS.inkSec,
              margin: "16px 0 0",
              maxWidth: 580,
            }}
          >
            The day&apos;s highest-signal stories, ranked from{" "}
            {digest.signals_tracked.toLocaleString("en-AU")} tracked across the
            global energy desk — unfiltered and not personalised. Members get
            this written up and tuned to their sectors each morning.
          </p>
        </section>

        {/* Stories */}
        {hasStories ? (
          <section style={{ marginTop: 12 }}>
            {digest.stories.map((s, i) => (
              <StoryRow key={s.article_url || i} story={s} rank={i + 1} />
            ))}
          </section>
        ) : (
          <section
            style={{
              marginTop: 24,
              padding: "48px 24px",
              textAlign: "center",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              background: COLORS.surface,
            }}
          >
            <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.ink, margin: 0 }}>
              Today&apos;s board is being compiled
            </p>
            <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.inkSec, margin: "10px 0 0" }}>
              The overnight desk run is still processing — check back shortly.
            </p>
          </section>
        )}

        {/* Conversion CTA */}
        <section
          style={{
            marginTop: 48,
            padding: "32px 28px",
            background: COLORS.forest,
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 26,
              fontWeight: 600,
              color: "#FFFFFF",
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Get the full briefing
          </h2>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 16,
              lineHeight: 1.6,
              color: COLORS.sageTint,
              margin: "12px 0 20px",
              maxWidth: 520,
            }}
          >
            Five minutes, three signals, one verdict — AI-written analysis of why
            today&apos;s stories matter, personalised to your sectors and role.
            Plus newsroom, markets, energy and a daily podcast.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              fontFamily: FONTS.sans,
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.forest,
              background: "#FFFFFF",
              padding: "12px 22px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Create your free account →
          </Link>
        </section>

        <footer
          style={{
            marginTop: 40,
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: COLORS.inkMuted,
            textAlign: "center",
          }}
        >
          ClimatePulse · AI-powered daily climate, energy &amp; sustainability
          intelligence
        </footer>
      </div>
    </main>
  );
}
