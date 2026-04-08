"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Link2,
  RefreshCw,
  BookOpen,
  AlertCircle,
  Loader2,
  Scale,
  Milestone,
  Building2,
  BarChart3,
  ShieldAlert,
  UserCircle,
  Users,
  Globe as GlobeIcon,
  Cpu as CpuIcon,
  Megaphone,
} from "lucide-react";
import type {
  DailyBriefing,
  DigestOutput,
  DigestHeroStory,
  DigestCompactStory,
  DigestDailyNumber,
  DigestCrossConnection,
  ScoredStory,
  SignalType,
} from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import type { EnergyDashboardData, PriceSummary } from "@/lib/energy/openelectricity";

// ─── Domain colour map ─────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  "carbon-emissions": "emerald",
  "energy-storage": "blue",
  "energy-generation": "amber",
  "energy-grid": "violet",
  "transport": "orange",
  "industry": "slate",
  "agriculture": "lime",
  "built-environment": "stone",
  "critical-minerals": "rose",
  "finance": "cyan",
  "policy": "indigo",
  "workforce-adaptation": "teal",
};

function getDomainAccent(domain: string | null): string {
  const color = DOMAIN_COLORS[domain ?? ""] ?? "emerald";
  return color;
}

// ─── Signal type → icon + human label ─────────────────────────────────────

const SIGNAL_TYPE_CONFIG: Record<SignalType, { icon: LucideIcon; label: string }> = {
  market_move:        { icon: TrendingUp,   label: "Market Move" },
  policy_change:      { icon: Scale,        label: "Policy Change" },
  project_milestone:  { icon: Milestone,    label: "Project Milestone" },
  corporate_action:   { icon: Building2,    label: "Corporate Action" },
  data_release:       { icon: BarChart3,    label: "Data Release" },
  enforcement:        { icon: ShieldAlert,  label: "Enforcement" },
  personnel:          { icon: UserCircle,   label: "Personnel" },
  technology_advance: { icon: CpuIcon,      label: "Tech Advance" },
  international:      { icon: GlobeIcon,    label: "International" },
  community_social:   { icon: Megaphone,    label: "Community & Social" },
};

const DOMAIN_LABELS: Record<string, string> = {
  "carbon-emissions": "Carbon & Emissions",
  "energy-storage": "Energy Storage",
  "energy-generation": "Energy Generation",
  "energy-grid": "Grid & Transmission",
  "transport": "Transport",
  "industry": "Industry",
  "agriculture": "Agriculture",
  "built-environment": "Built Environment",
  "critical-minerals": "Critical Minerals",
  "finance": "Climate Finance",
  "policy": "Policy & Regulation",
  "workforce-adaptation": "Workforce",
};

// ─── Fuel-tech colour / label maps (mirrored from energy-tab) ─────────────

const FUELTECH_COLORS: Record<string, string> = {
  energy_solar: "#F59E0B",
  energy_wind: "#3B82F6",
  energy_hydro: "#06B6D4",
  energy_coal: "#57534E",
  energy_gas: "#EF4444",
  energy_bioenergy: "#22C55E",
  energy_distillate: "#A3A3A3",
  energy_battery_discharging: "#8B5CF6",
  energy_battery_charging: "#C4B5FD",
  energy_battery: "#8B5CF6",
  energy_pumps: "#7C3AED",
};

const FUELTECH_LABELS: Record<string, string> = {
  energy_solar: "Solar",
  energy_wind: "Wind",
  energy_hydro: "Hydro",
  energy_coal: "Coal",
  energy_gas: "Gas",
  energy_bioenergy: "Bio",
  energy_distillate: "Distillate",
  energy_battery_discharging: "Battery",
  energy_battery_charging: "Batt (Chg)",
  energy_battery: "Battery",
  energy_pumps: "Pumped",
};

function getFtColor(ft: string): string {
  return FUELTECH_COLORS[ft] ?? "#9CA3AF";
}

function getFtLabel(ft: string): string {
  return FUELTECH_LABELS[ft] ?? ft.replace(/^energy_/, "").replace(/_/g, " ");
}

// ─── Story Ring ────────────────────────────────────────────────────────────

function StoryRing({
  domain,
  size = 48,
  glow = true,
}: {
  domain: string | null;
  size?: number;
  glow?: boolean;
}) {
  const accent = getDomainAccent(domain);
  const initial = domain?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-accent-${accent}/10 ring-2 ring-accent-${accent}/40`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full opacity-30 blur-sm"
          style={{
            background: `conic-gradient(from 0deg, var(--accent-emerald), var(--accent-amber), var(--accent-emerald))`,
          }}
        />
      )}
      <span
        className="relative z-10 font-display text-xs font-semibold text-foreground"
        style={{ fontSize: size * 0.3 }}
      >
        {initial}
      </span>
    </div>
  );
}

// ─── Source Link ───────────────────────────────────────────────────────────

function SourceLink({
  source,
  url,
  className = "",
}: {
  source: string;
  url: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-sm text-accent-emerald underline-offset-2 transition-colors hover:text-accent-emerald-light hover:underline ${className}`}
    >
      {source}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// ─── Key Metric ────────────────────────────────────────────────────────────

function KeyMetric({
  metric,
  large = false,
}: {
  metric: { value: string; unit: string; delta?: string } | null;
  large?: boolean;
}) {
  if (!metric) return null;

  return (
    <div className="flex flex-col items-end text-right">
      <span
        className={`font-mono font-bold tracking-tight text-foreground ${
          large ? "text-xl" : "text-base"
        }`}
      >
        {metric.value}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {metric.unit}
      </span>
      {metric.delta && (
        <span
          className={`mt-0.5 flex items-center gap-0.5 font-mono text-xs ${
            metric.delta.startsWith("-")
              ? "text-status-error"
              : "text-status-success"
          }`}
        >
          {metric.delta.startsWith("-") ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <TrendingUp className="h-3 w-3" />
          )}
          {metric.delta}
        </span>
      )}
    </div>
  );
}

// ─── Daily Number Card ─────────────────────────────────────────────────────

function DailyNumberCard({
  data,
  date,
  storyCount,
}: {
  data: DigestDailyNumber;
  date: string;
  storyCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="overflow-hidden rounded-xl bg-forest-green p-6 text-cream"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-amber">
          Today&apos;s Number
        </p>
        <p className="text-[11px] text-cream/50">
          {date} &middot; {storyCount} stories
        </p>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[48px] font-bold tracking-tight text-white">
          {data.value}
        </span>
        {data.trend && (
          <span className="flex items-center gap-1 font-mono text-sm text-status-success">
            {data.trend.startsWith("-") ? (
              <TrendingDown className="h-3.5 w-3.5 text-status-error" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            {data.trend}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-cream/60">{data.label}</p>

      {/* Progress bar visual */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${parseFloat(data.value) || 50}%` }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-accent-emerald"
        />
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-cream/70">
        {data.context}
      </p>
    </motion.div>
  );
}

// ─── Narrative Card ────────────────────────────────────────────────────────

function NarrativeCard({ text }: { text: string }) {
  // Split narrative into sentences and take up to 3 as bullet points
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const bullets = sentences.slice(0, 3).map((s) => s.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl p-5"
      style={{ backgroundColor: "rgba(42, 157, 143, 0.04)" }}
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-emerald">
        Today&apos;s Insights
      </p>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/85">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-emerald/60" />
            {bullet}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── Hero Story Card ───────────────────────────────────────────────────────

function HeroStoryCard({
  story,
  scoredStory,
  index,
}: {
  story: DigestHeroStory;
  scoredStory?: ScoredStory;
  index: number;
}) {
  const signalType = scoredStory?.signal_type ?? null;
  const config = signalType ? SIGNAL_TYPE_CONFIG[signalType] : null;
  const SignalIcon = config?.icon ?? BookOpen;
  const categoryLabel =
    config?.label ??
    DOMAIN_LABELS[scoredStory?.primary_domain ?? ""] ??
    "Climate Intelligence";

  // Split expert_take into key takeaway (first sentence) + detail
  const sentences = story.expert_take.match(/[^.!?]+[.!?]+/g) ?? [story.expert_take];
  const keyTakeaway = sentences[0].trim();
  const detail = sentences.slice(1).join(" ").trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
      className="overflow-hidden rounded-xl bg-card ring-1 ring-border-subtle"
    >
      {/* ── Card header ── */}
      <div className="flex items-start gap-3.5 p-5 pb-0">
        {/* Signal type icon with rank overlay */}
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
            <SignalIcon className="h-5 w-5 text-accent-emerald" />
          </div>
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-amber text-[10px] font-bold text-background">
            {story.rank}
          </span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Category label + score */}
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-emerald">
              {categoryLabel}
            </span>
            {scoredStory && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-medium">
                {scoredStory.personal_score}
              </Badge>
            )}
          </div>

          {/* Headline as link */}
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5">
            <h3 className="font-display text-base font-semibold leading-snug text-foreground decoration-accent-emerald/40 underline-offset-2 group-hover:underline">
              {story.headline}
            </h3>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </a>

          {/* Source attribution + entities */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">via {story.source}</span>
            {scoredStory?.entities?.slice(0, 3).map((e) => (
              <Badge key={e.name} variant="secondary" className="h-5 text-[10px]">
                {e.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Key metric — full-width banner between header and analysis */}
      {story.key_metric && (
        <div className="mx-5 mt-3 flex items-baseline gap-2.5 rounded-lg bg-surface-2/60 px-4 py-2.5">
          <span className="font-mono text-xl font-bold tracking-tight text-accent-emerald">
            {story.key_metric.value}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {story.key_metric.unit}
          </span>
          {story.key_metric.delta && (
            <span
              className={`flex items-center gap-0.5 font-mono text-xs ${
                story.key_metric.delta.startsWith("-")
                  ? "text-status-error"
                  : "text-status-success"
              }`}
            >
              {story.key_metric.delta.startsWith("-") ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <TrendingUp className="h-3 w-3" />
              )}
              {story.key_metric.delta}
            </span>
          )}
        </div>
      )}

      {/* ── Analysis section ── */}
      <div className="px-5 pb-5 pt-4">
        {/* Key takeaway pull-quote */}
        <div className="border-l-2 border-accent-emerald pl-3">
          <p className="text-sm font-medium leading-relaxed text-foreground/90">
            {keyTakeaway}
          </p>
        </div>

        {/* Extended detail */}
        {detail && (
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {detail}
          </p>
        )}

        {/* Connected storyline context */}
        {story.connected_storyline && (
          <p className="mt-3 flex items-center gap-1 text-xs italic text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0 text-accent-amber" />
            {story.connected_storyline.context}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Compact Story Row ─────────────────────────────────────────────────────

function CompactStoryRow({
  story,
  scoredStory,
  index,
}: {
  story: DigestCompactStory;
  scoredStory?: ScoredStory;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const signalType = scoredStory?.signal_type ?? null;
  const config = signalType ? SIGNAL_TYPE_CONFIG[signalType] : null;
  const SignalIcon = config?.icon ?? BookOpen;
  const categoryLabel =
    config?.label ??
    DOMAIN_LABELS[scoredStory?.primary_domain ?? ""] ??
    "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
      className="border-b border-border-subtle last:border-0"
    >
      {/* Row header */}
      <button
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next) {
            fetch("/api/user/signals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "accordion_open", story_id: String(story.rank) }),
            }).catch(() => {});
          }
        }}
        className="flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-surface-2/30"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
          <SignalIcon className="h-4 w-4 text-accent-emerald" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {story.headline}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{story.source}</span>
            {categoryLabel && (
              <>
                <span className="text-border-medium">&middot;</span>
                <span className="text-accent-emerald/70">{categoryLabel}</span>
              </>
            )}
          </div>
        </div>

        {story.key_metric && (
          <span className="shrink-0 font-mono text-sm font-bold text-accent-emerald">
            {story.key_metric.value}
          </span>
        )}

        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Accordion expansion */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 pl-11 pr-4">
              <p className="text-[13px] leading-relaxed text-foreground/70">
                {story.one_line_take}
              </p>

              {story.key_metric && (
                <div className="mt-2">
                  <KeyMetric metric={story.key_metric} />
                </div>
              )}

              <div className="mt-2">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-emerald underline-offset-2 transition-colors hover:text-accent-emerald-light hover:underline"
                >
                  Read at {story.source}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Connections Card ──────────────────────────────────────────────────────

function ConnectionsCard({
  connections,
}: {
  connections: DigestCrossConnection[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
      className="space-y-3"
    >
      {connections.map((conn, i) => (
        <div
          key={i}
          className="rounded-lg border-l-2 border-accent-amber bg-surface-2/40 p-4"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-amber">
            Connected
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/80">
            {conn.connection}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Stories {conn.story_ranks.join(" & ")}
          </p>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Digest Footer ─────────────────────────────────────────────────────────

function DigestFooter({
  generatedAt,
  onRegenerate,
  generating,
}: {
  generatedAt: string;
  onRegenerate: () => void;
  generating: boolean;
}) {
  const time = new Date(generatedAt).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Sydney",
  });

  return (
    <div className="flex items-center justify-between py-6 text-xs text-muted-foreground">
      <span>Updated {time} AEST</span>
      <div className="flex items-center gap-3">
        <span>Powered by ClimatePulse intelligence</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onRegenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {generating ? "Generating..." : "Regenerate"}
        </Button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function IntelligenceSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Daily number skeleton */}
      <div className="rounded-xl bg-forest-green/50 p-6">
        <Skeleton className="mb-3 h-3 w-24 bg-white/10" />
        <Skeleton className="mb-2 h-12 w-32 bg-white/10" />
        <Skeleton className="h-4 w-48 bg-white/10" />
        <Skeleton className="mt-4 h-1.5 w-full bg-white/10" />
        <Skeleton className="mt-4 h-10 w-full bg-white/10" />
      </div>

      {/* Narrative skeleton */}
      <div className="rounded-xl bg-surface-2/30 p-6">
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>

      {/* Hero stories skeleton */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl bg-card ring-1 ring-border-subtle">
          <div className="flex gap-3.5 p-5 pb-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="px-5 pb-5">
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────

function IntelligenceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-error/10">
        <AlertCircle className="h-7 w-7 text-status-error" />
      </div>
      <h3 className="font-display text-lg font-semibold">
        Briefing unavailable
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function IntelligenceEmpty({
  onGenerate,
  generating,
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-emerald/10">
        <BookOpen className="h-7 w-7 text-accent-emerald" />
      </div>
      <h3 className="font-display text-lg font-semibold">
        Your morning briefing
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Run the enrichment pipeline first to generate stories, then generate
        your personalised intelligence digest.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
        )}
        {generating ? "Generating..." : "Generate Briefing"}
      </Button>
    </div>
  );
}

// ─── Section Label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

// ─── Compact Generation Chart ─────────────────────────────────────────────

function CompactGenerationChart({
  timestamps,
  generation,
  fueltechs,
}: {
  timestamps: string[];
  generation: Record<string, number[]>;
  fueltechs: { key: string; label: string; color: string }[];
}) {
  if (timestamps.length < 2) return null;

  const W = 340;
  const H = 110;
  const barCount = timestamps.length;
  const barW = W / barCount;

  const ftReversed = [...fueltechs].reverse();
  const stacks = ftReversed.map((ft) => ({
    key: ft.key,
    color: ft.color,
    values: generation[ft.key] ?? timestamps.map(() => 0),
  }));

  const maxGen = Math.max(
    ...timestamps.map((_, i) => stacks.reduce((sum, s) => sum + s.values[i], 0)),
    1
  );

  // Compute totals per fueltech for legend filtering
  const ftTotals = new Map<string, number>();
  for (const s of stacks) {
    ftTotals.set(s.key, s.values.reduce((a, b) => a + b, 0));
  }
  const grandTotal = Array.from(ftTotals.values()).reduce((a, b) => a + b, 1);

  return (
    <div className="rounded-xl bg-surface-2/40 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Generation — 24h
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 110 }}>
        {timestamps.map((_, i) => {
          let cumulative = 0;
          return (
            <g key={i}>
              {stacks.map((stack) => {
                const val = stack.values[i];
                const barH = (val / maxGen) * H;
                const y = H - cumulative - barH;
                cumulative += barH;
                if (barH < 0.3) return null;
                return (
                  <rect
                    key={stack.key}
                    x={i * barW + 0.25}
                    y={y}
                    width={Math.max(barW - 0.5, 0.5)}
                    height={barH}
                    fill={stack.color}
                    opacity={0.85}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {fueltechs
          .filter((ft) => ((ftTotals.get(ft.key) ?? 0) / grandTotal) * 100 > 2)
          .map((ft) => (
            <div key={ft.key} className="flex items-center gap-1 text-[9px]">
              <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: ft.color }} />
              <span className="text-muted-foreground">{ft.label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Compact Price Chart ──────────────────────────────────────────────────

function CompactPriceChart({
  timestamps,
  price,
}: {
  timestamps: string[];
  price: number[];
}) {
  if (timestamps.length < 2 || price.length < 2) return null;

  const W = 340;
  const H = 72;
  const PAD = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const validPrices = price.filter((p) => p !== null && isFinite(p));
  const minPrice = Math.min(...validPrices, 0);
  const maxPrice = Math.max(...validPrices, 100);
  const range = maxPrice - minPrice || 1;

  const yScale = (v: number) =>
    PAD.top + chartH - ((v - minPrice) / range) * chartH;

  const linePath = price
    .map((p, i) => {
      const x = PAD.left + (i / (price.length - 1)) * chartW;
      const y = yScale(p);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Area fill path
  const areaPath = `${linePath} L${PAD.left + chartW},${PAD.top + chartH} L${PAD.left},${PAD.top + chartH} Z`;

  const avgPrice = Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
  const latestPrice = Math.round(price[price.length - 1]);

  return (
    <div className="rounded-xl bg-surface-2/40 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Price — 24h
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 72 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zero line if negative prices */}
        {minPrice < 0 && (
          <line
            x1={PAD.left}
            y1={yScale(0)}
            x2={W - PAD.right}
            y2={yScale(0)}
            stroke="var(--muted-foreground)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
            opacity={0.4}
          />
        )}

        <path d={areaPath} fill="url(#priceFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />

        {/* Highlight dots for negative/spike prices */}
        {price.map((p, i) => {
          if (p < 0) {
            return (
              <circle
                key={i}
                cx={PAD.left + (i / (price.length - 1)) * chartW}
                cy={yScale(p)}
                r={2}
                fill="var(--status-success)"
              />
            );
          }
          if (p > maxPrice * 0.85) {
            return (
              <circle
                key={i}
                cx={PAD.left + (i / (price.length - 1)) * chartW}
                cy={yScale(p)}
                r={2}
                fill="var(--status-error)"
              />
            );
          }
          return null;
        })}

        {/* Min / Max labels */}
        <text x={PAD.left + 2} y={yScale(maxPrice) + 10} fontSize="8" fill="var(--muted-foreground)">
          ${Math.round(maxPrice)}
        </text>
        <text x={PAD.left + 2} y={yScale(minPrice) - 3} fontSize="8" fill="var(--muted-foreground)">
          ${Math.round(minPrice)}
        </text>
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          Avg <span className="font-mono font-medium text-foreground">${avgPrice}</span>/MWh
        </span>
        <span className="text-muted-foreground">
          Now <span className="font-mono font-medium text-foreground">${latestPrice}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Wholesale Price Column Chart ─────────────────────────────────────────

function WholesalePriceColumnChart({
  priceSummaries,
}: {
  priceSummaries: PriceSummary[];
}) {
  if (priceSummaries.length === 0) return null;

  const W = 340;
  const H = 150;
  const PAD = { top: 8, right: 8, bottom: 22, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Y scale
  const allMax = Math.max(...priceSummaries.map((p) => p.max_24h ?? 0), 100);
  const allMin = Math.min(...priceSummaries.map((p) => p.min_24h ?? 0), 0);
  const yTop = allMax * 1.1;
  const yBottom = Math.min(allMin * 1.1, 0);
  const yRange = yTop - yBottom || 1;

  const yScale = (v: number) =>
    PAD.top + chartH - ((v - yBottom) / yRange) * chartH;

  const barSlotW = chartW / priceSummaries.length;
  const barW = barSlotW * 0.45;

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round(yBottom + (yRange * i) / (tickCount - 1))
  );

  return (
    <div className="rounded-xl bg-surface-2/40 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Prices by State — 24h ($/MWh)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 150 }}>
        {/* Grid lines */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={yScale(tick)}
              x2={W - PAD.right}
              y2={yScale(tick)}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="2,4"
            />
            <text
              x={PAD.left - 4}
              y={yScale(tick) + 3}
              textAnchor="end"
              fontSize="8"
              fill="var(--muted-foreground)"
            >
              ${tick}
            </text>
          </g>
        ))}

        {/* Zero line */}
        {yBottom < 0 && (
          <line
            x1={PAD.left}
            y1={yScale(0)}
            x2={W - PAD.right}
            y2={yScale(0)}
            stroke="var(--muted-foreground)"
            strokeWidth="0.75"
            strokeDasharray="4,3"
            opacity={0.5}
          />
        )}

        {/* Bars + range indicators */}
        {priceSummaries.map((p, i) => {
          const cx = PAD.left + i * barSlotW + barSlotW / 2;
          const avg = p.avg_24h ?? 0;
          const min = p.min_24h ?? 0;
          const max = p.max_24h ?? 0;

          // Bar from zero (or yBottom if all positive) to avg
          const barTop = yScale(avg);
          const barBottom = yScale(Math.max(0, yBottom));
          const barHeight = Math.max(barBottom - barTop, 1);

          // Column color based on price
          const fill =
            avg > 100
              ? "var(--status-error)"
              : avg > 50
              ? "#F59E0B"
              : "var(--accent-emerald)";

          const capW = 6;

          return (
            <g key={p.region}>
              {/* Column */}
              <rect
                x={cx - barW / 2}
                y={barTop}
                width={barW}
                height={barHeight}
                fill={fill}
                opacity={0.8}
                rx={2}
              />

              {/* Range line (min to max) */}
              <line
                x1={cx}
                y1={yScale(max)}
                x2={cx}
                y2={yScale(min)}
                stroke="var(--foreground)"
                strokeWidth="1"
                opacity={0.4}
              />

              {/* Top cap */}
              <line
                x1={cx - capW / 2}
                y1={yScale(max)}
                x2={cx + capW / 2}
                y2={yScale(max)}
                stroke="var(--foreground)"
                strokeWidth="1"
                opacity={0.4}
              />

              {/* Bottom cap */}
              <line
                x1={cx - capW / 2}
                y1={yScale(min)}
                x2={cx + capW / 2}
                y2={yScale(min)}
                stroke="var(--foreground)"
                strokeWidth="1"
                opacity={0.4}
              />

              {/* Avg label on bar */}
              <text
                x={cx}
                y={barTop - 4}
                textAnchor="middle"
                fontSize="8"
                fontWeight="600"
                fill="var(--foreground)"
              >
                ${Math.round(avg)}
              </text>

              {/* Region label */}
              <text
                x={cx}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill="var(--muted-foreground)"
              >
                {p.region}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Energy Sidebar ───────────────────────────────────────────────────────

function EnergySidebar({ data }: { data: EnergyDashboardData }) {
  return (
    <div className="space-y-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Energy Snapshot
      </span>

      {data.intraday.timestamps.length > 2 && (
        <CompactGenerationChart
          timestamps={data.intraday.timestamps}
          generation={data.intraday.generation}
          fueltechs={data.intraday.fueltechs}
        />
      )}

      {data.intraday.price.length > 2 && (
        <CompactPriceChart
          timestamps={data.intraday.timestamps}
          price={data.intraday.price}
        />
      )}

      {data.price_summaries.length > 0 && (
        <WholesalePriceColumnChart priceSummaries={data.price_summaries} />
      )}
    </div>
  );
}

// ─── Main Intelligence Tab ─────────────────────────────────────────────────

export function IntelligenceTab() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [energyData, setEnergyData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id || "test-user-1";

  const fetchBriefing = useCallback(async () => {
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

      // Energy is non-critical — fail silently
      if (energyRes.status === "fulfilled" && energyRes.value.ok) {
        setEnergyData(await energyRes.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const generateBriefing = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Generation failed: ${res.status}`);
      }
      const data = await res.json();
      setBriefing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }, [userId]);

  // Fetch briefing on mount and when user changes
  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  if (loading) return <IntelligenceSkeleton />;
  if (error) return <IntelligenceError message={error} onRetry={fetchBriefing} />;
  if (!briefing) return <IntelligenceEmpty onGenerate={generateBriefing} generating={generating} />;

  const { digest, stories } = briefing;
  const heroStories = stories.filter((s) => s.designation === "hero");
  const compactStories = stories.filter((s) => s.designation === "compact");

  // Match digest hero/compact stories to scored stories by title
  const findScoredStory = (headline: string) =>
    stories.find((s) => s.title === headline);

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 xl:grid-cols-[1fr_380px]">
        {/* ── Left column: briefing content ──────────────────────── */}
        <div className="min-w-0">
          {/* Daily Number — serves as the page greeting */}
          <DailyNumberCard
            data={digest.daily_number}
            date={today}
            storyCount={stories.length}
          />

          {/* Narrative */}
          <div className="mt-5">
            <NarrativeCard text={digest.narrative} />
          </div>

          {/* Hero Stories */}
          <SectionLabel>Top Stories</SectionLabel>
          <div className="space-y-4">
            {digest.hero_stories.map((story, i) => (
              <HeroStoryCard
                key={story.rank}
                story={story}
                scoredStory={findScoredStory(story.headline)}
                index={i}
              />
            ))}
          </div>

          {/* Compact Stories */}
          {digest.compact_stories.length > 0 && (
            <>
              <SectionLabel>Also in your briefing</SectionLabel>
              <div>
                {digest.compact_stories.map((story, i) => (
                  <CompactStoryRow
                    key={story.rank}
                    story={story}
                    scoredStory={findScoredStory(story.headline)}
                    index={i}
                  />
                ))}
              </div>
            </>
          )}

          {/* Cross-story Connections */}
          {digest.cross_story_connections &&
            digest.cross_story_connections.length > 0 && (
              <>
                <SectionLabel>Connections</SectionLabel>
                <ConnectionsCard connections={digest.cross_story_connections} />
              </>
            )}

          {/* Footer */}
          <DigestFooter
            generatedAt={briefing.generated_at}
            onRegenerate={generateBriefing}
            generating={generating}
          />
        </div>

        {/* ── Right column: energy charts sidebar ────────────────── */}
        {energyData && (
          <aside className="mt-6 lg:mt-0">
            <div className="space-y-4 lg:sticky lg:top-6">
              <EnergySidebar data={energyData} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
