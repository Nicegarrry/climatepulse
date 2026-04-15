"use client";

import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import { Micro, WobblyRule, SourceTag } from "@/components/intelligence/primitives";
import { WeeklyNumber } from "./weekly-number";
import type { WeeklyDigest, WeeklyCuratedStory } from "@/lib/types";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const startStr = start.toLocaleDateString("en-AU", { day: "numeric", month: "long" });
  const endStr = end.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return `${startStr} \u2013 ${endStr}`;
}

// ─── Story Card ────────────────────────────────────────────────────────────

function StoryCard({ story }: { story: WeeklyCuratedStory }) {
  const sev = SEVERITY[story.severity] || SEVERITY.watch;

  return (
    <div
      style={{
        padding: "14px 16px",
        background: COLORS.surface,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 5,
              background: sev.borderColor,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <Micro color={sev.labelColor}>{story.sector}</Micro>
        </div>
        {story.key_metric && (
          <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>
              {story.key_metric.value}
            </span>
            <span style={{ fontSize: 10, color: COLORS.inkMuted, marginLeft: 2 }}>
              {story.key_metric.unit}
            </span>
            {story.key_metric.delta && (
              <span style={{ fontSize: 9, color: COLORS.inkMuted, marginLeft: 4 }}>
                {story.key_metric.delta}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Headline */}
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 16,
          fontWeight: 500,
          color: COLORS.ink,
          margin: 0,
          lineHeight: 1.35,
          letterSpacing: -0.2,
        }}
      >
        {story.headline}
      </h3>

      {/* Editor take */}
      <p
        style={{
          fontSize: 13,
          color: COLORS.inkSec,
          lineHeight: 1.55,
          margin: "8px 0 0",
        }}
      >
        {story.editor_take}
      </p>

      {/* Source */}
      <div style={{ marginTop: 8 }}>
        <SourceTag name={story.source} />
      </div>
    </div>
  );
}

// ─── Theme Commentary ─────────────────────────────────────────────────────

function ThemeCommentary({ themes }: { themes: { theme_label: string; commentary: string }[] }) {
  return (
    <div style={{ marginTop: 24 }}>
      <Micro mb={8}>Themes</Micro>
      <WobblyRule color={COLORS.borderLight} />
      <div style={{ marginTop: 12 }}>
        {themes.map((theme, i) => (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              background: COLORS.paperDark,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.forest, marginBottom: 4 }}>
              {theme.theme_label}
            </div>
            <p style={{ fontSize: 13, color: COLORS.inkSec, lineHeight: 1.5, margin: 0 }}>
              {theme.commentary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function CurrentDigest({ digest }: { digest: WeeklyDigest }) {
  const weekRange = formatWeekRange(digest.week_start, digest.week_end);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 6 }}>
        <Micro color={COLORS.inkMuted}>{weekRange}</Micro>
      </div>
      <h1
        style={{
          fontFamily: FONTS.serif,
          fontSize: 30,
          fontWeight: 400,
          color: COLORS.ink,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: -0.8,
        }}
      >
        {digest.headline}
      </h1>

      {digest.published_at && (
        <div style={{ fontSize: 10, color: COLORS.inkFaint, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
          Published{" "}
          {new Date(digest.published_at).toLocaleDateString("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
      )}

      <div style={{ margin: "18px 0" }}>
        <WobblyRule />
      </div>

      {/* Weekly Number (inline on mobile, shown separately on desktop sidebar) */}
      {digest.weekly_number && (
        <div className="lg:hidden">
          <WeeklyNumber data={digest.weekly_number} />
        </div>
      )}

      {/* Editorial Narrative */}
      <div style={{ marginBottom: 24 }}>
        {digest.editor_narrative.split("\n\n").map((paragraph, i) => (
          <p
            key={i}
            style={{
              fontFamily: FONTS.serif,
              fontSize: 16,
              color: COLORS.ink,
              lineHeight: 1.65,
              margin: i === 0 ? 0 : "14px 0 0",
              letterSpacing: -0.1,
            }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      {/* Curated Stories */}
      <Micro mb={8}>This Week&apos;s Stories</Micro>
      <WobblyRule color={COLORS.borderLight} />
      <div style={{ marginTop: 10 }}>
        {digest.curated_stories.map((story, i) => (
          <StoryCard key={i} story={story} />
        ))}
      </div>

      {/* Theme Commentary */}
      {digest.theme_commentary && digest.theme_commentary.length > 0 && (
        <ThemeCommentary themes={digest.theme_commentary} />
      )}

      {/* Outlook */}
      {digest.outlook && (
        <div style={{ marginTop: 24 }}>
          <Micro mb={8}>What to Watch</Micro>
          <WobblyRule color={COLORS.borderLight} />
          <div
            style={{
              marginTop: 10,
              padding: "14px 16px",
              background: COLORS.sageTint,
              borderRadius: 8,
              border: `1px solid ${COLORS.borderLight}`,
            }}
          >
            <p style={{ fontSize: 13, color: COLORS.inkSec, lineHeight: 1.55, margin: 0 }}>
              {digest.outlook}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28 }}>
        <WobblyRule color={COLORS.borderLight} />
        <p style={{ fontSize: 10, color: COLORS.inkFaint, lineHeight: 1.5, margin: "10px 0 0", maxWidth: 420 }}>
          Weekly editorial digest. Stories curated from the daily pipeline. Analysis reflects editorial opinion {"\u2014"} verify against primary sources.
        </p>
      </div>
    </div>
  );
}
