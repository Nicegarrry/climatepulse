"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";

const STEPS = [
  { id: 1, label: "Baseline" },
  { id: 2, label: "Match levers" },
  { id: 3, label: "MACC & prioritise" },
] as const;

export function Stepper({
  current,
  onJump,
  maxReached,
}: {
  current: 1 | 2 | 3;
  onJump: (step: 1 | 2 | 3) => void;
  maxReached: 1 | 2 | 3;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 24px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: "#fff",
        fontFamily: FONTS.sans,
      }}
    >
      {STEPS.map((step, idx) => {
        const isActive = step.id === current;
        const isComplete = step.id < maxReached;
        const isReachable = step.id <= maxReached;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => isReachable && onJump(step.id as 1 | 2 | 3)}
              disabled={!isReachable}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: isActive ? COLORS.forest : "transparent",
                color: isActive ? "#fff" : isReachable ? COLORS.ink : COLORS.inkSec,
                border: `1px solid ${isActive ? COLORS.forest : COLORS.border}`,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: isReachable ? "pointer" : "default",
                fontFamily: FONTS.sans,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: isActive ? "#fff" : isComplete ? COLORS.forest : COLORS.border,
                  color: isActive ? COLORS.forest : isComplete ? "#fff" : COLORS.ink,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {step.id}
              </span>
              {step.label}
            </button>
            {idx < STEPS.length - 1 && (
              <span style={{ color: COLORS.inkSec, fontSize: 12 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
