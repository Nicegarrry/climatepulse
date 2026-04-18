import { LEADS, DAILY_NUMBER, TODAYS_READ } from "@/lib/mock-editorial";

/**
 * Static preview of a ClimatePulse briefing — rendered read-only on the
 * landing page so prospective users can see what they'll get without
 * signing in. Shape mirrors the real Intelligence tab at a high level
 * but intentionally simplified (no interactions, no sidebar).
 */
export function SampleBriefing() {
  // Show 3 leads — enough to convey the editorial voice without becoming a wall of text.
  const leads = LEADS.slice(0, 3);

  return (
    <div
      id="sample-briefing"
      className="scroll-mt-20 overflow-hidden rounded-lg border border-[#E8E5E0] bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:rounded-xl"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-[#E8E5E0] bg-[#F5F3F0] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[#1E4D2B]" />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5C5C]"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            Sample briefing · Friday 18 April 2026
          </span>
        </div>
        <span
          className="hidden text-[10px] uppercase tracking-[0.14em] text-[#8C8C8C] sm:inline"
          style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
        >
          5 min read
        </span>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_220px] md:gap-10">
        {/* Main column */}
        <div className="min-w-0">
          {/* Today's read */}
          <div className="mb-8">
            <div
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E4D2B]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              Today&rsquo;s read
            </div>
            <p
              className="text-[18px] leading-relaxed text-[#1A1A1A] sm:text-[20px]"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 400 }}
            >
              {TODAYS_READ}
            </p>
          </div>

          {/* Lead stories */}
          <div className="space-y-8 border-t border-[#F0EEEA] pt-7">
            {leads.map((story, idx) => (
              <article key={story.id}>
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A1A1A]"
                    style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                  >
                    {String(idx + 1).padStart(2, "0")} · {story.sector}
                  </span>
                  {story.severity === "alert" && (
                    <span className="inline-flex h-[18px] items-center rounded-sm bg-[#1A1A1A] px-1.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Alert
                    </span>
                  )}
                </div>
                <h3
                  className="mb-2 text-[20px] font-semibold leading-tight text-[#1A1A1A] sm:text-[22px]"
                  style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 600 }}
                >
                  {story.headline}
                </h3>
                <p
                  className="text-[15px] leading-relaxed text-[#5C5C5C] sm:text-[16px]"
                  style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                >
                  {story.summary}
                </p>
                {story.number && (
                  <div className="mt-3 flex items-baseline gap-2 text-[#3D1F3D]">
                    <span
                      className="text-[22px] font-light leading-none tabular-nums"
                      style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                    >
                      {story.number}
                      {story.unit && (
                        <span className="ml-0.5 text-[14px] text-[#6B4A6B]">{story.unit}</span>
                      )}
                    </span>
                    {story.trend && (
                      <span className="text-[11px] text-[#8C8C8C]" style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
                        {story.trend}
                      </span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        {/* Sidebar — Daily Number */}
        <aside className="md:border-l md:border-[#F0EEEA] md:pl-10">
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3D1F3D]"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            Daily number
          </div>
          <div className="flex items-baseline gap-2 text-[#3D1F3D]">
            <span
              className="text-[44px] font-light leading-none tabular-nums tracking-tight"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 300 }}
            >
              {DAILY_NUMBER.value}
            </span>
            <span
              className="text-[18px] text-[#6B4A6B]"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 300 }}
            >
              {DAILY_NUMBER.unit}
            </span>
          </div>
          <div
            className="mt-2 text-[12px] uppercase tracking-[0.1em] text-[#5C5C5C]"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontWeight: 600 }}
          >
            {DAILY_NUMBER.change} {DAILY_NUMBER.changeLabel}
          </div>
          <p
            className="mt-3 text-[13px] leading-relaxed text-[#5C5C5C]"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            {DAILY_NUMBER.label}. {DAILY_NUMBER.context}
          </p>
          <div className="mt-4 border-t border-[#F0EEEA] pt-3 text-[10px] uppercase tracking-wider text-[#8C8C8C]">
            Source · {DAILY_NUMBER.source}
          </div>
        </aside>
      </div>

      {/* Footer strip */}
      <div className="border-t border-[#E8E5E0] bg-[#F5F3F0]/60 px-5 py-3 text-center">
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-[#8C8C8C]"
          style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
        >
          Sample content · Your briefing is personalised to the sectors you pick
        </span>
      </div>
    </div>
  );
}
