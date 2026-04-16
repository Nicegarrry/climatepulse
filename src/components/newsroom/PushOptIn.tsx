"use client";

import { useCallback, useEffect, useState } from "react";
import { BellAlertIcon, BellSlashIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

type Status = "idle" | "subscribing" | "unsubscribing" | "subscribed" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.warn("[push] sw register failed:", err);
    return null;
  }
}

/**
 * Compact opt-in card for urgency-5 push notifications.
 * Designed to live on the Settings page or inline on the Newsroom feed.
 * Honours existing browser permission state and existing DB subscription.
 */
export function PushOptIn() {
  const [status, setStatus] = useState<Status>("idle");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    (async () => {
      const reg = await ensureRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setStatus("subscribed");
      else if (Notification.permission === "denied") setStatus("denied");
    })();
  }, []);

  const subscribe = useCallback(async () => {
    setStatus("subscribing");
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — cannot subscribe");
      setStatus("idle");
      return;
    }
    const reg = await ensureRegistration();
    if (!reg) {
      setStatus("idle");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }
      // Cast: TS bundles a stricter ArrayBufferLike in the lib than the
      // PushManager subscribe options expect. Runtime is identical.
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
      setStatus("subscribed");
    } catch (err) {
      console.warn("[push] subscribe failed:", err);
      setStatus("idle");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setStatus("unsubscribing");
    try {
      const reg = await ensureRegistration();
      if (!reg) {
        setStatus("idle");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/newsroom/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("idle");
    } catch (err) {
      console.warn("[push] unsubscribe failed:", err);
      setStatus("idle");
    }
  }, []);

  if (!isSupported) {
    return (
      <div
        style={{
          padding: 12,
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: COLORS.inkMuted,
          borderTop: `1px solid ${COLORS.borderLight}`,
        }}
      >
        Push notifications aren’t supported in this browser.
      </div>
    );
  }

  const isOn = status === "subscribed";
  const Icon = isOn ? BellAlertIcon : BellSlashIcon;
  const busy = status === "subscribing" || status === "unsubscribing";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: COLORS.surface,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 4,
      }}
    >
      <Icon
        style={{
          width: 18,
          height: 18,
          color: isOn ? COLORS.forest : COLORS.inkMuted,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.ink,
          }}
        >
          Breaking-news push notifications
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.inkMuted,
            marginTop: 2,
          }}
        >
          {status === "denied"
            ? "Browser blocked notifications. Enable them in site settings."
            : isOn
              ? "On — you’ll be notified for urgency-5 wire items only."
              : "Off — opt in to be alerted for major breaking stories."}
        </div>
      </div>
      <button
        onClick={isOn ? unsubscribe : subscribe}
        disabled={busy || status === "denied"}
        style={{
          background: isOn ? "transparent" : COLORS.forest,
          color: isOn ? COLORS.forest : "#fff",
          border: isOn ? `1px solid ${COLORS.forest}` : "none",
          borderRadius: 3,
          padding: "5px 12px",
          fontFamily: FONTS.sans,
          fontSize: 11,
          fontWeight: 500,
          cursor: busy || status === "denied" ? "not-allowed" : "pointer",
          opacity: busy || status === "denied" ? 0.5 : 1,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {busy ? "…" : isOn ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
