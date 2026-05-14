"use client";

import type { MaccStore } from "@/lib/automacc/v4-store";
import { COLORS } from "@/lib/design-tokens";

// Stub — Screen 2 implementation lives here (task #7).
export function LeverMatchScreen({ store: _store }: { store: MaccStore }) {
  return (
    <div style={{ padding: 32, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Screen 2 — Match levers (scaffold)</h2>
      <p style={{ color: COLORS.inkSec }}>LeverMatchScreen will render here. Implemented by task #7.</p>
    </div>
  );
}
