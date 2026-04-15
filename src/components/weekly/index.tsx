"use client";

import { useState, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import { CurrentDigest } from "./current-digest";
import { DigestArchive } from "./digest-archive";
import { WeeklyNumber } from "./weekly-number";
import type { WeeklyDigest } from "@/lib/types";
import {
  MOCK_WEEKLY_DIGEST,
  MOCK_WEEKLY_ARCHIVE,
} from "@/lib/mock-weekly";

// ─── Loading state ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: "40px 32px" }}>
      <div
        style={{
          width: 200,
          height: 12,
          background: COLORS.borderLight,
          borderRadius: 4,
          marginBottom: 14,
        }}
      />
      <div
        style={{
          width: 320,
          height: 24,
          background: COLORS.borderLight,
          borderRadius: 4,
          marginBottom: 20,
        }}
      />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: "100%",
            height: 80,
            background: COLORS.borderLight,
            borderRadius: 8,
            marginBottom: 10,
          }}
        />
      ))}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ padding: "60px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>{"\u25C8"}</div>
      <Micro color={COLORS.inkMuted} mb={8}>
        No Weekly Digests Yet
      </Micro>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
        The first edition of the weekly editorial digest will appear here once published.
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function WeeklyTab() {
  const [digests, setDigests] = useState<WeeklyDigest[]>([]);
  const [selected, setSelected] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDigests = useCallback(async () => {
    try {
      const res = await fetch("/api/weekly/digests?status=published&limit=10");
      if (res.ok) {
        const data = await res.json();
        if (data.digests && data.digests.length > 0) {
          setDigests(data.digests);
          setSelected(data.digests[0]);
          setLoading(false);
          return;
        }
      }
    } catch {
      // API not ready — fall through to mock
    }

    // Fallback to mock data
    setDigests(MOCK_WEEKLY_ARCHIVE);
    setSelected(MOCK_WEEKLY_DIGEST);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDigests();
  }, [fetchDigests]);

  if (loading) return <LoadingState />;
  if (!selected) return <EmptyState />;

  // Archive = all digests except the selected one
  const archiveDigests = digests.filter((d) => d.id !== selected.id);

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex" }}>
      {/* ── Main editorial column ──────────────────────────────────── */}
      <main style={{ flex: 1, padding: "26px 32px 60px", minWidth: 0 }}>
        {/* Tab header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 28,
                fontWeight: 400,
                color: COLORS.ink,
                margin: 0,
                letterSpacing: -0.6,
                lineHeight: 1.1,
              }}
            >
              The Weekly Pulse
            </h1>
            <div style={{ marginTop: 5, display: "flex", alignItems: "baseline", gap: 12 }}>
              <Micro>Editorial Digest</Micro>
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkFaint }}>
                {digests.length} edition{digests.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div style={{ margin: "18px 0 22px" }}>
          <WobblyRule />
        </div>

        {/* Digest content */}
        <CurrentDigest digest={selected} />
      </main>

      {/* ── Right sidebar ──────────────────────────────────────────── */}
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          borderLeft: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          padding: "26px 16px",
          overflowY: "auto",
        }}
        className="paper-grain hidden lg:block"
      >
        {/* Weekly Number — desktop sidebar */}
        {selected.weekly_number && (
          <WeeklyNumber data={selected.weekly_number} />
        )}

        {/* Archive list */}
        {archiveDigests.length > 0 && (
          <DigestArchive
            digests={archiveDigests}
            currentId={selected.id}
            onSelect={setSelected}
          />
        )}
      </aside>

      {/* ── Mobile archive (below content) ─────────────────────────── */}
      <div className="lg:hidden" style={{ padding: "0 16px 40px" }}>
        {archiveDigests.length > 0 && (
          <DigestArchive
            digests={archiveDigests}
            currentId={selected.id}
            onSelect={setSelected}
          />
        )}
      </div>
    </div>
  );
}
