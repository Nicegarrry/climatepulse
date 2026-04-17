"use client";

import { useCallback, useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";
import type { DailyBriefing, DigestHeroStory, DigestCompactStory } from "@/lib/types";

interface StoryOverride {
  editors_pick?: boolean;
  editorial_note?: string | null;
  analysis_override?: string | null;
}

type OverridesMap = Record<string, StoryOverride>;

function isHero(s: DigestHeroStory | DigestCompactStory): s is DigestHeroStory {
  return "expert_take" in s;
}

export function DailyReviewPanel() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [overrides, setOverrides] = useState<OverridesMap>({});
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load today's briefing (same endpoint the reader hits)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/digest/generate");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          briefing?: DailyBriefing | null;
          status?: string;
        };
        if (cancelled) return;
        if (data.briefing) {
          setBriefing(data.briefing);
          // Load current overrides
          try {
            const over = await fetch(`/api/briefing/${data.briefing.id}/editorial`);
            if (over.ok) {
              const ov = (await over.json()) as {
                editorial_overrides?: OverridesMap;
                suppressed_story_ids?: string[];
              };
              setOverrides(ov.editorial_overrides ?? {});
              setSuppressed(new Set((ov.suppressed_story_ids ?? []).map(String)));
            }
          } catch {
            /* no-op */
          }
        } else {
          setBriefing(null);
        }
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

  const persist = useCallback(
    async (
      briefingId: string,
      nextOverrides: OverridesMap,
      nextSuppressed: Set<string>,
      key: string
    ) => {
      setSaving(key);
      try {
        const res = await fetch(`/api/briefing/${briefingId}/editorial`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overrides: nextOverrides,
            suppressed_story_ids: Array.from(nextSuppressed),
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const togglePick = useCallback(
    (story: DigestHeroStory | DigestCompactStory) => {
      if (!briefing) return;
      const key = String(story.rank);
      const current = overrides[key] ?? {};
      const next: OverridesMap = {
        ...overrides,
        [key]: { ...current, editors_pick: !current.editors_pick },
      };
      setOverrides(next);
      persist(briefing.id, { [key]: next[key] }, suppressed, `pick-${key}`);
    },
    [briefing, overrides, suppressed, persist]
  );

  const toggleSuppress = useCallback(
    (story: DigestHeroStory | DigestCompactStory) => {
      if (!briefing) return;
      const key = String(story.rank);
      const nextSet = new Set(suppressed);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      setSuppressed(nextSet);
      persist(briefing.id, {}, nextSet, `suppress-${key}`);
    },
    [briefing, suppressed, persist]
  );

  const setField = useCallback(
    (
      story: DigestHeroStory | DigestCompactStory,
      field: "editorial_note" | "analysis_override",
      value: string
    ) => {
      if (!briefing) return;
      const key = String(story.rank);
      const current = overrides[key] ?? {};
      const next: OverridesMap = {
        ...overrides,
        [key]: { ...current, [field]: value || null },
      };
      setOverrides(next);
      // Debounce-ish: just persist on blur (see below). Save inline for now.
      persist(briefing.id, { [key]: next[key] }, suppressed, `${field}-${key}`);
    },
    [briefing, overrides, suppressed, persist]
  );

  if (loading) {
    return (
      <div style={panelStyle}>
        <Micro>Loading today&apos;s briefing&hellip;</Micro>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div style={panelStyle}>
        <Micro>No briefing published yet today.</Micro>
      </div>
    );
  }

  const heroes = briefing.digest?.hero_stories ?? [];
  const compact = briefing.digest?.compact_stories ?? [];

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div>
          <Micro>Daily Editorial Controls</Micro>
          <div style={{ fontSize: 11, color: COLORS.inkFaint, marginTop: 2 }}>
            Today&apos;s briefing is live. Edits apply on next load.
          </div>
        </div>
        {saving && (
          <span style={{ fontSize: 10, color: COLORS.forest }}>
            Saving {saving}&hellip;
          </span>
        )}
        {error && (
          <span style={{ fontSize: 10, color: COLORS.plum }}>{error}</span>
        )}
      </div>

      <div
        style={{ fontSize: 10, color: COLORS.inkFaint, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        Lead stories
      </div>
      {heroes.map((s) => (
        <StoryRow
          key={`h-${s.rank}`}
          story={s}
          override={overrides[String(s.rank)] ?? {}}
          suppressed={suppressed.has(String(s.rank))}
          onTogglePick={() => togglePick(s)}
          onToggleSuppress={() => toggleSuppress(s)}
          onFieldBlur={setField}
        />
      ))}

      {compact.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              color: COLORS.inkFaint,
              margin: "14px 0 6px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Also today
          </div>
          {compact.map((s) => (
            <StoryRow
              key={`c-${s.rank}`}
              story={s}
              override={overrides[String(s.rank)] ?? {}}
              suppressed={suppressed.has(String(s.rank))}
              onTogglePick={() => togglePick(s)}
              onToggleSuppress={() => toggleSuppress(s)}
              onFieldBlur={setField}
            />
          ))}
        </>
      )}
    </div>
  );
}

function StoryRow({
  story,
  override,
  suppressed,
  onTogglePick,
  onToggleSuppress,
  onFieldBlur,
}: {
  story: DigestHeroStory | DigestCompactStory;
  override: StoryOverride;
  suppressed: boolean;
  onTogglePick: () => void;
  onToggleSuppress: () => void;
  onFieldBlur: (
    s: DigestHeroStory | DigestCompactStory,
    field: "editorial_note" | "analysis_override",
    value: string
  ) => void;
}) {
  const [note, setNote] = useState(override.editorial_note ?? "");
  const [analysis, setAnalysis] = useState(override.analysis_override ?? "");

  const isPick = !!override.editors_pick;

  return (
    <div
      style={{
        padding: "10px 12px",
        border: `1px solid ${suppressed ? COLORS.plum : COLORS.border}`,
        background: suppressed ? "rgba(112,58,101,0.04)" : COLORS.surface,
        borderLeft: isPick ? `3px solid ${COLORS.forest}` : undefined,
        borderRadius: 6,
        marginBottom: 8,
        opacity: suppressed ? 0.6 : 1,
        transition: "opacity 150ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 14,
              color: COLORS.ink,
              lineHeight: 1.3,
            }}
          >
            #{story.rank} — {story.headline}
          </div>
          <div style={{ fontSize: 10, color: COLORS.inkFaint, marginTop: 2 }}>
            {story.source}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onTogglePick}
            style={actionButton(isPick, COLORS.forest)}
          >
            {isPick ? "\u2713 Pick" : "Pick"}
          </button>
          <button
            type="button"
            onClick={onToggleSuppress}
            style={actionButton(suppressed, COLORS.plum)}
          >
            {suppressed ? "\u2713 Hidden" : "Hide"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <textarea
          placeholder="Editor's note (optional, short)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onFieldBlur(story, "editorial_note", note)}
          rows={1}
          style={textAreaStyle}
        />
        <textarea
          placeholder={
            isHero(story)
              ? "Override expert take (optional)"
              : "Override one-line take (optional)"
          }
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          onBlur={() => onFieldBlur(story, "analysis_override", analysis)}
          rows={2}
          style={textAreaStyle}
        />
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  fontFamily: FONTS.sans,
  padding: "14px 16px",
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderTop: `2px solid ${COLORS.plum}`,
  borderRadius: 8,
  marginBottom: 18,
};

function actionButton(active: boolean, accent: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 500,
    border: `1px solid ${active ? accent : COLORS.border}`,
    background: active ? `${accent}15` : "transparent",
    color: active ? accent : COLORS.inkMuted,
    borderRadius: 4,
    cursor: "pointer",
  };
}

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 12,
  fontFamily: FONTS.sans,
  border: `1px solid ${COLORS.borderLight}`,
  borderRadius: 4,
  resize: "vertical",
  color: COLORS.ink,
  background: COLORS.paperDark,
};
