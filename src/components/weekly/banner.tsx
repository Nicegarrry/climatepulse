"use client";

import { useState, useEffect } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface DigestBanner {
  id: string;
  headline: string;
  banner_expires_at: string;
}

export function WeeklyDigestBanner({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const [banner, setBanner] = useState<DigestBanner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkBanner() {
      try {
        const res = await fetch("/api/weekly/digests?status=published&limit=1");
        if (!res.ok) return;
        const data = await res.json();
        const digest = data.digests?.[0];
        if (!digest?.banner_expires_at) return;

        // Check if banner has expired
        if (new Date(digest.banner_expires_at) < new Date()) return;

        // Check if user dismissed this digest's banner
        const dismissKey = `weekly_banner_dismissed_${digest.id}`;
        if (localStorage.getItem(dismissKey)) return;

        setBanner({
          id: digest.id,
          headline: digest.headline,
          banner_expires_at: digest.banner_expires_at,
        });
      } catch {
        // silently fail — banner is non-critical
      }
    }

    checkBanner();
  }, []);

  if (!banner || dismissed) return null;

  function dismiss() {
    if (banner) {
      localStorage.setItem(`weekly_banner_dismissed_${banner.id}`, "1");
    }
    setDismissed(true);
  }

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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: COLORS.forest,
            fontFamily: FONTS.sans,
            flexShrink: 0,
          }}
        >
          Weekly Pulse
        </span>
        <span
          style={{
            fontSize: 13,
            color: COLORS.ink,
            fontFamily: FONTS.serif,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {banner.headline}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onNavigate}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.forest,
            background: "none",
            border: `1px solid ${COLORS.forest}`,
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: FONTS.sans,
          }}
        >
          Read
        </button>
        <button
          onClick={dismiss}
          style={{
            fontSize: 14,
            color: COLORS.inkMuted,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            lineHeight: 1,
          }}
          aria-label="Dismiss banner"
        >
          {"\u00D7"}
        </button>
      </div>
    </div>
  );
}
