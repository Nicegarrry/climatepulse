"use client";

import type { MaccStore } from "@/lib/automacc/v4-store";
import { COLORS } from "@/lib/design-tokens";

// Stub — Screen 1 implementation lives here (task #6).
export function BaselineScreen({ store: _store }: { store: MaccStore }) {
  return (
    <div style={{ padding: 32, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Screen 1 — Baseline (scaffold)</h2>
      <p style={{ color: COLORS.inkSec }}>BaselineScreen will render here. Implemented by task #6.</p>
    </div>
  );
}
