import type { DigestOutput, PodcastScript, ScoredStory } from "@/lib/types";

export interface PodcastContext {
  digest: DigestOutput;
  stories?: ScoredStory[];
  nemSummary?: string;
}

/**
 * Generate a two-speaker podcast script from the daily digest.
 * Uses Claude Sonnet to create a ~5 minute structured conversational script.
 */
export async function generatePodcastScript(
  context: PodcastContext
): Promise<PodcastScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const prompt = buildScriptPrompt(context);

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

function buildScriptPrompt(context: PodcastContext): string {
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
