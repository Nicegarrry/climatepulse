/**
 * /launchpad — post-login front door, trimmed to the surfaces that work today.
 *
 * Server component. Wrapped by the (app) route group's client layout, which
 * gates render on `useAuth`. We additionally redirect unauthenticated users
 * here at the request level so direct visits don't even reach the client.
 *
 * Layout (deliberately minimal, very visual):
 *   - Hero          → Dashboard / today's briefing (the flagship surface),
 *                     with Newsroom + Markets as small sub-component cards.
 *   - Tile row      → NEM live · AutoMACC · Learn (greyed "coming soon").
 *
 * Everything else from the old triptych (Weekly, Research, Teaching, Services)
 * is intentionally cut for now to keep the entry point focused.
 */

import { redirect } from "next/navigation";
import { Inter_Tight, Newsreader, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";

import { getAuthUser } from "@/lib/supabase/server";
import { MonoEyebrow, PulseDot, Arrow, MiniSpark } from "@/components/launchpad/primitives";
import { DuckCurveTile } from "@/components/launchpad/duck-curve-tile";
import { MaccTile } from "@/components/launchpad/macc-tile";
import {
  formatAESTStamps,
  getDuckCurve,
  getLaunchpadProfile,
  getNewsroomCount,
  getOvernightIngestCount,
  hasBriefingToday,
} from "@/components/launchpad/data";

import "@/components/launchpad/launchpad.css";

export const metadata: Metadata = {
  title: "Launchpad — Climate Pulse",
  description: "Your climate intelligence desk.",
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

  const [profile, hasBrief, duckCurve, newsroomCount, ingestCount] =
    await Promise.all([
      getLaunchpadProfile(authUser.id),
      hasBriefingToday(authUser.id),
      getDuckCurve(),
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
    ? "Your daily digest is ready. Five minutes, three signals, one verdict — the day's climate, energy and transition intelligence in one read."
    : "Tell us your sectors and we'll generate your first briefing tomorrow morning. The full desk — newsroom, markets and energy — feeds into it.";

  const newsroomLabel =
    typeof newsroomCount === "number" ? newsroomCount.toLocaleString("en-AU") : "—";

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
          <span className="em-accent">Here&apos;s your climate desk.</span>
        </h1>
        <div className="stamp">
          <span className="live">
            <PulseDot /> live · {time}
          </span>
          <span>{date}</span>
          {ingestCount !== null && (
            <span>pipeline · {ingestCount.toLocaleString("en-AU")} items overnight</span>
          )}
        </div>
      </div>

      {/* ── Hero · the briefing (dashboard) ──────────────────────────── */}
      <section className="lp-hero" aria-labelledby="lp-hero-title">
        <div className="lp-hero-main">
          <div className="lp-hero-top">
            <span className="num">01.</span>
            <MonoEyebrow>The briefing · your daily read</MonoEyebrow>
          </div>
          <h2 id="lp-hero-title">Today&apos;s briefing</h2>
          <p className="lp-hero-desc">{briefingDesc}</p>
          <div className="lp-hero-status">
            <PulseDot />
            <span>{briefingMeta}</span>
          </div>
          <a className="lp-hero-cta" href="/dashboard?tab=intelligence">
            Open the dashboard <Arrow size={14} />
          </a>
        </div>

        {/* Markets + Newsroom — small sub-components that feed the hero */}
        <div className="lp-hero-subs">
          <span className="lp-subs-cap">
            <MonoEyebrow>Feeding today&apos;s read</MonoEyebrow>
          </span>

          <a className="lp-subtile" href="/dashboard?tab=newsroom">
            <div className="st-top">
              <span className="st-name">Newsroom</span>
              <PulseDot />
            </div>
            <div className="st-figure">{newsroomLabel}</div>
            <div className="st-label">new wire items · last 24h</div>
            <div className="st-foot">
              Open newsroom <Arrow />
            </div>
          </a>

          <a className="lp-subtile" href="/dashboard?tab=markets">
            <div className="st-top">
              <span className="st-name">Markets</span>
              <MiniSpark data={[44, 47, 45, 51, 49, 56, 60]} w={52} h={14} />
            </div>
            <div className="st-figure st-figure-sm">ASX</div>
            <div className="st-label">energy &amp; minerals movers</div>
            <div className="st-foot">
              Open markets <Arrow />
            </div>
          </a>
        </div>
      </section>

      {/* ── Feature tiles ────────────────────────────────────────────── */}
      <div className="lp-tiles">
        {/* 02 · NEM live energy */}
        <div className="lp-tile">
          <div className="lp-tile-cap">
            <span className="num">02.</span>
            <MonoEyebrow>Energy · NEM</MonoEyebrow>
          </div>
          <DuckCurveTile
            href="/dashboard?tab=energy"
            timestamps={duckCurve.timestamps}
            generation={duckCurve.generation}
            price={duckCurve.price}
            fueltechs={duckCurve.fueltechs}
            renewablesPct={duckCurve.renewablesPct}
            isSample={duckCurve.isSample}
          />
        </div>

        {/* 03 · AutoMACC */}
        <div className="lp-tile">
          <div className="lp-tile-cap">
            <span className="num">03.</span>
            <MonoEyebrow>Decarbonisation</MonoEyebrow>
          </div>
          <MaccTile href="/automacc" />
        </div>

        {/* 04 · Learn — coming soon (greyed, non-interactive) */}
        <div className="lp-tile lp-tile-soon" aria-disabled="true">
          <div className="lp-tile-cap">
            <span className="num">04.</span>
            <MonoEyebrow>Learn</MonoEyebrow>
            <span className="soon-badge">Coming soon</span>
          </div>
          <div className="lp-soon">
            <div className="lp-soon-rows" aria-hidden="true">
              <span className="lp-soon-row" style={{ width: "82%" }} />
              <span className="lp-soon-row" style={{ width: "64%" }} />
              <span className="lp-soon-row" style={{ width: "73%" }} />
              <span className="lp-soon-row" style={{ width: "48%" }} />
            </div>
            <div className="lp-soon-overlay">
              <ClockIcon />
              <span>Primers, explainers &amp; the long arc — landing soon.</span>
            </div>
          </div>
        </div>
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

function ClockIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
