"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface VoiceRow {
  id: string;
  display_name: string;
  provider: string;
  provider_voice_id: string;
  accent: string | null;
  gender: string | null;
  active: boolean;
}
interface CharacterRow {
  id: string;
  display_name: string;
  role: string;
  voice_profile_id: string | null;
  active: boolean;
}
interface FormatRow {
  id: string;
  display_name: string;
  emotional_register: string | null;
  typical_cadence: string | null;
  is_experimental: boolean;
  active: boolean;
}
interface ThemeRow {
  id: string;
  title: string;
  day_of_week: number;
  local_time: string;
  cornerstone_character_id: string | null;
  enabled: boolean;
}
interface FlagshipRow {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
  episode_number: number | null;
}
interface TierCount {
  tier: string;
  n: number;
  latest: string | null;
}
interface InteractionCount {
  interaction_type: string;
  n: number;
}

interface Summary {
  voices: VoiceRow[];
  characters: CharacterRow[];
  formats: FormatRow[];
  themes: ThemeRow[];
  flagship: FlagshipRow[];
  episode_counts_by_tier: TierCount[];
  interactions_last_7d: InteractionCount[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PodcastAdminTab() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/podcast/admin/summary", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Summary;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  async function generateToday() {
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const r = await fetch("/api/podcast/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().split("T")[0] }),
      });
      const body = await r.json().catch(() => ({}));
      setGenerateMsg(r.ok ? "Generation started." : body.error ?? `HTTP ${r.status}`);
    } catch (e) {
      setGenerateMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink }}>
        Couldn&apos;t load podcast admin: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.inkMuted }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", fontFamily: FONTS.sans, color: COLORS.ink }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 500, margin: 0 }}>
          Podcast admin
        </h1>
        <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: "4px 0 0" }}>
          Characters, voices, formats, themed schedule, flagship backlog, telemetry.
        </p>
      </header>

      <section style={{ marginBottom: 32 }}>
        <SectionTitle>Today</SectionTitle>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={generateToday}
            disabled={generating}
            style={primaryBtn(generating)}
          >
            {generating ? "Generating…" : "Generate today’s daily episode"}
          </button>
          {generateMsg && (
            <span style={{ fontSize: 12, color: COLORS.inkSec }}>{generateMsg}</span>
          )}
        </div>
      </section>

      <Grid>
        <Card title="Episodes by tier">
          <Rows
            rows={data.episode_counts_by_tier.map((t) => [
              t.tier,
              `${t.n} · last ${t.latest ? t.latest.slice(0, 10) : "—"}`,
            ])}
            empty="No episodes yet."
          />
        </Card>

        <Card title="Interactions · last 7d">
          <Rows
            rows={data.interactions_last_7d.map((r) => [r.interaction_type, String(r.n)])}
            empty="No telemetry yet."
          />
        </Card>
      </Grid>

      <Grid>
        <Card title={`Voices (${data.voices.length})`}>
          <Rows
            rows={data.voices.map((v) => [
              v.display_name,
              `${v.provider}:${v.provider_voice_id}${v.active ? "" : " · inactive"}`,
            ])}
            empty="No voices seeded."
          />
        </Card>

        <Card title={`Characters (${data.characters.length})`}>
          <Rows
            rows={data.characters.map((c) => [
              c.display_name,
              `${c.role}${c.voice_profile_id ? ` · ${c.voice_profile_id}` : ""}${c.active ? "" : " · inactive"}`,
            ])}
            empty="No characters seeded."
          />
        </Card>
      </Grid>

      <Grid>
        <Card title={`Formats (${data.formats.length})`}>
          <Rows
            rows={data.formats.map((f) => [
              f.display_name,
              `${f.emotional_register ?? "—"} · ${f.typical_cadence ?? "—"}${f.is_experimental ? " · experimental" : ""}`,
            ])}
            empty="No formats seeded."
          />
        </Card>

        <Card title={`Themed schedule (${data.themes.length})`}>
          <Rows
            rows={data.themes.map((t) => [
              t.title,
              `${DAYS[t.day_of_week]} ${t.local_time}${t.enabled ? "" : " · off"}`,
            ])}
            empty="No themed episodes scheduled."
          />
        </Card>
      </Grid>

      <section style={{ marginTop: 24 }}>
        <SectionTitle>Flagship backlog ({data.flagship.length})</SectionTitle>
        {data.flagship.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.inkMuted }}>No flagship ideas yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.flagship.map((ep) => (
              <li
                key={ep.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: `1px solid ${COLORS.borderLight}`,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    minWidth: 80,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                    color: statusColor(ep.status),
                  }}
                >
                  {ep.status}
                </span>
                <span style={{ flex: 1 }}>{ep.title}</span>
                <span style={{ color: COLORS.inkMuted, fontVariantNumeric: "tabular-nums" }}>
                  {ep.scheduled_for ?? "—"}
                </span>
                <span style={{ color: COLORS.inkMuted, width: 40, textAlign: "right" }}>
                  {ep.episode_number ? `#${ep.episode_number}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: COLORS.inkSec,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Rows({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: COLORS.inkMuted }}>{empty}</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map(([k, v], i) => (
        <li
          key={`${k}-${i}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            padding: "6px 0",
            fontSize: 12,
            borderBottom: i < rows.length - 1 ? `1px solid ${COLORS.borderLight}` : "none",
          }}
        >
          <span style={{ color: COLORS.ink }}>{k}</span>
          <span style={{ color: COLORS.inkMuted, textAlign: "right" }}>{v}</span>
        </li>
      ))}
    </ul>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: disabled ? COLORS.inkFaint : COLORS.forest,
    color: "#fff",
    border: "none",
    borderRadius: 3,
    cursor: disabled ? "default" : "pointer",
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.4,
  };
}

function statusColor(status: string): string {
  switch (status) {
    case "published": return COLORS.forest;
    case "scheduled": return COLORS.plum;
    case "drafted": return COLORS.inkSec;
    default: return COLORS.inkMuted;
  }
}
