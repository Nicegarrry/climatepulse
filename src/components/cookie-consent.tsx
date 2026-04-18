"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cp_cookie_consent";

/**
 * Minimal, non-blocking cookie-consent banner.
 *
 * Appears once per browser after the user signs in. The banner covers the
 * non-strictly-necessary cookies we set (cp_returning routing cookie,
 * product analytics). Strictly-necessary auth cookies (Supabase session)
 * are exempt from consent requirements under AU Privacy Act + GDPR
 * functional-cookie carve-outs.
 *
 * Choice is stored in localStorage so the banner never re-prompts on the
 * same device. Nothing server-side depends on the value — this is a
 * transparency notice, not a consent gate.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Show after a short delay so it doesn't land on top of other UI
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage unavailable — skip prompt */
    }
  }, []);

  const persist = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* no-op */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 60,
        maxWidth: 520,
        margin: "0 auto",
        background: "#FFFFFF",
        border: "1px solid #E8E5E0",
        borderTop: "2px solid #1E4D2B",
        borderRadius: 8,
        padding: "14px 16px",
        boxShadow: "0 8px 24px rgba(26,16,28,0.12)",
        fontFamily: "var(--font-sans), 'Source Sans 3', system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#1A1A1A" }}>
        <strong style={{ fontWeight: 600 }}>ClimatePulse uses cookies</strong> to keep you
        signed in, remember device preferences, and measure product usage.{" "}
        <Link
          href="/privacy"
          style={{ color: "#1E4D2B", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          Learn more
        </Link>
        .
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => persist("rejected")}
          style={{
            background: "transparent",
            color: "#5C5C5C",
            border: "1px solid #E8E5E0",
            borderRadius: 4,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => persist("accepted")}
          style={{
            background: "#1E4D2B",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 0.2,
          }}
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
