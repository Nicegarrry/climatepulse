"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import type { PodcastArchetype } from "@/lib/podcast/archetypes";
import { ARCHETYPE_FRAMINGS } from "@/lib/podcast/archetypes";

type Tier = "daily" | "themed" | "flagship";

const TIER_STYLE: Record<Tier, { label: string; bg: string; fg: string }> = {
  daily: { label: "Daily", bg: COLORS.sageTint, fg: COLORS.forest },
  themed: { label: "Themed", bg: COLORS.plumLight, fg: COLORS.plum },
  flagship: { label: "Flagship", bg: COLORS.ink, fg: "#fff" },
};

const ARCHETYPE_COLORS: Record<PodcastArchetype, { bg: string; fg: string }> = {
  commercial: { bg: "#F0E9D8", fg: "#6B5320" },
  academic:   { bg: "#E3ECF3", fg: "#2C4A63" },
  public:     { bg: "#EFE3E7", fg: "#703349" },
  general:    { bg: COLORS.paperDark, fg: COLORS.inkSec },
};

export function TierBadge({ tier }: { tier: Tier }) {
  const s = TIER_STYLE[tier];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: s.bg,
        color: s.fg,
        fontFamily: FONTS.sans,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        borderRadius: 2,
      }}
    >
      {s.label}
    </span>
  );
}

export function ArchetypeBadge({ archetype }: { archetype: PodcastArchetype | null | undefined }) {
  if (!archetype) return null;
  const s = ARCHETYPE_COLORS[archetype];
  const label = ARCHETYPE_FRAMINGS[archetype].short;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        background: s.bg,
        color: s.fg,
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.4,
        borderRadius: 2,
      }}
    >
      {label}
    </span>
  );
}

export function ThemeBadge({ themeSlug }: { themeSlug: string | null | undefined }) {
  if (!themeSlug) return null;
  const pretty = themeSlug.replace(/_/g, " ");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        background: "transparent",
        color: COLORS.inkSec,
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.5,
        textTransform: "capitalize",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 2,
      }}
    >
      {pretty}
    </span>
  );
}
