"use client";

import { useCallback, useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";
import type { DigestOutput, DailyBriefing } from "@/lib/types";
import {
  ALL_ARCHETYPES,
  ARCHETYPE_FRAMINGS,
  type PodcastArchetype,
} from "@/lib/podcast/archetypes";

interface PreviewPayload {
  archetype: PodcastArchetype;
  digest: DigestOutput;
  generated_at?: string;
  cached?: boolean;
}

export function ArchetypePreviewSwitcher() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [archetype, setArchetype] = useState<PodcastArchetype>("commercial");
  const [cache, setCache] = useState<Partial<Record<PodcastArchetype, PreviewPayload>>>({});
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load today's briefing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/digest/generate");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { briefing?: DailyBriefing | null };
        if (!cancelled) setBriefing(body.briefing ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchArchetype = useCallback(
    async (a: PodcastArchetype) => {
      if (!briefing) return;
      if (cache[a]) return;
      setFetching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/briefing/${briefing.id}/preview?archetype=${a}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `status ${res.status}`);
        }
        const payload = (await res.json()) as PreviewPayload;
        setCache((prev) => ({ ...prev, [a]: payload }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setFetching(false);
      }
    },
    [briefing, cache]
  );

  const onSelect = (a: PodcastArchetype) => {
    setArchetype(a);
    if (!cache[a]) void fetchArchetype(a);
  };

  if (loading) {
    return (
      <div style={panel}>
        <Micro>Loading preview&hellip;</Micro>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div style={panel}>
        <Micro>No briefing available to preview.</Micro>
      </div>
    );
  }

  const current = cache[archetype];
  const sourceDigest = briefing.digest;

  return (
    <div style={panel}>
      <div style={{ marginBottom: 10 }}>
        <Micro>Archetype Preview</Micro>
        <div style={{ fontSize: 11, color: COLORS.inkFaint, marginTop: 2 }}>
          Reframes today&apos;s briefing for each reader archetype. Same stories,
          rewritten narrative + takes.
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ALL_ARCHETYPES.map((a) => {
          const isActive = a === archetype;
          const hit = Boolean(cache[a]);
          return (
            <button
              key={a}
              type="button"
              onClick={() => onSelect(a)}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: isActive ? "#fff" : COLORS.inkSec,
                background: isActive ? COLORS.forest : "transparent",
                border: `1px solid ${isActive ? COLORS.forest : COLORS.borderLight}`,
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {ARCHETYPE_FRAMINGS[a].short}
              {hit && !isActive && (
                <span style={{ marginLeft: 4, color: COLORS.forest }}>·</span>
              )}
            </button>
          );
        })}
      </div>

      {fetching && !current && (
        <div style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 10 }}>
          Generating preview for {ARCHETYPE_FRAMINGS[archetype].short.toLowerCase()}&hellip; (first view ~30s)
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: "#A03030", marginBottom: 10 }}>
          {error}
        </div>
      )}

      <PreviewBody
        source={sourceDigest}
        preview={current?.digest ?? null}
        cached={Boolean(current?.cached)}
      />
    </div>
  );
}

function PreviewBody({
  source,
  preview,
  cached,
}: {
  source: DigestOutput;
  preview: DigestOutput | null;
  cached: boolean;
}) {
  const digest = preview ?? source;
  return (
    <div>
      {preview && (
        <div
          style={{
            fontSize: 10,
            color: cached ? COLORS.forest : COLORS.plum,
            marginBottom: 8,
          }}
        >
          {cached ? "cached preview" : "fresh preview"}
        </div>
      )}
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 13,
          lineHeight: 1.55,
          color: COLORS.ink,
          marginBottom: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        {digest.narrative}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {digest.hero_stories?.slice(0, 5).map((s) => (
          <div
            key={s.rank}
            style={{
              padding: "8px 10px",
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.ink,
              }}
            >
              #{s.rank} &middot; {s.headline}
            </div>
            <div
              style={{
                fontSize: 12,
                color: COLORS.inkSec,
                marginTop: 4,
                lineHeight: 1.45,
              }}
            >
              {s.expert_take}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  fontFamily: FONTS.sans,
  padding: "14px 16px",
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderTop: `2px solid ${COLORS.forest}`,
  borderRadius: 8,
};
