import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import type { RetrievedContent } from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RAGSource {
  content_type: ContentType;
  source_id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  published_at: string | null;
  similarity: number;
  significance_composite: number | null;
  primary_domain: string | null;
  trustworthiness_tier: number;
  chunk_text: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  model_used: string;
  input_tokens?: number;
  output_tokens?: number;
}

type GenerationMode = "research" | "brief";

// ─── Content type labels for prompt ───────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "Source article",
  podcast: "Podcast transcript (our editorial)",
  daily_digest: "Daily briefing (our editorial)",
  weekly_digest: "Weekly Pulse (our editorial)",
  weekly_report: "Weekly intelligence report (our editorial)",
  report_pdf: "Report",
  youtube_transcript: "YouTube transcript",
  learn_content: "Learn content",
  concept_card: "Concept card (our editorial)",
  microsector_brief: "Microsector brief (our editorial)",
  microsector_brief_block: "Brief block (our editorial)",
  learning_path: "Learning path (our editorial)",
  deep_dive: "Deep dive (our editorial)",
  surface_module: "Knowledge surface module",
  uploaded_doc: "Uploaded document",
};

// ─── Context Building ─────────────────────────────────────────────────────────

function buildSourceContext(items: RetrievedContent[]): string {
  return items
    .map((item, i) => {
      const typeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type;
      const parts: string[] = [
        `[${i + 1}] "${item.title}"`,
        `Type: ${typeLabel}${item.subtitle ? ` | ${item.subtitle}` : ""}`,
      ];

      if (item.published_at) {
        parts.push(`Published: ${item.published_at.slice(0, 10)}`);
      }

      if (item.primary_domain || item.signal_type || item.sentiment) {
        const meta: string[] = [];
        if (item.primary_domain) meta.push(`Domain: ${item.primary_domain}`);
        if (item.signal_type) meta.push(`Signal: ${item.signal_type}`);
        if (item.sentiment) meta.push(`Sentiment: ${item.sentiment}`);
        parts.push(meta.join(" | "));
      }

      if (item.significance_composite != null) {
        parts.push(`Significance: ${item.significance_composite}/100`);
      }

      if (item.jurisdictions?.length) {
        parts.push(`Jurisdictions: ${item.jurisdictions.join(", ")}`);
      }

      // The chunk text is the actual retrieved content — always include
      parts.push(`Content: ${item.chunk_text}`);

      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

// ─── Claude Sonnet Research Mode ──────────────────────────────────────────────

async function generateWithSonnet(
  query: string,
  context: string,
  itemCount: number,
  hasOwnEditorial: boolean
): Promise<{ answer: string; input_tokens?: number; output_tokens?: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set — required for research mode");
  }

  const editorialNote = hasOwnEditorial
    ? `\n\nIMPORTANT: Some retrieved items are ClimatePulse's own editorial output (daily briefings, podcast transcripts, weekly digests). When referencing these, you can say "as we covered in [date's briefing]" or "our Weekly Pulse noted...". This is the feedback loop — acknowledging our own prior coverage.`
    : "";

  const systemPrompt = `You are an expert climate, energy, and sustainability intelligence analyst for ClimatePulse — an Australian-focused intelligence platform.

Your job is to synthesise the retrieved items into a clear, authoritative answer to the user's research query. You should:
- Lead with the direct answer, then provide supporting evidence
- Reference specific items by their number [1], [2] etc.
- Highlight quantitative data (metrics, dollar figures, percentages) when available
- Note conflicting signals or evolving narratives
- Identify cross-domain connections
- Flag information gaps where the available items don't fully answer the query
- Use an analytical, professional tone appropriate for policy analysts, investors, and sustainability practitioners${editorialNote}

Do NOT:
- Make claims not supported by the retrieved items
- Speculate beyond what the evidence supports
- Include generic disclaimers — be direct and evidence-based`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `RESEARCH QUERY: ${query}

RETRIEVED ITEMS (${itemCount} most relevant from our intelligence corpus):

${context}

Please synthesise these items into a comprehensive answer. Reference items by number [1], [2] etc.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const textBlocks = data.content?.filter((b: { type: string }) => b.type === "text") ?? [];
  const answer = textBlocks.map((b: { text: string }) => b.text).join("");

  return {
    answer,
    input_tokens: data.usage?.input_tokens,
    output_tokens: data.usage?.output_tokens,
  };
}

// ─── Gemini Brief Mode ────────────────────────────────────────────────────────

async function generateWithGemini(
  query: string,
  context: string,
  itemCount: number
): Promise<{ answer: string }> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  const ai = new GoogleGenerativeAI(key);
  const model = ai.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: `You are a climate and energy intelligence assistant for ClimatePulse. Answer the user's question concisely using ONLY the provided items. Reference items by number [1], [2] etc. Be direct and factual. If the items don't contain enough information, say so. When referencing our own editorial output (podcasts, digests), you can say "as we covered in...".`,
  });

  const result = await model.generateContent(
    `Question: ${query}

Retrieved items (${itemCount} most relevant):

${context}

Answer concisely, referencing item numbers.`
  );

  return { answer: result.response.text() };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function generateAnswer(
  query: string,
  items: RetrievedContent[],
  mode: GenerationMode = "brief"
): Promise<RAGResponse> {
  const context = buildSourceContext(items);
  const hasOwnEditorial = items.some((i) => i.trustworthiness_tier === 0);

  let answer: string;
  let modelUsed: string;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  if (mode === "research") {
    const result = await generateWithSonnet(query, context, items.length, hasOwnEditorial);
    answer = result.answer;
    modelUsed = "claude-sonnet-4-6";
    inputTokens = result.input_tokens;
    outputTokens = result.output_tokens;
  } else {
    const result = await generateWithGemini(query, context, items.length);
    answer = result.answer;
    modelUsed = GEMINI_MODEL;
  }

  return {
    answer,
    sources: items.map((item) => ({
      content_type: item.content_type,
      source_id: item.source_id,
      title: item.title,
      subtitle: item.subtitle,
      url: item.url,
      published_at: item.published_at,
      similarity: item.similarity,
      significance_composite: item.significance_composite,
      primary_domain: item.primary_domain,
      trustworthiness_tier: item.trustworthiness_tier,
      chunk_text: item.chunk_text,
    })),
    model_used: modelUsed,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}
