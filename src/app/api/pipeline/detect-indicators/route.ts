import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Detector calls Gemini Flash once per in-domain article (concurrency=3) over
// the last 24h of enriched_articles. Empirically ~150 articles/day → ~50s of
// wall time. 300s leaves headroom for slower Gemini days.
export const maxDuration = 300;

export const GET = (req: NextRequest) => handleStepCron(req, "detect_indicators");
export const POST = (req: NextRequest) => handleStepCron(req, "detect_indicators");
