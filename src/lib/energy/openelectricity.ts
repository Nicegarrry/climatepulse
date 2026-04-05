import { OpenElectricityClient } from "@openelectricity/client";
import type { DataInterval, ITimeSeriesResult } from "@openelectricity/client";

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

function formatDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// Series names from the API use "energy_" prefix with fueltech_group
const RENEWABLE_SERIES = new Set([
  "energy_solar", "energy_wind", "energy_hydro", "energy_bioenergy",
]);

const FOSSIL_SERIES = new Set([
  "energy_coal", "energy_gas", "energy_distillate",
]);

const FUELTECH_DISPLAY: Record<string, string> = {
  energy_solar: "Solar",
  energy_wind: "Wind",
  energy_hydro: "Hydro",
  energy_coal: "Coal",
  energy_gas: "Gas",
  energy_bioenergy: "Bioenergy",
  energy_distillate: "Distillate",
  energy_battery_discharging: "Battery",
  energy_battery_charging: "Battery (Charge)",
  energy_battery: "Battery (Net)",
  energy_pumps: "Pumped Hydro",
};

const FUELTECH_COLORS: Record<string, string> = {
  energy_solar: "#F59E0B",
  energy_wind: "#3B82F6",
  energy_hydro: "#06B6D4",
  energy_coal: "#57534E",
  energy_gas: "#EF4444",
  energy_bioenergy: "#22C55E",
  energy_distillate: "#A3A3A3",
  energy_battery_discharging: "#8B5CF6",
  energy_battery_charging: "#C4B5FD",
  energy_battery: "#8B5CF6",
  energy_pumps: "#7C3AED",
};

// ── Exported types ───────────────────────────────────────────────────────

export interface GenerationMixEntry {
  fueltech: string;
  label: string;
  color: string;
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
  renewable_pct_7d: number;
  renewable_pct_today: number;
  emissions_intensity: number | null;
  total_generation_gwh_7d: number;
  generation_mix: GenerationMixEntry[];
  state_snapshots: StateSnapshot[];
  price_summaries: PriceSummary[];
  renewable_pct_daily: { date: string; value: number }[];
  emissions_daily: { date: string; value: number }[];
  generation_daily: { date: string; fueltechs: Record<string, number> }[];
  fetched_at: string;
  error: string | null;
}

// ── Main fetch ───────────────────────────────────────────────────────────

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
    // 1. Generation by fueltech_group (7 days) — mix + renewable %
    const gen7d = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
      secondaryGrouping: "fueltech_group",
    });

    const genResults = gen7d.response.data?.[0]?.results ?? [];
    // Exclude negative-net and charging series from totals
    const genForMix = genResults.filter(
      (r) => r.name !== "energy_battery" && r.name !== "energy_battery_charging" && r.name !== "energy_pumps"
    );

    const totalEnergy = genForMix.reduce(
      (sum, r) => sum + r.data.reduce((s, [, v]) => s + Math.max(v ?? 0, 0), 0),
      0
    );
    const renewableEnergy = genForMix
      .filter((r) => RENEWABLE_SERIES.has(r.name))
      .reduce((sum, r) => sum + r.data.reduce((s, [, v]) => s + Math.max(v ?? 0, 0), 0), 0);

    result.total_generation_gwh_7d = Math.round(totalEnergy / 1000 * 10) / 10;
    result.renewable_pct_7d = totalEnergy > 0
      ? Math.round((renewableEnergy / totalEnergy) * 1000) / 10
      : 0;

    // Build generation mix
    for (const r of genForMix) {
      const energy = r.data.reduce((s, [, v]) => s + Math.max(v ?? 0, 0), 0);
      if (energy <= 0) continue;
      result.generation_mix.push({
        fueltech: r.name,
        label: FUELTECH_DISPLAY[r.name] ?? r.name.replace("energy_", ""),
        color: FUELTECH_COLORS[r.name] ?? "#9CA3AF",
        energy_gwh: Math.round(energy / 1000 * 10) / 10,
        share_pct: totalEnergy > 0 ? Math.round((energy / totalEnergy) * 1000) / 10 : 0,
        type: RENEWABLE_SERIES.has(r.name)
          ? "renewable"
          : FOSSIL_SERIES.has(r.name)
            ? "fossil"
            : r.name.includes("battery")
              ? "storage"
              : "other",
      });
    }
    result.generation_mix.sort((a, b) => b.energy_gwh - a.energy_gwh);

    // Build daily generation (for stacked chart)
    const dailyMap = new Map<string, Record<string, number>>();
    for (const r of genForMix) {
      for (const [date, value] of r.data) {
        const day = date.split("T")[0];
        if (!dailyMap.has(day)) dailyMap.set(day, {});
        const entry = dailyMap.get(day)!;
        entry[r.name] = (entry[r.name] ?? 0) + Math.max(value ?? 0, 0);
      }
    }
    result.generation_daily = Array.from(dailyMap.entries())
      .map(([date, fueltechs]) => ({ date, fueltechs }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Today's renewable % (renewable grouping)
    const genToday = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: yesterday,
      dateEnd: now,
      secondaryGrouping: "renewable",
    });
    const todayResults = genToday.response.data?.[0]?.results ?? [];
    // Names are "energy_True" and "energy_False"
    const todayRenewable = sumSeries(todayResults, (n) => n === "energy_True");
    const todayFossil = sumSeries(todayResults, (n) => n === "energy_False");
    const todayTotal = todayRenewable + todayFossil;
    result.renewable_pct_today = todayTotal > 0
      ? Math.round((todayRenewable / todayTotal) * 1000) / 10
      : 0;

    // 3. Emissions (7 days daily for intensity calc)
    const emissions = await client.getNetworkData("NEM", ["emissions"], {
      interval: "1d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
    });
    const emResults = emissions.response.data?.[0]?.results ?? [];
    const totalEmissions = sumSeries(emResults);
    result.emissions_intensity = totalEnergy > 0
      ? Math.round((totalEmissions / totalEnergy) * 1000) / 1000
      : null;

    // Emissions daily trend
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

    // 4. 30-day renewable % daily trend (sparkline)
    const gen30d = await client.getNetworkData("NEM", ["energy"], {
      interval: "1d" as DataInterval,
      dateStart: thirtyDaysAgo,
      dateEnd: now,
      secondaryGrouping: "renewable",
    });
    const trend30Results = gen30d.response.data?.[0]?.results ?? [];
    const renewSeries = trend30Results.find((r) => r.name === "energy_True");
    const nonRenewSeries = trend30Results.find((r) => r.name === "energy_False");

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

    // 5. State-by-state renewable %
    // API returns pipe-separated names like "energy_NSW1|True"
    const stateGen = await client.getNetworkData("NEM", ["energy"], {
      interval: "7d" as DataInterval,
      dateStart: sevenDaysAgo,
      dateEnd: now,
      primaryGrouping: "network_region",
      secondaryGrouping: "renewable",
    });

    const regionNames: Record<string, string> = {
      NSW1: "NSW", QLD1: "QLD", VIC1: "VIC", SA1: "SA", TAS1: "TAS",
    };

    // Parse pipe-separated series names
    const stateResults = stateGen.response.data?.[0]?.results ?? [];
    const stateMap = new Map<string, { renewable: number; total: number }>();

    for (const r of stateResults) {
      // Name format: "energy_NSW1|True" or "energy_NSW1|False"
      const match = r.name.match(/^energy_(\w+)\|(True|False)$/);
      if (!match) continue;
      const [, regionCode, isRenewable] = match;
      const energy = r.data.reduce((s, [, v]) => s + Math.max(v ?? 0, 0), 0);

      if (!stateMap.has(regionCode)) stateMap.set(regionCode, { renewable: 0, total: 0 });
      const entry = stateMap.get(regionCode)!;
      entry.total += energy;
      if (isRenewable === "True") entry.renewable += energy;
    }

    for (const [code, { renewable, total }] of stateMap) {
      const region = regionNames[code] ?? code;
      result.state_snapshots.push({
        region,
        renewable_pct: total > 0 ? Math.round((renewable / total) * 1000) / 10 : 0,
        total_energy_gwh: Math.round(total / 1000 * 10) / 10,
      });
    }
    result.state_snapshots.sort((a, b) => b.renewable_pct - a.renewable_pct);

    // 6. Prices by region
    try {
      const market = await client.getMarket("NEM", ["price"], {
        interval: "1h" as DataInterval,
        dateStart: yesterday,
        dateEnd: now,
        primaryGrouping: "network_region",
      });

      // Results have pipe-separated names like "price_NSW1"
      const priceResults = market.response.data?.[0]?.results ?? [];
      for (const r of priceResults) {
        const match = r.name.match(/^price_(\w+)$/);
        if (!match) continue;
        const regionCode = match[1];
        const region = regionNames[regionCode] ?? regionCode;

        const prices = r.data.map(([, v]) => v).filter((v): v is number => v !== null);
        if (prices.length === 0) continue;

        result.price_summaries.push({
          region,
          latest_price: Math.round(prices[prices.length - 1] * 100) / 100,
          avg_24h: Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100,
          min_24h: Math.round(Math.min(...prices) * 100) / 100,
          max_24h: Math.round(Math.max(...prices) * 100) / 100,
        });
      }
      // Sort: SA, TAS, VIC, NSW, QLD (alphabetical by state name)
      result.price_summaries.sort((a, b) => a.region.localeCompare(b.region));
    } catch {
      // Price data is non-critical
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
