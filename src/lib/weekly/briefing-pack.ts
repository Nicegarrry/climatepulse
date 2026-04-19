import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import type { WeeklyThemeCluster } from "@/lib/types";

// ─── Shape ────────────────────────────────────────────────────────────────

export interface PackTopEngaged {
  raw_article_id: string;
  headline: string;
  source: string;
  thumbs_up: number;
  saves: number;
  expands: number;
  score: number;
}

export interface PackEditorSave {
  raw_article_id: string;
  headline: string;
  source: string;
  saved_at: string;
  note: string | null;
}

export interface PackCapturedPick {
  briefing_id: string;
  date: string;
  rank: number;
  headline: string | null;
}

export interface PackCapturedNote extends PackCapturedPick {
  note: string;
}

export interface PackRagRetrieval {
  theme_label: string;
  sources: { source_id: string; content_type: string; snippet: string }[];
}

export interface BriefingPack {
  top_engaged: PackTopEngaged[];
  editor_saves: PackEditorSave[];
  captured_picks: PackCapturedPick[];
  captured_notes: PackCapturedNote[];
  rag_retrievals: PackRagRetrieval[];
  suggested_angles: string[];
}

// ─── Builders ─────────────────────────────────────────────────────────────

async function fetchTopEngaged(
  weekStart: string,
  weekEnd: string
): Promise<PackTopEngaged[]> {
  try {
    const { rows } = await pool.query<{
      raw_article_id: string;
      title: string;
      source_name: string;
      thumbs_up: string;
      saves: string;
      expands: string;
    }>(
      `SELECT
          ubi.raw_article_id,
          ra.title,
          ra.source_name,
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'thumbs_up')::bigint AS thumbs_up,
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'save')::bigint      AS saves,
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'expand')::bigint    AS expands
         FROM user_briefing_interactions ubi
         JOIN raw_articles ra ON ra.id = ubi.raw_article_id
        WHERE ubi.created_at >= $1::date
          AND ubi.created_at <  ($2::date + INTERVAL '1 day')
          AND ubi.raw_article_id IS NOT NULL
        GROUP BY ubi.raw_article_id, ra.title, ra.source_name
        ORDER BY (
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'thumbs_up') * 3 +
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'save')      * 5 +
          COUNT(*) FILTER (WHERE ubi.interaction_type = 'expand')    * 1
        ) DESC
        LIMIT 10`,
      [weekStart, weekEnd]
    );
    return rows.map((r) => {
      const thumbs_up = Number(r.thumbs_up);
      const saves = Number(r.saves);
      const expands = Number(r.expands);
      return {
        raw_article_id: r.raw_article_id,
        headline: r.title,
        source: r.source_name,
        thumbs_up,
        saves,
        expands,
        score: thumbs_up * 3 + saves * 5 + expands,
      };
    });
  } catch (err) {
    console.warn("[briefing-pack] top_engaged skipped:", err);
    return [];
  }
}

async function fetchEditorSaves(
  editorUserId: string,
  weekStart: string,
  weekEnd: string
): Promise<PackEditorSave[]> {
  try {
    const { rows } = await pool.query<{
      raw_article_id: string;
      title: string;
      source_name: string;
      saved_at: string;
      note: string | null;
    }>(
      `SELECT usa.raw_article_id,
              ra.title,
              ra.source_name,
              usa.saved_at,
              usa.note
         FROM user_saved_articles usa
         JOIN raw_articles ra ON ra.id = usa.raw_article_id
        WHERE usa.user_id = $1
          AND usa.saved_at >= $2::date
          AND usa.saved_at <  ($3::date + INTERVAL '1 day')
        ORDER BY usa.saved_at DESC
        LIMIT 20`,
      [editorUserId, weekStart, weekEnd]
    );
    return rows.map((r) => ({
      raw_article_id: r.raw_article_id,
      headline: r.title,
      source: r.source_name,
      saved_at: r.saved_at,
      note: r.note,
    }));
  } catch (err) {
    console.warn("[briefing-pack] editor_saves skipped:", err);
    return [];
  }
}

interface OverrideEntry {
  editors_pick?: boolean;
  editorial_note?: string | null;
}

async function fetchCapturedPicksAndNotes(
  weekStart: string,
  weekEnd: string
): Promise<{ picks: PackCapturedPick[]; notes: PackCapturedNote[] }> {
  try {
    const { rows } = await pool.query<{
      id: string;
      date: string;
      digest: { hero_stories?: { rank: number; headline: string }[]; compact_stories?: { rank: number; headline: string }[] };
      editorial_overrides: Record<string, OverrideEntry> | null;
    }>(
      `SELECT id, date, digest, editorial_overrides
         FROM daily_briefings
        WHERE date >= $1::date
          AND date <= $2::date
          AND editorial_overrides IS NOT NULL
          AND editorial_overrides::text <> '{}'`,
      [weekStart, weekEnd]
    );

    const picks: PackCapturedPick[] = [];
    const notes: PackCapturedNote[] = [];
    const seenPick = new Set<string>();
    const seenNote = new Set<string>();

    for (const row of rows) {
      const heros = row.digest?.hero_stories ?? [];
      const compact = row.digest?.compact_stories ?? [];
      const all: { rank: number; headline: string }[] = [...heros, ...compact];
      const overrides = row.editorial_overrides ?? {};

      for (const [rankKey, o] of Object.entries(overrides)) {
        if (rankKey === "__meta") continue;
        const rank = Number(rankKey);
        const story = all.find((s) => s.rank === rank);
        const headline = story?.headline ?? null;

        if (o.editors_pick) {
          const key = `${row.id}:${rank}`;
          if (!seenPick.has(key)) {
            picks.push({ briefing_id: row.id, date: row.date, rank, headline });
            seenPick.add(key);
          }
        }
        if (o.editorial_note) {
          const key = `${row.id}:${rank}:note`;
          if (!seenNote.has(key)) {
            notes.push({
              briefing_id: row.id,
              date: row.date,
              rank,
              headline,
              note: o.editorial_note,
            });
            seenNote.add(key);
          }
        }
      }
    }
    return { picks, notes };
  } catch (err) {
    console.warn("[briefing-pack] captured_picks/notes skipped:", err);
    return { picks: [], notes: [] };
  }
}

async function fetchRagRetrievalsForClusters(
  clusters: WeeklyThemeCluster[]
): Promise<PackRagRetrieval[]> {
  if (clusters.length === 0) return [];
  try {
    // Import lazily so a missing RAG layer doesn't break the generate route.
    const { retrieveContent } = await import("@/lib/intelligence/retriever");
    const top = clusters.slice(0, 5);
    const out: PackRagRetrieval[] = [];
    for (const c of top) {
      try {
        const hits = await retrieveContent(
          c.label,
          { content_types: ["article", "weekly_digest", "weekly_report"] },
          { limit: 3 }
        );
        out.push({
          theme_label: c.label,
          sources: (hits ?? []).slice(0, 3).map((h) => ({
            source_id: h.source_id,
            content_type: h.content_type,
            snippet: (h.chunk_text ?? "").slice(0, 240),
          })),
        });
      } catch {
        /* per-theme failure is fine */
      }
    }
    return out;
  } catch (err) {
    console.warn("[briefing-pack] rag_retrievals skipped:", err);
    return [];
  }
}

async function suggestAngles(
  clusters: WeeklyThemeCluster[],
  topEngaged: PackTopEngaged[],
  capturedNotes: PackCapturedNote[]
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || clusters.length === 0) return [];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const themeLines = clusters.slice(0, 6).map((c, i) => `[${i + 1}] ${c.label}`);
    const engagedLines = topEngaged.slice(0, 5).map((t) => `- ${t.headline} (${t.source})`);
    const noteLines = capturedNotes.slice(0, 5).map((n) => `- "${n.note}" (on: ${n.headline ?? "story"})`);

    const prompt = `You are helping a climate/energy editor find 3 to 5 sharp editorial angles for this week's Pulse Weekly editorial.

Themes clustered from the week:
${themeLines.join("\n")}

Most-engaged stories (reader signal):
${engagedLines.join("\n") || "(none)"}

Editor's own inline notes from the week:
${noteLines.join("\n") || "(none)"}

Return 3 to 5 angle ideas as a JSON array of strings. Each angle should be a single sentence, argumentative not descriptive, avoid hedging, no emojis, no hashtags. Format: ["angle 1", "angle 2", ...]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, 5);
  } catch (err) {
    console.warn("[briefing-pack] suggested_angles skipped:", err);
    return [];
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────

export async function buildBriefingPack(opts: {
  weekStart: string;
  weekEnd: string;
  editorUserId: string | null;
  clusters: WeeklyThemeCluster[];
}): Promise<BriefingPack> {
  const [topEngaged, capturedBoth, ragRetrievals] = await Promise.all([
    fetchTopEngaged(opts.weekStart, opts.weekEnd),
    fetchCapturedPicksAndNotes(opts.weekStart, opts.weekEnd),
    fetchRagRetrievalsForClusters(opts.clusters),
  ]);

  const editorSaves = opts.editorUserId
    ? await fetchEditorSaves(opts.editorUserId, opts.weekStart, opts.weekEnd)
    : [];

  const suggestedAngles = await suggestAngles(
    opts.clusters,
    topEngaged,
    capturedBoth.notes
  );

  return {
    top_engaged: topEngaged,
    editor_saves: editorSaves,
    captured_picks: capturedBoth.picks,
    captured_notes: capturedBoth.notes,
    rag_retrievals: ragRetrievals,
    suggested_angles: suggestedAngles,
  };
}
