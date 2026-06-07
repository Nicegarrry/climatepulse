"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth-context";
import type { PublicStory } from "@/lib/digest/public-digest";
import "./landing.css";

const Arrow = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
    style={{ display: "inline-block", verticalAlign: -1 }}
  >
    <path
      d="M3 8h10M9 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PulseDot = ({ size = 6 }: { size?: number }) => (
  <span className="cp-pulse-dot" style={{ width: size, height: size }} aria-hidden />
);

// ─── Helpers (ported from /today so the board reads faithfully) ─────────────

function prettify(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function sentimentColor(s: string | null): string {
  if (s === "positive") return "var(--accent)";
  if (s === "negative") return "#B23A2E";
  return "var(--ink-3)";
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

// Animate a live counter from 0 -> target on mount. State seeds to the real
// number so SSR/first paint match (no hydration mismatch); when motion is
// allowed the rAF loop resets to 0 on its first frame and eases up. Reduced
// motion or a non-positive count just leaves the seeded value in place. All
// setState happens inside the rAF callback, never synchronously in the effect.
function useCountUp(target: number): number {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (target <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start: number | null = null;
    const duration = 850;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

// ─── Pricing data ───────────────────────────────────────────────────────────

const FOUNDERS_FEATURES = [
  "Personalised daily briefing, written to your sectors",
  "Newsroom — the live wire feed, deduped and ranked",
  "Energy dashboard (live NEM) + Markets dashboard",
  "Learn + Research, grounded in the sector taxonomy",
  "Weekly Pulse report every Sunday",
  "A daily podcast for the commute",
];

const PREMIUM_FEATURES = [
  "Access to premium & paywalled sources",
  "High-quality research from a proprietary knowledge base",
  "A daily podcast individually customised to you",
  "A premium fortnightly podcast + newsletter",
  "Priority desk requests and deeper sector deep-reads",
];

// ─── Landing root ─────────────────────────────────────────────────────────

export function Landing({
  topStories,
  signalsTracked,
}: {
  topStories: PublicStory[];
  signalsTracked: number;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Authed users land on /launchpad — the post-auth router page.
  useEffect(() => {
    if (!isLoading && user) router.replace("/launchpad");
  }, [user, isLoading, router]);

  if (user) {
    return (
      <div
        className="cp-launchpad"
        style={{
          minHeight: "calc(100vh / 1.125)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5EFE6",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid #0F4D2A",
            borderTopColor: "transparent",
            animation: "cp-pulse 1s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div className="cp-launchpad">
      <TopNav />
      <Hero topStories={topStories} signalsTracked={signalsTracked} />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── Top nav — logo + single Sign-up CTA ────────────────────────────────────

function TopNav() {
  return (
    <header className="pl-top">
      <div className="left">
        <Image src="/leaf only.svg" alt="" width={22} height={22} priority />
        <span>climate pulse</span>
      </div>
      <nav className="right">
        <Link className="cta" href="/login">
          Sign up now
        </Link>
      </nav>
    </header>
  );
}

// ─── Hero — headline, dominant CTA, inline live board ───────────────────────

function Hero({
  topStories,
  signalsTracked,
}: {
  topStories: PublicStory[];
  signalsTracked: number;
}) {
  const count = useCountUp(signalsTracked);
  const showCount = signalsTracked > 0;

  return (
    <section className="pl-hero">
      <div className="container">
        <div className="eyebrow cp-rise cp-rise-1">
          <PulseDot />
          &nbsp; LIVE ·{" "}
          {showCount
            ? `${count.toLocaleString("en-AU")} signals tracked today`
            : "tracking the transition"}
        </div>
        <h1 className="cp-rise cp-rise-2">
          The daily climate &amp; energy brief that reads everything, so you read{" "}
          <em>five minutes.</em>
        </h1>
        <p className="sub cp-rise cp-rise-3">
          ClimatePulse tracks every policy drop, market move and project filing across
          Australia&rsquo;s energy transition overnight, then writes you a personalised
          briefing tuned to your sectors. Built for the investors, analysts and policy
          professionals who can&rsquo;t afford to miss the signal.
        </p>
        <div className="ctas cp-rise cp-rise-4">
          <Link href="/login" className="btn-primary btn-xl">
            Sign up now <Arrow size={15} />
          </Link>
          <Link href="/today" className="btn-ghost">
            See today&rsquo;s dashboard without logging in
          </Link>
        </div>

        <LiveBoard stories={topStories} />
      </div>
    </section>
  );
}

// ─── Inline live signal board — the single proof element ────────────────────

function LiveBoard({ stories }: { stories: PublicStory[] }) {
  return (
    <div className="pl-board cp-rise cp-rise-5" aria-label="Today's live signal board">
      <div className="pl-board-head">
        <span className="kicker">
          <PulseDot /> On the desk right now
        </span>
        <Link href="/today" className="full">
          Full board <Arrow size={12} />
        </Link>
      </div>

      {stories.length > 0 ? (
        <div className="pl-board-rows">
          {stories.map((s, i) => {
            const domain = prettify(s.primary_domain);
            const signal = prettify(s.signal_type);
            const time = fmtTime(s.published_at);
            return (
              <article className="pl-board-row" key={s.article_url || i}>
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="body">
                  <div className="chips">
                    {domain && <span className="chip">{domain}</span>}
                    {signal && <span className="chip">{signal}</span>}
                    {s.sentiment && (
                      <span
                        className="sent"
                        role="img"
                        aria-label={`sentiment: ${s.sentiment}`}
                        style={{ background: sentimentColor(s.sentiment) }}
                      />
                    )}
                  </div>
                  <p className="title">{s.title}</p>
                  <div className="meta">
                    {s.source_name ?? "Source"}
                    {time ? ` · ${time} AEST` : ""}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pl-board-empty">
          <p className="h">Today&rsquo;s board is compiling</p>
          <p className="s">
            The overnight desk run is still processing — the live feed returns shortly.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Pricing — Founders (active) vs Premium (greyed, inert) ──────────────────

function Pricing() {
  return (
    <section className="pl-pricing" id="pricing">
      <div className="container">
        <div className="pl-pricing-head">
          <div className="eyebrow">PRICING</div>
          <h2>
            Two ways <em>in.</em>
          </h2>
        </div>

        <div className="pl-price-grid">
          {/* Founders — the live, free, selectable offer */}
          <article className="pl-price-card founders">
            <div className="badge">Current offer · Early access</div>
            <h3>Founders</h3>
            <div className="price">Free · early access</div>
            <ul>
              {FOUNDERS_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon className="ico" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="btn-primary card-cta">
              Sign up now <Arrow />
            </Link>
          </article>

          {/* Premium — future tier, deliberately greyed out and inert */}
          <article className="pl-price-card cp-tier--soon">
            <span className="cp-sr-only">Premium tier — not yet available</span>
            <div className="badge">Coming soon</div>
            <h3>Premium</h3>
            <div className="price">Pricing TBC</div>
            <ul>
              {PREMIUM_FEATURES.map((f) => (
                <li key={f}>
                  <LockClosedIcon className="ico" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="card-cta soon" disabled>
              Coming soon
            </button>
          </article>
        </div>

        <p className="pl-pricing-note">
          Founders members get first access and locked-in pricing when Premium ships.
        </p>
      </div>
    </section>
  );
}

// ─── Final CTA band ─────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="pl-cta">
      <div className="container">
        <h2>
          Start tomorrow morning with <em>signal, not noise.</em>
        </h2>
        <p>
          Early access is open and free. Drop your email, pick your sectors, and your
          first briefing lands before 6am AEST.
        </p>
        <div className="ctas">
          <Link href="/login" className="btn-primary btn-xl">
            Sign up now <Arrow size={15} />
          </Link>
          <Link href="/today" className="btn-ghost">
            See today&rsquo;s dashboard first
          </Link>
        </div>
        <div className="stamp">NO SPAM · UNSUBSCRIBE ANY TIME</div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="pl-foot">
      <span>CLIMATE PULSE · BUILT IN AUSTRALIA</span>
      <span className="links">
        <Link href="/today">Today&rsquo;s board</Link>
        <a href="mailto:hello@climatepulse.app">hello@climatepulse.app</a>
      </span>
    </footer>
  );
}
