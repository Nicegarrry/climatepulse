"use client";

import { useEffect, useState, useCallback } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { COLORS } from "@/lib/design-tokens";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa_install_dismissed";
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const expiry = Number(raw);
  if (Number.isNaN(expiry)) return false;
  return Date.now() < expiry;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone)
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isiOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;
    setIsIOS(isIOS());
    setVisible(true);
  }, []);

  useEffect(() => {
    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <div
      style={{
        background: COLORS.sageTint,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        color: COLORS.forest,
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>Add Climate Pulse to your home screen</span>
        {isiOS && (
          <span style={{ marginLeft: 8, fontWeight: 400, color: COLORS.inkSec, fontSize: 12 }}>
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
          </span>
        )}
        {!isiOS && !deferredPrompt && (
          <span style={{ marginLeft: 8, fontWeight: 400, color: COLORS.inkSec, fontSize: 12 }}>
            Use your browser menu to install
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {deferredPrompt && !isiOS && (
          <button
            onClick={handleInstall}
            style={{
              background: COLORS.forest,
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            color: COLORS.inkMuted,
          }}
        >
          <XMarkIcon style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}
