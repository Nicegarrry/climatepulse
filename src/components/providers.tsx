"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalyticsProvider } from "@/lib/analytics/provider";
import { useAuth } from "@/lib/auth-context";

function AnalyticsBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <AnalyticsProvider userId={user?.id ?? null}>
      {children}
    </AnalyticsProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light">
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

export { AnalyticsBridge };
