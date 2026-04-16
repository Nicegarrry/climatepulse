import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Enrichment drains whatever backlog exists, so give it the full Vercel Pro
// serverless ceiling (800s ≈ 13m 20s). The internal budget in step3Enrich is
// capped at 12 minutes so in-flight Gemini batches can finish cleanly.
export const maxDuration = 800;

export const GET = (req: NextRequest) => handleStepCron(req, "enrichment");
export const POST = (req: NextRequest) => handleStepCron(req, "enrichment");
