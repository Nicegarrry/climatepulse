import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { selectBriefingStories } from "@/lib/personalisation";
import { MOCK_USER_PROFILE, MOCK_DIGEST } from "@/lib/mock-digest";
import type {
  UserProfile,
  ScoredStory,
  DigestOutput,
  EnrichedArticle,
  DailyBriefing,
} from "@/lib/types";

// ─── Build the digest prompt ───────────────────────────────────────────────

function buildDigestPrompt(
  stories: ScoredStory[],
  profile: UserProfile,
  roleLensLabel: string
): string {
  const storiesBlock = stories
    .map(
      (s, i) => `---
[${i + 1}] ${s.title}
Source: ${s.source_name} | Signal: ${s.signal_type ?? "unknown"} | Score: ${s.personal_score}
Sectors: ${s.microsector_slugs.join(", ") || "none"}
Entities: ${s.entities.map((e) => `${e.name} (${e.type})`).join(", ") || "none"}
Key metric: ${s.quantitative_data?.primary_metric ? `${s.quantitative_data.primary_metric.value} ${s.quantitative_data.primary_metric.unit} — ${s.quantitative_data.primary_metric.context}` : "None"}
Content: ${s.full_text?.slice(0, 500) ?? s.snippet ?? "No content available"}
Source URL: ${s.article_url}
---`
    )
    .join("\n");

  const channelsBlock =
    stories
      .flatMap((s) => s.transmission_channels_triggered)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((ch) => `- ${ch}`)
      .join("\n") || "None identified today.";

  return `You are the intelligence analyst for ClimatePulse, producing a personalised daily
briefing for a climate and energy professional. Your job is to ADD analytical value
that the source articles do not provide. Never summarise what happened — the user
can read the source. Instead, explain WHY it matters, WHAT it connects to, and
WHAT the user should think about.

USER PROFILE:
Role: ${roleLensLabel}
Primary sectors: ${profile.primary_sectors.join(", ")}
Jurisdictions: ${profile.jurisdictions.join(", ")}

TODAY'S STORIES (ranked by personal relevance):
${storiesBlock}

TRANSMISSION CHANNELS IN PLAY:
${channelsBlock}

YOUR TASKS:

1. TODAY'S NARRATIVE (3-5 sentences)
Write a synthesis paragraph that connects today's top stories into a coherent
picture of what is happening in the energy transition TODAY. Write for a ${roleLensLabel}.
Do NOT start with "Today's briefing covers..." or similar meta-framing.
Start with the insight itself.

2. DAILY NUMBER
Select the single most striking quantitative data point from today's stories.

3. HERO STORY ANALYSIS (for top 3 stories only)
For each of the top 3 stories, provide:
a) HEADLINE: The story's actual headline (do not rewrite)
b) SOURCE + URL
c) EXPERT TAKE (3-4 sentences): Analytical frame using transmission channels and role lens.
d) KEY METRIC
e) CONNECTED STORYLINE (if applicable)

4. COMPACT STORY ANALYSIS (for stories ranked 4+)
For each remaining story, provide:
a) HEADLINE + SOURCE + URL
b) ONE-LINE TAKE: A single analytical sentence for a ${roleLensLabel}.
c) KEY METRIC

5. CROSS-STORY CONNECTIONS
If any stories are connected (shared entities, cause-effect), flag the connection in 1 sentence.

CRITICAL RULES:
- Never summarise the source article. ADD analysis.
- Frame everything through the user's role lens.
- Be specific. Not "this could affect the sector" but concrete implications.
- Keep output concise. The user reads this on their phone during morning commute.

Respond in JSON matching this schema exactly:
{
  "narrative": "string",
  "daily_number": { "value": "string", "label": "string", "context": "string", "trend": "string|null" },
  "hero_stories": [{ "rank": 1, "headline": "string", "source": "string", "url": "string", "expert_take": "string", "key_metric": { "value": "string", "unit": "string", "delta": "string" } | null, "connected_storyline": { "title": "string", "context": "string" } | null, "micro_sectors": ["string"], "entities_mentioned": ["string"] }],
  "compact_stories": [{ "rank": 4, "headline": "string", "source": "string", "url": "string", "one_line_take": "string", "key_metric": { "value": "string", "unit": "string", "delta": "string" } | null }],
  "cross_story_connections": [{ "story_ranks": [1, 3], "connection": "string" }] | null
}`;
}

// ─── Fetch enriched articles published in the last 32h ──────────────────────

async function fetchRecentEnrichedArticles(): Promise<EnrichedArticle[]> {
  const result = await pool.query(
    `SELECT
      ea.id, ea.raw_article_id, ea.microsector_ids, ea.tag_ids,
      ea.signal_type, ea.sentiment, ea.jurisdictions, ea.raw_entities,
      ea.model_used, ea.used_full_text, ea.enriched_at,
      ea.significance_scores, ea.significance_composite,
      ea.context_quality, ea.primary_domain, ea.secondary_domain,
      ea.confidence_levels, ea.quantitative_data,
      ea.transmission_channels_triggered, ea.pipeline_version,
      ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at,
      ft.content as full_text, ft.word_count as full_text_word_count,
      -- Resolve microsector slugs from IDs
      COALESCE(
        (SELECT array_agg(tm.slug)
         FROM taxonomy_microsectors tm
         WHERE tm.id = ANY(ea.microsector_ids)), '{}'
      ) as microsector_slugs,
      -- Resolve entity names + types from join table
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', e.id, 'name', e.canonical_name, 'type', e.entity_type, 'role', ae.role
        ))
         FROM article_entities ae
         JOIN entities e ON e.id = ae.entity_id
         WHERE ae.enriched_article_id = ea.id), '[]'
      ) as entities_joined
    FROM enriched_articles ea
    JOIN raw_articles ra ON ra.id = ea.raw_article_id
    LEFT JOIN full_text_articles ft ON ft.raw_article_id = ea.raw_article_id
    WHERE ra.published_at >= NOW() - INTERVAL '32 hours'
      AND ea.significance_composite IS NOT NULL
    ORDER BY ea.significance_composite DESC
    LIMIT 50`
  );

  return result.rows.map((row) => ({
    ...row,
    microsector_ids: row.microsector_ids ?? [],
    tag_ids: row.tag_ids ?? [],
    jurisdictions: row.jurisdictions ?? [],
    transmission_channels_triggered: row.transmission_channels_triggered ?? [],
    microsector_names: row.microsector_slugs ?? [],
    entities: row.entities_joined ?? [],
  }));
}

// ─── Call Claude Sonnet ────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<DigestOutput> {
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
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    text,
  ];
  const jsonStr = jsonMatch[1]?.trim() ?? text.trim();

  return JSON.parse(jsonStr) as DigestOutput;
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const useMock = body.mock === true;

    // Get user profile (mock for now)
    const profile: UserProfile = MOCK_USER_PROFILE;

    let stories: ScoredStory[];
    let digest: DigestOutput;

    if (useMock) {
      // Return mock data for UI development
      const { MOCK_SCORED_STORIES, MOCK_DIGEST } = await import(
        "@/lib/mock-digest"
      );
      stories = MOCK_SCORED_STORIES;
      digest = MOCK_DIGEST;
    } else {
      // Fetch real data and generate
      const enriched = await fetchRecentEnrichedArticles();

      if (enriched.length === 0) {
        return NextResponse.json(
          { error: "No stories published in the last 32 hours" },
          { status: 404 }
        );
      }

      stories = selectBriefingStories(enriched, profile);

      if (stories.length === 0) {
        return NextResponse.json(
          { error: "No stories passed personalisation threshold" },
          { status: 404 }
        );
      }

      // Find role lens label
      const { ROLE_LENS_OPTIONS } = await import("@/lib/types");
      const roleLens = ROLE_LENS_OPTIONS.find(
        (r) => r.id === profile.role_lens
      );
      const roleLensLabel = roleLens?.label ?? "General Interest";

      const prompt = buildDigestPrompt(stories, profile, roleLensLabel);

      try {
        digest = await callClaude(prompt);
      } catch (err) {
        // Retry once
        console.error("First digest attempt failed, retrying:", err);
        try {
          digest = await callClaude(prompt);
        } catch (retryErr) {
          console.error("Retry failed:", retryErr);
          // Fall back to mock
          const { MOCK_DIGEST } = await import("@/lib/mock-digest");
          digest = MOCK_DIGEST;
        }
      }
    }

    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const briefingId = `briefing-${Date.now()}`;

    const briefing: DailyBriefing = {
      id: briefingId,
      user_id: profile.id,
      date: today,
      stories,
      digest,
      generated_at: now,
    };

    // Persist to daily_briefings (upsert — regenerating overwrites same day)
    try {
      await pool.query(
        `INSERT INTO daily_briefings (id, user_id, date, stories, digest, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date) DO UPDATE SET
           id = EXCLUDED.id,
           stories = EXCLUDED.stories,
           digest = EXCLUDED.digest,
           generated_at = EXCLUDED.generated_at`,
        [briefingId, profile.id, today, JSON.stringify(stories), JSON.stringify(digest), now]
      );
    } catch (persistErr) {
      // Non-fatal — briefing still returned even if persistence fails
      console.warn("Failed to persist briefing:", persistErr);
    }

    return NextResponse.json(briefing);
  } catch (err) {
    console.error("Digest generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── GET handler (return mock for easy testing) ────────────────────────────

export async function GET() {
  // Check for today's persisted briefing first
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await pool.query(
      `SELECT id, user_id, date, stories, digest, generated_at
       FROM daily_briefings
       WHERE date = $1
       ORDER BY generated_at DESC
       LIMIT 1`,
      [today]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return NextResponse.json({
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        stories: row.stories,
        digest: row.digest,
        generated_at: row.generated_at,
      } as DailyBriefing);
    }
  } catch {
    // Table might not exist yet — fall through to mock
  }

  const { MOCK_BRIEFING } = await import("@/lib/mock-digest");
  return NextResponse.json(MOCK_BRIEFING);
}
