// Server-side data fetchers for the launchpad triptych.
// Each helper returns null on failure so the page can render gracefully.

import pool from "@/lib/db";
import type { LiveState } from "./live-tile";

/* ── Pipeline / ingestion ─────────────────────────────────────────── */

export async function getOvernightIngestCount(): Promise<number | null> {
  try {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM raw_articles
        WHERE fetched_at > NOW() - INTERVAL '24 hours'`,
    );
    const n = Number(rows[0]?.n ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/* ── User profile (extra fields beyond auth-context) ──────────────── */

export type LaunchpadProfile = {
  id: string;
  name: string | null;
  role: string;
  tier: string;
  onboarded_at: string | null;
  primary_sectors: string[] | null;
};

export async function getLaunchpadProfile(
  userId: string,
): Promise<LaunchpadProfile | null> {
  try {
    const { rows } = await pool.query<LaunchpadProfile>(
      `SELECT
         id,
         name,
         user_role AS role,
         COALESCE(tier, 'free') AS tier,
         onboarded_at,
         primary_sectors
       FROM user_profiles
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/* ── Today's briefing existence ───────────────────────────────────── */

export async function hasBriefingToday(userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM daily_briefings
          WHERE user_id = $1
            AND date = CURRENT_DATE
       ) AS exists`,
      [userId],
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

/* ── Newsroom item count (last 24h) ───────────────────────────────── */

export async function getNewsroomCount(): Promise<number | null> {
  try {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM raw_articles
        WHERE COALESCE(published_at, fetched_at) > NOW() - INTERVAL '24 hours'`,
    );
    const n = Number(rows[0]?.n ?? 0);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/* ── Latest published Weekly Pulse ────────────────────────────────── */

export type LaunchpadWeekly = {
  id: string;
  week_start: string;
  headline: string;
  editor_narrative: string | null;
  published_at: string;
  edition_number: number | null;
};

export async function getLatestWeekly(): Promise<LaunchpadWeekly | null> {
  try {
    const { rows } = await pool.query<LaunchpadWeekly>(
      `WITH ordered AS (
         SELECT id, week_start, headline, editor_narrative, published_at,
                ROW_NUMBER() OVER (ORDER BY published_at ASC) AS edition_number
           FROM weekly_digests
          WHERE status = 'published'
            AND published_at IS NOT NULL
       )
       SELECT *
         FROM ordered
        ORDER BY published_at DESC
        LIMIT 1`,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/* ── NEM live snapshot ────────────────────────────────────────────── */

export type LiveSnapshot = {
  states: LiveState[];
  renewablesPct: number;
  isSample: boolean;
};

const SAMPLE_SNAPSHOT: LiveSnapshot = {
  renewablesPct: 64,
  isSample: true,
  states: [
    { code: "NSW", price: 38.20, mix: 61 },
    { code: "VIC", price: 41.10, mix: 72 },
    { code: "QLD", price: 47.80, mix: 51 },
    { code: "SA", price: 35.60, mix: 88 },
    { code: "TAS", price: 28.20, mix: 99 },
  ],
};

/**
 * Tries to fetch live NEM data via the existing internal API.
 * Falls back to a deterministic sample snapshot if anything goes wrong —
 * the tile is decorative and we never want to block the launchpad on it.
 */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  try {
    const { fetchEnergyDashboard } = await import(
      "@/lib/energy/openelectricity"
    );
    const data = await fetchEnergyDashboard();
    if (!data || data.error) return SAMPLE_SNAPSHOT;

    const wanted = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"];
    const stateMap = new Map(
      data.state_snapshots.map((s) => [s.region, s.renewable_pct]),
    );
    const priceMap = new Map(
      data.price_summaries.map((p) => [p.region, p.latest_price]),
    );

    const states: LiveState[] = wanted.map((region) => {
      const code = region.replace(/1$/, "");
      const mix = stateMap.get(region);
      const price = priceMap.get(region);
      return {
        code,
        price: typeof price === "number" ? price : 0,
        mix: typeof mix === "number" ? mix : 0,
      };
    });

    // Reject the result if we got nothing useful — render sample instead.
    const anyMix = states.some((s) => s.mix > 0);
    if (!anyMix) return SAMPLE_SNAPSHOT;

    return {
      states,
      renewablesPct: data.renewable_pct_today || data.renewable_pct_7d || 0,
      isSample: false,
    };
  } catch {
    return SAMPLE_SNAPSHOT;
  }
}

/* ── Time/date stamps in AEST ─────────────────────────────────────── */

export function formatAESTStamps(now = new Date()): {
  time: string; // "05:47 AEST"
  date: string; // "Tuesday · 12 May 2026"
} {
  const tz = "Australia/Sydney";
  const time =
    new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now) + " AEST";

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("weekday")} · ${get("day")} ${get("month")} ${get("year")}`;

  return { time, date };
}
