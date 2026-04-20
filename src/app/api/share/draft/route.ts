import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import pool from "@/lib/db";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { getAuthUser } from "@/lib/supabase/server";
import { getOrCreateRefHash } from "@/lib/share";

// POST body: { article_url?: string; episode_id?: string; target?: "linkedin"|"twitter" }
// Returns: { blurb, share_url, preview: { headline, source_name, teaser } }
//
// Personalisation inputs (best-effort — blurb still works if user is anon or
// enrichment data is missing):
//   - user_profiles.role_lens  → voice
//   - user_profiles.primary_sectors → angle
//   - user_profiles.jurisdictions → region vernacular
//   - enrichment: teaser (raw_articles.snippet), sentiment, primary domain,
//     top entity names.

export const dynamic = "force-dynamic";

interface ArticleContext {
  raw_article_id: string | null;
  headline: string;
  source_name: string | null;
  snippet: string | null;
  sentiment: string | null;
  domain: string | null;
  entities: string[];
}

interface PodcastContext {
  title: string;
  briefing_date: string;
  audio_url: string;
}

interface UserContext {
  role_lens: string;
  primary_sectors: string[];
  jurisdictions: string[];
}

const BLURB_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    blurb: { type: SchemaType.STRING },
  },
  required: ["blurb"],
};

function roleVoice(role: string): string {
  const map: Record<string, string> = {
    investor: "capital-allocator reasoning about deal flow, project economics and market pricing",
    corporate_sustainability:
      "sustainability lead thinking about compliance burden, reporting, and greenwashing exposure",
    policy_analyst:
      "policy professional attuned to institutions, precedent, and regulatory design",
    project_developer:
      "project developer attentive to approvals, grid access, community and delivery risk",
    board_director:
      "board-level operator weighing fiduciary risk, capital allocation and reputational exposure",
    researcher:
      "researcher who cares about evidence quality, data novelty and methodology",
    general: "climate-literate professional observing the transition",
  };
  return map[role] ?? map.general;
}

function jurisdictionsToRegion(jurisdictions: string[]): string | null {
  if (!jurisdictions.length) return null;
  const lower = jurisdictions.map((j) => j.toLowerCase());
  const stateMap: Record<string, string> = {
    nsw: "Sydney / NSW",
    vic: "Melbourne / VIC",
    qld: "Brisbane / QLD",
    wa: "Perth / WA",
    sa: "Adelaide / SA",
    tas: "Hobart / TAS",
    nt: "Darwin / NT",
    act: "Canberra / ACT",
  };
  for (const j of lower) {
    if (stateMap[j]) return stateMap[j];
  }
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("eu")) return "Europe";
  if (lower.includes("usa") || lower.includes("us")) return "the US";
  return jurisdictions[0];
}

async function loadArticleContext(articleUrl: string): Promise<ArticleContext | null> {
  try {
    const { rows } = await pool.query<{
      id: string;
      title: string;
      source_name: string | null;
      snippet: string | null;
      sentiment: string | null;
      domain: string | null;
      entity_names: string[] | null;
    }>(
      `
      SELECT
        ra.id,
        ra.title,
        ra.source_name,
        ra.snippet,
        ea.sentiment::text AS sentiment,
        td.slug AS domain,
        ARRAY(
          SELECT e.canonical_name
          FROM article_entities ae
          JOIN entities e ON e.id = ae.entity_id
          WHERE ae.enriched_article_id = ea.id
          ORDER BY e.id
          LIMIT 5
        ) AS entity_names
      FROM raw_articles ra
      LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
      LEFT JOIN taxonomy_microsectors tm ON tm.id = ea.microsector_ids[1]
      LEFT JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
      LEFT JOIN taxonomy_domains td ON td.id = ts.domain_id
      WHERE ra.article_url = $1
      LIMIT 1
      `,
      [articleUrl]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      raw_article_id: row.id,
      headline: row.title,
      source_name: row.source_name,
      snippet: row.snippet,
      sentiment: row.sentiment,
      domain: row.domain,
      entities: row.entity_names ?? [],
    };
  } catch (err) {
    console.warn("[share/draft] loadArticleContext failed:", err);
    return null;
  }
}

async function loadPodcastContext(episodeId: string): Promise<PodcastContext | null> {
  try {
    const { rows } = await pool.query<{
      briefing_date: string;
      audio_url: string;
      script: { title?: string } | null;
    }>(
      `SELECT briefing_date::text, audio_url, script FROM podcast_episodes WHERE id = $1 LIMIT 1`,
      [episodeId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      title: row.script?.title ?? `ClimatePulse Daily — ${row.briefing_date}`,
      briefing_date: row.briefing_date,
      audio_url: row.audio_url,
    };
  } catch {
    return null;
  }
}

async function loadUserContext(userId: string | null): Promise<UserContext> {
  if (!userId) {
    return { role_lens: "general", primary_sectors: [], jurisdictions: [] };
  }
  try {
    const { rows } = await pool.query<{
      role_lens: string | null;
      primary_sectors: string[] | null;
      jurisdictions: string[] | null;
    }>(
      `SELECT role_lens, primary_sectors, jurisdictions FROM user_profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return { role_lens: "general", primary_sectors: [], jurisdictions: [] };
    return {
      role_lens: row.role_lens ?? "general",
      primary_sectors: row.primary_sectors ?? [],
      jurisdictions: row.jurisdictions ?? [],
    };
  } catch {
    return { role_lens: "general", primary_sectors: [], jurisdictions: [] };
  }
}

function buildArticlePrompt(article: ArticleContext, user: UserContext): string {
  const region = jurisdictionsToRegion(user.jurisdictions);
  const voice = roleVoice(user.role_lens);
  const sectors = user.primary_sectors.slice(0, 3).join(", ") || "(not set)";
  const entities = article.entities.slice(0, 4).join(", ") || "(none)";

  return [
    `You are drafting a short LinkedIn post on behalf of a user reacting to a climate / energy news story. Write in the user's own first-person voice — professional but personal, not a press release.`,
    ``,
    `HARD RULES`,
    `- Exactly two sentences. 45–85 words total.`,
    `- Sentence 1: an observational or reflective reaction — why this resonates, what it reminds them of, why it matters now. Use the region only if it fits naturally (e.g. "here in Sydney", "from an Australian vantage"). Do not force it.`,
    `- Sentence 2: one concrete, specific fact from the article (a number, timeline, decision or mechanism) followed by the flow-on implications relevant to the user's work.`,
    `- No hashtags, no emojis, no "via", no "Just read…", no "Interesting article…", no "Check this out".`,
    `- Do NOT include the article URL — the share link is appended separately.`,
    `- Do not start with the source name or the headline verbatim.`,
    ``,
    `USER CONTEXT`,
    `- Voice / role: ${user.role_lens} — ${voice}.`,
    `- Primary sectors: ${sectors}.`,
    `- Region: ${region ?? "unspecified — keep geographic voice neutral"}.`,
    ``,
    `ARTICLE`,
    `- Headline: ${article.headline}`,
    `- Source: ${article.source_name ?? "unknown"}`,
    `- Summary: ${article.snippet ?? "(no snippet available — infer from headline)"}`,
    `- Domain: ${article.domain ?? "unspecified"}`,
    `- Sentiment: ${article.sentiment ?? "neutral"}`,
    `- Key entities: ${entities}`,
    ``,
    `Return JSON: { "blurb": "<two sentences>" }`,
  ].join("\n");
}

function buildPodcastPrompt(episode: PodcastContext, user: UserContext): string {
  const region = jurisdictionsToRegion(user.jurisdictions);
  const voice = roleVoice(user.role_lens);
  const sectors = user.primary_sectors.slice(0, 3).join(", ") || "(not set)";

  return [
    `You are drafting a short LinkedIn post on behalf of a user sharing a daily climate podcast episode — "ClimatePulse Daily", a 5-minute two-speaker briefing covering the day's most significant climate and energy stories.`,
    ``,
    `HARD RULES`,
    `- Exactly two sentences. 35–70 words total.`,
    `- Sentence 1: why the user recommends listening — the format (short, two-speaker), or what they personally get out of it.`,
    `- Sentence 2: a hook about today's edition specifically (the date, or the transition-reality angle).`,
    `- No hashtags, no emojis, no "Just listened…", no "Check this out".`,
    `- Do NOT include the audio URL — the share link is appended separately.`,
    ``,
    `USER CONTEXT`,
    `- Voice / role: ${user.role_lens} — ${voice}.`,
    `- Primary sectors: ${sectors}.`,
    `- Region: ${region ?? "unspecified"}.`,
    ``,
    `EPISODE`,
    `- Title: ${episode.title}`,
    `- Date: ${episode.briefing_date}`,
    ``,
    `Return JSON: { "blurb": "<two sentences>" }`,
  ].join("\n");
}

function fallbackArticleBlurb(article: ArticleContext): string {
  return `Worth a read from today's ClimatePulse briefing. ${article.headline}${
    article.source_name ? ` — ${article.source_name}` : ""
  }.`;
}

function fallbackPodcastBlurb(episode: PodcastContext): string {
  return `Today's ClimatePulse Daily is live — a five-minute two-speaker briefing on the climate and energy stories that actually shifted the dial. The ${episode.briefing_date} edition has just dropped.`;
}

async function draftBlurb(prompt: string, fallback: string, startedAt: number): Promise<string> {
  if (!process.env.GOOGLE_AI_API_KEY) return fallback;
  // Flash-lite latency budget — don't let a slow call block the user.
  const timeoutMs = 3500;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: BLURB_SCHEMA,
        temperature: 0.75,
        maxOutputTokens: 400,
      },
    });

    const resPromise = model.generateContent(prompt);
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );
    const raced = await Promise.race([resPromise, timeout]);
    if (!raced) {
      console.warn(`[share/draft] Gemini timed out after ${Date.now() - startedAt}ms`);
      return fallback;
    }
    const text = raced.response.text();
    const parsed = JSON.parse(text) as { blurb?: string };
    const blurb = parsed.blurb?.trim();
    return blurb && blurb.length > 0 ? blurb : fallback;
  } catch (err) {
    console.warn("[share/draft] gemini failed:", err);
    return fallback;
  }
}

function buildShareUrl(
  kind: "story" | "podcast",
  params: {
    req: NextRequest;
    articleUrl?: string;
    episodeId?: string;
    target: string;
    refHash: string | null;
  }
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || params.req.nextUrl.origin;
  const url = new URL(kind === "story" ? "/share/story" : "/share/podcast", base);
  if (kind === "story" && params.articleUrl) {
    url.searchParams.set("u", params.articleUrl);
  }
  if (kind === "podcast" && params.episodeId) {
    url.searchParams.set("id", params.episodeId);
  }
  url.searchParams.set("utm_source", params.target);
  url.searchParams.set("utm_medium", "story_share");
  url.searchParams.set("utm_campaign", new Date().toISOString().slice(0, 10));
  if (params.refHash) url.searchParams.set("ref", params.refHash);
  return url.toString();
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: {
    article_url?: string;
    episode_id?: string;
    target?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const target = (body.target ?? "linkedin").toLowerCase();
  const articleUrl = body.article_url?.trim();
  const episodeId = body.episode_id?.trim();

  if (!articleUrl && !episodeId) {
    return NextResponse.json(
      { error: "article_url or episode_id required" },
      { status: 400 }
    );
  }

  // Validate article URL shape so this endpoint can't be used for arbitrary
  // embedding.
  if (articleUrl) {
    try {
      const parsed = new URL(articleUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "invalid url" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }
  }

  const user = await getAuthUser();
  const [userCtx, refHash] = await Promise.all([
    loadUserContext(user?.id ?? null),
    user ? getOrCreateRefHash(user.id) : Promise.resolve(null),
  ]);

  if (articleUrl) {
    const article = await loadArticleContext(articleUrl);
    const ctx: ArticleContext = article ?? {
      raw_article_id: null,
      headline: "",
      source_name: null,
      snippet: null,
      sentiment: null,
      domain: null,
      entities: [],
    };

    const share_url = buildShareUrl("story", {
      req,
      articleUrl,
      target,
      refHash,
    });

    // If we only have the bare URL (no enrichment), don't waste a Gemini call
    // on an empty prompt — return the fallback blurb immediately.
    if (!ctx.headline) {
      return NextResponse.json({
        blurb: "Worth a read from today's ClimatePulse briefing.",
        share_url,
        preview: null,
      });
    }

    const prompt = buildArticlePrompt(ctx, userCtx);
    const blurb = await draftBlurb(prompt, fallbackArticleBlurb(ctx), startedAt);

    return NextResponse.json({
      blurb,
      share_url,
      preview: {
        headline: ctx.headline,
        source_name: ctx.source_name,
        teaser: ctx.snippet,
        sentiment: ctx.sentiment,
        domain: ctx.domain,
      },
    });
  }

  // Podcast branch
  const episode = await loadPodcastContext(episodeId!);
  if (!episode) {
    return NextResponse.json({ error: "episode not found" }, { status: 404 });
  }

  const share_url = buildShareUrl("podcast", {
    req,
    episodeId: episodeId!,
    target,
    refHash,
  });

  const prompt = buildPodcastPrompt(episode, userCtx);
  const blurb = await draftBlurb(prompt, fallbackPodcastBlurb(episode), startedAt);

  return NextResponse.json({
    blurb,
    share_url,
    preview: {
      headline: episode.title,
      source_name: "ClimatePulse",
      teaser: null,
      sentiment: null,
      domain: "podcast",
    },
  });
}
