"use client";

import { COLORS } from "@/lib/design-tokens";

interface Props {
  urgency: 1 | 2 | 3 | 4 | 5;
}

/**
 * Urgency rendered as 0–2 plum bullets in the right gutter.
 * Levels 1–3 show no glyph — rank is conveyed by feed order alone.
 * Levels 4–5 add a single dot; level 5 adds a second to differentiate.
 */
export function UrgencyGlyph({ urgency }: Props) {
  if (urgency <= 3) {
    return <span style={{ display: "inline-block", width: 14 }} aria-hidden />;
  }

  const dots = urgency === 5 ? 2 : 1;
  return (
    <span
      role="img"
      aria-label={`Urgency ${urgency}`}
      style={{
        display: "inline-flex",
        gap: 2,
        color: COLORS.plum,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i}>•</span>
      ))}
    </span>
  );
}
