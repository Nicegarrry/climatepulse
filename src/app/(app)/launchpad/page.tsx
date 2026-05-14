/**
 * /launchpad — post-login, pre-feature dashboard triptych.
 *
 * Server component. Wrapped by the (app) route group's client layout, which
 * gates render on `useAuth`. We additionally redirect unauthenticated users
 * here at the request level so direct visits don't even reach the client.
 *
 * Design source: /tmp/launchpad-design/.../launchpad/DirC.jsx
 *
 * Data:
 *   - User profile (id, name, role, tier, onboarded_at, primary_sectors)
 *   - Today's briefing existence  → drives "READY" vs "PERSONALISE" copy
 *   - Latest published Weekly Pulse → hero card, hidden if absent
 *   - NEM live snapshot via fetchEnergyDashboard → falls back to a sample
 *   - Overnight ingest count from `raw_articles`, omitted if unavailable
 */

import { redirect } from "next/navigation";
import { Inter_Tight, Newsreader, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";

import { getAuthUser } from "@/lib/supabase/server";
import { MonoEyebrow, PulseDot, Row } from "@/components/launchpad/primitives";
import { LiveTile } from "@/components/launchpad/live-tile";
import { WeeklyTile } from "@/components/launchpad/weekly-tile";
import { MaccTile } from "@/components/launchpad/macc-tile";
import {
  formatAESTStamps,
  getLatestWeekly,
  getLaunchpadProfile,
  getLiveSnapshot,
  getNewsroomCount,
  getOvernightIngestCount,
  hasBriefingToday,
} from "@/components/launchpad/data";

import "@/components/launchpad/launchpad.css";

export const metadata: Metadata = {
  title: "Launchpad — Climate Pulse",
  description: "Three things to read, two things to do.",
};

// Scoped fonts. The root layout uses Crimson Pro / Source Sans 3;
// the launchpad design calls for Newsreader / Inter Tight / JetBrains Mono.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export default async function LaunchpadPage() {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");

  const [profile, hasBrief, weekly, snapshot, newsroomCount, ingestCount] =
    await Promise.all([
      getLaunchpadProfile(authUser.id),
      hasBriefingToday(authUser.id),
      getLatestWeekly(),
      getLiveSnapshot(),
      getNewsroomCount(),
      getOvernightIngestCount(),
    ]);

  const displayName =
    profile?.name?.trim().split(/\s+/)[0] ||
    (authUser.user_metadata?.name as string | undefined)?.trim().split(/\s+/)[0] ||
    "there";

  const { time, date } = formatAESTStamps();

  const briefingMeta = hasBrief ? "READY · 5 MIN" : "PERSONALISE";
  const briefingDesc = hasBrief
    ? "Your daily digest is ready. Five minutes, three signals, one verdict."
    : "Tell us your sectors and we'll generate your first briefing tomorrow morning.";

  const newsroomMeta =
    typeof newsroomCount === "number" ? `${newsroomCount} NEW` : "LIVE";

  const weeklyHref = weekly ? `/dashboard?tab=weekly` : "#";
  const weeklyEdition = weekly
    ? weekly.edition_number
      ? `Edition ${weekly.edition_number}`
      : "Latest"
    : "";
  const weeklyDate = weekly?.published_at
    ? new Date(weekly.published_at).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const weeklyLede =
    weekly?.editor_narrative?.replace(/\s+/g, " ").trim().slice(0, 180) ?? "";

  const className = [
    "lp-launchpad",
    interTight.variable,
    newsreader.variable,
    jbMono.variable,
  ].join(" ");

  return (
    <div className={className}>
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="lp-head">
        <h1 className="serif">
          Good morning, {displayName}.{" "}
          <span className="em-accent">Three things to read, two things to do.</span>
        </h1>
        <div className="stamp">
          <span className="live">
            <PulseDot /> live · {time}
          </span>
          <span>{date}</span>
          {ingestCount !== null && (
            <span>pipeline · {ingestCount.toLocaleString("en-AU")} items ingested overnight</span>
          )}
        </div>
      </div>

      {/* ── Triptych ─────────────────────────────────────────────────── */}
      <div className="lp-grid">
        {/* ── 01 · Live intelligence ──────────────────────────────── */}
        <section className="lp-col" aria-labelledby="lp-col-1">
          <div className="lp-col-head">
            <div className="top">
              <span className="num">01.</span>
              <MonoEyebrow>Live</MonoEyebrow>
            </div>
            <h2 id="lp-col-1">Live intelligence</h2>
            <p className="promise">
              What changed overnight, and what&apos;s moving now.
            </p>
          </div>
          <div className="lp-col-body">
            <LiveTile
              href="/dashboard?tab=energy"
              states={snapshot.states}
              renewablesPct={snapshot.renewablesPct}
              isSample={snapshot.isSample}
            />
            <Row
              href="/dashboard?tab=intelligence"
              name="Today's briefing"
              meta={briefingMeta}
              desc={briefingDesc}
            />
            <Row
              href="/dashboard?tab=newsroom"
              name="Newsroom"
              meta={newsroomMeta}
              desc="Live wire feed across AEMO, ASX, DCCEEW and the trade press."
            />
            <Row
              href="/dashboard?tab=markets"
              name="Markets"
              meta="ASX 10:00"
              desc="ASX energy + minerals movers, refreshed through the trading day."
            />
          </div>
          <div className="lp-col-cta">
            <a href="/dashboard">
              Go to live intelligence
              <span className="path">→ /dashboard</span>
            </a>
          </div>
        </section>

        {/* ── 02 · Learning ───────────────────────────────────────── */}
        <section className="lp-col" aria-labelledby="lp-col-2">
          <div className="lp-col-head">
            <div className="top">
              <span className="num">02.</span>
              <MonoEyebrow>This week</MonoEyebrow>
            </div>
            <h2 id="lp-col-2">Learning</h2>
            <p className="promise">
              Catch up on the concepts, the players, and the long arc.
            </p>
          </div>
          <div className="lp-col-body">
            {weekly && (
              <WeeklyTile
                href={weeklyHref}
                edition={weeklyEdition}
                date={weeklyDate}
                title={weekly.headline}
                lede={weeklyLede}
              />
            )}
            <Row
              href="/learn"
              name="Learn"
              meta="PRIMERS"
              desc="Short primers on the concepts, programs, and people that drive the transition."
            />
            <Row
              href="/learn"
              name="Research"
              meta="NEW · APR"
              desc="Long-form pieces — primers, explainers, data notes. New work each month."
            />
            <Row
              href="/teaching"
              name="Teaching"
              meta="JULY · COHORT 01"
              tag="Soon"
              desc="'Australian Energy Transition 101' — eight live sessions, founder-led, capped at 24."
            />
          </div>
          <div className="lp-col-cta">
            <a href="/learn">
              Go to learning
              <span className="path">→ /learn</span>
            </a>
          </div>
        </section>

        {/* ── 03 · Beyond the briefing ────────────────────────────── */}
        <section className="lp-col" aria-labelledby="lp-col-3">
          <div className="lp-col-head">
            <div className="top">
              <span className="num">03.</span>
              <MonoEyebrow>Founder-led</MonoEyebrow>
            </div>
            <h2 id="lp-col-3">Beyond the briefing</h2>
            <p className="promise">
              Founder-led work for teams that need more than a newsletter.
            </p>
          </div>
          <div className="lp-col-body">
            <MaccTile href="/automacc" />
            <Row
              href="/services/private"
              name="Private briefings"
              meta="BY REQUEST"
              desc="A bespoke daily brief for one investment committee, board, or executive team."
            />
            <Row
              href="/services/deep"
              name="Sector deep reads"
              meta="6-WEEK"
              desc="Six-week engagements on a single sector. Written by Nick, not a team."
            />
            <Row
              href="/services/workshops"
              name="Workshops"
              meta="Q3 2026"
              tag="Soon"
              desc="Half-day desk-side workshops for analyst teams. Format finalising."
            />
          </div>
          <div className="lp-col-cta">
            <a href="/services">
              Talk to us
              <span className="path">→ /services</span>
            </a>
          </div>
        </section>
      </div>

      <div className="lp-foot">
        <span>climate pulse · launchpad · {date}</span>
        <span>
          {ingestCount !== null
            ? `ingested ${ingestCount.toLocaleString("en-AU")} overnight`
            : "live · personalised"}
        </span>
      </div>
    </div>
  );
}
