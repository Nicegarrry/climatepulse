"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro } from "@/components/intelligence/primitives";

interface TopEngaged {
  raw_article_id: string;
  headline: string;
  source: string;
  thumbs_up: number;
  saves: number;
  expands: number;
  score: number;
}
interface EditorSave {
  raw_article_id: string;
  headline: string;
  source: string;
  saved_at: string;
  note: string | null;
}
interface CapturedPick {
  briefing_id: string;
  date: string;
  rank: number;
  headline: string | null;
}
interface CapturedNote extends CapturedPick {
  note: string;
}
interface RagRetrieval {
  theme_label: string;
  sources: { source_id: string; content_type: string; snippet: string }[];
}

interface BriefingPack {
  top_engaged: TopEngaged[];
  editor_saves: EditorSave[];
  captured_picks: CapturedPick[];
  captured_notes: CapturedNote[];
  rag_retrievals: RagRetrieval[];
  suggested_angles: string[];
}

interface ReportResponse {
  report?: {
    id: string;
    week_start: string;
    week_end: string;
    briefing_pack?: BriefingPack | string | null;
  } | null;
}

export function BriefingPackView() {
  const [pack, setPack] = useState<BriefingPack | null>(null);
  const [meta, setMeta] = useState<{ week_start: string; week_end: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weekly/reports?limit=1");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as ReportResponse & { reports?: ReportResponse["report"][] };
      const report = body.report ?? body.reports?.[0] ?? null;
      if (!report) {
        setPack(null);
        setMeta(null);
        return;
      }
      setMeta({ week_start: report.week_start, week_end: report.week_end });
      if (!report.briefing_pack) {
        setPack(null);
      } else {
        const p = typeof report.briefing_pack === "string"
          ? (JSON.parse(report.briefing_pack) as BriefingPack)
          : (report.briefing_pack as BriefingPack);
        setPack(p);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly/generate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `status ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !pack) {
    return (
      <div style={panel}>
        <Micro>Loading briefing pack&hellip;</Micro>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div>
          <Micro>Editor Briefing Pack</Micro>
          {meta && (
            <div style={{ fontSize: 11, color: COLORS.inkFaint, marginTop: 2 }}>
              Week of {meta.week_start} &ndash; {meta.week_end}
            </div>
          )}
        </div>
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
          {regenerating ? "Rebuilding\u2026" : "Rebuild"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#A03030", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {!pack && (
        <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>
          No pack yet. Click Rebuild, or apply{" "}
          <code style={{ fontFamily: "ui-monospace" }}>migrate-briefing-pack.sql</code>{" "}
          if this is the first run.
        </p>
      )}

      {pack && (
        <div style={{ display: "grid", gap: 14 }}>
          {pack.suggested_angles.length > 0 && (
            <Section title="Suggested angles">
              <ol style={olStyle}>
                {pack.suggested_angles.map((a, i) => (
                  <li key={i} style={{ marginBottom: 4, color: COLORS.ink }}>
                    {a}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {pack.top_engaged.length > 0 && (
            <Section title="Top-engaged this week">
              <ul style={ulStyle}>
                {pack.top_engaged.slice(0, 8).map((t) => (
                  <li key={t.raw_article_id} style={liStyle}>
                    <div style={{ flex: 1 }}>{t.headline}</div>
                    <span style={meta11}>
                      {t.source} &middot; 👍 {t.thumbs_up} &middot; ★ {t.saves}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pack.editor_saves.length > 0 && (
            <Section title="Your saved articles">
              <ul style={ulStyle}>
                {pack.editor_saves.map((s) => (
                  <li key={s.raw_article_id + s.saved_at} style={liStyle}>
                    <div style={{ flex: 1 }}>
                      {s.headline}
                      {s.note && (
                        <div
                          style={{
                            fontSize: 11,
                            color: COLORS.inkFaint,
                            fontStyle: "italic",
                            marginTop: 2,
                          }}
                        >
                          &ldquo;{s.note}&rdquo;
                        </div>
                      )}
                    </div>
                    <span style={meta11}>{s.source}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pack.captured_picks.length > 0 && (
            <Section title="Editor's Picks captured">
              <ul style={ulStyle}>
                {pack.captured_picks.map((p) => (
                  <li key={`${p.briefing_id}:${p.rank}`} style={liStyle}>
                    <div style={{ flex: 1 }}>{p.headline ?? "(suppressed)"}</div>
                    <span style={meta11}>
                      {p.date} &middot; #{p.rank}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pack.captured_notes.length > 0 && (
            <Section title="Your inline notes">
              <ul style={ulStyle}>
                {pack.captured_notes.map((n) => (
                  <li key={`${n.briefing_id}:${n.rank}:note`} style={liStyle}>
                    <div style={{ flex: 1 }}>
                      {n.headline ?? "(suppressed)"}
                      <div
                        style={{
                          fontSize: 11,
                          color: COLORS.inkSec,
                          fontStyle: "italic",
                          marginTop: 2,
                        }}
                      >
                        &ldquo;{n.note}&rdquo;
                      </div>
                    </div>
                    <span style={meta11}>{n.date}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pack.rag_retrievals.length > 0 && (
            <Section title="Prior coverage (RAG)">
              {pack.rag_retrievals.map((r) => (
                <div key={r.theme_label} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: COLORS.ink,
                      marginBottom: 4,
                    }}
                  >
                    {r.theme_label}
                  </div>
                  <ul style={{ ...ulStyle, paddingLeft: 10 }}>
                    {r.sources.map((s) => (
                      <li key={s.source_id} style={liStyle}>
                        <div style={{ flex: 1, color: COLORS.inkSec }}>
                          {s.snippet}
                        </div>
                        <span style={meta11}>{s.content_type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: COLORS.inkMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
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

const ulStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  fontSize: 12,
};

const olStyle: React.CSSProperties = {
  paddingLeft: 20,
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: COLORS.ink,
};

const liStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "4px 0",
  borderBottom: `1px solid ${COLORS.paperDark}`,
  fontSize: 12,
  color: COLORS.inkSec,
};

const meta11: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.inkFaint,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
