import crypto from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "@/lib/db";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import { logGeneration } from "@/lib/learn/cost-tracker";
import {
  BlockType,
  type BlockGenerationResult,
} from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

interface ArticleSubstrate {
  id: string;
  content_hash: string;
}

interface GenerateBlockOpts {
  microsectorSlug: string;
  microsectorName: string;
  primaryDomain: string | null;
  articles: ArticleSubstrate[];
  promptVars?: Record<string, string>;
}

const STRUCTURED_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  BlockType.KeyMechanisms,
  BlockType.Watchlist,
  BlockType.AustralianContext,
]);

function computeInputHash(articles: ArticleSubstrate[]): string {
  const sorted = [...articles].sort((a, b) => a.id.localeCompare(b.id));
  const payload = sorted.map((a) => `${a.id}:${a.content_hash}`).join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function computeContentHash(body: string | null, bodyJson: unknown): string {
  const raw = JSON.stringify({ body: body ?? "", bodyJson: bodyJson ?? null });
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Generate (or skip) a single block for a microsector brief.
 *
 * - nicks_lens is schema + code-enforced manual-only; throws if attempted.
 * - related is derived SQL-side (taxonomy + co-mentions), not LLM — skipped here.
 * - Short-circuits via input-hash match; writes to microsector_brief_blocks
 *   with editorial_status='ai_drafted' and increments version.
 */
export async function generateBlock(
  briefId: string,
  blockType: BlockType,
  opts: GenerateBlockOpts,
): Promise<BlockGenerationResult> {
  if (blockType === BlockType.NicksLens) {
    throw new Error(
      "[block-generator] nicks_lens is manual-only; use the editorial UI to author.",
    );
  }
  if (blockType === BlockType.Related) {
    // SQL-derived: implemented in a separate helper (Phase 3).
    return { skipped: "related_derived_not_generated" };
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("[block-generator] GOOGLE_AI_API_KEY not set");
  }

  const start = Date.now();
  const inputHash = computeInputHash(opts.articles);

  const { rows: existing } = await pool.query<{
    last_input_hash: string | null;
    version: number;
  }>(
    `SELECT last_input_hash, version
       FROM microsector_brief_blocks
       WHERE brief_id = $1 AND block_type = $2`,
    [briefId, blockType],
  );

  if (existing.length > 0 && existing[0].last_input_hash === inputHash) {
    return { skipped: "inputs_unchanged" };
  }

  const templatePath = `learn/brief-blocks/${blockType}.md`;
  const template = await loadPrompt(templatePath);

  const articleContext = opts.articles
    .map((a, i) => `[${i + 1}] article_id=${a.id}`)
    .join("\n");

  const systemPrompt = assemblePrompt(template, {
    MICROSECTOR_SLUG: opts.microsectorSlug,
    MICROSECTOR_NAME: opts.microsectorName,
    PRIMARY_DOMAIN: opts.primaryDomain ?? "unknown",
    ARTICLE_COUNT: String(opts.articles.length),
    ARTICLE_IDS: articleContext,
    ...(opts.promptVars ?? {}),
  });

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let inputTokens = 0;
  let outputTokens = 0;
  let rawText: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(systemPrompt);
      rawText = response.response.text();
      const usage = response.response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? 0;
      outputTokens = usage?.candidatesTokenCount ?? 0;
      if (rawText) break;
    } catch (err) {
      console.error(
        `[block-generator] attempt ${attempt + 1} failed for ${blockType}:`,
        err,
      );
    }
  }

  if (!rawText) {
    throw new Error(
      `[block-generator] generation failed after 2 attempts for brief=${briefId} block=${blockType}`,
    );
  }

  let body: string | null = null;
  let bodyJson: Record<string, unknown> | null = null;

  if (STRUCTURED_BLOCK_TYPES.has(blockType)) {
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      bodyJson = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      body = rawText;
      console.warn(
        `[block-generator] JSON parse failed for ${blockType} — stored as text for reviewer`,
      );
    }
  } else {
    body = rawText;
  }

  const contentHash = computeContentHash(body, bodyJson);
  const durationMs = Date.now() - start;
  const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

  const { rows: upserted } = await pool.query<{ id: string }>(
    `INSERT INTO microsector_brief_blocks
       (brief_id, block_type, body, body_json, cadence_policy,
        last_generated_at, last_input_hash, content_hash,
        editorial_status, version)
     VALUES ($1, $2, $3, $4::jsonb, 'manual',
             NOW(), $5, $6, 'ai_drafted', $7)
     ON CONFLICT (brief_id, block_type) DO UPDATE SET
       body              = EXCLUDED.body,
       body_json         = EXCLUDED.body_json,
       last_generated_at = NOW(),
       last_input_hash   = EXCLUDED.last_input_hash,
       content_hash      = EXCLUDED.content_hash,
       editorial_status  = 'ai_drafted',
       version           = microsector_brief_blocks.version + 1,
       updated_at        = NOW()
     RETURNING id`,
    [
      briefId,
      blockType,
      body,
      bodyJson !== null ? JSON.stringify(bodyJson) : null,
      inputHash,
      contentHash,
      nextVersion,
    ],
  );

  await logGeneration({
    module: "learn-brief",
    stage: blockType,
    inputTokens,
    outputTokens,
    durationMs,
    itemsProcessed: opts.articles.length,
    model: "gemini-flash",
  });

  return {
    blockId: upserted[0].id,
    briefId,
    blockType,
    inputHash,
    inputTokens,
    outputTokens,
    durationMs,
    version: nextVersion,
  };
}
