// src/lib/digest/generate.ts
//
// Pure digest generation — no HTTP, no auth. Callable from both the
// /api/digest/generate route and the pipeline's step4Digest so that the
// cron path avoids a self-fetch round-trip.

import pool from "@/lib/db";
import { selectBriefingStories, DEPTH_RANGES } from "@/lib/personalisation";
import { getTaxonomyTree } from "@/lib/enrichment/taxonomy-cache";
import { MOCK_USER_PROFILE } from "@/lib/mock-digest";
import { getInteractionSummary } from "@/lib/newsroom/interactions";
import { retrieveContent } from "@/lib/intelligence/retriever";
import type { RetrievedContent } from "@/lib/intelligence/retriever";
import { sydneyDateString } from "@/lib/podcast/date";
import type {
  UserProfile,
  ScoredStory,
  DigestOutput,
  EnrichedArticle,
  DailyBriefing,
} from "@/lib/types";

// ─── Typed failures so callers can map to HTTP status ──────────────────────

export class DigestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "DigestError";
  }
}

// ─── Content depth classification ──────────────────────────────────────────

type ContentDepth = "full_text" | "snippet" | "metadata_only";

function getContentDepth(story: ScoredStory): ContentDepth {
  if (story.full_text && story.full_text.length > 100) return "full_text";
  if (story.snippet && story.snippet.length > 20) return "snippet";
  return "metadata_only";
}

// ─── Web search pre-pass for thin stories ──────────────────────────────────

async function fetchWebContext(
  thinStories: ScoredStory[]
): Promise<Map<string, string>> {
  const contextMap = new Map<string, string>();
  if (thinStories.length === 0) return contextMap;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return contextMap;

  const storiesBlock = thinStories
    .map(
      (s, i) =>
        `[${i + 1}] "${s.title}" — ${s.source_name}\nURL: ${s.article_url}\nSignal: ${s.signal_type ?? "unknown"}\nSnippet: ${s.snippet ?? "none"}`
    )
    .join("\n\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2025-01-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: Math.min(thinStories.length * 2, 10),
          },
        ],
        messages: [
          {
            role: "user",
            content: `You are a factual research assistant. For each news story below, search the web to find the key facts, data points, and quotes from the original reporting. Do NOT add analysis or opinion — only verified facts.

${storiesBlock}

After searching, respond with ONLY a JSON array — no markdown fencing:
[
  { "index": 1, "context": "2-3 sentence factual summary with specific numbers/quotes found" },
  ...
]

If you cannot find information for a story, set context to null.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`Web context pre-pass failed: ${response.status}`);
      return contextMap;
    }

    const data = await response.json();

    // Extract text blocks (skip server_tool_use and web_search_tool_result blocks)
    const textBlocks =
      data.content?.filter((b: { type: string }) => b.type === "text") ?? [];
    const text = textBlocks
      .map((b: { text: string }) => b.text)
      .join("");

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      text,
    ];
    const jsonStr = jsonMatch[1]?.trim() ?? text.trim();
    const results = JSON.parse(jsonStr);

    for (const result of results) {
      const storyIndex = (result.index ?? 0) - 1;
      if (
        storyIndex >= 0 &&
        storyIndex < thinStories.length &&
        result.context
      ) {
        contextMap.set(thinStories[storyIndex].id, result.context);
      }
    }

    console.log(
      `Web context: found context for ${contextMap.size}/${thinStories.length} thin stories`
    );
  } catch (err) {
    console.warn("Web context pre-pass error:", err);
  }

  return contextMap;
}

// ─── Build the digest prompt ───────────────────────────────────────────────

// ─── Prior-coverage RAG lookup for hero stories ─────────────────────────────

// Look back three days so we skip today's own coverage but catch week-over-week
// continuations. Tiers 0 + 1 = own editorial + primary sources (skip aggregator
// noise). dedupeBySource collapses multi-chunk articles to their best chunk.
const PRIOR_COVERAGE_LOOKBACK_DAYS = 3;
const PRIOR_COVERAGE_PER_STORY = 3;

async function fetchPriorCoverage(
  stories: ScoredStory[]
): Promise<Map<string, RetrievedContent[]>> {
  const result = new Map<string, RetrievedContent[]>();
  const heroes = stories.filter((s) => s.designation === "hero");
  if (heroes.length === 0) return result;

  const cutoff = new Date(
    Date.now() - PRIOR_COVERAGE_LOOKBACK_DAYS * 86_400_000
  )
    .toISOString()
    .slice(0, 10);

  await Promise.all(
    heroes.map(async (story) => {
      const entityIds = story.entities
        .map((e) => e.id)
        .filter((id): id is number => typeof id === "number");

      try {
        const hits = await retrieveContent(
          story.title,
          {
            date_to: cutoff,
            content_types: ["article", "daily_digest", "podcast"],
            trustworthiness_tiers: [0, 1],
            ...(entityIds.length > 0 ? { entity_ids: entityIds } : {}),
          },
          {
            limit: PRIOR_COVERAGE_PER_STORY,
            dedupeBySource: true,
          }
        );
        if (hits.length > 0) result.set(story.id, hits);
      } catch (err) {
        console.warn(
          `[digest] prior coverage for "${story.title}" failed:`,
          err
        );
      }
    })
  );

  return result;
}

function buildDigestPrompt(
  stories: ScoredStory[],
  profile: UserProfile,
  roleLensLabel: string,
  webContext: Map<string, string>,
  priorCoverage: Map<string, RetrievedContent[]>,
  analysisDetail: "brief" | "standard" | "extended" = "standard"
): string {
  const storiesBlock = stories
    .map((s, i) => {
      const depth = getContentDepth(s);
      const webCtx = webContext.get(s.id);
      const prior = priorCoverage.get(s.id) ?? [];

      let contentLine: string;
      if (depth === "full_text") {
        contentLine = s.full_text!.slice(0, 500);
      } else if (depth === "snippet") {
        contentLine = s.snippet!;
      } else {
        contentLine = "No article content available";
      }

      const priorBlock =
        prior.length > 0
          ? `\nPrior ClimatePulse coverage (reference only when it genuinely reframes today's story):\n` +
            prior
              .map(
                (p) =>
                  `  - ${p.published_at?.slice(0, 10) ?? "?"} [${p.content_type}] ${p.title}${p.snippet ? ` — ${p.snippet.slice(0, 180)}` : ""}`
              )
              .join("\n")
          : "";

      return `---
[${i + 1}] ${s.title}
Designation: ${s.designation.toUpperCase()}
Source: ${s.source_name} | Signal: ${s.signal_type ?? "unknown"} | Score: ${s.personal_score}
Content depth: ${depth.toUpperCase()}
Sectors: ${s.microsector_slugs.join(", ") || "none"}
Entities: ${s.entities.map((e) => `${e.name} (${e.type})`).join(", ") || "none"}
Key metric: ${s.quantitative_data?.primary_metric ? `${s.quantitative_data.primary_metric.value} ${s.quantitative_data.primary_metric.unit} — ${s.quantitative_data.primary_metric.context}` : "None"}
Content: ${contentLine}${webCtx ? `\nWeb research (verified): ${webCtx}` : ""}
Source URL: ${s.article_url}${priorBlock}
---`;
    })
    .join("\n");

  const channelsBlock =
    stories
      .flatMap((s) => s.transmission_channels_triggered)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((ch) => `- ${ch}`)
      .join("\n") || "None identified today.";

  return `You are the intelligence analyst for catalyst.study, producing a personalised daily
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
ONLY use numbers explicitly present in the story content or web research. If no
quantitative data is available, use the strongest factual data point you have.

3. HERO STORY ANALYSIS (for stories marked "hero" in the designation field)
For each hero story, provide:
a) HEADLINE: The story's actual headline (do not rewrite)
b) SOURCE + URL
c) EXPERT TAKE: Analytical frame using transmission channels and role lens.${
    analysisDetail === "brief"
      ? " Keep to 2-3 sentences. Be punchy."
      : analysisDetail === "extended"
        ? " Provide 5-6 sentences. Include second-order implications and what to watch for next."
        : " Provide 3-4 sentences."
  }
d) KEY METRIC
e) SO WHAT (if the story triggers a transmission channel from the list above): One sentence explaining the cross-domain implication, framed for the user's role. E.g., "Rising lithium costs could delay Australia's grid-scale storage targets." If no channel is triggered, omit this field.
f) CONNECTED STORYLINE (if applicable)

4. COMPACT STORY ANALYSIS (for stories marked "compact")
For each compact story, provide:
a) HEADLINE + SOURCE + URL
b) ONE-LINE TAKE: ${
    analysisDetail === "extended"
      ? "Two analytical sentences for a " + roleLensLabel + "."
      : "A single analytical sentence for a " + roleLensLabel + "."
  }
c) KEY METRIC

5. CROSS-STORY CONNECTIONS
If any stories are connected (shared entities, cause-effect), flag the connection in 1 sentence.

CONTENT DEPTH RULES (CRITICAL — READ CAREFULLY):
Each story has a "Content depth" label. You MUST calibrate your analysis accordingly:
- FULL_TEXT: Rich source material available. Provide full analytical depth.
- SNIPPET + "Web research (verified)": Use the web research as your factual basis. Ground all claims in those facts.
- SNIPPET without web research: You have only a headline and 1-2 sentence summary. Provide analysis based ONLY on what is stated. Prefix expert_take or one_line_take with "[Limited source]".
- METADATA_ONLY + "Web research (verified)": Use web research as your sole factual basis. Prefix with "[Web sourced]".
- METADATA_ONLY without web research: You have ONLY the headline and metadata. Prefix with "[Headline only]" and confine your take to what the headline implies. Do NOT speculate about article content.

ABSOLUTE RULES:
- NEVER fabricate quotes, statistics, dollar figures, percentages, or specific claims not present in the provided content or web research.
- NEVER invent key_metric values. If no metric exists in the source material, set key_metric to null.
- Frame everything through the user's role lens.
- Be specific. Not "this could affect the sector" but concrete implications grounded in provided facts.
- Keep output concise. The user reads this on their phone during morning commute.

Respond in JSON matching this schema exactly:
{
  "narrative": "string",
  "daily_number": { "value": "string", "label": "string", "context": "string", "trend": "string|null" },
  "hero_stories": [{ "rank": 1, "headline": "string", "source": "string", "url": "string", "expert_take": "string", "key_metric": { "value": "string", "unit": "string", "delta": "string" } | null, "so_what": "string|null", "connected_storyline": { "title": "string", "context": "string" } | null, "micro_sectors": ["string"], "entities_mentioned": ["string"] }],
  "compact_stories": [{ "rank": 4, "headline": "string", "source": "string", "url": "string", "one_line_take": "string", "key_metric": { "value": "string", "unit": "string", "delta": "string" } | null }],
  "cross_story_connections": [{ "story_ranks": [1, 3], "connection": "string" }] | null
}`;
}

// ─── Fetch enriched articles published in the last 32h ─────────────────────

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
      ea.contradicts_prior, ea.contradicted_source_ids,
      ra.title, ra.snippet, ra.source_name, ra.article_url, ra.published_at,
      ft.content as full_text, ft.word_count as full_text_word_count,
      COALESCE(
        (SELECT array_agg(tm.slug)
         FROM taxonomy_microsectors tm
         WHERE tm.id = ANY(ea.microsector_ids)), '{}'
      ) as microsector_slugs,
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
    significance_composite: Number(row.significance_composite) || null,
    microsector_ids: row.microsector_ids ?? [],
    tag_ids: row.tag_ids ?? [],
    jurisdictions: row.jurisdictions ?? [],
    transmission_channels_triggered: row.transmission_channels_triggered ?? [],
    microsector_names: row.microsector_slugs ?? [],
    entities: row.entities_joined ?? [],
  }));
}

// ─── Call Claude Sonnet ────────────────────────────────────────────────────

export async function callClaude(prompt: string): Promise<DigestOutput> {
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

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    text,
  ];
  const jsonStr = jsonMatch[1]?.trim() ?? text.trim();

  return JSON.parse(jsonStr) as DigestOutput;
}

// ─── Fetch user profile from DB ────────────────────────────────────────────

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role_lens, primary_sectors, jurisdictions,
              followed_entities, followed_storylines, triage_history,
              accordion_opens, story_ring_taps, briefing_depth, digest_time
       FROM user_profiles WHERE id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role_lens: row.role_lens,
        primary_sectors: row.primary_sectors ?? [],
        jurisdictions: row.jurisdictions ?? [],
        followed_entities: row.followed_entities ?? [],
        followed_storylines: row.followed_storylines ?? [],
        triage_history: row.triage_history ?? {},
        accordion_opens: row.accordion_opens ?? {},
        story_ring_taps: row.story_ring_taps ?? {},
        briefing_depth: row.briefing_depth ?? "standard",
        digest_time: row.digest_time ?? "06:30",
      };
    }
  } catch {
    // Fall through to mock
  }
  // If no profile row exists yet (e.g. mid-onboarding), use mock defaults but
  // keep the real userId so the persisted briefing is owned by the right user.
  return { ...MOCK_USER_PROFILE, id: userId };
}

// ─── Public entry point ────────────────────────────────────────────────────

export async function generateBriefingForUser(
  userId: string,
  opts: { mock?: boolean } = {}
): Promise<DailyBriefing> {
  const profile: UserProfile = await fetchUserProfile(userId);

  let stories: ScoredStory[];
  let digest: DigestOutput;
  let articlesAnalysed: number | undefined;

  if (opts.mock) {
    const { MOCK_SCORED_STORIES, MOCK_DIGEST } = await import(
      "@/lib/mock-digest"
    );
    stories = MOCK_SCORED_STORIES;
    digest = MOCK_DIGEST;
  } else {
    const enriched = await fetchRecentEnrichedArticles();
    articlesAnalysed = enriched.length;

    if (enriched.length === 0) {
      throw new DigestError(404, "No stories published in the last 32 hours");
    }

    const [taxonomyTree, interactionSummary] = await Promise.all([
      getTaxonomyTree(),
      getInteractionSummary(profile.id).catch((err) => {
        console.warn("[digest] failed to load interaction summary:", err);
        return undefined;
      }),
    ]);
    stories = selectBriefingStories(
      enriched,
      profile,
      taxonomyTree,
      interactionSummary
    );

    if (stories.length === 0) {
      throw new DigestError(404, "No stories passed personalisation threshold");
    }

    const { ROLE_LENS_OPTIONS } = await import("@/lib/types");
    const roleLens = ROLE_LENS_OPTIONS.find((r) => r.id === profile.role_lens);
    const roleLensLabel = roleLens?.label ?? "General Interest";

    const thinStories = stories.filter(
      (s) => getContentDepth(s) !== "full_text"
    );
    const webContext =
      thinStories.length > 0
        ? await fetchWebContext(thinStories)
        : new Map<string, string>();

    if (thinStories.length > 0) {
      console.log(
        `Digest: ${thinStories.length}/${stories.length} stories lack full text, ` +
          `web context found for ${webContext.size}`
      );
    }

    // Pull prior ClimatePulse coverage for each HERO story so Claude can
    // reference historical context ("as we covered on April 12…") when it
    // genuinely reframes today's piece. Non-fatal — if RAG is unavailable
    // we just skip the block.
    const priorCoverage = await fetchPriorCoverage(stories).catch((err) => {
      console.warn("[digest] prior coverage fetch failed:", err);
      return new Map<string, RetrievedContent[]>();
    });

    const depthConfig = DEPTH_RANGES[profile.briefing_depth];
    const prompt = buildDigestPrompt(
      stories,
      profile,
      roleLensLabel,
      webContext,
      priorCoverage,
      depthConfig.analysisDetail
    );

    try {
      digest = await callClaude(prompt);
    } catch (err) {
      console.error("First digest attempt failed, retrying:", err);
      try {
        digest = await callClaude(prompt);
      } catch (retryErr) {
        console.error("Retry failed:", retryErr);
        const { MOCK_DIGEST } = await import("@/lib/mock-digest");
        digest = MOCK_DIGEST;
      }
    }
  }

  const now = new Date().toISOString();
  const today = sydneyDateString();
  const briefingId = `briefing-${Date.now()}`;

  const briefing: DailyBriefing = {
    id: briefingId,
    user_id: profile.id,
    date: today,
    stories,
    digest,
    generated_at: now,
    articles_analysed: articlesAnalysed,
  };

  // Persist (non-fatal)
  try {
    await pool.query(
      `INSERT INTO daily_briefings (id, user_id, date, stories, digest, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) DO UPDATE SET
         id = EXCLUDED.id,
         stories = EXCLUDED.stories,
         digest = EXCLUDED.digest,
         generated_at = EXCLUDED.generated_at`,
      [
        briefingId,
        profile.id,
        today,
        JSON.stringify(stories),
        JSON.stringify(digest),
        now,
      ]
    );

    // Embed into the RAG corpus (feedback loop)
    try {
      const { embedDailyDigest } = await import("@/lib/intelligence/embedder");
      await embedDailyDigest(briefingId);
    } catch (embedErr) {
      console.warn("Failed to embed daily digest:", embedErr);
    }
  } catch (persistErr) {
    console.warn("Failed to persist briefing:", persistErr);
  }

  return briefing;
}
