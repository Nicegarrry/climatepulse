"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DevPanel } from "@/components/dev-panel";
import { InstallPrompt } from "@/components/install-prompt";
import { CookieConsent } from "@/components/cookie-consent";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.onboardedAt) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.onboardedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // DevPanel only shown to admin users (gated by role)
  const showDevPanel = user.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <InstallPrompt />
      <main className="flex-1">{children}</main>
      <CookieConsent />
      {showDevPanel && <DevPanel />}
    </div>
  );
}
