"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import type { DailyBriefing, DigestHeroStory, DigestCompactStory } from "@/lib/types";
import type { EnergyDashboardData } from "@/lib/energy/openelectricity";
import { WobblyRule, Micro, SourceTag } from "./primitives";
import { LeadStories } from "./lead-stories";
import { AlsoToday } from "./also-today";
import { GlowingBriefingCard } from "./glowing-card";
import { StoriesOverlay } from "./stories-overlay";
import { EnergySidebar } from "./energy-sidebar";
import type { EditorialStory, DailyNumber as DailyNumberType } from "@/lib/mock-editorial";
import {
  LEADS as MOCK_LEADS,
  ALSO as MOCK_ALSO,
  BRIEFING as MOCK_BRIEFING,
  DAILY_NUMBER as MOCK_DAILY_NUMBER,
  TODAYS_READ as MOCK_TODAYS_READ,
  MARKET_CONTEXT,
} from "@/lib/mock-editorial";

// ─── Transform API data to editorial shapes ─────────────────────────────────

function heroToEditorial(hero: DigestHeroStory, idx: number): EditorialStory {
  return {
    id: idx + 1,
    sector: hero.micro_sectors?.[0]?.toUpperCase().replace(/-/g, " ") || "GENERAL",
    severity: idx === 0 ? "alert" : "watch",
    headline: hero.headline,
    summary: hero.expert_take,
    body: hero.expert_take,
    whyItMatters: hero.so_what || "",
    sources: [hero.source],
    sourceTypes: [],
    number: hero.key_metric?.value,
    unit: hero.key_metric?.unit,
    trend: hero.key_metric?.delta || undefined,
    isLead: idx === 0,
  };
}

function compactToEditorial(compact: DigestCompactStory, idx: number, offset: number): EditorialStory {
  return {
    id: offset + idx + 1,
    sector: "GENERAL",
    severity: "ready",
    headline: compact.headline,
    summary: compact.one_line_take,
    body: compact.one_line_take,
    whyItMatters: "",
    sources: [compact.source],
    sourceTypes: [],
    number: compact.key_metric?.value,
    unit: compact.key_metric?.unit,
  };
}

// ─── Daily Number component ─────────────────────────────────────────────────

function DailyNumberDisplay({ data }: { data: DailyNumberType }) {
  return (
    <div
      style={{
        borderTop: `2px solid ${COLORS.plum}`,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTopWidth: 2,
        borderTopColor: COLORS.plum,
        borderRadius: 8,
        padding: "18px 22px",
        flex: "0 0 215px",
        marginTop: -4,
      }}
    >
      <Micro color={COLORS.plum}>Daily Number</Micro>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
        <span
          style={{
            fontFamily: FONTS.serif,
            fontSize: 46,
            fontWeight: 300,
            color: COLORS.plum,
            letterSpacing: -1.5,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.value}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.plumMid }}>{data.unit}</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSec, marginTop: 5 }}>{data.label}</div>
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.forest, fontVariantNumeric: "tabular-nums" }}>
          {data.change}
        </span>
        <span style={{ fontSize: 10, color: COLORS.inkMuted }}>{data.changeLabel}</span>
      </div>
      {data.context && (
        <p style={{ fontSize: 10, color: COLORS.inkMuted, lineHeight: 1.5, margin: "5px 0 0" }}>{data.context}</p>
      )}
      <div style={{ marginTop: 8 }}>
        <SourceTag name={data.source} type="data" />
      </div>
    </div>
  );
}

function DailyNumberMobile({ data }: { data: DailyNumberType }) {
  return (
    <div style={{ padding: "20px 20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Micro color={COLORS.plum}>Daily Number</Micro>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
            <span
              style={{
                fontFamily: FONTS.serif,
                fontSize: 42,
                fontWeight: 300,
                color: COLORS.plum,
                letterSpacing: -1.5,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {data.value}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.plumMid }}>{data.unit}</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkSec, marginTop: 4 }}>{data.label}</div>
        </div>
        <div style={{ textAlign: "right", paddingBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.forest, fontVariantNumeric: "tabular-nums" }}>
            {data.change}
          </span>
          <div style={{ fontSize: 9, color: COLORS.inkMuted, marginTop: 1 }}>{data.changeLabel}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Today's Read (sans-serif, no italic) ───────────────────────────────────

function TodaysReadBlock({ text }: { text: string }) {
  return (
    <div style={{ flex: 1, paddingTop: 4 }}>
      <Micro color={COLORS.forest} mb={8}>
        Today{"\u2019"}s Read
      </Micro>
      <p
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          color: COLORS.inkSec,
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ─── Mobile Market Context ──────────────────────────────────────────────────

function MobileMarketContext({ data }: { data: EnergyDashboardData | null }) {
  if (!data) return null;

  return (
    <>
      <div style={{ padding: "16px 20px 6px" }}>
        <Micro color={COLORS.forest}>Market Context</Micro>
      </div>
      <div style={{ padding: "0 20px 14px" }}>
        {/* Price cards */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {data.price_summaries.slice(0, 2).map((p) => (
            <div
              key={p.region}
              style={{
                flex: 1,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <div style={{ fontSize: 8, color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>
                {p.region}
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
                ${Math.round(p.latest_price ?? 0)}
              </span>
              <span style={{ fontSize: 9, color: COLORS.inkMuted }}>/MWh</span>
            </div>
          ))}
        </div>
        {/* State prices row */}
        <div style={{ display: "flex", gap: 3 }}>
          {data.price_summaries.map((d) => (
            <div
              key={d.region}
              style={{
                flex: 1,
                textAlign: "center",
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 5,
                padding: "5px 0",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
                ${Math.round(d.latest_price ?? 0)}
              </div>
              <div style={{ fontSize: 8, color: COLORS.inkMuted }}>{d.region}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: COLORS.inkFaint, marginTop: 6 }}>
          Renewables: {data.renewable_pct_today?.toFixed(1) ?? "..."}% today
        </div>
      </div>
    </>
  );
}

// ─── Mobile Story List ──────────────────────────────────────────────────────

function MobileStoryList({
  stories,
  onOpenStories,
}: {
  stories: EditorialStory[];
  onOpenStories: (idx: number) => void;
}) {
  return (
    <>
      <div style={{ padding: "12px 20px 6px" }}>
        <Micro>Today{"\u2019"}s Stories</Micro>
      </div>
      {stories.map((story, idx) => {
        const sev = SEVERITY[story.severity] || SEVERITY.watch;
        return (
          <div
            key={story.id}
            onClick={() => onOpenStories(idx)}
            style={{
              padding: "12px 20px",
              borderBottom: `1px solid ${COLORS.borderLight}`,
              borderLeft: `2px solid ${sev.borderColor}`,
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
              <Micro color={sev.labelColor}>{story.sector}</Micro>
              {story.number && (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{story.number}</span>
                  <span style={{ fontSize: 9, color: COLORS.inkMuted, marginLeft: 2 }}>{story.unit}</span>
                </span>
              )}
            </div>
            <h3 style={{ fontFamily: FONTS.serif, fontSize: 15, fontWeight: 400, color: COLORS.ink, lineHeight: 1.3, margin: 0 }}>
              {story.headline}
            </h3>
            <div style={{ fontSize: 10, color: COLORS.inkFaint, marginTop: 4 }}>
              {story.sources[0]}
              {story.sources.length > 1 && ` +${story.sources.length - 1}`}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Loading / Error states ─────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: "40px 32px", color: COLORS.inkMuted, fontSize: 13 }}>
      <Micro>Loading briefing...</Micro>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 60, background: COLORS.borderLight, borderRadius: 8, animation: "fadeIn 1s ease infinite alternate" }} />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: "40px 32px" }}>
      <Micro color={COLORS.ink}>Briefing unavailable</Micro>
      <p style={{ fontSize: 13, color: COLORS.inkSec, marginTop: 8 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          background: COLORS.forest,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Desktop Layout ─────────────────────────────────────────────────────────
// Single scroll context — main + sidebar scroll together

function DesktopIntelligence({
  leads,
  also,
  dailyNumber,
  todaysRead,
  energyData,
}: {
  leads: EditorialStory[];
  also: EditorialStory[];
  dailyNumber: DailyNumberType;
  todaysRead: string;
  energyData: EnergyDashboardData | null;
}) {
  const totalStories = leads.length + also.length;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex" }}>
      {/* Editorial column */}
      <main style={{ flex: 1, padding: "26px 32px 60px", maxWidth: 860, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 400, color: COLORS.ink, margin: 0, letterSpacing: -0.8, lineHeight: 1.1 }}>
              {dateStr}
            </h1>
            <div style={{ marginTop: 5, display: "flex", alignItems: "baseline", gap: 12 }}>
              <Micro>Daily Briefing</Micro>
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkFaint }}>
                {totalStories} stories
              </span>
            </div>
          </div>
          <span style={{ fontSize: 13, fontFamily: FONTS.serif, fontStyle: "italic", paddingBottom: 2 }}>
            <span style={{ color: COLORS.forest }}>climate</span>
            <span style={{ color: COLORS.plum }}>pulse</span>
          </span>
        </div>

        <div style={{ margin: "18px 0 22px" }}><WobblyRule /></div>

        {/* Today's Read + Daily Number (number on right) */}
        <div style={{ display: "flex", gap: 20, marginBottom: 26, alignItems: "flex-start" }}>
          <TodaysReadBlock text={todaysRead} />
          <DailyNumberDisplay data={dailyNumber} />
        </div>

        {/* Lead Stories */}
        <div style={{ marginBottom: 6 }}><Micro>Lead Stories</Micro></div>
        <div style={{ marginBottom: 10 }}><WobblyRule color={COLORS.borderLight} /></div>
        <LeadStories stories={leads} />

        {/* Also Today */}
        {also.length > 0 && (
          <>
            <div style={{ marginTop: 20, marginBottom: 6 }}><Micro>Also Today</Micro></div>
            <div style={{ marginBottom: 10 }}><WobblyRule color={COLORS.borderLight} /></div>
            <AlsoToday stories={also} />
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28 }}><WobblyRule color={COLORS.borderLight} /></div>
        <div style={{ paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: 10, color: COLORS.inkFaint, lineHeight: 1.5, margin: 0, maxWidth: 420 }}>
            Stories ranked by significance. AI analysis {"\u2014"} verify against primary sources.
          </p>
          <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: COLORS.inkFaint }}>
            {now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}{"\u2009"}AEST
          </span>
        </div>
      </main>

      {/* Energy sidebar — scrolls WITH main content */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          borderLeft: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
        }}
        className="paper-grain hidden lg:block"
      >
        <EnergySidebar data={energyData} />
      </aside>
    </div>
  );
}

// ─── Mobile Layout ──────────────────────────────────────────────────────────

function MobileIntelligence({
  leads,
  also,
  briefing,
  dailyNumber,
  todaysRead,
  energyData,
}: {
  leads: EditorialStory[];
  also: EditorialStory[];
  briefing: EditorialStory[];
  dailyNumber: DailyNumberType;
  todaysRead: string;
  energyData: EnergyDashboardData | null;
}) {
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesStart, setStoriesStart] = useState(0);
  const [storiesPhase, setStoriesPhase] = useState<"entering" | "active">("entering");

  const openBriefing = (idx = 0) => {
    setStoriesStart(idx);
    setStoriesPhase("entering");
    setStoriesOpen(true);
    setTimeout(() => setStoriesPhase("active"), 450);
  };

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <DailyNumberMobile data={dailyNumber} />
        <div style={{ padding: "0 20px" }}><WobblyRule /></div>
        <GlowingBriefingCard onStart={() => openBriefing(0)} todaysRead={todaysRead} storyCount={briefing.length} />
        <div style={{ padding: "0 20px" }}><WobblyRule color={COLORS.borderLight} /></div>
        <MobileStoryList stories={briefing} onOpenStories={openBriefing} />
        <MobileMarketContext data={energyData} />
        <div style={{ padding: "4px 20px 24px" }}>
          <WobblyRule color={COLORS.borderLight} />
          <p style={{ fontSize: 9, color: COLORS.inkFaint, lineHeight: 1.5, margin: "10px 0 0" }}>
            Stories ranked by significance. Data: AEMO, CER. AI analysis {"\u2014"} verify against primary sources.
          </p>
        </div>
      </div>
      {storiesOpen && (
        <StoriesOverlay
          stories={briefing}
          startIndex={storiesStart}
          onClose={() => setStoriesOpen(false)}
          phase={storiesPhase}
        />
      )}
    </>
  );
}

// ─── Main Export — data fetching orchestrator ────────────────────────────────

export { EnergySidebar };

export default function IntelligenceTab() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [energyData, setEnergyData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id || "test-user-1";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [digestRes, energyRes] = await Promise.allSettled([
        fetch(`/api/digest/generate?userId=${userId}`),
        fetch("/api/energy/dashboard"),
      ]);

      if (digestRes.status === "fulfilled" && digestRes.value.ok) {
        setBriefing(await digestRes.value.json());
      } else {
        throw new Error("Failed to fetch briefing");
      }

      if (energyRes.status === "fulfilled" && energyRes.value.ok) {
        setEnergyData(await energyRes.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform API data to editorial shapes, or fall back to mocks
  let leads: EditorialStory[];
  let also: EditorialStory[];
  let allStories: EditorialStory[];
  let dailyNumber: DailyNumberType;
  let todaysRead: string;

  if (briefing?.digest) {
    const d = briefing.digest;
    leads = (d.hero_stories || []).map(heroToEditorial);
    also = (d.compact_stories || []).map((c, i) => compactToEditorial(c, i, leads.length));
    allStories = [...leads, ...also];
    // Parse the value to separate number from unit (e.g. "€74 billion" → value="€74", unit="billion")
    const rawValue = d.daily_number?.value || MOCK_DAILY_NUMBER.value;
    const rawLabel = d.daily_number?.label || "";
    dailyNumber = {
      value: rawValue,
      unit: rawLabel,
      label: d.daily_number?.context || MOCK_DAILY_NUMBER.label,
      change: d.daily_number?.trend || "",
      changeLabel: "vs.\u200930-day avg",
      source: "AEMO",
    };
    todaysRead = d.narrative || MOCK_TODAYS_READ;
  } else {
    leads = MOCK_LEADS;
    also = MOCK_ALSO;
    allStories = MOCK_BRIEFING;
    dailyNumber = MOCK_DAILY_NUMBER;
    todaysRead = MOCK_TODAYS_READ;
  }

  if (loading) return <LoadingState />;
  if (error && !briefing) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <DesktopIntelligence
          leads={leads}
          also={also}
          dailyNumber={dailyNumber}
          todaysRead={todaysRead}
          energyData={energyData}
        />
      </div>
      {/* Mobile */}
      <div className="flex flex-col flex-1 md:hidden overflow-hidden">
        <MobileIntelligence
          leads={leads}
          also={also}
          briefing={allStories}
          dailyNumber={dailyNumber}
          todaysRead={todaysRead}
          energyData={energyData}
        />
      </div>
    </>
  );
}
