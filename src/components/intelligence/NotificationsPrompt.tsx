"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

const STORAGE_KEY = "cp_notifs_prompt_resolved";
const SHOW_DELAY_MS = 8_000;

type Status = "hidden" | "prompting" | "subscribing" | "subscribed" | "error";

interface Props {
  /** True once the user has a ready briefing on screen. */
  briefingReady: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export function NotificationsPrompt({ briefingReady }: Props) {
  const [status, setStatus] = useState<Status>("hidden");

  useEffect(() => {
    if (!briefingReady) return;
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return;

    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage unavailable — show anyway
    }

    if (Notification.permission !== "default") {
      // Already granted or denied elsewhere — don't second-guess the user.
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* no-op */
      }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const reg = await ensureRegistration();
      const existingSub = await reg?.pushManager.getSubscription();
      if (existingSub) {
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* no-op */
        }
        return;
      }
      if (!cancelled) setStatus("prompting");
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [briefingReady]);

  const resolve = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* no-op */
    }
  }, []);

  const dismiss = useCallback(() => {
    resolve();
    setStatus("hidden");
  }, [resolve]);

  const subscribe = useCallback(async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setStatus("error");
      return;
    }
    setStatus("subscribing");
    const reg = await ensureRegistration();
    if (!reg) {
      setStatus("error");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        resolve();
        setStatus("hidden");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/newsroom/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      resolve();
      setStatus("subscribed");
      setTimeout(() => setStatus("hidden"), 2200);
    } catch {
      setStatus("error");
    }
  }, [resolve]);

  if (status === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-label="Enable breaking-news notifications"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 50,
        width: 340,
        maxWidth: "calc(100vw - 40px)",
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.forest}`,
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
        fontFamily: FONTS.sans,
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: COLORS.inkFaint,
          padding: 4,
          lineHeight: 0,
        }}
      >
        <X size={14} />
      </button>

      {status === "subscribed" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <BellAlertIcon width={18} height={18} style={{ color: COLORS.forest }} />
          <span style={{ fontSize: 13, color: COLORS.forest, fontWeight: 500 }}>
            You&rsquo;re in. We&rsquo;ll only ping for breaking stories.
          </span>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: COLORS.forest,
              marginBottom: 6,
            }}
          >
            <BellAlertIcon width={12} height={12} />
            Breaking-news alerts
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.45,
              color: COLORS.ink,
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            Want a push when a story breaks that can&rsquo;t wait until tomorrow&rsquo;s brief?
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: COLORS.inkMuted,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            Urgency-5 wire items only — typically fewer than three a week. You can turn
            this off anytime in Settings.
          </div>
          {status === "error" && (
            <div
              style={{
                fontSize: 11,
                color: COLORS.plum,
                marginBottom: 10,
              }}
            >
              Couldn&rsquo;t enable notifications. Try again from Settings.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={subscribe}
              disabled={status === "subscribing"}
              style={{
                flex: 1,
                background: COLORS.forest,
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.3,
                cursor: status === "subscribing" ? "not-allowed" : "pointer",
                opacity: status === "subscribing" ? 0.6 : 1,
                fontFamily: FONTS.sans,
              }}
            >
              {status === "subscribing" ? "Enabling…" : "Turn on"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              style={{
                background: "transparent",
                color: COLORS.inkMuted,
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: 4,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: FONTS.sans,
              }}
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
