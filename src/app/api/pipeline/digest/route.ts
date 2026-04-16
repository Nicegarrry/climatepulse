import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Claude Sonnet + optional web-search pre-pass runs per user. 300s covers
// a few dozen users comfortably.
export const maxDuration = 300;

export const GET = (req: NextRequest) => handleStepCron(req, "digest");
export const POST = (req: NextRequest) => handleStepCron(req, "digest");
