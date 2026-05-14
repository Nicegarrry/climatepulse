"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { SampleBriefingModal } from "./sample-modal";
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

const Mortarboard = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
    style={{ display: "inline-block", verticalAlign: -1, marginRight: 4 }}
  >
    <path
      d="M1 6.5l7-3.5 7 3.5-7 3.5-7-3.5zM3.5 8v3.5c0 1 2 2 4.5 2s4.5-1 4.5-2V8"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PulseDot = ({ size = 6 }: { size?: number }) => (
  <span
    className="cp-pulse-dot"
    style={{ width: size, height: size }}
    aria-hidden
  />
);

// ─── Pillar data ──────────────────────────────────────────────────────────

type PillarId = "intel" | "learn" | "serve";

type PillarItem = { name: string; tag: string };

const PILLARS: { id: PillarId; num: string; name: string; promise: string }[] = [
  {
    id: "intel",
    num: "01",
    name: "Live intelligence",
    promise: "What changed overnight, and what's moving now.",
  },
  {
    id: "learn",
    num: "02",
    name: "Learning",
    promise: "Catch up on the concepts, the players, and the long arc.",
  },
  {
    id: "serve",
    num: "03",
    name: "Beyond the briefing",
    promise: "Founder-led work for teams that need more than a newsletter.",
  },
];

const PILLAR_ITEMS: Record<PillarId, PillarItem[]> = {
  intel: [
    { name: "Daily briefing", tag: "Live" },
    { name: "Newsroom", tag: "Live" },
    { name: "Energy", tag: "Live" },
    { name: "Markets", tag: "Live" },
  ],
  learn: [
    { name: "Learn", tag: "Live" },
    { name: "Research", tag: "Live" },
    { name: "Weekly Pulse", tag: "Sun" },
    { name: "Teaching", tag: "Jul" },
  ],
  serve: [
    { name: "AutoMACC", tag: "Live" },
    { name: "Private briefings", tag: "Req" },
    { name: "Sector deep reads", tag: "Req" },
    { name: "Workshops", tag: "Q3" },
  ],
};

// ─── Landing root ─────────────────────────────────────────────────────────

export function Landing() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const ctaRef = useRef<HTMLElement | null>(null);

  // Authed users land on /launchpad — the post-auth router page.
  useEffect(() => {
    if (!isLoading && user) router.replace("/launchpad");
  }, [user, isLoading, router]);

  if (user) {
    return (
      <div
        style={{
          minHeight: "100vh",
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

  const openSample = () => setModalOpen(true);
  const closeSample = () => setModalOpen(false);
  const scrollToCTA = () => ctaRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="cp-launchpad">
      <TopNav onScrollToCTA={scrollToCTA} />
      <Hero onSampleClick={openSample} onCTAClick={scrollToCTA} />
      <Pillars onSampleClick={openSample} />
      <Moat />
      <CTA sectionRef={ctaRef} onCTAClick={() => router.push("/login")} />
      <Footer />
      <SampleBriefingModal open={modalOpen} onClose={closeSample} />
    </div>
  );
}

// ─── Top nav ──────────────────────────────────────────────────────────────

function TopNav({ onScrollToCTA }: { onScrollToCTA: () => void }) {
  const handleCTA = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onScrollToCTA();
  };
  return (
    <header className="pl-top">
      <div className="left">
        <Image src="/leaf only.svg" alt="" width={22} height={22} priority />
        <span>climate pulse</span>
      </div>
      <nav className="right">
        <a href="#how">How it works</a>
        <a href="#pillars">What you get</a>
        <a href="#moat">Why it&rsquo;s different</a>
        <a className="login-link" href="/login">
          <Mortarboard />
          Student login
        </a>
        <a className="cta" href="#cta" onClick={handleCTA}>
          Get early access
        </a>
      </nav>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function Hero({
  onSampleClick,
  onCTAClick,
}: {
  onSampleClick: () => void;
  onCTAClick: () => void;
}) {
  return (
    <section className="pl-hero" id="how">
      <div className="container">
        <div className="eyebrow">
          <PulseDot />
          &nbsp; PRE-LAUNCH · EARLY ACCESS OPEN
        </div>
        <h1>
          The daily brief for Australia&rsquo;s <em>energy transition.</em>
        </h1>
        <p className="sub">
          ClimatePulse reads the policy drops, market moves, and project news shaping
          your sector — then sends you only what matters. Paired with a live NEM + ASX
          energy dashboard, deeper learning, and founder-led services for teams that
          need more than a newsletter.
        </p>
        <div className="ctas">
          <button type="button" className="btn-primary" onClick={onCTAClick}>
            Get early access <Arrow />
          </button>
          <button type="button" className="btn-ghost" onClick={onSampleClick}>
            See a sample briefing →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Three-pillar architecture section ───────────────────────────────────

function Pillars({ onSampleClick }: { onSampleClick: () => void }) {
  const [activePillar, setActivePillar] = useState<PillarId>("intel");

  return (
    <section className="pl-architecture" id="pillars">
      <div className="container">
        <div className="pl-arch-head">
          <div>
            <div className="eyebrow">04 · WHAT YOU GET</div>
            <h2>
              A briefing, a classroom, <em>and a workshop.</em>
            </h2>
          </div>
          <p className="copy">
            Climate Pulse is three things on one masthead. A daily intelligence product
            for the morning read. A learning surface for the long arc. And a small set
            of founder-led services for teams that want a more direct line.
          </p>
        </div>

        <div className="pl-arch-switch" role="tablist" aria-label="Preview a pillar">
          {PILLARS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activePillar === p.id}
              className={`pl-switch-btn ${activePillar === p.id ? "active" : ""}`}
              onClick={() => setActivePillar(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="pl-arch-grid">
          {PILLARS.map((p) => {
            const isActive = p.id === activePillar;
            return (
              <article
                key={p.id}
                className={`pl-pillar-card ${isActive ? "active" : ""}`}
              >
                <span className="num">{p.num.replace("0", "")}.</span>
                <h3>{p.name}</h3>
                <p className="promise">{p.promise}</p>
                <ul>
                  {PILLAR_ITEMS[p.id].map((it) => (
                    <li key={it.name}>
                      <span>{it.name}</span>
                      <span className="tag">{it.tag}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" className="open" onClick={onSampleClick}>
                  {p.id === "serve" ? "Talk to us" : "Sample it"} <Arrow />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Moat ─────────────────────────────────────────────────────────────────

function Moat() {
  return (
    <section className="pl-moat" id="moat">
      <div className="container">
        <div className="eyebrow">05 · THE MOAT</div>
        <h2>
          Not another <em>AI news aggregator.</em>
        </h2>
        <p className="lede">
          Most climate newsletters built in 2025 are a ChatGPT prompt wrapped around an
          RSS feed. ClimatePulse is different in the parts that matter: the 108-sector
          taxonomy, the significance scoring model, and the source list. These are the
          product of years working inside Australian energy transition.
        </p>
        <p className="pull">
          AI does the heavy lifting of reading and classifying. Editorial judgement —
          mine — defines what &ldquo;significant&rdquo; means.
        </p>
        <div className="attribution">
          <span className="rule" aria-hidden />
          Nick · Founder, Climate Pulse
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────

function CTA({
  sectionRef,
  onCTAClick,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  onCTAClick: () => void;
}) {
  return (
    <section className="pl-cta" id="cta" ref={sectionRef}>
      <div className="container">
        <div className="eyebrow">06 · START HERE</div>
        <h2>
          Start your morning with <em>signal, not noise.</em>
        </h2>
        <p>
          Early access is open. Takes 30 seconds — drop your email and pick the sectors
          you care about.
        </p>
        <button type="button" className="btn-primary" onClick={onCTAClick}>
          Get early access <Arrow />
        </button>
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
      <span>
        <a href="mailto:hello@climatepulse.app">hello@climatepulse.app</a>
      </span>
    </footer>
  );
}
