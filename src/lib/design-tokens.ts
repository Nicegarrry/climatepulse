// ClimatePulse Editorial Design Tokens
// Single source of truth — mirrors the reference designs in docs/

export const COLORS = {
  // Backgrounds (warm paper)
  bg: "#FAF9F7",
  surface: "#FFFFFF",
  paperDark: "#F5F3F0",

  // Borders (warm grey)
  border: "#E8E5E0",
  borderLight: "#F0EEEA",

  // Ink (warm black scale)
  ink: "#1A1A1A",
  inkSec: "#5C5C5C",
  inkMuted: "#8C8C8C",
  inkFaint: "#B3B3B3",

  // Brand — forest green (primary accent, ~5% of screen)
  forest: "#1E4D2B",
  forestMid: "#4A7C59",
  sage: "#94A88A",
  sageTint: "#EFF4EC",

  // Brand — plum (Daily Number + streak only)
  plum: "#3D1F3D",
  plumLight: "#F5EEF5",
  plumMid: "#6B4A6B",
} as const;

export const FONTS = {
  serif: "'Crimson Pro', Georgia, serif",
  sans: "'Source Sans 3', system-ui, sans-serif",
} as const;

export const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

export const SEVERITY = {
  alert: { borderColor: COLORS.ink, labelColor: COLORS.ink, fontWeight: 700 },
  watch: { borderColor: COLORS.inkMuted, labelColor: COLORS.inkSec, fontWeight: 500 },
  ready: { borderColor: COLORS.forest, labelColor: COLORS.forest, fontWeight: 400 },
  clear: { borderColor: "transparent", labelColor: COLORS.inkMuted, fontWeight: 400 },
} as const;

export type SeverityLevel = keyof typeof SEVERITY;

export const NAV_ITEMS = [
  { icon: "\u25C7", label: "Briefing", value: "intelligence" },
  { icon: "\u2197", label: "Explore", value: "discovery" },
  { icon: "\u2261", label: "Sectors", value: "categories" },
  { icon: "\u25CE", label: "Storylines", value: "energy" },
  { icon: "\u25A4", label: "Weekly", value: "taxonomy" },
] as const;
