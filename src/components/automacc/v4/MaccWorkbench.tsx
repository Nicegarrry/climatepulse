"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { useMaccStore } from "@/lib/automacc/v4-store";
import { Stepper } from "./Stepper";
import { BaselineScreen } from "./BaselineScreen";
import { LeverMatchScreen } from "./LeverMatchScreen";
import { MaccChartScreen } from "./MaccChartScreen";

export function MaccWorkbench() {
  const { user } = useAuth();
  const store = useMaccStore(user?.id ?? null);
  const { session, setStep } = store;

  // Furthest step we'd let the user jump back to / forward to.
  const maxReached = useMemo<1 | 2 | 3>(() => {
    if (session.levers.some((l) => l.costPerTco2 !== null)) return 3;
    if (session.sources.some((s) => s.tco2y !== null)) return 2;
    return 1;
  }, [session.sources, session.levers]);

  if (!store.hydrated) {
    return (
      <div
        style={{
          padding: 64,
          textAlign: "center",
          color: COLORS.inkSec,
          fontFamily: FONTS.sans,
        }}
      >
        Loading your session…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAFAF7",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <Stepper current={session.step} onJump={setStep} maxReached={maxReached} />
      <main style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {session.step === 1 && <BaselineScreen store={store} />}
        {session.step === 2 && <LeverMatchScreen store={store} />}
        {session.step === 3 && <MaccChartScreen store={store} />}
      </main>
    </div>
  );
}
