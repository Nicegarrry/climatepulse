import { NextRequest, NextResponse } from "next/server";
import { discoverThemes } from "@/lib/intelligence/retriever";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      date_from,
      date_to,
      min_articles = 3,
    } = body as {
      date_from: string;
      date_to: string;
      min_articles?: number;
    };

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: "date_from and date_to are required" },
        { status: 400 }
      );
    }

    const themes = await discoverThemes(date_from, date_to, min_articles);

    return NextResponse.json({
      date_from,
      date_to,
      theme_count: themes.length,
      themes,
    });
  } catch (err) {
    console.error("Theme discovery error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Theme discovery failed" },
      { status: 500 }
    );
  }
}
