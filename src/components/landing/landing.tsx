"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { HeroCanvas } from "./hero-canvas";
import { StickyCTA } from "./sticky-cta";
import { SampleBriefing } from "./sample-briefing";
import { FAQ } from "./faq";

const FONTS = {
  serif: "'Crimson Pro', Georgia, serif",
  sans: "'Source Sans 3', system-ui, sans-serif",
};

const PERSONAS: { role: string; framing: string }[] = [
  {
    role: "Investors & analysts",
    framing:
      "Deal flow, policy signals, and the market moves that shape Australian energy thesis work.",
  },
  {
    role: "Corporate sustainability leads",
    framing:
      "What regulators, peers, and supply chains are doing — before it lands on your CEO's desk.",
  },
  {
    role: "Policy analysts",
    framing:
      "Consultation openings, draft determinations, parliamentary movement, state-vs-federal dynamics.",
  },
  {
    role: "Project developers",
    framing:
      "Grid connection, planning, offtake, and permitting signals across the technologies you work in.",
  },
  {
    role: "Researchers & academics",
    framing:
      "Funding calls, adjacent research, and the policy-industry interface your grants need to track.",
  },
];

const FEATURES: { title: string; desc: string; comingSoon?: boolean }[] = [
  {
    title: "Daily brief",
    desc: "The core product. Personalised, ranked, five minutes long. Email and dashboard.",
  },
  {
    title: "Weekly digest",
    desc: "Longer-form editorial analysis every Sunday. Themes, patterns, what's quietly building.",
  },
  {
    title: "Storylines",
    desc: "Follow a narrative across weeks. How a policy fight, project saga, or market shift is actually developing over time.",
    comingSoon: true,
  },
  {
    title: "Markets pulse",
    desc: "ASX-listed energy tickers, sparklines, and the moves worth knowing about.",
    comingSoon: true,
  },
  {
    title: "Daily audio",
    desc: "The brief as a short podcast, for the commute.",
    comingSoon: true,
  },
];

export function Landing() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Authed users land on /dashboard instead of the marketing page.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (user) {
    // Short-lived flash while the redirect fires; matches the prior loader
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1E4D2B] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]" style={{ fontFamily: FONTS.sans }}>
      {/* ─── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#E8E5E0] bg-[#FAF9F7]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/leaf only.svg" alt="" width={22} height={22} />
            <span
              className="text-[15px] font-semibold tracking-tight text-[#3D1F3D]"
              style={{ fontFamily: FONTS.serif }}
            >
              climate pulse
            </span>
          </Link>
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-md bg-[#1E4D2B] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#163a21] sm:inline-flex"
          >
            Get early access
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center text-[13px] font-medium text-[#1E4D2B] sm:hidden"
          >
            Sign in →
          </Link>
        </div>
      </header>

      {/* ─── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Canvas art sits behind headline */}
        <div className="relative h-[38vh] min-h-[260px] max-h-[420px] w-full">
          <HeroCanvas />
          {/* Subtle gradient fade into content */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#FAF9F7]"
          />
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
          <h1
            className="text-[34px] font-medium leading-[1.1] tracking-tight text-[#1A1A1A] sm:text-[46px] md:text-[56px]"
            style={{ fontFamily: FONTS.serif, fontWeight: 500 }}
          >
            The daily brief for Australia&rsquo;s energy transition.
          </h1>
          <p
            className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#5C5C5C] sm:text-[19px]"
            style={{ fontFamily: FONTS.sans }}
          >
            ClimatePulse reads the policy drops, market moves, and project news shaping your
            sector — then sends you only what matters. Built by someone who&rsquo;s worked
            inside it, not another aggregator.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-md bg-[#1E4D2B] px-6 text-[15px] font-semibold tracking-tight text-white transition-colors hover:bg-[#163a21]"
            >
              Get early access
            </Link>
            <a
              href="#sample-briefing"
              className="flex h-12 items-center justify-center text-[15px] font-medium text-[#1E4D2B] hover:underline"
            >
              See a sample briefing →
            </a>
          </div>
          <p
            className="mt-6 text-[12px] uppercase tracking-[0.14em] text-[#8C8C8C]"
            style={{ fontFamily: FONTS.sans }}
          >
            Free during early access · 30-second signup
          </p>
        </div>

        {/* Sentinel for sticky-CTA observer */}
        <div id="landing-hero-sentinel" aria-hidden className="h-px" />
      </section>

      {/* ─── 2. The problem ──────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          There&rsquo;s too much, and most of it isn&rsquo;t for you.
        </h2>
        <p
          className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#5C5C5C] sm:text-[18px]"
          style={{ fontFamily: FONTS.serif, fontWeight: 400 }}
        >
          RenewEconomy, AFR, AEMO, DCCEEW, LinkedIn, three Substacks, two WhatsApp groups.
          Every day more gets published, and the fraction relevant to your work keeps
          shrinking. Most people respond by skimming more. ClimatePulse flips it: ingest
          everything, surface only what matters for your specific sector and role.
        </p>
      </Section>

      {/* ─── 3. How it works ─────────────────────────────────────────────── */}
      <Section tinted>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          Three steps between the firehose and your inbox.
        </h2>
        <div className="mt-10 space-y-5 sm:mt-12">
          {[
            {
              n: "01",
              title: "We read everything.",
              body:
                "Our pipeline ingests hundreds of Australian and global sources daily: regulators, utilities, research institutions, trade press, and international coverage that moves the Australian market. Two-tier retrieval so JavaScript-heavy sites and podcasts don't slip through.",
            },
            {
              n: "02",
              title: "We classify and score.",
              body:
                "Every item is tagged across 108 micro-sectors and scored for significance on a 0–100 index. The taxonomy was built from scratch for Australian energy transition — not borrowed from a generic news ontology.",
            },
            {
              n: "03",
              title: "You get what matters.",
              body:
                "Your daily briefing is personalised to the sectors and topics you choose, ranked by significance to you. Five-minute read, in your inbox before 6am AEST.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-lg border border-[#E8E5E0] bg-white p-6 sm:p-7"
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="text-[22px] font-light tabular-nums text-[#1E4D2B]"
                  style={{ fontFamily: FONTS.serif, fontWeight: 300 }}
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3
                    className="text-[19px] leading-snug text-[#1A1A1A] sm:text-[21px]"
                    style={{ fontFamily: FONTS.serif, fontWeight: 600 }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-2 text-[15px] leading-relaxed text-[#5C5C5C] sm:text-[16px]"
                    style={{ fontFamily: FONTS.sans }}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Sample briefing preview ─────────────────────────────────────── */}
      <Section>
        <Eyebrow>Preview</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          What a ClimatePulse briefing looks like.
        </h2>
        <p
          className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#5C5C5C]"
          style={{ fontFamily: FONTS.sans }}
        >
          A sample from earlier this month. Your briefing is personalised — this one shows
          grid, critical minerals, and finance. Yours would reflect the sectors you pick
          during onboarding.
        </p>
        <div className="mt-8 sm:mt-10">
          <SampleBriefing />
        </div>
      </Section>

      {/* ─── 4. What you get ─────────────────────────────────────────────── */}
      <Section tinted>
        <Eyebrow>What you get</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          The product, unbundled.
        </h2>
        <div className="mt-10 divide-y divide-[#E8E5E0] border-y border-[#E8E5E0]">
          {FEATURES.map((f) => (
            <div key={f.title} className="grid gap-1 py-6 sm:grid-cols-[200px_1fr] sm:gap-8 sm:py-7">
              <div className="flex items-center gap-2">
                <h3
                  className="text-[17px] leading-snug text-[#1A1A1A] sm:text-[18px]"
                  style={{ fontFamily: FONTS.serif, fontWeight: 600 }}
                >
                  {f.title}
                </h3>
                {f.comingSoon && (
                  <span className="inline-flex h-[18px] items-center rounded-sm border border-[#E8E5E0] bg-[#F5F3F0] px-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#8C8C8C]">
                    Soon
                  </span>
                )}
              </div>
              <p
                className="text-[15px] leading-relaxed text-[#5C5C5C] sm:text-[16px]"
                style={{ fontFamily: FONTS.sans }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 5. Built for your role ──────────────────────────────────────── */}
      <Section>
        <Eyebrow>Built for your role</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          Five roles, five ways in.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PERSONAS.map((p, i) => (
            <div
              key={p.role}
              className="rounded-lg border border-[#E8E5E0] bg-white p-5 sm:p-6"
              style={i === 0 ? { background: "#EFF4EC" } : undefined}
            >
              <h3
                className="text-[17px] leading-snug text-[#1A1A1A] sm:text-[18px]"
                style={{ fontFamily: FONTS.serif, fontWeight: 600 }}
              >
                {p.role}
              </h3>
              <p
                className="mt-2 text-[14px] leading-relaxed text-[#5C5C5C] sm:text-[15px]"
                style={{ fontFamily: FONTS.sans }}
              >
                {p.framing}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 6. The moat ─────────────────────────────────────────────────── */}
      <Section tinted>
        <Eyebrow>Why this is different</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          Not another AI news aggregator.
        </h2>
        <p
          className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[#3D1F3D] sm:text-[18px]"
          style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 400 }}
        >
          Most climate newsletters built in 2025 are a ChatGPT prompt wrapped around an
          RSS feed. ClimatePulse isn&rsquo;t that.
        </p>
        <p
          className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[#5C5C5C] sm:text-[17px]"
          style={{ fontFamily: FONTS.sans }}
        >
          The 108-sector taxonomy, the significance scoring model, and the source list are
          the product of years working inside Australian energy transition as a strategy
          consultant. AI does the heavy lifting of reading and classifying. Editorial
          judgment — mine — defines what &ldquo;significant&rdquo; means. That&rsquo;s the
          difference between a briefing that feels curated and a feed that feels algorithmic.
        </p>
      </Section>

      {/* ─── 7. FAQ ──────────────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Frequently asked</Eyebrow>
        <h2 className="mt-3" style={headingStyle()}>
          Questions before signing up.
        </h2>
        <div className="mt-8">
          <FAQ />
        </div>
      </Section>

      {/* ─── 8. Final CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-[#E8E5E0] bg-[#FAF9F7] px-4 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-2xl">
          <h2
            className="text-[28px] leading-tight text-[#1A1A1A] sm:text-[36px]"
            style={{ fontFamily: FONTS.serif, fontWeight: 500 }}
          >
            Start your morning with signal, not noise.
          </h2>
          <p
            className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[#5C5C5C] sm:text-[17px]"
            style={{ fontFamily: FONTS.sans }}
          >
            Early access is open. Takes 30 seconds — drop your email and pick the sectors
            you care about.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#1E4D2B] px-8 text-[15px] font-semibold tracking-tight text-white transition-colors hover:bg-[#163a21]"
            >
              Get early access
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 9. Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E5E0] bg-[#F5F3F0] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/leaf only.svg" alt="" width={18} height={18} />
            <span
              className="text-[13px] font-semibold tracking-tight text-[#3D1F3D]"
              style={{ fontFamily: FONTS.serif }}
            >
              climate pulse
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-[#8C8C8C]">
              · Built in Australia
            </span>
          </div>
          <div className="flex flex-wrap gap-5 text-[12px] text-[#5C5C5C]">
            <Link href="/privacy" className="hover:text-[#1A1A1A]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1A1A1A]">Terms</Link>
            <a href="mailto:hello@climatepulse.app" className="hover:text-[#1A1A1A]">Contact</a>
          </div>
        </div>
      </footer>

      <StickyCTA />
    </div>
  );
}

function Section({
  children,
  tinted = false,
}: {
  children: React.ReactNode;
  tinted?: boolean;
}) {
  return (
    <section
      className={`px-4 py-20 sm:px-6 sm:py-24 ${tinted ? "bg-[#F5F3F0]" : "bg-[#FAF9F7]"}`}
    >
      <div className="mx-auto max-w-3xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E4D2B]"
      style={{ fontFamily: FONTS.sans }}
    >
      {children}
    </div>
  );
}

function headingStyle(): React.CSSProperties {
  return {
    fontFamily: FONTS.serif,
    fontWeight: 500,
    fontSize: "clamp(26px, 4vw, 36px)",
    lineHeight: 1.15,
    letterSpacing: "-0.01em",
    color: "#1A1A1A",
  };
}
