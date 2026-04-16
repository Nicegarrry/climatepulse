"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { SectorTag } from "./SectorTag";

const DOMAIN_OPTIONS = [
  "energy-generation",
  "energy-storage",
  "energy-grid",
  "carbon-emissions",
  "transport",
  "industry",
  "agriculture",
  "built-environment",
  "critical-minerals",
  "finance",
  "policy",
  "workforce-adaptation",
];

interface Props {
  threshold: number;
  sectors: string[];
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onChangeThreshold: (n: number) => void;
  onChangeSectors: (next: string[]) => void;
  onRefresh: () => void;
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function FeedHeader({
  threshold,
  sectors,
  lastUpdated,
  isRefreshing,
  onChangeThreshold,
  onChangeSectors,
  onRefresh,
}: Props) {
  // Re-render every 15s so the relative timestamp ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const sectorSet = new Set(sectors);
  const toggleSector = (s: string) => {
    const next = new Set(sectorSet);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChangeSectors(Array.from(next));
  };

  return (
    <header
      style={{
        padding: "14px 16px 8px 16px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 10,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: FONTS.serif,
              fontSize: 22,
              fontWeight: 500,
              color: COLORS.ink,
            }}
          >
            Newsroom
          </h1>
          <p
            style={{
              margin: "2px 0 0 0",
              fontSize: 11,
              fontFamily: FONTS.sans,
              color: COLORS.inkMuted,
              letterSpacing: 0.2,
            }}
          >
            Live updates weekdays 6am–8pm AEST · refreshed {formatRelative(lastUpdated)}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: COLORS.inkSec,
              fontFamily: FONTS.sans,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            URGENCY ≥
            <select
              value={threshold}
              onChange={(e) => onChangeThreshold(Number(e.target.value))}
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                fontWeight: 500,
                color: COLORS.ink,
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${COLORS.border}`,
                padding: "1px 4px",
                cursor: "pointer",
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh feed"
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.inkMuted,
              cursor: isRefreshing ? "wait" : "pointer",
              padding: 4,
              opacity: isRefreshing ? 0.6 : 1,
            }}
          >
            <ArrowPathIcon
              style={{
                width: 16,
                height: 16,
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
            />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          rowGap: 6,
          paddingBottom: 4,
        }}
      >
        {DOMAIN_OPTIONS.map((d) => (
          <SectorTag
            key={d}
            domain={d}
            active={sectorSet.has(d)}
            onClick={() => toggleSector(d)}
          />
        ))}
        {sectors.length > 0 && (
          <button
            onClick={() => onChangeSectors([])}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: FONTS.sans,
              fontSize: 10,
              letterSpacing: 0.4,
              color: COLORS.inkFaint,
              textTransform: "uppercase",
              cursor: "pointer",
              padding: 0,
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
