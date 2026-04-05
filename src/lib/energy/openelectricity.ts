import { OpenElectricityClient } from "@openelectricity/client";
import type {
  DataInterval,
  ITimeSeriesResult,
} from "@openelectricity/client";

function getClient() {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) throw new Error("OPENELECTRICITY_API_KEY not set in .env.local");
  return new OpenElectricityClient({ apiKey });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function sumSeries(results: ITimeSeriesResult[], nameFilter?: (name: string) => boolean): number {
  return results
    .filter((r) => !nameFilter || nameFilter(r.name))
    .reduce((sum, r) => {
      const total = r.data.reduce((s, [, v]) => s + (v ?? 0), 0);
      return sum + total;
    }, 0);
}

function latestValue(results: ITimeSeriesResult[], nameFilter?: (name: string) => boolean): number | null {
  for (const r of results) {
    if (nameFilter && !nameFilter(r.name)) continue;
    for (let i = r.data.length - 1; i >= 0; i--) {
      if (r.data[i][1] !== null) return r.data[i][1];
    }
  }
  return null;
}

function formatDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

const RENEWABLE_FUELTECHS = new Set([
  "solar_utility", "solar_rooftop", "solar_thermal", "solar",
  "wind", "wind_offshore",
  "hydro",
  "bioenergy_biogas", "bioenergy_biomass",
]);

const FOSSIL_FUELTECHS = new Set([
  "coal_black", "coal_brown",
  "gas_ccgt", "gas_ocgt", "gas_recip", "gas_steam", "gas_wcmg",
  "distillate",
]);

// ── Data fetchers ────────────────────────────────────────────────────────

export interface GenerationMixEntry {
  fueltech: string;
  energy_gwh: number;
  share_pct: number;
  type: "renewable" | "fossil" | "storage" | "other";
}

export interface StateSnapshot {
  region: string;
  renewable_pct: number;
  total_energy_gwh: number;
}

export interface PriceSummary {
  region: string;
  latest_price: number | null;
  avg_24h: number | null;
  min_24h: number | null;
  max_24h: number | null;
}

export interface EnergyDashboardData {
  // Headline numbers
  renewable_pct_7d: number;
  renewable_pct_today: number;
  emissions_intensity: number | null; // tCO2/MWh
  total_generation_gwh_7d: number;

  // Generation mix (last 7 days)
  generation_mix: GenerationMixEntry[];

  // State breakdown
  state_snapshots: StateSnapshot[];

  // Prices by region (last 24h)
  price_summaries: PriceSummary[];

  // Time series for sparklines (daily, last 30 days)
  renewable_pct_daily: { date: string; value: number }[];
  emissions_daily: { date: string; value: number }[];

  // Generation by fuel over time (daily, last 7 days)
  generation_daily: {
    date: string;
    fueltechs: Record<string, number>;
  }[];

  fetched_at: string;
  error: string | null;
}

export async function fetchEnergyDashboard(): Promise<EnergyDashboardData> {
  const client = getClient();
  const now = formatDate(0);
  const yesterday = formatDate(1);
  const sevenDaysAgo = formatDate(7);
  const thirtyDaysAgo = formatDate(30);

  const result: EnergyDashboardData = {
    renewable_pct_7d: 0,
    renewable_pct_today: 0,
    emissions_intensity: null,
    total_generation_gwh_7d: 0,
    generation_mix: [],
    state_snapshots: [],
    price_summaries: [],
    renewable_pct_daily: [],
    emissions_daily: [],
    generation_daily: [],
    fetched_at: new Date().toISOString(),
    error: null,
  };

  try {
    // 1. Generation by fueltech (last 7 days) — for mix + renewable %
    const gen7d = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
      secondaryGrouping: "fueltech_group",
    });

    const genResults = gen7d.response.data?.[0]?.results ?? [];
    const totalEnergy = sumSeries(genResults);
    const renewableEnergy = sumSeries(genResults, (n) => RENEWABLE_FUELTECHS.has(n));

    result.total_generation_gwh_7d = Math.round(totalEnergy / 1000 * 10) / 10; // MWh to GWh
    result.renewable_pct_7d = totalEnergy > 0 ? Math.round((renewableEnergy / totalEnergy) * 1000) / 10 : 0;

    // Build generation mix
    const mixMap = new Map<string, number>();
    for (const r of genResults) {
      const existing = mixMap.get(r.name) ?? 0;
      const seriesTotal = r.data.reduce((s, [, v]) => s + (v ?? 0), 0);
      mixMap.set(r.name, existing + seriesTotal);
    }

    result.generation_mix = Array.from(mixMap.entries())
      .filter(([, v]) => v > 0)
      .map(([fueltech, energy]) => ({
        fueltech,
        energy_gwh: Math.round(energy / 1000 * 10) / 10,
        share_pct: totalEnergy > 0 ? Math.round((energy / totalEnergy) * 1000) / 10 : 0,
        type: RENEWABLE_FUELTECHS.has(fueltech)
          ? "renewable" as const
          : FOSSIL_FUELTECHS.has(fueltech)
            ? "fossil" as const
            : fueltech.includes("battery")
              ? "storage" as const
              : "other" as const,
      }))
      .sort((a, b) => b.energy_gwh - a.energy_gwh);

    // Build daily generation by fueltech (for stacked chart)
    const dailyMap = new Map<string, Record<string, number>>();
    for (const r of genResults) {
      for (const [date, value] of r.data) {
        const day = date.split("T")[0];
        if (!dailyMap.has(day)) dailyMap.set(day, {});
        const entry = dailyMap.get(day)!;
        entry[r.name] = (entry[r.name] ?? 0) + (value ?? 0);
      }
    }
    result.generation_daily = Array.from(dailyMap.entries())
      .map(([date, fueltechs]) => ({ date, fueltechs }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Today's renewable % (just today)
    const genToday = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: yesterday,
      dateEnd: now,
      secondaryGrouping: "fueltech_group",
    });
    const todayResults = genToday.response.data?.[0]?.results ?? [];
    const todayTotal = sumSeries(todayResults);
    const todayRenewable = sumSeries(todayResults, (n) => RENEWABLE_FUELTECHS.has(n));
    result.renewable_pct_today = todayTotal > 0 ? Math.round((todayRenewable / todayTotal) * 1000) / 10 : 0;

    // 3. Emissions (last 7 days daily for trend)
    const emissions = await client.getNetworkData("NEM", ["emissions"], {
      interval: "1d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
    });
    const emResults = emissions.response.data?.[0]?.results ?? [];
    // Calculate intensity: emissions / energy
    const totalEmissions = sumSeries(emResults);
    result.emissions_intensity = totalEnergy > 0
      ? Math.round((totalEmissions / totalEnergy) * 1000) / 1000
      : null;

    // 4. 30-day renewable % daily trend (for sparkline)
    const gen30d = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: thirtyDaysAgo,
      dateEnd: now,
      secondaryGrouping: "renewable",
    });
    const trend30Results = gen30d.response.data?.[0]?.results ?? [];

    // "renewable" grouping gives "renewable" and "non_renewable" series
    const renewSeries = trend30Results.find((r) => r.name === "renewable");
    const nonRenewSeries = trend30Results.find((r) => r.name === "non_renewable");

    if (renewSeries && nonRenewSeries) {
      for (let i = 0; i < renewSeries.data.length; i++) {
        const [date, renVal] = renewSeries.data[i];
        const nonRenVal = nonRenewSeries.data[i]?.[1] ?? 0;
        const total = (renVal ?? 0) + (nonRenVal ?? 0);
        if (total > 0) {
          result.renewable_pct_daily.push({
            date: date.split("T")[0],
            value: Math.round(((renVal ?? 0) / total) * 1000) / 10,
          });
        }
      }
    }

    // Build emissions daily trend too
    for (const r of emResults) {
      for (const [date, value] of r.data) {
        if (value !== null) {
          result.emissions_daily.push({
            date: date.split("T")[0],
            value: Math.round(value),
          });
        }
      }
    }

    // 5. State-by-state renewable % (last 7 days)
    const stateGen = await client.getNetworkData("NEM", ["energy"], {
      interval: "7d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
      primaryGrouping: "network_region",
      secondaryGrouping: "renewable",
    });

    const stateData = stateGen.response.data ?? [];
    const regionNames: Record<string, string> = {
      NSW1: "NSW", QLD1: "QLD", VIC1: "VIC", SA1: "SA", TAS1: "TAS",
    };

    for (const series of stateData) {
      const region = regionNames[series.network_code] ?? series.network_code;
      const results = series.results ?? [];
      const renew = sumSeries(results, (n) => n === "renewable");
      const nonRenew = sumSeries(results, (n) => n === "non_renewable");
      const total = renew + nonRenew;
      result.state_snapshots.push({
        region,
        renewable_pct: total > 0 ? Math.round((renew / total) * 1000) / 10 : 0,
        total_energy_gwh: Math.round(total / 1000 * 10) / 10,
      });
    }
    result.state_snapshots.sort((a, b) => b.renewable_pct - a.renewable_pct);

    // 6. Prices by region (last 24h)
    const regions = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"];
    for (const regionCode of regions) {
      try {
        const market = await client.getMarket("NEM", ["price"], {
          interval: "1h" as DataInterval,
          dateStart: yesterday,
          dateEnd: now,
          primaryGrouping: "network_region",
        });

        const regionData = market.response.data?.find(
          (d) => d.network_code === regionCode
        );
        const priceResults = regionData?.results?.[0]?.data ?? [];
        const prices = priceResults.map(([, v]) => v).filter((v): v is number => v !== null);

        result.price_summaries.push({
          region: regionNames[regionCode] ?? regionCode,
          latest_price: prices.length > 0 ? Math.round(prices[prices.length - 1] * 100) / 100 : null,
          avg_24h: prices.length > 0 ? Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100 : null,
          min_24h: prices.length > 0 ? Math.round(Math.min(...prices) * 100) / 100 : null,
          max_24h: prices.length > 0 ? Math.round(Math.max(...prices) * 100) / 100 : null,
        });

        break; // Only need one call with network_region grouping
      } catch {
        // Price data may not be available for all regions
      }
    }

    // If we got all regions from one call, parse them
    if (result.price_summaries.length <= 1) {
      // Try fetching all at once
      try {
        const market = await client.getMarket("NEM", ["price"], {
          interval: "1h" as DataInterval,
          dateStart: yesterday,
          dateEnd: now,
          primaryGrouping: "network_region",
        });

        result.price_summaries = [];
        for (const series of market.response.data ?? []) {
          const region = regionNames[series.network_code] ?? series.network_code;
          const priceResults = series.results?.[0]?.data ?? [];
          const prices = priceResults.map(([, v]) => v).filter((v): v is number => v !== null);

          result.price_summaries.push({
            region,
            latest_price: prices.length > 0 ? Math.round(prices[prices.length - 1] * 100) / 100 : null,
            avg_24h: prices.length > 0 ? Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100 : null,
            min_24h: prices.length > 0 ? Math.round(Math.min(...prices) * 100) / 100 : null,
            max_24h: prices.length > 0 ? Math.round(Math.max(...prices) * 100) / 100 : null,
          });
        }
      } catch {
        // OK to have no price data
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
