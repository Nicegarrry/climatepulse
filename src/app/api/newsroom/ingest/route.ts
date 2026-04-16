import { NextRequest, NextResponse } from "next/server";
import { runNewsroomIngest } from "@/lib/newsroom/run";

// Allow up to the platform default (300s on Fluid Compute). Steady-state
// runs are sub-15s; the higher ceiling protects rare backfills where the
// 100-article-per-run cap is fully exercised.
export const maxDuration = 300;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  // ?force=1 lets us run the pipeline outside Sydney business hours for
  // local testing or one-off backfills.
  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const summary = await runNewsroomIngest({
      trigger: "cron",
      ignoreBusinessHours: force,
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[newsroom/ingest] fatal:", err);
    return NextResponse.json(
      {
        error: "ingest failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
