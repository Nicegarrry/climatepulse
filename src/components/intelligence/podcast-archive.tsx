"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { PodcastArchiveItem } from "@/lib/types";
import { TierBadge, ArchetypeBadge, ThemeBadge } from "./podcast-badges";

type Tier = "daily" | "themed" | "flagship";

interface ArchiveResponse {
  episodes: PodcastArchiveItem[];
  tier: string;
  paid: boolean;
  pagination: { limit: number; offset: number; returned: number };
}

const TIERS: { id: Tier; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "themed", label: "Themed" },
  { id: "flagship", label: "Flagship" },
];

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export function PodcastArchive() {
  const [activeTier, setActiveTier] = useState<Tier>("daily");
  const [items, setItems] = useState<PodcastArchiveItem[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUpgradeRequired(false);

    fetch(`/api/podcast/archive?tier=${activeTier}&limit=50`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (r.status === 402) {
          if (!cancelled) {
            setUpgradeRequired(true);
            setItems([]);
          }
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ArchiveResponse;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setItems(data.episodes);
        setIsPaid(data.paid);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTier]);

  return (
    <section style={{ padding: "24px 0" }}>
      <header style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 22,
            fontWeight: 500,
            color: COLORS.ink,
            margin: 0,
          }}
        >
          Podcast archive
        </h2>
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.inkMuted,
            margin: "4px 0 0",
          }}
        >
          Daily briefings, themed deep-dives, and flagship episodes.
        </p>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: 16,
        }}
      >
        {TIERS.map((t) => {
          const active = t.id === activeTier;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTier(t.id)}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                borderBottom: active ? `2px solid ${COLORS.forest}` : "2px solid transparent",
                marginBottom: -1,
                fontFamily: FONTS.sans,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? COLORS.forest : COLORS.inkSec,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {loading && (
        <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.inkMuted, padding: "24px 0" }}>
          Loading…
        </div>
      )}

      {error && !loading && (
        <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.ink, padding: "24px 0" }}>
          Couldn&apos;t load archive: {error}
        </div>
      )}

      {upgradeRequired && !loading && (
        <div
          style={{
            padding: 20,
            background: COLORS.plumLight,
            border: `1px solid ${COLORS.plum}22`,
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 16,
              color: COLORS.plum,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Themed and flagship episodes are part of ClimatePulse Launch.
          </div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.inkSec }}>
            Upgrade your plan to unlock weekly deep-dives and long-form flagship episodes.
          </div>
        </div>
      )}

      {!loading && !error && !upgradeRequired && items.length === 0 && (
        <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.inkMuted, padding: "24px 0" }}>
          {activeTier === "daily" && !isPaid
            ? "No episodes in the last 7 days."
            : "No episodes yet."}
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((ep) => (
            <li
              key={ep.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "14px 0",
                borderBottom: `1px solid ${COLORS.borderLight}`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  color: COLORS.inkMuted,
                  minWidth: 96,
                  flexShrink: 0,
                }}
              >
                {formatDate(ep.briefing_date)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 15,
                    color: COLORS.ink,
                    lineHeight: 1.35,
                    marginBottom: 4,
                  }}
                >
                  <a
                    href={ep.audio_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {ep.title ?? `ClimatePulse ${ep.tier} — ${ep.briefing_date}`}
                  </a>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <TierBadge tier={ep.tier} />
                  <ArchetypeBadge archetype={ep.archetype} />
                  <ThemeBadge themeSlug={ep.theme_slug} />
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  color: COLORS.inkMuted,
                  flexShrink: 0,
                }}
              >
                {formatDuration(ep.audio_duration_seconds)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
