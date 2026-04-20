import type { Metadata } from "next";
import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import { COLORS, FONTS } from "@/lib/design-tokens";

// Public podcast-preview landing.
//   /share/podcast?id=<episode_id>&utm_source=...&ref=<hash>
//
// Anon visitors can listen inline (native <audio controls>) before deciding
// to sign up.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EpisodePreview {
  id: string;
  briefing_date: string;
  title: string;
  audio_url: string;
  duration_seconds: number | null;
  tier: string | null;
  archetype: string | null;
  theme_slug: string | null;
}

async function loadEpisode(episodeId: string): Promise<EpisodePreview | null> {
  try {
    const { rows } = await pool.query<{
      id: string;
      briefing_date: string;
      audio_url: string;
      audio_duration_seconds: number | null;
      script: { title?: string } | null;
      tier: string | null;
      archetype: string | null;
      theme_slug: string | null;
    }>(
      `SELECT id, briefing_date::text, audio_url, audio_duration_seconds, script, tier, archetype, theme_slug
       FROM podcast_episodes
       WHERE id = $1
       LIMIT 1`,
      [episodeId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      briefing_date: row.briefing_date,
      title: row.script?.title ?? `ClimatePulse Daily — ${row.briefing_date}`,
      audio_url: row.audio_url,
      duration_seconds: row.audio_duration_seconds,
      tier: row.tier,
      archetype: row.archetype,
      theme_slug: row.theme_slug,
    };
  } catch {
    return null;
  }
}

function formatDate(iso: string): string | null {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s} sec`;
  return `${m} min${s >= 30 ? " " + s + " sec" : ""}`;
}

// ─── Metadata ────────────────────────────────────────────────────────────

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  if (!id) return { title: "Shared podcast — ClimatePulse" };
  const episode = await loadEpisode(id);
  if (!episode) return { title: "ClimatePulse Daily" };

  const title = `${episode.title} — ClimatePulse Daily`;
  const description =
    "A five-minute two-speaker briefing on the day's climate, energy & sustainability news — curated by ClimatePulse.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "music.song",
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

export default async function SharePodcastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  if (!id) notFound();

  const episode = await loadEpisode(id);
  if (!episode) notFound();

  const authed = await getAuthUser();
  const dateLabel = formatDate(episode.briefing_date);
  const durationLabel = formatDuration(episode.duration_seconds);

  let signupHref = "/login";
  if (authed) {
    signupHref = "/dashboard";
  } else if (typeof sp.ref === "string") {
    signupHref = `/login?ref=${encodeURIComponent(sp.ref)}`;
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

        <article
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "clamp(24px, 4vw, 40px)",
          }}
        >
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
            <span style={{ color: COLORS.forest, fontWeight: 600 }}>
              {episode.tier === "flagship"
                ? "Flagship"
                : episode.tier === "themed"
                  ? "Themed"
                  : "Daily"}{" "}
              podcast
            </span>
            {dateLabel && <span style={{ color: COLORS.inkMuted }}>{dateLabel}</span>}
            {durationLabel && (
              <span style={{ color: COLORS.inkFaint }}>{durationLabel}</span>
            )}
          </div>

          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: "clamp(24px, 4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.25,
              color: COLORS.ink,
              margin: 0,
            }}
          >
            {episode.title}
          </h1>

          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              lineHeight: 1.55,
              color: COLORS.inkSec,
              margin: "16px 0 0",
            }}
          >
            A short two-speaker briefing on today's most significant climate and energy
            stories — curated, scripted and produced by ClimatePulse.
          </p>

          <div
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: COLORS.paperDark,
              borderRadius: 6,
            }}
          >
            <audio
              controls
              preload="metadata"
              src={episode.audio_url}
              style={{ width: "100%", display: "block" }}
            >
              Your browser does not support the audio element.{" "}
              <a href={episode.audio_url}>Download the episode.</a>
            </audio>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 24,
            }}
          >
            <a
              href={signupHref}
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
              {authed ? "Open today's briefing" : "Get the daily briefing"}
            </a>
            <a
              href="/"
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
              Learn more about ClimatePulse
            </a>
          </div>
        </article>

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
            A new five-minute audio edition drops every morning alongside the written
            briefing. Free to try.
          </p>
        )}
      </div>
    </main>
  );
}
