// Server-side data fetchers for the launchpad triptych.
// Each helper returns null on failure so the page can render gracefully.

import pool from "@/lib/db";

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
            AND date = (NOW() AT TIME ZONE 'Australia/Sydney')::date
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

/* ── NEM intraday "duck curve" (generation stack + price) ─────────── */

export type DuckFuel = { key: string; label: string; color: string };

export type DuckCurve = {
  timestamps: string[];
  generation: Record<string, number[]>; // fueltech key -> MW per timestamp
  price: number[]; // $/MWh per timestamp
  fueltechs: DuckFuel[]; // largest-total first; rendered bottom-to-top
  renewablesPct: number;
  isSample: boolean;
};

const RENEWABLE_FUELS = new Set(["solar", "wind", "hydro", "bioenergy"]);

// Deterministic 24h sample with the classic duck shape: a midday solar bulge
// that pushes spot prices down, then an evening peak as it sets. Used whenever
// the live feed is unavailable — the tile is decorative and must never block
// the launchpad render.
function buildSampleCurve(): DuckCurve {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const timestamps = hours.map(
    (h) => `2026-06-02T${h.toString().padStart(2, "0")}:00:00+10:00`,
  );
  const solar = (h: number) => {
    if (h < 6 || h > 19) return 0;
    const x = (h - 12.5) / 3.2; // bell centred just after noon
    return Math.round(Math.exp(-x * x) * 11800);
  };
  const evening = (h: number) => (h >= 17 && h <= 20 ? 1 : 0);
  const generation: Record<string, number[]> = {
    coal: hours.map((h) => Math.round(12000 - solar(h) * 0.35 + evening(h) * 1200)),
    gas: hours.map((h) => 1500 + evening(h) * 2600 + (h < 6 ? 400 : 0)),
    hydro: hours.map((h) => 1400 + evening(h) * 1500),
    wind: hours.map((h) => 3200 + Math.round(2200 * Math.sin(h / 2.3 + 1))),
    solar: hours.map(solar),
  };
  const price = hours.map((h) => {
    if (h >= 10 && h <= 14) return Math.round(-8 + (h - 12) * (h - 12) * 6); // midday dip
    if (h >= 17 && h <= 19) return Math.round(150 + (18 - Math.abs(18 - h)) * 12); // evening spike
    if (h < 6) return 42;
    return 70;
  });
  return {
    timestamps,
    generation,
    price,
    fueltechs: [
      { key: "coal", label: "Coal", color: "#57534E" },
      { key: "gas", label: "Gas", color: "#EF4444" },
      { key: "hydro", label: "Hydro", color: "#06B6D4" },
      { key: "wind", label: "Wind", color: "#3B82F6" },
      { key: "solar", label: "Solar", color: "#F59E0B" },
    ],
    renewablesPct: 64,
    isSample: true,
  };
}

const SAMPLE_CURVE = buildSampleCurve();

function computeRenewablePct(curve: Omit<DuckCurve, "renewablesPct" | "isSample">): number {
  let renew = 0;
  let total = 0;
  for (const ft of curve.fueltechs) {
    const base = ft.key.replace(/^(energy|power)_/, "");
    const sum = (curve.generation[ft.key] ?? []).reduce((s, v) => s + Math.max(v ?? 0, 0), 0);
    total += sum;
    if (RENEWABLE_FUELS.has(base)) renew += sum;
  }
  return total > 0 ? Math.round((renew / total) * 100) : 0;
}

/**
 * Pulls the intraday generation-stack + price ("duck curve") from the same
 * energy-dashboard fetch the rest of the app uses — a snippet of the chart on
 * /dashboard?tab=energy. Falls back to a deterministic sample whenever the
 * live feed isn't available, so the launchpad never blocks on it.
 */
export async function getDuckCurve(): Promise<DuckCurve> {
  try {
    const { fetchEnergyDashboard } = await import("@/lib/energy/openelectricity");
    const data = await fetchEnergyDashboard();
    const intraday = data?.intraday;
    if (!data || data.error || !intraday || intraday.timestamps.length < 2) {
      return SAMPLE_CURVE;
    }

    // fetchEnergyDashboard already orders fueltechs largest-total first; keep a
    // defensive sort so baseload stacks at the base and solar rides on top.
    const total = (key: string) =>
      (intraday.generation[key] ?? []).reduce((s, v) => s + Math.max(v ?? 0, 0), 0);
    const fueltechs = [...intraday.fueltechs].sort((a, b) => total(b.key) - total(a.key));

    const base = {
      timestamps: intraday.timestamps,
      generation: intraday.generation,
      price: intraday.price,
      fueltechs,
    };

    return {
      ...base,
      renewablesPct:
        data.renewable_pct_today || data.renewable_pct_7d || computeRenewablePct(base),
      isSample: false,
    };
  } catch {
    return SAMPLE_CURVE;
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
