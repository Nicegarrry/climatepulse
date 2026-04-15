import type { WeeklyDigest, WeeklyCuratedStory } from "@/lib/types";

interface EmailResult {
  sent: number;
}

// ─── Build HTML email ──────────────────────────────────────────────────────

function buildEmailHtml(digest: WeeklyDigest): string {
  const stories = digest.curated_stories || [];
  const weekRange = formatWeekRange(digest.week_start, digest.week_end);
  const narrativeExcerpt = digest.editor_narrative
    .split("\n\n")
    .slice(0, 2)
    .join("\n\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Weekly Pulse — ${digest.headline}</title>
  <style>
    body { font-family: 'Georgia', serif; color: #1A1A1A; background: #FAF9F7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 20px; }
    .header { border-bottom: 2px solid #1E4D2B; padding-bottom: 16px; margin-bottom: 20px; }
    .week-range { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8C8C8C; font-family: sans-serif; }
    .headline { font-size: 24px; font-weight: 400; line-height: 1.25; margin: 8px 0 0; }
    .number-card { background: #F5EEF5; border-top: 2px solid #3D1F3D; border-radius: 6px; padding: 14px 16px; margin: 16px 0; }
    .number-value { font-size: 28px; color: #3D1F3D; font-weight: 300; }
    .number-unit { font-size: 13px; color: #6B4A6B; margin-left: 4px; }
    .number-label { font-size: 12px; color: #5C5C5C; margin-top: 4px; }
    .narrative { font-size: 15px; line-height: 1.65; color: #1A1A1A; margin: 16px 0; }
    .story { border-left: 2px solid #E8E5E0; padding: 8px 0 8px 14px; margin: 10px 0; }
    .story-sector { font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: #8C8C8C; font-family: sans-serif; font-weight: 700; }
    .story-headline { font-size: 14px; font-weight: 500; margin: 4px 0; }
    .story-take { font-size: 13px; color: #5C5C5C; line-height: 1.5; }
    .cta { display: inline-block; background: #1E4D2B; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-family: sans-serif; font-size: 13px; font-weight: 500; margin: 16px 0; }
    .footer { border-top: 1px solid #E8E5E0; padding-top: 12px; margin-top: 24px; font-size: 11px; color: #8C8C8C; font-family: sans-serif; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="week-range">${weekRange} &middot; The Weekly Pulse</div>
      <h1 class="headline">${escapeHtml(digest.headline)}</h1>
    </div>

    ${digest.weekly_number ? `
    <div class="number-card">
      <span class="number-value">${escapeHtml(digest.weekly_number.value)}</span>
      <span class="number-unit">${escapeHtml(digest.weekly_number.unit)}</span>
      <div class="number-label">${escapeHtml(digest.weekly_number.label)}</div>
    </div>` : ""}

    <div class="narrative">${narrativeExcerpt.split("\n\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>

    <div style="margin: 20px 0;">
      <div class="week-range" style="margin-bottom: 10px;">This Week's Stories</div>
      ${stories.slice(0, 6).map((s: WeeklyCuratedStory) => `
      <div class="story">
        <div class="story-sector">${escapeHtml(s.sector)} &middot; ${escapeHtml(s.source)}</div>
        <div class="story-headline">${escapeHtml(s.headline)}</div>
        <div class="story-take">${escapeHtml(s.editor_take)}</div>
      </div>`).join("")}
    </div>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://climatepulse.app"}/dashboard" class="cta">
      Read the full digest &rarr;
    </a>

    <div class="footer">
      <p>You're receiving this because you subscribed to The Weekly Pulse from Climate Pulse.</p>
      <p>To unsubscribe, update your preferences in the app.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const startStr = start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} \u2013 ${endStr}`;
}

// ─── Send via Resend ───────────────────────────────────────────────────────

export async function sendWeeklyDigestEmail(
  digest: WeeklyDigest
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return { sent: 0 };
  }

  const html = buildEmailHtml(digest);

  // For testing: send to a single address
  const testEmail = process.env.DIGEST_TEST_EMAIL || "delivered@resend.dev";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Weekly Pulse <digest@climatepulse.app>",
      to: [testEmail],
      subject: `The Weekly Pulse: ${digest.headline}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} ${errorText}`);
  }

  console.log(`Weekly digest email sent to ${testEmail}`);
  return { sent: 1 };
}
