"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";

interface Props {
  domain: string;
  onClick?: () => void;
  active?: boolean;
}

/**
 * Editorial sector tag — small-caps text with a hairline underline.
 * Not a pill, not a badge, never a coloured background.
 */
export function SectorTag({ domain, onClick, active }: Props) {
  const label = domain.replace(/-/g, " ").toUpperCase();
  const interactive = typeof onClick === "function";

  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-block",
        fontFamily: FONTS.sans,
        fontSize: 10,
        letterSpacing: 0.6,
        fontWeight: 500,
        color: active ? COLORS.forest : COLORS.inkSec,
        borderBottom: `1px solid ${active ? COLORS.forest : "rgba(30,77,43,0.35)"}`,
        paddingBottom: 1,
        cursor: interactive ? "pointer" : "default",
        userSelect: interactive ? "none" : "auto",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
