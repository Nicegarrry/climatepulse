import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { runAemoGridMixScraper } from "@/lib/indicators/scrapers/aemo-grid-mix";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  console.log(
    `[scraper:aemo_grid_mix] Starting (trigger=${isCron ? "cron" : "manual"})`
  );
  const result = await runAemoGridMixScraper();
  const httpStatus = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status: httpStatus });
}

export const GET = (req: NextRequest) => handle(req);
export const POST = (req: NextRequest) => handle(req);
