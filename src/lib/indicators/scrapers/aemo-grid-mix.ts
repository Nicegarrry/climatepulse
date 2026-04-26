import pool from "@/lib/db";
import { fetchEnergyDashboard } from "@/lib/energy/openelectricity";

const SCRAPER_ID = "aemo_grid_mix";
const SOURCE_URL = "https://api.openelectricity.org.au/";

export interface ScraperResult {
  status: "completed" | "failed";
  rows_written: number;
  error?: string;
  details: { indicator_slug: string; value: number; written: boolean; reason?: string }[];
}

// Insert one indicator_value row per indicator we successfully extract.
// Uses (indicator_id, observed_at) as a soft idempotency key — re-runs on the
// same calendar day update once and skip subsequent insertions.
async function writeIfNew(
  indicatorSlug: string,
  value: number,
  unit: string,
  observedAt: string
): Promise<{ written: boolean; reason?: string }> {
  const { rows: ind } = await pool.query<{ id: string; unit: string; geography: string }>(
    `SELECT id, unit, geography FROM indicators WHERE slug = $1`,
    [indicatorSlug]
  );
  if (ind.length === 0) return { written: false, reason: "indicator not in catalogue" };
  const indicator = ind[0];

  // Skip if we already wrote a row for this indicator on this calendar day.
  const dup = await pool.query(
    `SELECT 1 FROM indicator_values
     WHERE indicator_id = $1
       AND source_type = 'scraper'
       AND source_scraper = $2
       AND observed_at::date = $3::date
     LIMIT 1`,
    [indicator.id, SCRAPER_ID, observedAt.slice(0, 10)]
  );
  if (dup.rows.length > 0) return { written: false, reason: "already written today" };

  await pool.query(
    `INSERT INTO indicator_values (
       indicator_id, value, unit, geography, observed_at,
       source_type, source_scraper, source_url, confidence
     ) VALUES ($1, $2, $3, $4, $5, 'scraper', $6, $7, 1.0)`,
    [indicator.id, value, indicator.unit, indicator.geography, observedAt, SCRAPER_ID, SOURCE_URL]
  );
  return { written: true };
}

export async function runAemoGridMixScraper(): Promise<ScraperResult> {
  const { rows: runRows } = await pool.query<{ id: string }>(
    `INSERT INTO scraper_runs (scraper, status) VALUES ($1, 'running') RETURNING id`,
    [SCRAPER_ID]
  );
  const runId = runRows[0].id;

  try {
    const dashboard = await fetchEnergyDashboard();
    if (dashboard.error) {
      throw new Error(dashboard.error);
    }

    const observedAt = dashboard.fetched_at;
    const details: ScraperResult["details"] = [];

    // 1. Renewables share — use the 7-day rolling avg to match the catalogue
    //    description ("rolling avg").
    if (Number.isFinite(dashboard.renewable_pct_7d) && dashboard.renewable_pct_7d > 0) {
      const w = await writeIfNew(
        "grid_renewables_share_au",
        dashboard.renewable_pct_7d,
        "%",
        observedAt
      );
      details.push({
        indicator_slug: "grid_renewables_share_au",
        value: dashboard.renewable_pct_7d,
        ...w,
      });
    }

    // 2. Emissions intensity — present when the API returns it.
    if (
      typeof dashboard.emissions_intensity === "number" &&
      Number.isFinite(dashboard.emissions_intensity) &&
      dashboard.emissions_intensity > 0
    ) {
      const w = await writeIfNew(
        "grid_emissions_intensity_au",
        dashboard.emissions_intensity,
        "gCO2/kWh",
        observedAt
      );
      details.push({
        indicator_slug: "grid_emissions_intensity_au",
        value: dashboard.emissions_intensity,
        ...w,
      });
    }

    const written = details.filter((d) => d.written).length;

    await pool.query(
      `UPDATE scraper_runs
       SET status = 'completed', completed_at = NOW(), rows_written = $1, metadata = $2::jsonb
       WHERE id = $3`,
      [written, JSON.stringify({ details }), runId]
    );

    return { status: "completed", rows_written: written, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE scraper_runs
       SET status = 'failed', completed_at = NOW(), error = $1
       WHERE id = $2`,
      [message, runId]
    );
    return { status: "failed", rows_written: 0, error: message, details: [] };
  }
}
