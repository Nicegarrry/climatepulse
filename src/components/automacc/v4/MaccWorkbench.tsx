"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { useMaccWorkspace } from "@/lib/automacc/v4-store";
import { CASE_STUDY_SESSIONS } from "@/lib/automacc/case-study";
import { Stepper } from "./Stepper";
import { BaselineScreen } from "./BaselineScreen";
import { LeverMatchScreen } from "./LeverMatchScreen";
import { MaccChartScreen } from "./MaccChartScreen";
import { CompaniesSidebar } from "./CompaniesSidebar";

export function MaccWorkbench() {
  const { user } = useAuth();
  const workspace = useMaccWorkspace(user?.id ?? null, () => CASE_STUDY_SESSIONS);
  const store = workspace.active;
  const { session, setStep } = store;

  // Furthest step we'd let the user jump back to / forward to.
  const maxReached = useMemo<1 | 2 | 3>(() => {
    if (session.levers.some((l) => l.costPerTco2 !== null)) return 3;
    if (session.sources.some((s) => s.tco2y !== null)) return 2;
    return 1;
  }, [session.sources, session.levers]);

  if (!workspace.hydrated) {
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
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
      }}
    >
      <div
        className="automacc-sidebar"
        style={{
          flex: "0 0 260px",
          maxWidth: 260,
          minWidth: 0,
        }}
      >
        <CompaniesSidebar workspace={workspace} />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stepper current={session.step} onJump={setStep} maxReached={maxReached} />
        <main
          style={{
            padding: "32px 24px",
            maxWidth: 1100,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {session.step === 1 && <BaselineScreen store={store} />}
          {session.step === 2 && <LeverMatchScreen store={store} />}
          {session.step === 3 && <MaccChartScreen store={store} />}
        </main>
      </div>
      <style>{`
        @media (max-width: 800px) {
          .automacc-sidebar {
            flex: 1 1 100% !important;
            max-width: 100% !important;
          }
          .automacc-sidebar > aside {
            min-height: 0 !important;
            border-right: none !important;
            border-bottom: 1px solid ${COLORS.border};
          }
        }
      `}</style>
    </div>
  );
}
