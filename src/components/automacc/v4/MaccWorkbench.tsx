"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
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
      }}
    >
      {/* Top bar — climatepulse logo + back link. Hidden in print. */}
      <header
        data-print-hide="true"
        className="automacc-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "12px 24px",
          background: "#fff",
          borderBottom: `1px solid ${COLORS.border}`,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: COLORS.ink,
            textDecoration: "none",
            fontFamily: FONTS.sans,
          }}
          aria-label="Back to ClimatePulse dashboard"
        >
          <ArrowLeftIcon width={16} height={16} style={{ color: COLORS.inkSec }} />
          <img
            src="/logo.svg"
            alt="ClimatePulse"
            height={22}
            style={{ height: 22, width: "auto", display: "block" }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.inkSec,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              borderLeft: `1px solid ${COLORS.border}`,
              paddingLeft: 12,
              marginLeft: 4,
            }}
          >
            AutoMACC
          </span>
        </Link>
        <Link
          href="/dashboard"
          style={{
            fontSize: 13,
            color: COLORS.inkSec,
            textDecoration: "none",
            padding: "6px 12px",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            fontFamily: FONTS.sans,
          }}
        >
          ← Back to dashboard
        </Link>
      </header>

      <div
        className="automacc-body"
        style={{
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
          className="automacc-main-pane"
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
