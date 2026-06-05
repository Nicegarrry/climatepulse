"use client";

// Dedicated "Research" tab. Wraps the self-contained ResearchPanel (corpus
// Q&A over the intelligence index) that used to live inline at the bottom of
// the Briefing tab. Pulling it out keeps the daily briefing focused and gives
// research its own home. The panel brings its own card styling, so this is
// just a centred page container.

import { ResearchPanel } from "@/components/intelligence/research-panel";

export default function ResearchTab() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ResearchPanel />
    </div>
  );
}
