"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAnalytics } from "@/lib/analytics/provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import type { DailyBriefing, DigestHeroStory, DigestCompactStory, ScoredStory, PodcastEpisode } from "@/lib/types";
import type { EnergyDashboardData } from "@/lib/energy/openelectricity";
import { WobblyRule, Micro, SourceTag } from "./primitives";
import { LeadStories } from "./lead-stories";
import { AlsoToday } from "./also-today";
import { GlowingBriefingCard } from "./glowing-card";
import { StoriesOverlay, type BriefingCompletionData } from "./stories-overlay";
import { EnergySidebar } from "./energy-sidebar";
import { GeneratingBanner } from "./generating-banner";
import { SectorCoverage } from "@/components/sector-coverage";
import { WeeklyPulseCard } from "@/components/weekly-pulse-card";
import { PodcastPlayer } from "./podcast-player";
import { ResearchPanel } from "./research-panel";
import { DailyFeedbackPrompt } from "./DailyFeedbackPrompt";
import { NotificationsPrompt } from "./NotificationsPrompt";
import type { SectorCoverageData, WeeklyPulse } from "@/lib/types";
import type { EditorialStory, DailyNumber as DailyNumberType } from "@/lib/mock-editorial";
import {
  LEADS as MOCK_LEADS,
  ALSO as MOCK_ALSO,
  BRIEFING as MOCK_BRIEFING,
  DAILY_NUMBER as MOCK_DAILY_NUMBER,
  TODAYS_READ as MOCK_TODAYS_READ,
} from "@/lib/mock-editorial";

// ─── Domain label resolution (from old intelligence-tab) ────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  "carbon-emissions": "CARBON & EMISSIONS",
  "energy-storage": "ENERGY STORAGE",
  "energy-generation": "ENERGY GENERATION",
  "energy-grid": "GRID & TRANSMISSION",
  "transport": "TRANSPORT",
  "industry": "INDUSTRY",
  "agriculture": "AGRICULTURE",
  "built-environment": "BUILT ENVIRONMENT",
  "critical-minerals": "CRITICAL MINERALS",
  "finance": "CLIMATE FINANCE",
  "policy": "POLICY & REGULATION",
  "workforce-adaptation": "WORKFORCE",
};

function resolveSector(
  hero: DigestHeroStory | DigestCompactStory,
  scoredStories: ScoredStory[]
): string {
  // Try to match to a ScoredStory by headline to get the domain
  const matched = scoredStories.find((s) => s.title === hero.headline);
  if (matched?.primary_domain) {
    return DOMAIN_LABELS[matched.primary_domain] || matched.primary_domain.toUpperCase().replace(/-/g, " ");
  }
  // Fallback: use micro_sectors if available (hero stories only)
  if ("micro_sectors" in hero && hero.micro_sectors?.length > 0) {
    const ms = hero.micro_sectors[0];
    // Try to find a matching domain from the microsector slug
    for (const [domain, label] of Object.entries(DOMAIN_LABELS)) {
      if (ms.includes(domain.split("-")[0])) return label;
    }
    return ms.toUpperCase().replace(/-/g, " ");
  }
  // Fallback: use signal type or matched story data
  if (matched?.signal_type) {
    const SIGNAL_LABELS: Record<string, string> = {
      market_move: "MARKET",
      policy_change: "POLICY",
      project_milestone: "PROJECT",
      corporate_action: "CORPORATE",
      technology_advance: "TECHNOLOGY",
      international: "INTERNATIONAL",
      enforcement: "ENFORCEMENT",
      personnel: "PERSONNEL",
      community_social: "COMMUNITY",
    };
    return SIGNAL_LABELS[matched.signal_type] || "GENERAL";
  }
  return "GENERAL";
}

function resolveSeverity(idx: number, scoredStory?: ScoredStory): "alert" | "watch" | "ready" | "clear" {
  if (idx === 0) return "alert";
  if (scoredStory && scoredStory.inherent_score > 70) return "alert";
  if (scoredStory && scoredStory.inherent_score > 40) return "watch";
  if (idx < 3) return "watch";
  return "ready";
}

// ─── Transform API data to editorial shapes ─────────────────────────────────

function heroToEditorial(hero: DigestHeroStory, idx: number, scoredStories: ScoredStory[]): EditorialStory {
  const matched = scoredStories.find((s) => s.title === hero.headline);
  const ed = hero as DigestHeroStory & {
    editors_pick?: boolean;
    editorial_note?: string | null;
  };
  return {
    id: idx + 1,
    sector: resolveSector(hero, scoredStories),
    severity: resolveSeverity(idx, matched),
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
    url: hero.url,
    connectedStoryline: hero.connected_storyline,
    entitiesMentioned: hero.entities_mentioned,
    editorsPick: ed.editors_pick,
    editorialNote: ed.editorial_note ?? null,
    triggeredIndicatorUpdate: hero.triggered_indicator_update ?? null,
  };
}

function compactToEditorial(compact: DigestCompactStory, idx: number, offset: number, scoredStories: ScoredStory[]): EditorialStory {
  const matched = scoredStories.find((s) => s.title === compact.headline);
  const ed = compact as DigestCompactStory & {
    editors_pick?: boolean;
    editorial_note?: string | null;
  };
  return {
    id: offset + idx + 1,
    sector: resolveSector(compact, scoredStories),
    severity: resolveSeverity(offset + idx, matched),
    headline: compact.headline,
    summary: compact.one_line_take,
    body: compact.one_line_take,
    whyItMatters: "",
    sources: [compact.source],
    sourceTypes: [],
    number: compact.key_metric?.value,
    unit: compact.key_metric?.unit,
    url: compact.url,
    editorsPick: ed.editors_pick,
    editorialNote: ed.editorial_note ?? null,
    triggeredIndicatorUpdate: compact.triggered_indicator_update ?? null,
  };
}

// ─── Daily Number in sidebar ────────────────────────────────────────────────

function DailyNumberSidebar({ data, briefedToday, streakCount }: { data: DailyNumberType; briefedToday?: boolean; streakCount?: number }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.plum}`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Micro color={COLORS.plum}>Daily Number</Micro>
        {briefedToday && (
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: COLORS.forest }}>
              Briefed {"\u2713"}
            </span>
            {streakCount != null && streakCount >= 3 && (
              <div style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                Day {streakCount}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
        <span
          style={{
            fontFamily: FONTS.serif,
            fontSize: 36,
            fontWeight: 300,
            color: COLORS.plum,
            letterSpacing: -1,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.value}
        </span>
      </div>
      <div style={{ fontSize: 11, color: COLORS.inkSec, marginTop: 4 }}>{data.unit}</div>
      <div style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 2, lineHeight: 1.5 }}>{data.label}</div>
      {data.change && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px solid ${COLORS.borderLight}`,
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.forest, fontVariantNumeric: "tabular-nums" }}>
            {data.change}
          </span>
          <span style={{ fontSize: 9, color: COLORS.inkMuted }}>{data.changeLabel}</span>
        </div>
      )}
    </div>
  );
}

function DailyNumberMobile({ data, briefedToday, streakCount }: { data: DailyNumberType; briefedToday?: boolean; streakCount?: number }) {
  return (
    <div style={{ padding: "20px 20px 16px" }}>
      {/* Top row: label + briefed badge. Both kept on one line via nowrap so a
          long `data.change` (rendered below) can't squeeze them into wrapping. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ whiteSpace: "nowrap" }}>
          <Micro color={COLORS.plum}>Daily Number</Micro>
        </span>
        {briefedToday && (
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: COLORS.forest }}>
              Briefed {"\u2713"}
            </span>
            {streakCount != null && streakCount >= 3 && (
              <span style={{ fontSize: 11, color: COLORS.inkMuted, fontVariantNumeric: "tabular-nums" }}>
                Day {streakCount}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Number + unit on their own row, no horizontal pressure from change text */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <span
          style={{
            fontFamily: FONTS.serif,
            fontSize: 36,
            fontWeight: 300,
            color: COLORS.plum,
            letterSpacing: -1,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.value}
        </span>
        {data.unit && (
          <span style={{ fontSize: 12, color: COLORS.inkSec, lineHeight: 1.3 }}>{data.unit}</span>
        )}
      </div>

      {/* Long-form trend explanation gets the full width — previously crammed
          into a right-aligned half column where it wrapped awkwardly. */}
      {data.change && (
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.forest,
            lineHeight: 1.4,
            margin: "10px 0 0",
          }}
        >
          {data.change}
        </p>
      )}
      {data.changeLabel && (
        <div style={{ fontSize: 10, color: COLORS.inkMuted, marginTop: 4, textAlign: "right" }}>
          {data.changeLabel}
        </div>
      )}
    </div>
  );
}

// ─── Today's Read (formatted with bullet points) ────────────────────────────

function TodaysReadBlock({ text, articlesAnalysed }: { text: string; articlesAnalysed?: number }) {
  // Split narrative into sentences and present as scannable bullet points
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  // Take first 4 sentences as key points
  const points = sentences.slice(0, 4).map((s) => s.trim());

  return (
    <div style={{ marginBottom: 26 }}>
      <Micro color={COLORS.forest} mb={10}>
        Today{"\u2019"}s Read
      </Micro>
      {articlesAnalysed != null && articlesAnalysed > 0 && (
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: COLORS.inkMuted,
            margin: "0 0 10px 0",
            lineHeight: 1.4,
          }}
        >
          Based on {articlesAnalysed} articles analysed overnight
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {points.map((point, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: 5,
                background: i === 0 ? COLORS.forest : COLORS.sage,
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                color: COLORS.inkSec,
                lineHeight: 1.6,
                margin: 0,
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              {point}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile Market Context ──────────────────────────────────────────────────

function MobileMarketContext({ data }: { data: EnergyDashboardData | null }) {
  if (!data) return null;

  // Inline generation chart for mobile (simplified stacked bars)
  const intraday = data.intraday;
  const hasIntraday = intraday && intraday.timestamps.length > 0;

  return (
    <>
      <div style={{ padding: "16px 20px 6px" }}>
        <Micro color={COLORS.forest}>Market Context</Micro>
      </div>
      <div style={{ padding: "0 20px 14px" }}>
        {/* Generation chart */}
        {hasIntraday && (
          <div
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>
              Generation {"\u2014"} 24h
            </div>
            <svg viewBox="0 0 320 60" style={{ width: "100%", height: "auto" }}>
              {(() => {
                const ts = intraday.timestamps;
                const ftReversed = [...intraday.fueltechs].reverse();
                const stacks = ftReversed.map((ft) => ({
                  key: ft.key,
                  color: ft.color,
                  values: intraday.generation[ft.key] ?? ts.map(() => 0),
                }));
                const maxGen = Math.max(
                  ...ts.map((_, i) => stacks.reduce((sum, s) => sum + s.values[i], 0)),
                  1
                );
                const barW = 320 / ts.length;
                return ts.map((_, i) => {
                  let cum = 0;
                  return (
                    <g key={i}>
                      {stacks.map((stack) => {
                        const val = stack.values[i];
                        const bh = (val / maxGen) * 50;
                        const y = 50 - cum - bh;
                        cum += bh;
                        if (bh < 0.3) return null;
                        return <rect key={stack.key} x={i * barW + 0.15} y={y} width={Math.max(barW - 0.3, 0.3)} height={bh} fill={stack.color} opacity={0.8} />;
                      })}
                    </g>
                  );
                });
              })()}
            </svg>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 4 }}>
              {intraday.fueltechs
                .filter((ft) => {
                  const total = (intraday.generation[ft.key] ?? []).reduce((a: number, b: number) => a + b, 0);
                  const grand = Object.values(intraday.generation).reduce((s, arr) => s + arr.reduce((a: number, b: number) => a + b, 0), 0);
                  return (total / (grand || 1)) * 100 > 2;
                })
                .map((ft) => (
                  <div key={ft.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 6, height: 3, borderRadius: 1, background: ft.color }} />
                    <span style={{ fontSize: 9, color: COLORS.inkMuted }}>{ft.label}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* State prices */}
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
}: {
  stories: EditorialStory[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <>
      <div style={{ padding: "12px 20px 6px" }}>
        <Micro>Today{"\u2019"}s Stories</Micro>
      </div>
      {stories.map((story) => {
        const sev = SEVERITY[story.severity] || SEVERITY.watch;
        const isOpen = expanded === story.id;
        return (
          <div
            key={story.id}
            onClick={() => setExpanded(isOpen ? null : story.id)}
            style={{
              padding: "12px 20px",
              borderBottom: `1px solid ${COLORS.borderLight}`,
              cursor: "pointer",
              background: isOpen ? COLORS.paperDark : "transparent",
              transition: "background 150ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
              <Micro color={sev.labelColor}>{story.sector}</Micro>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {story.number && (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{story.number}</span>
                    <span style={{ fontSize: 9, color: COLORS.inkMuted, marginLeft: 2 }}>{story.unit}</span>
                  </span>
                )}
                <span style={{ fontSize: 14, color: COLORS.inkFaint, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease", display: "inline-block" }}>
                  {"\u203A"}
                </span>
              </div>
            </div>
            <h3 style={{ fontFamily: FONTS.serif, fontSize: 15, fontWeight: 400, color: COLORS.ink, lineHeight: 1.3, margin: 0 }}>
              {story.headline}
            </h3>
            <div style={{ fontSize: 10, color: COLORS.inkFaint, marginTop: 4 }}>
              {story.url ? (
                <a href={story.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: COLORS.inkFaint, textDecoration: "none", borderBottom: "1px dotted #D0CCC6" }}>
                  {story.sources[0]} {"\u2197"}
                </a>
              ) : (
                story.sources[0]
              )}
              {story.sources.length > 1 && ` +${story.sources.length - 1}`}
            </div>
            {/* Expanded content — animated */}
            <div
              style={{
                maxHeight: isOpen ? 400 : 0,
                opacity: isOpen ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 200ms ease, opacity 150ms ease",
              }}
            >
              <div style={{ paddingTop: 10 }}>
                {story.summary && (
                  <p style={{ fontSize: 13, fontFamily: FONTS.serif, color: COLORS.inkSec, lineHeight: 1.6, margin: "0 0 8px" }}>
                    {story.summary}
                  </p>
                )}
                {story.whyItMatters && (
                  <div style={{ background: COLORS.sageTint, borderLeft: `2px solid ${COLORS.forest}`, padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 8 }}>
                    <Micro color={COLORS.forest} mb={3}>Why it matters</Micro>
                    <p style={{ fontSize: 12, fontFamily: FONTS.serif, color: COLORS.ink, lineHeight: 1.5, margin: 0 }}>
                      {story.whyItMatters}
                    </p>
                  </div>
                )}
                {story.url && (
                  <a href={story.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: COLORS.forest, fontWeight: 500, textDecoration: "none", borderBottom: `1px solid ${COLORS.sage}` }}>
                    Read full article {"\u2197"}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Mobile briefing header ─────────────────────────────────────────────────
// In-flow header at the top of the briefing scroll container (mobile only).
// Larger logo than the dashboard's compact persistent header — scrolls away
// with content for an iOS-style large-title feel. Owns its own avatar
// dropdown so users still have access to profile / settings / sign out.

// Sticky cover that matches the height of the iOS status bar / Dynamic Island.
// Without this, content scrolling up would show through behind the translucent
// status bar once Safari's top chrome auto-hides. Using `position: sticky`
// (not fixed) keeps it scoped to the scroll container so it can't leak onto
// desktop or onto other tabs.
function StatusBarCover() {
  return (
    <div
      aria-hidden
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        height: "env(safe-area-inset-top)",
        background: COLORS.surface,
        zIndex: 20,
      }}
    />
  );
}

function MobileBriefingHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const initials =
    (user?.name || user?.email || "")
      .split(/[\s@]+/)
      .map((s) => s[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "\u00B7";

  const dateStr = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        // Extra top padding on mobile to clear the status bar / Dynamic Island.
        // `max(...)` so non-iOS devices (no safe-area inset) still get a
        // comfortable 14px breathing room.
        padding: "max(env(safe-area-inset-top), 14px) 20px 6px",
        gap: 12,
      }}
    >
      <img
        src="/logo.svg"
        alt="Climate Pulse"
        style={{ height: 34, width: "auto", display: "block" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: COLORS.inkMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {dateStr}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback
                  style={{
                    background: COLORS.sageTint,
                    color: COLORS.forest,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 text-sm">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void logout();
                router.push("/login");
              }}
              className="gap-2 text-sm text-destructive focus:text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Loading / Error states ─────────────────────────────────────────────────

// Single shimmer-overlay block. Animated via cp-skeleton keyframes injected
// once at the bottom of LoadingState — keeps the Skeleton component pure JSX
// so it can be sprinkled freely without each instance re-defining keyframes.
function Skeleton({
  width = "100%",
  height,
  radius = 6,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: COLORS.borderLight,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)",
          animation: "cp-skeleton 1.6s linear infinite",
        }}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        flex: 1,
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Mobile-only header inside the scroll area so it scrolls away. Desktop
          layout has its own chrome and doesn't need this. */}
      <div className="md:hidden">
        <StatusBarCover />
        <MobileBriefingHeader />
      </div>

      <div style={{ padding: "8px 20px 40px" }} className="md:px-8 md:py-10">
        {/* Daily Number block */}
        <div style={{ paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width={96} height={10} />
            <Skeleton width={64} height={10} />
          </div>
          <Skeleton width={140} height={36} radius={4} style={{ marginTop: 12 }} />
          <Skeleton width="55%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="85%" height={12} style={{ marginTop: 10 }} />
        </div>

        <div style={{ height: 1, background: COLORS.borderLight, margin: "22px 0" }} />

        {/* Briefing CTA + podcast skeletons */}
        <Skeleton height={110} radius={14} />
        <Skeleton height={56} radius={10} style={{ marginTop: 12 }} />

        <div style={{ height: 1, background: COLORS.borderLight, margin: "22px 0" }} />

        {/* Story rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width={90} height={9} />
              <Skeleton width="92%" height={16} />
              <Skeleton width="68%" height={16} />
            </div>
          ))}
        </div>

        {/* Subtle status line */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: COLORS.inkFaint,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontFamily: FONTS.sans,
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.sage,
              animation: "cp-skeleton-pulse 1.2s ease-in-out infinite",
            }}
          />
          Loading briefing
        </div>
      </div>

      <style jsx global>{`
        @keyframes cp-skeleton {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes cp-skeleton-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// Map raw server errors to user-friendly copy. "Briefing unavailable" is the
// default headline; detail line softens technical messages like "Profile not
// found" that can appear during the narrow window between a new user signing
// up and their first profile write landing.
function friendlyErrorCopy(raw: string): { headline: string; detail: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("profile not found") || lower.includes("not authenticated")) {
    return {
      headline: "Setting up your account",
      detail: "We're finishing setup for your profile. Try again in a few seconds.",
    };
  }
  if (lower.includes("no stories")) {
    return {
      headline: "Your first briefing is brewing",
      detail: "Today's stories haven't finished processing. Your briefing will land shortly.",
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      headline: "Taking longer than expected",
      detail: "The briefing is still being built. Try again, or come back in a minute.",
    };
  }
  if (lower.includes("failed to fetch")) {
    return {
      headline: "Can't reach the briefing service",
      detail: "Check your connection and try again. If it keeps failing, we'll know — this is logged server-side.",
    };
  }
  return {
    headline: "Briefing unavailable",
    detail: "Something went wrong loading today's briefing. Tap retry, or refresh the page.",
  };
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { headline, detail } = friendlyErrorCopy(message);
  return (
    <div style={{ padding: "40px 32px", maxWidth: 440 }}>
      <Micro color={COLORS.ink}>{headline}</Micro>
      <p style={{ fontSize: 13, color: COLORS.inkSec, marginTop: 8, lineHeight: 1.5 }}>{detail}</p>
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

function IndicatorsUpdatedStrip({ count }: { count: number }) {
  return (
    <a
      href="/dashboard?tab=indicators"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: COLORS.sageTint,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${COLORS.forest}`,
        padding: "10px 14px",
        marginBottom: 12,
        fontFamily: FONTS.sans,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.forest,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
        <span style={{ fontSize: 13, color: COLORS.ink }}>
          indicator{count === 1 ? "" : "s"} updated today
        </span>
      </div>
      <span style={{ fontSize: 11, color: COLORS.forest, fontWeight: 500 }}>
        View →
      </span>
    </a>
  );
}

function SampleBanner({ reason }: { reason: "no_articles" | "no_personalisation_match" | "ai_error" | undefined }) {
  const copy: Record<string, string> = {
    no_articles: "Today's stories are still being processed. We've put together a sample briefing so you can see the shape — yours will arrive at 6am AEST.",
    no_personalisation_match: "No stories matched your sectors today. This sample shows the format — we'll widen the net overnight.",
    ai_error: "We hit a temporary hiccup generating your briefing. This sample is a stand-in; we'll retry overnight.",
  };
  const message = copy[reason ?? ""] ?? "Showing a sample briefing. Your personalised one will arrive shortly.";
  return (
    <div
      role="status"
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${COLORS.plum}`,
        padding: "12px 16px",
        marginBottom: 16,
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: COLORS.plum,
          marginBottom: 4,
        }}
      >
        Sample briefing
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.inkSec, lineHeight: 1.5 }}>
        {message}
      </div>
    </div>
  );
}

// ─── Desktop Layout ─────────────────────────────────────────────────────────

function DesktopIntelligence({
  leads,
  also,
  todaysRead,
  dailyNumber,
  energyData,
  briefedToday,
  streakCount,
  sectorCoverage,
  weeklyPulse,
  podcastEpisode,
  articlesAnalysed,
  topBanner,
}: {
  leads: EditorialStory[];
  also: EditorialStory[];
  todaysRead: string;
  dailyNumber: DailyNumberType;
  energyData: EnergyDashboardData | null;
  briefedToday?: boolean;
  streakCount?: number;
  sectorCoverage?: SectorCoverageData | null;
  weeklyPulse?: WeeklyPulse | null;
  podcastEpisode?: PodcastEpisode | null;
  articlesAnalysed?: number;
  topBanner?: React.ReactNode;
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
      <main style={{ flex: 1, padding: "26px 32px 60px", minWidth: 0 }}>
        {topBanner}
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
        </div>

        <div style={{ margin: "18px 0 22px" }}><WobblyRule /></div>

        {/* Podcast player */}
        {podcastEpisode && (
          <div style={{ marginBottom: 16 }}>
            <PodcastPlayer episode={podcastEpisode} />
          </div>
        )}

        {/* Today's Read — full width */}
        <TodaysReadBlock text={todaysRead} articlesAnalysed={articlesAnalysed} />

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

        {/* Research Panel */}
        <div style={{ marginTop: 28 }}>
          <ResearchPanel />
        </div>

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

      {/* Right sidebar — Daily Number + Energy data */}
      <aside
        style={{
          width: 320,
          flexShrink: 0,
          borderLeft: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          padding: "26px 16px",
        }}
        className="paper-grain hidden lg:block"
      >
        <DailyNumberSidebar data={dailyNumber} briefedToday={briefedToday} streakCount={streakCount} />
        {weeklyPulse && <div style={{ marginBottom: 14 }}><WeeklyPulseCard pulse={weeklyPulse} /></div>}
        {sectorCoverage && sectorCoverage.sectors.length > 0 && <div style={{ marginBottom: 14 }}><SectorCoverage data={sectorCoverage} /></div>}
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
  onBriefingComplete,
  briefedToday,
  streakCount,
  podcastEpisode,
  articlesAnalysed,
  topBanner,
}: {
  leads: EditorialStory[];
  also: EditorialStory[];
  briefing: EditorialStory[];
  dailyNumber: DailyNumberType;
  todaysRead: string;
  energyData: EnergyDashboardData | null;
  onBriefingComplete?: (data: BriefingCompletionData) => void;
  briefedToday?: boolean;
  streakCount?: number;
  podcastEpisode?: PodcastEpisode | null;
  articlesAnalysed?: number;
  topBanner?: React.ReactNode;
}) {
  const { track } = useAnalytics();
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesStart, setStoriesStart] = useState(0);
  const [storiesPhase, setStoriesPhase] = useState<"entering" | "active">("entering");
  const [podcastPlaying, setPodcastPlaying] = useState(false);

  const openBriefing = (idx = 0) => {
    setStoriesStart(idx);
    setStoriesPhase("entering");
    setStoriesOpen(true);
    setTimeout(() => setStoriesPhase("active"), 450);
    track("briefing.started", {
      edition_date: new Date().toISOString().slice(0, 10),
      stories_count: briefing.length,
      entry_point: "card",
    });
  };

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <StatusBarCover />
        <MobileBriefingHeader />
        {topBanner && <div style={{ padding: "12px 16px 0" }}>{topBanner}</div>}
        <DailyNumberMobile data={dailyNumber} briefedToday={briefedToday} streakCount={streakCount} />
        <div style={{ padding: "0 20px" }}><WobblyRule /></div>
        <GlowingBriefingCard onStart={() => openBriefing(0)} todaysRead={todaysRead} storyCount={briefing.length} briefedToday={briefedToday} streakCount={streakCount} articlesAnalysed={articlesAnalysed} />
        {podcastEpisode && (
          <div
            style={{
              padding: "8px 20px 0",
              // Becomes sticky once audio is playing so users can keep
              // controls in view while scrolling the rest of the briefing.
              position: podcastPlaying ? "sticky" : "static",
              top: "env(safe-area-inset-top)",
              zIndex: 15,
              background: COLORS.surface,
            }}
          >
            <PodcastPlayer
              episode={podcastEpisode}
              compact
              onPlayingChange={setPodcastPlaying}
            />
          </div>
        )}
        <div style={{ padding: "0 20px" }}><WobblyRule color={COLORS.borderLight} /></div>
        <MobileStoryList stories={briefing} />
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
          onComplete={onBriefingComplete}
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
  const { track } = useAnalytics();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [energyData, setEnergyData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefedToday, setBriefedToday] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [sectorCoverage, setSectorCoverage] = useState<SectorCoverageData | null>(null);
  const [weeklyPulse, setWeeklyPulse] = useState<WeeklyPulse | null>(null);
  const [podcastEpisode, setPodcastEpisode] = useState<PodcastEpisode | null>(null);
  const [digestStatus, setDigestStatus] = useState<"ready" | "generating" | "timed_out" | "unknown">("unknown");
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);

  const userId = user?.id;

  // Poll-only digest fetch. Used by the generating-state poll loop so we
  // don't re-trigger the sidebar/energy/podcast fetches on every tick.
  const pollDigest = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/digest/generate?userId=${userId}`);
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.status === "ready" && payload.briefing) {
        setBriefing(payload.briefing);
        setDigestStatus("ready");
        setGenerationStartedAt(null);
      }
    } catch {
      // Non-fatal — next tick will retry
    }
  }, [userId]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [digestRes, energyRes, streakRes, coverageRes, pulseRes, podcastRes] = await Promise.allSettled([
        fetch(`/api/digest/generate?userId=${userId}`),
        fetch("/api/energy/dashboard"),
        fetch(`/api/analytics/streak?userId=${userId}`),
        fetch(`/api/analytics/sector-coverage?userId=${userId}`),
        fetch(`/api/analytics/weekly-pulse?userId=${userId}`),
        fetch("/api/podcast"),
      ]);

      if (digestRes.status === "fulfilled" && digestRes.value.ok) {
        const payload = await digestRes.value.json();
        if (payload?.status === "ready" && payload.briefing) {
          setBriefing(payload.briefing);
          setDigestStatus("ready");
          setGenerationStartedAt(null);
        } else if (payload?.status === "generating") {
          setBriefing(null);
          setDigestStatus("generating");
          setGenerationStartedAt(
            payload.generation_started_at
              ? new Date(payload.generation_started_at).getTime()
              : Date.now()
          );
        } else {
          // Unexpected shape — treat as ready to preserve backward compat
          setBriefing(payload);
          setDigestStatus("ready");
        }
      } else {
        throw new Error("Failed to fetch briefing");
      }

      if (energyRes.status === "fulfilled" && energyRes.value.ok) {
        setEnergyData(await energyRes.value.json());
      }

      if (streakRes.status === "fulfilled" && streakRes.value.ok) {
        const streakData = await streakRes.value.json();
        setBriefedToday(streakData.briefed_today || false);
        setStreakCount(streakData.current_streak || 0);
      }

      if (coverageRes.status === "fulfilled" && coverageRes.value.ok) {
        setSectorCoverage(await coverageRes.value.json());
      }

      if (pulseRes.status === "fulfilled" && pulseRes.value.ok) {
        const pulseData = await pulseRes.value.json();
        setWeeklyPulse(pulseData.pulse || null);
      }

      if (podcastRes.status === "fulfilled" && podcastRes.value.ok) {
        setPodcastEpisode(await podcastRes.value.json());
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

  // While a first-time briefing is generating, poll every 6s until it lands.
  // Cap at ~3 minutes so we don't poll forever if something goes wrong server-side.
  // On timeout, flip to "timed_out" so the UI surfaces a real error + retry
  // (previously the generating banner just hung forever, which customers read
  // as "my briefing is still being built" indefinitely).
  useEffect(() => {
    if (digestStatus !== "generating") return;
    const startedAt = generationStartedAt ?? Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt > 180_000) {
        clearInterval(id);
        setDigestStatus("timed_out");
        setError("timed out");
        return;
      }
      pollDigest();
    }, 6_000);
    return () => clearInterval(id);
  }, [digestStatus, generationStartedAt, pollDigest]);

  // Handle briefing completion — post to streak API and update local state
  const handleBriefingComplete = useCallback(async (data: BriefingCompletionData) => {
    const editionDate = new Date().toISOString().slice(0, 10);

    track("briefing.completed", {
      edition_date: editionDate,
      stories_viewed: data.storiesViewed,
      total_duration_seconds: data.totalDurationSeconds,
    });

    for (const timing of data.storyTimings) {
      if (timing.counted) {
        track("story.viewed", {
          story_id: String(timing.storyIndex),
          position: timing.storyIndex,
          duration_seconds: timing.durationSeconds,
        });
      }
    }

    try {
      const res = await fetch("/api/analytics/briefing-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          editionDate,
          storiesViewed: data.storiesViewed,
          totalStories: data.totalStories,
          totalViewTimeSeconds: data.totalDurationSeconds,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setBriefedToday(true);
        setStreakCount(result.streak || 0);
      }
    } catch {
      // Best-effort
    }
  }, [userId, track]);

  // Transform API data to editorial shapes, or fall back to mocks
  const scoredStories: ScoredStory[] = briefing?.stories || [];
  let leads: EditorialStory[];
  let also: EditorialStory[];
  let allStories: EditorialStory[];
  let dailyNumber: DailyNumberType;
  let todaysRead: string;

  if (briefing?.digest) {
    const d = briefing.digest;
    leads = (d.hero_stories || []).map((h, i) => heroToEditorial(h, i, scoredStories));
    also = (d.compact_stories || []).map((c, i) => compactToEditorial(c, i, leads.length, scoredStories));

    // Deduplicate: remove any compact story whose headline appears in leads
    const leadHeadlines = new Set(leads.map((l) => l.headline));
    also = also.filter((a) => !leadHeadlines.has(a.headline));

    allStories = [...leads, ...also];

    dailyNumber = {
      value: d.daily_number?.value || MOCK_DAILY_NUMBER.value,
      unit: d.daily_number?.label || "",
      label: d.daily_number?.context || MOCK_DAILY_NUMBER.label,
      change: d.daily_number?.trend || "",
      changeLabel: "vs.\u200930-day avg",
      source: "AI analysis",
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
  if (digestStatus === "timed_out" && !briefing) {
    return <ErrorState message="timed out" onRetry={fetchData} />;
  }

  const isSampleBriefing = briefing?.digest?.is_sample === true;
  const indicatorsCount = briefing?.digest?.indicators_updated_today ?? 0;
  const indicatorsStrip =
    indicatorsCount > 0 && !isSampleBriefing ? (
      <IndicatorsUpdatedStrip count={indicatorsCount} />
    ) : null;
  const baseBanner =
    digestStatus === "generating" && generationStartedAt ? (
      <GeneratingBanner startedAt={generationStartedAt} estimatedSeconds={60} />
    ) : isSampleBriefing ? (
      <SampleBanner reason={briefing?.digest?.sample_reason} />
    ) : null;
  const topBanner =
    baseBanner || indicatorsStrip ? (
      <>
        {baseBanner}
        {indicatorsStrip}
      </>
    ) : null;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <DesktopIntelligence
          leads={leads}
          also={also}
          todaysRead={todaysRead}
          dailyNumber={dailyNumber}
          energyData={energyData}
          briefedToday={briefedToday}
          streakCount={streakCount}
          sectorCoverage={sectorCoverage}
          weeklyPulse={weeklyPulse}
          podcastEpisode={podcastEpisode}
          articlesAnalysed={briefing?.articles_analysed}
          topBanner={topBanner}
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
          onBriefingComplete={handleBriefingComplete}
          briefedToday={briefedToday}
          streakCount={streakCount}
          podcastEpisode={podcastEpisode}
          articlesAnalysed={briefing?.articles_analysed}
          topBanner={topBanner}
        />
      </div>
      <DailyFeedbackPrompt
        storyOptions={allStories.map((s) => ({
          id: s.id,
          headline: s.headline,
          url: s.url,
        }))}
      />
      <NotificationsPrompt briefingReady={digestStatus === "ready" && !!briefing} />
    </>
  );
}
