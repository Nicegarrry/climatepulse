import { config } from "dotenv";
config({ path: ".env.local" });

import { generateWeeklyReport } from "../src/lib/weekly/generate";

const weekStart = process.argv[2];
generateWeeklyReport(weekStart)
  .then((r) => {
    console.log("\n✔ Weekly report generated:");
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n✖ Generation failed:", err);
    process.exit(1);
  });
