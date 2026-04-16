import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Hard 3-minute internal budget in step2FullText; 300s Vercel ceiling is plenty.
export const maxDuration = 300;

export const GET = (req: NextRequest) => handleStepCron(req, "fulltext");
export const POST = (req: NextRequest) => handleStepCron(req, "fulltext");
