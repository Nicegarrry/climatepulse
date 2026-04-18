"use client";

import { useEffect, useState, useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { FLAGSHIP_STATUSES, type FlagshipStatus } from "@/lib/podcast/flagship-statuses";

interface Episode {
  id: string;
  title: string;
  concept: string | null;
  format_id: string | null;
  ai_suggested_format_id: string | null;
  status: FlagshipStatus;
  complexity: number | null;
  scheduled_for: string | null;
  published_at: string | null;
  episode_number: number | null;
  assigned_characters: string[];
  production_notes: string | null;
  linked_weekly_digest_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Format {
  id: string;
  display_name: string;
  emotional_register: string | null;
  typical_cadence: string | null;
  is_experimental: boolean;
}

interface Character {
  id: string;
  display_name: string;
  role: string;
}

interface Data {
  episodes: Episode[];
  formats: Format[];
  characters: Character[];
}

const STATUS_LABEL: Record<FlagshipStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export function FlagshipScheduler() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/flagship-episodes", { credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEpisode() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/flagship-episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setNewTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function updateEpisode(id: string, patch: Partial<Episode> & Record<string, unknown>) {
    try {
      const r = await fetch(`/api/flagship-episodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function archiveEpisode(id: string) {
    if (!confirm("Archive this episode?")) return;
    try {
      const r = await fetch(`/api/flagship-episodes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (error) {
    return <Shell>Error: {error}</Shell>;
  }
  if (!data) {
    return <Shell>Loading…</Shell>;
  }

  const selected = selectedId ? data.episodes.find((e) => e.id === selectedId) ?? null : null;

  return (
    <Shell>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 500, margin: 0 }}>
          Flagship scheduler
        </h1>
        <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: "4px 0 0" }}>
          Backlog and schedule for long-form flagship episodes.
        </p>
      </header>

      <section
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          padding: 12,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
        }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New flagship idea…"
          style={{
            flex: 1,
            padding: "8px 10px",
            fontFamily: FONTS.sans,
            fontSize: 13,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3,
            background: COLORS.bg,
            color: COLORS.ink,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void createEpisode();
          }}
        />
        <button
          onClick={createEpisode}
          disabled={creating || !newTitle.trim()}
          style={{
            padding: "8px 14px",
            background: creating || !newTitle.trim() ? COLORS.inkFaint : COLORS.forest,
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: creating || !newTitle.trim() ? "default" : "pointer",
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Add idea
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: 24 }}>
        <section>
          <SectionTitle>Backlog ({data.episodes.length})</SectionTitle>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.episodes.map((ep) => {
              const active = ep.id === selectedId;
              return (
                <li key={ep.id}>
                  <button
                    onClick={() => setSelectedId(ep.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      marginBottom: 4,
                      background: active ? COLORS.sageTint : "transparent",
                      border: `1px solid ${active ? COLORS.sage : COLORS.borderLight}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      fontFamily: FONTS.sans,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={statusPill(ep.status)}>{STATUS_LABEL[ep.status]}</span>
                      {ep.episode_number && (
                        <span style={{ fontSize: 10, color: COLORS.inkMuted }}>#{ep.episode_number}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.ink, marginTop: 4 }}>{ep.title}</div>
                    {ep.scheduled_for && (
                      <div style={{ fontSize: 10, color: COLORS.inkMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                        Scheduled: {ep.scheduled_for.slice(0, 10)}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          {selected ? (
            <EpisodeEditor
              episode={selected}
              formats={data.formats}
              characters={data.characters}
              onUpdate={updateEpisode}
              onArchive={archiveEpisode}
            />
          ) : (
            <div style={{ fontSize: 13, color: COLORS.inkMuted, padding: 16 }}>
              Select an episode to edit.
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function EpisodeEditor({
  episode,
  formats,
  characters,
  onUpdate,
  onArchive,
}: {
  episode: Episode;
  formats: Format[];
  characters: Character[];
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}) {
  const [local, setLocal] = useState(() => ({
    title: episode.title,
    concept: episode.concept ?? "",
    format_id: episode.format_id ?? "",
    complexity: episode.complexity ?? null,
    scheduled_for: episode.scheduled_for ? episode.scheduled_for.slice(0, 10) : "",
    assigned_characters: episode.assigned_characters ?? [],
    production_notes: episode.production_notes ?? "",
  }));

  useEffect(() => {
    setLocal({
      title: episode.title,
      concept: episode.concept ?? "",
      format_id: episode.format_id ?? "",
      complexity: episode.complexity ?? null,
      scheduled_for: episode.scheduled_for ? episode.scheduled_for.slice(0, 10) : "",
      assigned_characters: episode.assigned_characters ?? [],
      production_notes: episode.production_notes ?? "",
    });
  }, [episode.id, episode.title, episode.concept, episode.format_id, episode.complexity, episode.scheduled_for, episode.assigned_characters, episode.production_notes]);

  const toggleCharacter = (id: string) => {
    setLocal((s) => ({
      ...s,
      assigned_characters: s.assigned_characters.includes(id)
        ? s.assigned_characters.filter((c) => c !== id)
        : [...s.assigned_characters, id],
    }));
  };

  const save = () =>
    onUpdate(episode.id, {
      title: local.title,
      concept: local.concept || null,
      format_id: local.format_id || null,
      complexity: local.complexity,
      scheduled_for: local.scheduled_for || null,
      assigned_characters: local.assigned_characters,
      production_notes: local.production_notes || null,
    });

  const transitionTo = (status: FlagshipStatus) => onUpdate(episode.id, { status });

  return (
    <div
      style={{
        padding: 20,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {FLAGSHIP_STATUSES.filter((s) => s !== "archived").map((s) => {
          const active = episode.status === s;
          return (
            <button
              key={s}
              onClick={() => !active && transitionTo(s)}
              disabled={active}
              style={{
                padding: "4px 10px",
                background: active ? COLORS.ink : "transparent",
                color: active ? "#fff" : COLORS.inkSec,
                border: `1px solid ${active ? COLORS.ink : COLORS.border}`,
                borderRadius: 2,
                cursor: active ? "default" : "pointer",
                fontFamily: FONTS.sans,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <Field label="Title">
        <input value={local.title} onChange={(e) => setLocal({ ...local, title: e.target.value })} style={inputStyle} />
      </Field>

      <Field label="Concept">
        <textarea
          rows={3}
          value={local.concept}
          onChange={(e) => setLocal({ ...local, concept: e.target.value })}
          style={{ ...inputStyle, fontFamily: FONTS.sans, resize: "vertical" }}
        />
      </Field>

      <Field
        label={
          episode.ai_suggested_format_id && episode.ai_suggested_format_id !== local.format_id
            ? `Format (AI suggested: ${
                formats.find((f) => f.id === episode.ai_suggested_format_id)?.display_name ?? episode.ai_suggested_format_id
              })`
            : "Format"
        }
      >
        <select value={local.format_id} onChange={(e) => setLocal({ ...local, format_id: e.target.value })} style={inputStyle}>
          <option value="">—</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.display_name}
              {f.is_experimental ? " · experimental" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Complexity (1–5)">
          <input
            type="number"
            min={1}
            max={5}
            value={local.complexity ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setLocal({ ...local, complexity: v === "" ? null : Number(v) });
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="Scheduled for">
          <input
            type="date"
            value={local.scheduled_for}
            onChange={(e) => setLocal({ ...local, scheduled_for: e.target.value })}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Characters">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {characters.map((c) => {
            const active = local.assigned_characters.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCharacter(c.id)}
                style={{
                  padding: "4px 10px",
                  background: active ? COLORS.forest : "transparent",
                  color: active ? "#fff" : COLORS.inkSec,
                  border: `1px solid ${active ? COLORS.forest : COLORS.border}`,
                  borderRadius: 2,
                  cursor: "pointer",
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                }}
              >
                {c.display_name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Production notes">
        <textarea
          rows={3}
          value={local.production_notes}
          onChange={(e) => setLocal({ ...local, production_notes: e.target.value })}
          style={{ ...inputStyle, fontFamily: FONTS.sans, resize: "vertical" }}
        />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "space-between" }}>
        <button
          onClick={save}
          style={{
            padding: "8px 16px",
            background: COLORS.forest,
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Save changes
        </button>
        <button
          onClick={() => onArchive(episode.id)}
          style={{
            padding: "8px 16px",
            background: "transparent",
            color: COLORS.inkMuted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: FONTS.sans,
            fontSize: 12,
          }}
        >
          Archive
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "24px 32px", fontFamily: FONTS.sans, color: COLORS.ink }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: COLORS.inkSec,
        margin: "0 0 12px",
      }}
    >
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: COLORS.inkSec,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  background: COLORS.bg,
  color: COLORS.ink,
  fontFamily: FONTS.sans,
  fontSize: 13,
};

function statusPill(status: FlagshipStatus): React.CSSProperties {
  const colors: Record<FlagshipStatus, { bg: string; fg: string }> = {
    idea:      { bg: COLORS.paperDark, fg: COLORS.inkSec },
    drafted:   { bg: "#E3ECF3",        fg: "#2C4A63" },
    scheduled: { bg: COLORS.plumLight, fg: COLORS.plum },
    published: { bg: COLORS.sageTint,  fg: COLORS.forest },
    archived:  { bg: "#F0E9D8",        fg: "#6B5320" },
  };
  const c = colors[status];
  return {
    display: "inline-block",
    padding: "1px 7px",
    background: c.bg,
    color: c.fg,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    borderRadius: 2,
  };
}
