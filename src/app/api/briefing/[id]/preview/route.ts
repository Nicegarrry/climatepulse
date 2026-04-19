import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { ARCHETYPE_FRAMINGS, type PodcastArchetype } from "@/lib/podcast/archetypes";
import type { DigestOutput } from "@/lib/types";

export const maxDuration = 120;

const VALID: PodcastArchetype[] = ["commercial", "academic", "public", "general"];

function isArchetype(v: string): v is PodcastArchetype {
  return (VALID as string[]).includes(v);
}

/**
 * Builds a directive-heavy reframe prompt. Claude must aggressively change
 * the *voice* — a reader should be able to tell which archetype they're
 * seeing from the narrative alone.
 */
function buildReframePrompt(
  source: DigestOutput,
  archetype: PodcastArchetype
): string {
  const framing = ARCHETYPE_FRAMINGS[archetype];
  return `You are reframing an existing daily climate/energy briefing for a specific reader archetype. The original briefing is written for a generic reader — your job is to rewrite it with a distinctly different voice so the target archetype reader can immediately tell this was written for them.

TARGET ARCHETYPE: ${framing.label}

FRAMING DIRECTIVE:
${framing.directive}

WHAT YOU MUST REWRITE (be aggressive — voice changes should be obvious):
  - narrative — rewrite fully in the archetype's voice
  - hero_stories[*].expert_take — rewrite fully
  - hero_stories[*].so_what — rewrite fully if present
  - compact_stories[*].one_line_take — rewrite fully

WHAT YOU MUST PRESERVE VERBATIM (do not change):
  - daily_number (entire object)
  - rank ordering of hero_stories and compact_stories
  - every story's headline, source, url
  - every story's key_metric
  - hero_stories[*].micro_sectors, entities_mentioned, connected_storyline

SOURCE BRIEFING (JSON):
${JSON.stringify(source)}

Return ONLY a JSON object (no prose before or after, no code fences) with the exact same shape as the source. Every rewritten field should reflect the archetype directive unmistakably.`;
}

/**
 * Dedicated Claude call for reframing. Higher max_tokens than the default
 * digest path because the response must contain the full digest JSON (stories,
 * takes, narrative) — not just the narrative delta.
 */
async function callClaudeReframe(prompt: string): Promise<DigestOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? "";
  const stopReason: string | null = data.stop_reason ?? null;
  if (stopReason === "max_tokens") {
    throw new Error("Reframe response truncated (hit max_tokens)");
  }

  // Prefer fenced JSON, fall back to first `{…}` block, then raw text.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = fenced?.[1]?.trim();
  if (!jsonStr) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = text.slice(firstBrace, lastBrace + 1);
    } else {
      jsonStr = text.trim();
    }
  }

  return JSON.parse(jsonStr) as DigestOutput;
}

// GET /api/briefing/[id]/preview?archetype=commercial
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const archetypeParam = req.nextUrl.searchParams.get("archetype");
  if (!archetypeParam || !isArchetype(archetypeParam)) {
    return NextResponse.json({ error: "invalid archetype" }, { status: 400 });
  }
  const archetype: PodcastArchetype = archetypeParam;

  // Cache lookup
  try {
    const { rows } = await pool.query<{ digest: DigestOutput; generated_at: string }>(
      `SELECT digest, generated_at
         FROM daily_briefing_previews
        WHERE briefing_id = $1 AND archetype = $2`,
      [id, archetype]
    );
    if (rows.length > 0) {
      return NextResponse.json({
        archetype,
        digest: rows[0].digest,
        generated_at: rows[0].generated_at,
        cached: true,
      });
    }
  } catch (err) {
    // Cache table missing — proceed to generate; write-back will silently skip.
    console.warn("[preview] cache read skipped:", err);
  }

  // Load source briefing
  const { rows: briefings } = await pool.query<{ digest: DigestOutput }>(
    `SELECT digest FROM daily_briefings WHERE id = $1`,
    [id]
  );
  if (briefings.length === 0) {
    return NextResponse.json({ error: "briefing not found" }, { status: 404 });
  }
  const source = briefings[0].digest;

  // Reframe via Claude
  let digest: DigestOutput;
  try {
    digest = await callClaudeReframe(buildReframePrompt(source, archetype));
  } catch (err) {
    console.error("[preview] Claude reframe failed:", err);
    return NextResponse.json(
      {
        error: "Reframe failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  // Write-back cache (best-effort)
  try {
    await pool.query(
      `INSERT INTO daily_briefing_previews (briefing_id, archetype, digest, model_used)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (briefing_id, archetype) DO UPDATE
         SET digest = EXCLUDED.digest,
             generated_at = NOW(),
             model_used = EXCLUDED.model_used`,
      [id, archetype, JSON.stringify(digest), "claude-sonnet"]
    );
  } catch (err) {
    console.warn("[preview] cache write skipped (migration missing?):", err);
  }

  return NextResponse.json({ archetype, digest, cached: false });
}
