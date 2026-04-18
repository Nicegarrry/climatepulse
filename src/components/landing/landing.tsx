"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { PulseArt } from "./pulse-art";
import { SampleBriefingModal } from "./sample-modal";
import "./landing.css";

const ArrowRight = () => (
  <svg className="arrow" width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
    <path
      d="M1 5h14M10 1l5 4-5 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Landing() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const finalCtaRef = useRef<HTMLElement | null>(null);

  // Authed users still route to /dashboard
  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  // Reveal the sticky CTA + topbar Sample button after the hero scrolls past
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  const goEarlyAccess = () => {
    finalCtaRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="cp-landing">
      <header className="topbar">
        <div className="topbar-logo">
          <Image
            src="/leaf only.svg"
            alt=""
            width={24}
            height={24}
            className="mark"
            priority
          />
          <span>climate pulse</span>
        </div>
        <button
          type="button"
          className={`topbar-cta ${pastHero ? "visible" : ""}`}
          onClick={openSample}
        >
          Sample →
        </button>
      </header>

      <Hero onSampleClick={openSample} onCTAClick={goEarlyAccess} />
      <Problem />
      <HowItWorks />
      <WhatYouGet />
      <Personas />
      <Moat />
      <FAQ />
      <FinalCTA sectionRef={finalCtaRef} onCTAClick={() => router.push("/login")} />
      <Footer />

      <div className={`sticky-cta ${pastHero ? "visible" : ""}`} aria-hidden={!pastHero}>
        <button type="button" className="btn-primary" onClick={goEarlyAccess}>
          Get early access
          <ArrowRight />
        </button>
      </div>

      <SampleBriefingModal open={modalOpen} onClose={closeSample} />
    </div>
  );
}

// ─── Section components ────────────────────────────────────────────────────

function Hero({
  onSampleClick,
  onCTAClick,
}: {
  onSampleClick: () => void;
  onCTAClick: () => void;
}) {
  return (
    <section className="hero">
      <div className="hero-eyebrow">
        <span className="dot" aria-hidden />
        <span>Pre-launch · Early access open</span>
      </div>
      <PulseArt />
      <h1 className="hero-title">
        The daily brief for Australia&rsquo;s <em>energy transition.</em>
      </h1>
      <p className="hero-sub">
        ClimatePulse reads the policy drops, market moves, and project news shaping your
        sector — then sends you only what matters. Paired with a live NEM + ASX energy
        dashboard. Built by someone who&rsquo;s worked inside it, not another aggregator.
      </p>
      <div className="hero-cta-stack">
        <button type="button" className="btn-primary" onClick={onCTAClick}>
          Get early access
          <ArrowRight />
        </button>
        <button type="button" className="btn-ghost" onClick={onSampleClick}>
          See a sample briefing <span className="arrow">→</span>
        </button>
      </div>
    </section>
  );
}

function Problem() {
  const sources: { label: string; strike?: boolean }[] = [
    { label: "RenewEconomy" },
    { label: "AFR" },
    { label: "AEMO" },
    { label: "DCCEEW" },
    { label: "pv magazine" },
    { label: "LinkedIn", strike: true },
    { label: "3 Substacks", strike: true },
    { label: "AER" },
    { label: "2 WhatsApps", strike: true },
    { label: "CER" },
    { label: "The Australian" },
    { label: "…" },
  ];
  return (
    <section className="problem">
      <div className="section-num">02 · The problem</div>
      <h2 className="section-title">
        There&rsquo;s too much, and most of it <em>isn&rsquo;t for you.</em>
      </h2>
      <p className="section-lede">
        RenewEconomy, AFR, AEMO, DCCEEW, LinkedIn, three Substacks, two WhatsApp groups.
        Every day more gets published — and the fraction relevant to your work keeps
        shrinking.
      </p>
      <div className="problem-sources">
        {sources.map((s, i) => (
          <span key={i} className="source-chip">
            <span className={s.strike ? "strike" : ""}>{s.label}</span>
          </span>
        ))}
      </div>
      <p className="section-lede" style={{ fontSize: 17 }}>
        Most people respond by skimming more. ClimatePulse flips it: ingest everything,
        surface only what matters for your specific sector and role.
      </p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section>
      <div className="section-num">03 · How it works</div>
      <h2 className="section-title">Three beats, one briefing.</h2>
      <div className="how-cards">
        <div className="how-card">
          <span className="badge">Pipeline</span>
          <span className="how-num">01</span>
          <h3 className="how-heading">We read everything.</h3>
          <p className="how-body">
            Our pipeline ingests hundreds of Australian and global sources daily:
            regulators, utilities, research institutions, trade press, and international
            coverage that moves the Australian market. Two-tier retrieval so
            JavaScript-heavy sites and podcasts don&rsquo;t slip through.
          </p>
        </div>
        <div className="how-card">
          <span className="badge">Model</span>
          <span className="how-num">02</span>
          <h3 className="how-heading">We classify and score.</h3>
          <p className="how-body">
            Every item is tagged across 108 micro-sectors and scored for significance on
            a 0–100 index. The taxonomy was built from scratch for Australian energy
            transition — not borrowed from a generic news ontology.
          </p>
          <div className="score-visual" aria-hidden>
            <div className="score-row">
              <span style={{ minWidth: 120 }}>CIS auction closes</span>
              <div className="score-bar">
                <div className="score-fill" style={{ width: "94%", animationDelay: "0.1s" }} />
              </div>
              <span className="score-val">94</span>
            </div>
            <div className="score-row">
              <span style={{ minWidth: 120 }}>AEMC rule change</span>
              <div className="score-bar">
                <div className="score-fill" style={{ width: "71%", animationDelay: "0.25s" }} />
              </div>
              <span className="score-val">71</span>
            </div>
            <div className="score-row">
              <span style={{ minWidth: 120 }}>Offshore wind EIS</span>
              <div className="score-bar">
                <div className="score-fill" style={{ width: "43%", animationDelay: "0.4s" }} />
              </div>
              <span className="score-val">43</span>
            </div>
          </div>
        </div>
        <div className="how-card">
          <span className="badge">Delivery</span>
          <span className="how-num">03</span>
          <h3 className="how-heading">You get what matters.</h3>
          <p className="how-body">
            Your daily briefing is personalised to the sectors and topics you choose,
            ranked by significance to you. Five-minute read, in your inbox before 6am AEST.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatYouGet() {
  const features: { name: string; desc: string; soon?: boolean }[] = [
    {
      name: "Daily brief",
      desc: "The core product. Personalised, ranked, five minutes long. Email and dashboard.",
    },
    {
      name: "Weekly digest",
      desc: "Longer-form editorial analysis every Sunday. Themes, patterns, what's quietly building.",
    },
    {
      name: "Daily audio",
      desc: "The brief as a short podcast, for the commute. Plus weekly themed episodes that go deeper on a single story.",
    },
    {
      name: "Live energy dashboard",
      desc: "NEM generation mix, wholesale spot prices by state, and the renewables share — updated every five-minute dispatch interval. Opens today's brief with the at-a-glance snapshot.",
    },
    {
      name: "ASX energy tickers",
      desc: "Daily market data for the ASX-listed energy, utilities, and critical-minerals stocks that move with your sector — Origin, Santos, Pilbara, Lynas, IGO, AGL, and more.",
    },
    {
      name: "Storylines",
      soon: true,
      desc: "Follow a narrative across weeks. How a policy fight, project saga, or market shift is actually developing over time.",
    },
    {
      name: "Learn",
      soon: true,
      desc: "Short primers on the concepts, bodies, and acronyms behind the headlines — so new team members can catch up fast.",
    },
  ];
  return (
    <section>
      <div className="section-num">04 · What you get</div>
      <h2 className="section-title">
        A briefing, <em>and a data dashboard.</em>
      </h2>
      <div className="features">
        {features.map((f, i) => (
          <div className="feature-row" key={i} data-soon={f.soon ? "true" : "false"}>
            <div className="feature-mark">{String(i + 1).padStart(2, "0")}</div>
            <div className="feature-body">
              <h3 className="feature-name">
                {f.name}
                {f.soon && <span className="tag">Coming soon</span>}
              </h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const PERSONAS = [
  {
    id: "invest",
    tab: "Investors",
    role: "Investors & analysts",
    what: "Deal flow, policy signals, and the market moves that shape Australian energy thesis work.",
    bullets: [
      "Capital raises, term sheets, M&A",
      "Regulator signals before consensus",
      "ASX energy tickers & sparklines",
    ],
  },
  {
    id: "corp",
    tab: "Corporate",
    role: "Corporate sustainability leads",
    what: "What regulators, peers, and supply chains are doing — before it lands on your CEO's desk.",
    bullets: [
      "Disclosure & reporting rule changes",
      "Peer moves: science-based targets, offtakes",
      "Supply-chain decarb, Scope 3",
    ],
  },
  {
    id: "policy",
    tab: "Policy",
    role: "Policy analysts",
    what: "Consultation openings, draft determinations, parliamentary movement, state-vs-federal dynamics.",
    bullets: [
      "Consultation & submission windows",
      "Draft determinations, final rules",
      "Senate committees, state ministers",
    ],
  },
  {
    id: "dev",
    tab: "Developers",
    role: "Project developers",
    what: "Grid connection, planning, offtake, and permitting signals across the technologies you work in.",
    bullets: [
      "AEMO GPS process & grid connection",
      "Planning approvals & EIS timelines",
      "Offtake markets, CIS outcomes",
    ],
  },
  {
    id: "res",
    tab: "Research",
    role: "Researchers & academics",
    what: "Funding calls, adjacent research, and the policy-industry interface your grants need to track.",
    bullets: [
      "ARENA, ARC, CRC funding rounds",
      "Adjacent research, preprints, data",
      "Policy-industry interface for grants",
    ],
  },
];

function Personas() {
  const [activeId, setActiveId] = useState(PERSONAS[0].id);
  const p = PERSONAS.find((x) => x.id === activeId) ?? PERSONAS[0];
  return (
    <section className="personas">
      <div className="section-num">05 · Built for your role</div>
      <h2 className="section-title">
        Five entry points. <em>One of them is yours.</em>
      </h2>
      <div className="persona-tabs" role="tablist">
        {PERSONAS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === activeId}
            className={`persona-tab ${x.id === activeId ? "active" : ""}`}
            onClick={() => setActiveId(x.id)}
          >
            {x.tab}
          </button>
        ))}
      </div>
      <div className="persona-panel" role="tabpanel">
        <div className="persona-role">{p.role}</div>
        <p className="persona-what">{p.what}</p>
        <ul className="persona-list">
          {p.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Moat() {
  return (
    <section className="moat">
      <div className="section-num">06 · The moat</div>
      <h2 className="section-title">
        Not another <em>AI news aggregator.</em>
      </h2>
      <p>
        Most climate newsletters built in 2025 are a ChatGPT prompt wrapped around an RSS
        feed.
      </p>
      <div className="pull">
        ClimatePulse is different in the parts that matter: the 108-sector taxonomy, the
        significance scoring model, and the source list.
      </div>
      <p>
        These are the product of years working inside Australian energy transition as a
        strategy consultant. AI does the heavy lifting of reading and classifying.
        Editorial judgment — mine — defines what &ldquo;significant&rdquo; means.
      </p>
      <p>
        That&rsquo;s the difference between a briefing that feels curated and a feed that
        feels algorithmic.
      </p>
      <div className="sig">Nick · Founder, ClimatePulse</div>
    </section>
  );
}

const FAQS = [
  { q: "When does it arrive?", a: "Every morning before 6am AEST, seven days a week." },
  {
    q: "What sources do you cover?",
    a: "Australian regulators and policy bodies (DCCEEW, AEMO, AER, CER, state equivalents), utilities, industry associations, trade press (RenewEconomy, pv magazine Australia, etc.), major mastheads, research institutions, and select international sources that affect Australian markets. Full list available on request.",
  },
  {
    q: "How does personalisation work?",
    a: "You pick sectors and topics during onboarding. Significance scoring gets boosted for your areas. The system refines over time based on what you open and read.",
  },
  {
    q: "What does it cost?",
    a: "Early access is free while we shape the product. Paid tiers will be introduced later — early access users will get preferential pricing.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your personalisation choices and engagement data are never shared or sold. Email delivery is via Resend over a custom domain.",
  },
  {
    q: "Who's behind it?",
    a: "A solo operator with a background in Australian energy strategy consulting. More on the About page.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number>(0);
  return (
    <section>
      <div className="section-num">07 · Frequently asked</div>
      <h2 className="section-title">Questions, pre-empted.</h2>
      <div className="faq-list">
        {FAQS.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className={`faq-item ${isOpen ? "open" : ""}`}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
              >
                {item.q}
                <span className="plus" aria-hidden />
              </button>
              <div className="faq-a">{item.a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinalCTA({
  sectionRef,
  onCTAClick,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  onCTAClick: () => void;
}) {
  return (
    <section className="final-cta" ref={sectionRef}>
      <div className="section-num" style={{ justifyContent: "center" }}>
        08 · Start here
      </div>
      <h2 className="section-title">
        Start your morning with <em>signal, not noise.</em>
      </h2>
      <p>
        Early access is open. Takes 30 seconds — drop your email and pick the sectors you
        care about.
      </p>
      <button type="button" className="btn-primary" onClick={onCTAClick}>
        Get early access
        <ArrowRight />
      </button>
      <div className="fine">NO SPAM · UNSUBSCRIBE ANY TIME</div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="foot-row">
        <div>CLIMATEPULSE</div>
        <div>BUILT IN AUSTRALIA</div>
      </div>
      <div className="foot-links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="mailto:hello@climatepulse.app">hello@climatepulse.app</a>
      </div>
      <p className="foot-colophon">
        A small, serious publication for Australian energy transition. Assembled daily in
        Sydney.
      </p>
    </footer>
  );
}
