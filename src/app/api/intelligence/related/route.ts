import { NextRequest, NextResponse } from "next/server";
import { findRelatedContent } from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";

const VALID_CONTENT_TYPES: ContentType[] = [
  "article",
  "podcast",
  "daily_digest",
  "weekly_digest",
  "weekly_report",
  "report_pdf",
  "youtube_transcript",
  "learn_content",
];

export async function GET(req: NextRequest) {
  try {
    const sourceId = req.nextUrl.searchParams.get("id");
    // Default content_type is "article" for backward compatibility
    const contentTypeParam = (req.nextUrl.searchParams.get("type") ?? "article") as ContentType;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10");

    if (!sourceId) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }

    if (!VALID_CONTENT_TYPES.includes(contentTypeParam)) {
      return NextResponse.json(
        { error: `invalid content type: ${contentTypeParam}` },
        { status: 400 }
      );
    }

    const related = await findRelatedContent(contentTypeParam, sourceId, {
      limit: Math.min(limit, 20),
    });

    return NextResponse.json({
      source_id: sourceId,
      content_type: contentTypeParam,
      related: related.map((item) => ({
        content_type: item.content_type,
        source_id: item.source_id,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        published_at: item.published_at,
        primary_domain: item.primary_domain,
        signal_type: item.signal_type,
        significance_composite: item.significance_composite,
        similarity: Math.round(item.similarity * 1000) / 1000,
      })),
    });
  } catch (err) {
    console.error("Related content error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to find related content" },
      { status: 500 }
    );
  }
}
