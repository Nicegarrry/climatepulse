"use client";

import type { MaccStore } from "@/lib/automacc/v4-store";
import { COLORS } from "@/lib/design-tokens";

// Stub — Screen 3 implementation lives here (task #8).
export function MaccChartScreen({ store: _store }: { store: MaccStore }) {
  return (
    <div style={{ padding: 32, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Screen 3 — MACC & prioritise (scaffold)</h2>
      <p style={{ color: COLORS.inkSec }}>MaccChartScreen will render here. Implemented by task #8.</p>
    </div>
  );
}
