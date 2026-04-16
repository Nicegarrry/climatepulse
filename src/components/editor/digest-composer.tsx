"use client";

import { useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import type { WeeklyCuratedStory, WeeklyDigest } from "@/lib/types";

type DigestDraft = Partial<WeeklyDigest>;

interface DigestComposerProps {
  value: DigestDraft;
  onChange: (updates: DigestDraft) => void;
  onSave: () => void;
  onPublish: () => void;
  saving: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  canPublish: boolean;
}

const SEVERITY_OPTIONS: WeeklyCuratedStory["severity"][] = [
  "alert",
  "watch",
  "ready",
  "clear",
];

export function DigestComposer({
  value,
  onChange,
  onSave,
  onPublish,
  saving,
  saveStatus,
  canPublish,
}: DigestComposerProps) {
  const stories = value.curated_stories ?? [];

  const updateStory = useCallback(
    (idx: number, updates: Partial<WeeklyCuratedStory>) => {
      const next = stories.map((s, i) => (i === idx ? { ...s, ...updates } : s));
      onChange({ curated_stories: next });
    },
    [stories, onChange]
  );

  const removeStory = useCallback(
    (idx: number) => {
      onChange({ curated_stories: stories.filter((_, i) => i !== idx) });
    },
    [stories, onChange]
  );

  const moveStory = useCallback(
    (idx: number, direction: -1 | 1) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= stories.length) return;
      const next = [...stories];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      onChange({ curated_stories: next });
    },
    [stories, onChange]
  );

  const addEmptyStory = useCallback(() => {
    const next: WeeklyCuratedStory = {
      headline: "",
      source: "",
      url: "",
      editor_take: "",
      severity: "watch",
      sector: "",
    };
    onChange({ curated_stories: [...stories, next] });
  }, [stories, onChange]);

  const wn = value.weekly_number ?? null;
  const setWeeklyNumber = useCallback(
    (patch: Partial<NonNullable<WeeklyDigest["weekly_number"]>>) => {
      const base = wn ?? { value: "", unit: "", label: "", context: "", trend: null };
      onChange({ weekly_number: { ...base, ...patch } });
    },
    [wn, onChange]
  );

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <Micro>Digest Composer</Micro>
        <SaveIndicator status={saveStatus} />
      </div>
      <WobblyRule color={COLORS.borderLight} />

      {/* Week range */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Field label="Week start">
          <input
            type="date"
            value={value.week_start ?? ""}
            onChange={(e) => onChange({ week_start: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label="Week end">
          <input
            type="date"
            value={value.week_end ?? ""}
            onChange={(e) => onChange({ week_end: e.target.value })}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Headline */}
      <div style={{ marginTop: 14 }}>
        <Field label="Headline">
          <input
            type="text"
            value={value.headline ?? ""}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder="e.g. Batteries Cross 10 GW as Curtailment Crisis Deepens"
            style={{ ...inputStyle, fontSize: 15, fontFamily: FONTS.serif }}
          />
        </Field>
      </div>

      {/* Narrative */}
      <div style={{ marginTop: 14 }}>
        <Field label="Editorial narrative (markdown, blank lines for paragraphs)">
          <textarea
            value={value.editor_narrative ?? ""}
            onChange={(e) => onChange({ editor_narrative: e.target.value })}
            rows={8}
            style={{ ...inputStyle, fontFamily: FONTS.serif, lineHeight: 1.55, resize: "vertical" }}
          />
        </Field>
      </div>

      {/* Weekly number */}
      <div style={{ marginTop: 18 }}>
        <Micro mb={6}>Number of the Week</Micro>
        <div
          style={{
            padding: 12,
            background: COLORS.paperDark,
            borderRadius: 6,
            border: `1px solid ${COLORS.borderLight}`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <Field label="Value">
              <input
                type="text"
                value={wn?.value ?? ""}
                onChange={(e) => setWeeklyNumber({ value: e.target.value })}
                style={inputStyle}
                placeholder="10.2"
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                value={wn?.unit ?? ""}
                onChange={(e) => setWeeklyNumber({ unit: e.target.value })}
                style={inputStyle}
                placeholder="GW"
              />
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Label">
              <input
                type="text"
                value={wn?.label ?? ""}
                onChange={(e) => setWeeklyNumber({ label: e.target.value })}
                style={inputStyle}
                placeholder="Grid-connected battery storage capacity"
              />
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Context">
              <textarea
                value={wn?.context ?? ""}
                onChange={(e) => setWeeklyNumber({ context: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Why this number matters"
              />
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Trend (optional)">
              <input
                type="text"
                value={wn?.trend ?? ""}
                onChange={(e) => setWeeklyNumber({ trend: e.target.value || null })}
                style={inputStyle}
                placeholder="+1.4 GW since March"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Curated stories */}
      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <Micro>Curated Stories ({stories.length})</Micro>
          <button onClick={addEmptyStory} style={linkBtn}>
            + Add empty story
          </button>
        </div>
        <WobblyRule color={COLORS.borderLight} />
        <div style={{ marginTop: 10 }}>
          {stories.length === 0 ? (
            <div
              style={{
                padding: "22px 12px",
                textAlign: "center",
                color: COLORS.inkMuted,
                fontSize: 12,
                border: `1px dashed ${COLORS.border}`,
                borderRadius: 6,
              }}
            >
              No stories yet. Pick articles from the Story Picker or click &quot;Add empty story&quot; above.
            </div>
          ) : (
            stories.map((s, i) => (
              <StoryEditor
                key={i}
                index={i}
                total={stories.length}
                story={s}
                onChange={(updates) => updateStory(i, updates)}
                onRemove={() => removeStory(i)}
                onMove={(dir) => moveStory(i, dir)}
              />
            ))
          )}
        </div>
      </div>

      {/* Outlook */}
      <div style={{ marginTop: 18 }}>
        <Field label="Outlook / What to watch">
          <textarea
            value={value.outlook ?? ""}
            onChange={(e) => onChange({ outlook: e.target.value || null })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Look ahead to next week's key events or watchlist items"
          />
        </Field>
      </div>

      {/* Actions */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button onClick={onSave} disabled={saving} style={primaryBtn}>
          {saving ? "Saving\u2026" : "Save draft"}
        </button>
        <button
          onClick={onPublish}
          disabled={!canPublish}
          style={{
            ...publishBtn,
            opacity: canPublish ? 1 : 0.5,
            cursor: canPublish ? "pointer" : "not-allowed",
          }}
        >
          {"Publish\u2026"}
        </button>
      </div>
    </div>
  );
}

/* ── Story editor card ─────────────────────────────────────────────── */

function StoryEditor({
  index,
  total,
  story,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  story: WeeklyCuratedStory;
  onChange: (u: Partial<WeeklyCuratedStory>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  type KeyMetric = NonNullable<WeeklyCuratedStory["key_metric"]>;
  const km: KeyMetric = story.key_metric ?? { value: "", unit: "" };
  const setKm = (patch: Partial<KeyMetric>) => {
    const merged: KeyMetric = { ...km, ...patch };
    // If all fields empty, clear it
    if (!merged.value && !merged.unit && !merged.delta) {
      onChange({ key_metric: undefined });
    } else {
      onChange({ key_metric: merged });
    }
  };

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 10,
        background: COLORS.paperDark,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: COLORS.inkMuted, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Story {index + 1} / {total}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={iconBtn} onClick={() => onMove(-1)} disabled={index === 0} title="Move up">
            {"\u2191"}
          </button>
          <button style={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1} title="Move down">
            {"\u2193"}
          </button>
          <button style={{ ...iconBtn, color: "#8B2E2E" }} onClick={onRemove} title="Remove">
            {"\u00d7"}
          </button>
        </div>
      </div>

      <Field label="Headline">
        <input
          type="text"
          value={story.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <Field label="Source">
          <input
            type="text"
            value={story.source}
            onChange={(e) => onChange({ source: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label="Sector">
          <input
            type="text"
            value={story.sector}
            onChange={(e) => onChange({ sector: e.target.value })}
            style={inputStyle}
            placeholder="e.g. ENERGY \u2014 STORAGE"
          />
        </Field>
      </div>

      <div style={{ marginTop: 8 }}>
        <Field label="URL">
          <input
            type="url"
            value={story.url}
            onChange={(e) => onChange({ url: e.target.value })}
            style={inputStyle}
            placeholder="https://"
          />
        </Field>
      </div>

      <div style={{ marginTop: 8 }}>
        <Field label="Editor take">
          <textarea
            value={story.editor_take}
            onChange={(e) => onChange({ editor_take: e.target.value })}
            rows={4}
            style={{ ...inputStyle, fontFamily: FONTS.serif, lineHeight: 1.55, resize: "vertical" }}
          />
        </Field>
      </div>

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "140px 1fr 1fr 1fr", gap: 8 }}>
        <Field label="Severity">
          <select
            value={story.severity}
            onChange={(e) => onChange({ severity: e.target.value as WeeklyCuratedStory["severity"] })}
            style={inputStyle}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Metric value">
          <input
            type="text"
            value={km.value ?? ""}
            onChange={(e) => setKm({ value: e.target.value })}
            style={inputStyle}
            placeholder="e.g. 10.2"
          />
        </Field>
        <Field label="Unit">
          <input
            type="text"
            value={km.unit ?? ""}
            onChange={(e) => setKm({ unit: e.target.value })}
            style={inputStyle}
            placeholder="e.g. GW"
          />
        </Field>
        <Field label="Delta (optional)">
          <input
            type="text"
            value={km.delta ?? ""}
            onChange={(e) => setKm({ delta: e.target.value || undefined })}
            style={inputStyle}
            placeholder="+1.4 MoM"
          />
        </Field>
      </div>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: FONTS.sans,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: COLORS.inkMuted,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const text =
    status === "saving"
      ? "Saving\u2026"
      : status === "saved"
      ? "Saved"
      : status === "error"
      ? "Save failed"
      : "";
  const color =
    status === "error" ? "#8B2E2E" : status === "saved" ? COLORS.forest : COLORS.inkMuted;
  if (!text) return null;
  return (
    <span style={{ fontSize: 11, color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{text}</span>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 13,
  padding: "7px 9px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 5,
  background: COLORS.surface,
  color: COLORS.ink,
  width: "100%",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  background: COLORS.forest,
  color: "#fff",
  border: "none",
  borderRadius: 5,
  cursor: "pointer",
};

const publishBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  background: COLORS.plum,
  color: "#fff",
  border: "none",
  borderRadius: 5,
};

const linkBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 8px",
  background: "transparent",
  color: COLORS.forest,
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const iconBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  fontSize: 14,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.inkSec,
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
