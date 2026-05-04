import type { DigestOutput, PodcastScript, ScoredStory } from "@/lib/types";
import { getEntityBrief } from "@/lib/intelligence/retriever";

export interface PodcastContext {
  digest: DigestOutput;
  stories?: ScoredStory[];
  nemSummary?: string;
}

// Cap the number of entity briefs we fetch per episode. Each brief is 5 DB
// queries, so 8 × 5 = 40 queries in parallel — still fast, but enough to
// inform the script without overwhelming the prompt.
const MAX_ENTITY_BRIEFS = 8;

/**
 * Generate a two-speaker podcast script from the daily digest.
 * Uses Claude Sonnet to create a ~5 minute structured conversational script.
 */
export async function generatePodcastScript(
  context: PodcastContext
): Promise<PodcastScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Fetch entity callbacks from RAG (prior coverage, mention trends). Failure
  // is non-fatal: if the table is missing or a query fails we drop the
  // "ENTITY HISTORY" block entirely and Claude writes the script without it.
  const entityHistory = await fetchEntityHistory(context).catch((err) => {
    console.warn("[podcast] entity history fetch failed:", err);
    return "";
  });

  const prompt = buildScriptPrompt(context, entityHistory);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
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
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() ?? text.trim();

  const script = JSON.parse(jsonStr) as PodcastScript;

  // Calculate word count from turns
  script.word_count = script.turns.reduce(
    (sum, turn) => sum + turn.text.split(/\s+/).length,
    0
  );
  // Estimate duration: ~150 words per minute for brisk conversation
  script.estimated_duration_seconds = Math.round(
    (script.word_count / 150) * 60
  );

  return script;
}

/**
 * Build enriched article summaries from scored stories + digest hero/compact data.
 * Matches stories by headline to merge full text with digest analysis.
 */
function buildArticleBlocks(context: PodcastContext): string {
  const { digest, stories } = context;
  const storyMap = new Map<string, ScoredStory>();
  if (stories) {
    for (const s of stories) {
      storyMap.set(s.title, s);
    }
  }

  const heroBlocks = digest.hero_stories.map((h, i) => {
    const matched = storyMap.get(h.headline);
    const fullText = matched?.full_text;
    // Truncate full text to ~600 words for prompt efficiency
    const textExcerpt = fullText
      ? fullText.split(/\s+/).slice(0, 600).join(" ")
      : null;

    return `=== STORY ${i + 1} (HERO) ===
Headline: ${h.headline}
Source: ${h.source}
URL: ${h.url}
Signal type: ${matched?.signal_type ?? "unknown"}
Significance score: ${matched?.inherent_score ?? "N/A"}/100

ARTICLE CONTENT (${textExcerpt ? "full text excerpt" : matched?.snippet ? "snippet only" : "headline only"}):
${textExcerpt ?? matched?.snippet ?? "[No article content available — analyse based on headline and expert take only]"}

CLIMATEPULSE ANALYSIS:
Expert take: ${h.expert_take}
Key metric: ${h.key_metric ? `${h.key_metric.value} ${h.key_metric.unit}${h.key_metric.delta ? ` (${h.key_metric.delta})` : ""}` : "None available"}
So what: ${h.so_what ?? "N/A"}
Connected storyline: ${h.connected_storyline ? `${h.connected_storyline.title} — ${h.connected_storyline.context}` : "None"}
Entities: ${h.entities_mentioned?.join(", ") ?? "none"}
Quantitative data: ${matched?.quantitative_data ? JSON.stringify(matched.quantitative_data) : "None"}`;
  });

  const compactBlocks = digest.compact_stories.map((c, i) => {
    const matched = storyMap.get(c.headline);
    return `=== STORY ${heroBlocks.length + i + 1} (COMPACT) ===
Headline: ${c.headline}
Source: ${c.source}
Take: ${c.one_line_take}
Key metric: ${c.key_metric ? `${c.key_metric.value} ${c.key_metric.unit}` : "None"}
${matched?.snippet ? `Snippet: ${matched.snippet}` : ""}`;
  });

  return [...heroBlocks, ...compactBlocks].join("\n\n");
}

/**
 * Resolve entity IDs across this episode's hero stories, fetch their briefs
 * in parallel, and format a short "ENTITY HISTORY" block the script writer
 * can draw on for "as we covered last Tuesday" style callbacks.
 *
 * Returns "" if no entities can be resolved — caller then omits the block.
 */
async function fetchEntityHistory(context: PodcastContext): Promise<string> {
  const { digest, stories } = context;
  if (!stories || stories.length === 0) return "";

  // Match hero stories back to their ScoredStory so we can read entity IDs.
  const storyMap = new Map<string, ScoredStory>();
  for (const s of stories) storyMap.set(s.title, s);

  // Dedupe entity IDs across heroes; preserve appearance order so we bias
  // toward entities in the top-ranked story.
  const entityOrder: number[] = [];
  const seen = new Set<number>();
  for (const hero of digest.hero_stories) {
    const story = storyMap.get(hero.headline);
    if (!story) continue;
    for (const e of story.entities ?? []) {
      if (typeof e.id !== "number") continue;
      if (!seen.has(e.id)) {
        seen.add(e.id);
        entityOrder.push(e.id);
      }
    }
  }

  const topEntityIds = entityOrder.slice(0, MAX_ENTITY_BRIEFS);
  if (topEntityIds.length === 0) return "";

  const briefs = await Promise.all(
    topEntityIds.map((id) => getEntityBrief(id).catch(() => null))
  );

  const lines: string[] = [];
  const todayMs = Date.now();
  for (const brief of briefs) {
    if (!brief) continue;

    // Only include entities with genuine history — filter out those we've
    // only ever seen today (nothing to call back to).
    const recent = brief.recent_content.filter((c) => {
      if (!c.published_at) return false;
      const ageDays = (todayMs - Date.parse(c.published_at)) / 86_400_000;
      return ageDays >= 1; // strictly earlier than today
    });
    if (recent.length === 0) continue;

    const mentions = recent.slice(0, 3).map((c) => {
      const date = c.published_at ? c.published_at.slice(0, 10) : "unknown";
      const kind = c.content_type === "daily_digest"
        ? "our briefing"
        : c.content_type === "podcast"
          ? "the podcast"
          : c.subtitle ?? "article";
      return `  ${date} (${kind}): ${c.title}`;
    });

    const totalMentions = brief.entity.mention_count ?? recent.length;
    const topDomain = brief.domain_distribution?.[0]?.domain;
    const topSignal = brief.signal_distribution?.[0]?.signal;
    const flavour = [
      topDomain ? `mostly ${topDomain}` : null,
      topSignal ? topSignal.replace(/_/g, " ") : null,
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(
      `- ${brief.entity.canonical_name} (${brief.entity.entity_type}) — ${totalMentions} total mentions${flavour ? ` [${flavour}]` : ""}:\n${mentions.join("\n")}`
    );
  }

  if (lines.length === 0) return "";
  return lines.join("\n");
}

function buildScriptPrompt(context: PodcastContext, entityHistory: string = ""): string {
  const { digest, nemSummary } = context;

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const articleBlocks = buildArticleBlocks(context);

  const connectionsBlock = digest.cross_story_connections
    ?.map((c) => `- Stories ${c.story_ranks.join(" & ")}: ${c.connection}`)
    .join("\n") ?? "None";

  return `You are writing a script for a 5-minute daily climate and energy podcast called "ClimatePulse Daily". This is produced by ClimatePulse, an AI-powered climate intelligence platform. The podcast is aimed at Australian climate/energy professionals catching up on their morning commute.

TODAY'S DATE: ${today}

THE PREMISE:
Sarah and James are ClimatePulse analysts stepping through the biggest stories that their analysis has surfaced today. They reference "our analysis", "the ClimatePulse briefing", "what we flagged" — this is their job.

TWO PRESENTERS:

- HOST (female — "Sarah"): Big-picture, qualitative thinker. Sceptical by default. Pushes back on corporate announcements, questions whether policy changes will deliver, asks what the real climate and energy implications are. Cares about outcomes, not press releases.

- ANALYST (male — "James"): Numbers and data. Anchors everything in specifics. Also critical — points out when numbers don't add up, when targets are unrealistic, or when data tells a different story to the headline.

Dynamic: Fast-paced back-and-forth. They build on each other but also challenge each other. Short turns, quick exchanges, genuine debate — not a scripted read.

NARRATIVE THREAD:
${digest.narrative}

DAILY NUMBER:
${digest.daily_number.value} ${digest.daily_number.label}
Context: ${digest.daily_number.context}
${digest.daily_number.trend ? `Trend: ${digest.daily_number.trend}` : ""}

NEM (NATIONAL ELECTRICITY MARKET) DATA:
${nemSummary ?? "No NEM data available — skip or use daily number if NEM-related."}

ARTICLES WITH FULL CONTENT:
${articleBlocks}

CROSS-STORY CONNECTIONS:
${connectionsBlock}
${entityHistory ? `
ENTITY HISTORY (prior ClimatePulse coverage of today's key entities):
${entityHistory}

You MAY draw on this history for natural callbacks — e.g. "ARENA, who we covered on 2026-04-12 for that Pilbara storage announcement" or "AEMO again — this is the third time this month their numbers have driven the story". Use these sparingly: only when the callback genuinely reframes today's story or highlights a pattern. Do not pad every sentence with references to past coverage.
` : ""}

EPISODE STRUCTURE:

1. OPEN (~20 seconds, host)
   "Welcome to ClimatePulse Daily for [date]. I'm Sarah, with James. Today our analysis has flagged [3-4 topics]. Let's get into it."

2. NEM CHECK-IN (~15 seconds, analyst)
   One-sentence update on the Australian NEM with actual numbers from the data above. E.g. "Quick NEM update — renewables at X% yesterday, spot prices averaged Y dollars a megawatt hour across the mainland states."

3. STORY DEEP-DIVES (~3.5 minutes, both, 3-4 stories)
   THIS IS THE CORE. For each story, you have the actual article content above. USE IT.

   For each story:
   a) Sarah introduces what ACTUALLY happened (from the article content, not just the headline)
   b) James adds the specific numbers, data points, and quantitative details FROM THE ARTICLE
   c) They discuss what it actually means for climate and energy — emissions, grid, renewables, storage, transition speed
   d) Be CRITICAL. Question claims. Note gaps between announcement and delivery. Ask whether this will actually reduce emissions or accelerate deployment.

   IMPORTANT: Each story should get 3-5 exchanges (6-10 turns) of real discussion drawing on the article content. Don't just mention the headline and move on. Dig into what the article actually says.

4. THREADS & OUTLOOK (~30 seconds, both)
   Sarah connects the stories. James adds what to watch next, grounded in data.

5. SIGN-OFF (~10 seconds, host)
   "That's ClimatePulse Daily. See you tomorrow."

PACING & VARIETY:
- Include occasional filler words for naturalness: "look," "yeah," "I mean," "right," "so" — but sparingly, maybe 5-6 total across the episode.
- Vary turn length significantly. Mix very short reactions ("Right.", "Exactly.", "That's the key thing.") with medium turns (2-3 sentences) and occasional longer analytical turns (3-4 sentences).
- Some exchanges should be rapid-fire (4+ turns of 1 sentence each), others more measured.

RULES:
- Target 750-850 words total (~5 minutes at brisk pace).
- Australian context. "Dollars" not "USD". Metric units.
- Do NOT fabricate numbers, quotes, or facts. Use what's in the article content and analysis above.
- Analyst MUST cite specific numbers from articles when they exist.
- Focus on CLIMATE AND ENERGY implications — emissions, grid, renewables, storage, transition — not policy process or corporate governance.
- Be SCEPTICAL. This is expert analysis, not news summarisation.

JSON schema:
{
  "title": "ClimatePulse Daily — [short thematic subtitle]",
  "turns": [
    { "speaker": "host", "text": "..." },
    { "speaker": "analyst", "text": "..." },
    ...
  ],
  "estimated_duration_seconds": 300,
  "word_count": 0
}`;
}
