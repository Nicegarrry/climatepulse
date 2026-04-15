import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { sendWeeklyDigestEmail } from "@/lib/weekly/email-sender";

export const maxDuration = 60;

// POST /api/weekly/digests/[id]/publish
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Load digest and verify it's a draft
    const { rows } = await pool.query(
      "SELECT * FROM weekly_digests WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    const digest = rows[0];
    if (digest.status === "published") {
      return NextResponse.json({ error: "Digest is already published" }, { status: 400 });
    }

    // Generate LinkedIn draft
    let linkedinDraft: string | null = null;
    try {
      linkedinDraft = await generateLinkedInDraft(digest);
    } catch (err) {
      console.warn("LinkedIn draft generation failed:", err);
    }

    // Publish: update status + timestamps
    const bannerExpires = new Date();
    bannerExpires.setHours(bannerExpires.getHours() + 48);

    await pool.query(
      `UPDATE weekly_digests SET
        status = 'published',
        published_at = NOW(),
        banner_expires_at = $2,
        linkedin_draft = $3,
        updated_at = NOW()
      WHERE id = $1`,
      [id, bannerExpires.toISOString(), linkedinDraft]
    );

    // Send email if RESEND_API_KEY is configured
    let emailResult = { sent: 0 };
    if (process.env.RESEND_API_KEY) {
      try {
        emailResult = await sendWeeklyDigestEmail({
          ...digest,
          status: "published",
          published_at: new Date().toISOString(),
        });
        await pool.query(
          "UPDATE weekly_digests SET email_sent_at = NOW(), email_recipient_count = $2 WHERE id = $1",
          [id, emailResult.sent]
        );
      } catch (err) {
        console.warn("Email send failed:", err);
      }
    }

    return NextResponse.json({
      published: true,
      digest_id: id,
      banner_expires_at: bannerExpires.toISOString(),
      linkedin_draft: linkedinDraft,
      emails_sent: emailResult.sent,
    });
  } catch (err) {
    console.error("Weekly digest publish:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── LinkedIn draft generation ─────────────────────────────────────────────

async function generateLinkedInDraft(digest: {
  headline: string;
  editor_narrative: string;
  curated_stories: string; // JSONB comes as string from pg
  weekly_number?: string;
}): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const stories = typeof digest.curated_stories === "string"
    ? JSON.parse(digest.curated_stories)
    : digest.curated_stories;

  const topStories = stories.slice(0, 3).map(
    (s: { headline: string; editor_take: string }) =>
      `- ${s.headline}: ${s.editor_take}`
  ).join("\n");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `Write a LinkedIn post (under 250 words) for a weekly climate/energy newsletter called "The Weekly Pulse".

Headline: ${digest.headline}
Editorial excerpt: ${digest.editor_narrative.slice(0, 500)}
Top stories:
${topStories}

The tone should be professional but opinionated — this is an expert sharing their weekly analysis. End with a CTA to read the full digest. Do NOT use hashtags. Do NOT use emojis.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
