"use client";

import { useCallback, useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";
import type { DailyBriefing, DigestHeroStory, DigestCompactStory } from "@/lib/types";

interface StoryOverride {
  editors_pick?: boolean;
  editorial_note?: string | null;
  analysis_override?: string | null;
  sector_tags?: string[] | null;
}

interface EditorialMeta {
  digest_intro?: string | null;
  story_order?: number[];
}

type OverridesMap = Record<string, StoryOverride | EditorialMeta>;

const META_KEY = "__meta";

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
  const [regenerating, setRegenerating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [reloadToken]);

  const regenerate = useCallback(async () => {
    if (!briefing || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefing/${briefing.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Regenerate failed (${res.status})`);
      }
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }, [briefing, regenerating]);

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
      const current = (overrides[key] as StoryOverride | undefined) ?? {};
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
      const current = (overrides[key] as StoryOverride | undefined) ?? {};
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

  const setSectorTags = useCallback(
    (story: DigestHeroStory | DigestCompactStory, tags: string[]) => {
      if (!briefing) return;
      const key = String(story.rank);
      const current = (overrides[key] as StoryOverride | undefined) ?? {};
      const next: OverridesMap = {
        ...overrides,
        [key]: { ...current, sector_tags: tags.length ? tags : null },
      };
      setOverrides(next);
      persist(briefing.id, { [key]: next[key] }, suppressed, `tags-${key}`);
    },
    [briefing, overrides, suppressed, persist]
  );

  const setIntro = useCallback(
    (value: string) => {
      if (!briefing) return;
      const currentMeta = (overrides[META_KEY] as EditorialMeta | undefined) ?? {};
      const next: OverridesMap = {
        ...overrides,
        [META_KEY]: { ...currentMeta, digest_intro: value || null },
      };
      setOverrides(next);
      persist(briefing.id, { [META_KEY]: next[META_KEY] }, suppressed, "intro");
    },
    [briefing, overrides, suppressed, persist]
  );

  const move = useCallback(
    (story: DigestHeroStory | DigestCompactStory, dir: -1 | 1, lane: "hero" | "compact") => {
      if (!briefing) return;
      const lanestories = lane === "hero"
        ? briefing.digest?.hero_stories ?? []
        : briefing.digest?.compact_stories ?? [];
      const currentMeta = (overrides[META_KEY] as EditorialMeta | undefined) ?? {};
      const baseOrder = currentMeta.story_order && currentMeta.story_order.length > 0
        ? currentMeta.story_order
        : lanestories.map((s) => s.rank);
      const idx = baseOrder.indexOf(story.rank);
      if (idx < 0) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= baseOrder.length) return;
      const nextOrder = [...baseOrder];
      [nextOrder[idx], nextOrder[newIdx]] = [nextOrder[newIdx], nextOrder[idx]];
      const next: OverridesMap = {
        ...overrides,
        [META_KEY]: { ...currentMeta, story_order: nextOrder },
      };
      setOverrides(next);
      persist(briefing.id, { [META_KEY]: next[META_KEY] }, suppressed, "reorder");
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
  const meta = (overrides[META_KEY] as EditorialMeta | undefined) ?? {};

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saving && (
            <span style={{ fontSize: 10, color: COLORS.forest }}>
              Saving {saving}&hellip;
            </span>
          )}
          {error && (
            <span style={{ fontSize: 10, color: COLORS.plum }}>{error}</span>
          )}
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              color: regenerating ? COLORS.inkFaint : COLORS.plum,
              background: regenerating ? "transparent" : `${COLORS.plum}10`,
              border: `1px solid ${regenerating ? COLORS.borderLight : COLORS.plum}`,
              borderRadius: 4,
              cursor: regenerating ? "wait" : "pointer",
            }}
          >
            {regenerating ? "Regenerating\u2026" : "Regenerate"}
          </button>
        </div>
      </div>

      <IntroEditor initial={meta.digest_intro ?? ""} onSave={setIntro} />

      <div
        style={{ fontSize: 10, color: COLORS.inkFaint, margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        Lead stories
      </div>
      {heroes.map((s, i) => (
        <StoryRow
          key={`h-${s.rank}`}
          story={s}
          override={(overrides[String(s.rank)] as StoryOverride | undefined) ?? {}}
          suppressed={suppressed.has(String(s.rank))}
          canMoveUp={i > 0}
          canMoveDown={i < heroes.length - 1}
          onTogglePick={() => togglePick(s)}
          onToggleSuppress={() => toggleSuppress(s)}
          onFieldBlur={setField}
          onTagsChange={(tags) => setSectorTags(s, tags)}
          onMove={(dir) => move(s, dir, "hero")}
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
          {compact.map((s, i) => (
            <StoryRow
              key={`c-${s.rank}`}
              story={s}
              override={(overrides[String(s.rank)] as StoryOverride | undefined) ?? {}}
              suppressed={suppressed.has(String(s.rank))}
              canMoveUp={i > 0}
              canMoveDown={i < compact.length - 1}
              onTogglePick={() => togglePick(s)}
              onToggleSuppress={() => toggleSuppress(s)}
              onFieldBlur={setField}
              onTagsChange={(tags) => setSectorTags(s, tags)}
              onMove={(dir) => move(s, dir, "compact")}
            />
          ))}
        </>
      )}
    </div>
  );
}

function IntroEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          fontSize: 10,
          color: COLORS.inkFaint,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Digest intro (optional)
      </div>
      <textarea
        value={value}
        placeholder="A short editor's note at the top of today's briefing…"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== initial) onSave(value);
        }}
        rows={2}
        style={textAreaStyle}
      />
    </div>
  );
}

function StoryRow({
  story,
  override,
  suppressed,
  canMoveUp,
  canMoveDown,
  onTogglePick,
  onToggleSuppress,
  onFieldBlur,
  onTagsChange,
  onMove,
}: {
  story: DigestHeroStory | DigestCompactStory;
  override: StoryOverride;
  suppressed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onTogglePick: () => void;
  onToggleSuppress: () => void;
  onFieldBlur: (
    s: DigestHeroStory | DigestCompactStory,
    field: "editorial_note" | "analysis_override",
    value: string
  ) => void;
  onTagsChange: (tags: string[]) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [note, setNote] = useState(override.editorial_note ?? "");
  const [analysis, setAnalysis] = useState(override.analysis_override ?? "");
  const originalTags = isHero(story) ? story.micro_sectors ?? [] : [];
  const effectiveTags = override.sector_tags ?? originalTags;
  const [tagInput, setTagInput] = useState("");

  const isPick = !!override.editors_pick;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if (effectiveTags.includes(t)) {
      setTagInput("");
      return;
    }
    onTagsChange([...effectiveTags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => {
    onTagsChange(effectiveTags.filter((x) => x !== t));
  };

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
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            style={miniButton(canMoveUp)}
            aria-label="Move up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            style={miniButton(canMoveDown)}
            aria-label="Move down"
          >
            ▼
          </button>
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

        {isHero(story) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {effectiveTags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  background: COLORS.paperDark,
                  color: COLORS.inkSec,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.borderLight}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  aria-label={`Remove ${t}`}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: COLORS.inkFaint,
                    cursor: "pointer",
                    fontSize: 11,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              placeholder="+ tag"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              style={{
                fontSize: 10,
                padding: "2px 6px",
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: 10,
                background: COLORS.surface,
                width: 80,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function miniButton(enabled: boolean): React.CSSProperties {
  return {
    padding: "2px 6px",
    fontSize: 10,
    background: "transparent",
    color: enabled ? COLORS.inkMuted : COLORS.inkFaint,
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: 3,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
  };
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
