import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { callClaude } from "@/lib/digest/generate";
import { ARCHETYPE_FRAMINGS, type PodcastArchetype } from "@/lib/podcast/archetypes";
import type { DigestOutput } from "@/lib/types";

export const maxDuration = 120;

const VALID: PodcastArchetype[] = ["commercial", "academic", "public", "general"];

function isArchetype(v: string): v is PodcastArchetype {
  return (VALID as string[]).includes(v);
}

/**
 * Builds a lightweight reframe prompt. Keeps stories identical to the source
 * briefing — only wording changes (narrative, expert_take, one_line_take).
 */
function buildReframePrompt(
  source: DigestOutput,
  archetype: PodcastArchetype
): string {
  const framing = ARCHETYPE_FRAMINGS[archetype];
  return `You are reframing an existing daily climate/energy briefing for a specific reader archetype. Do not add or remove stories. Do not change the daily_number. Do not change rank order. Only rewrite: narrative, hero_stories[*].expert_take, compact_stories[*].one_line_take, and hero_stories[*].so_what (if present) so the voice fits the target archetype.

TARGET ARCHETYPE: ${framing.label}

FRAMING DIRECTIVE:
${framing.directive}

SOURCE BRIEFING (JSON):
${JSON.stringify(source)}

Return ONLY a JSON object with the exact same shape as the source briefing, with narrative + expert_take + one_line_take + so_what rewritten for the archetype. Preserve story ids, ranks, headlines, sources, urls, micro_sectors, entities_mentioned, key_metric, and daily_number verbatim.`;
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
    digest = await callClaude(buildReframePrompt(source, archetype));
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
