import { NextRequest, NextResponse } from "next/server";
import { OpenElectricityClient } from "@openelectricity/client";
import type { DataInterval } from "@openelectricity/client";
import { requireAuth } from "@/lib/supabase/server";

function ftLabel(name: string): string {
  const base = name.replace(/^(energy|power)_/, "");
  const labels: Record<string, string> = {
    solar: "Solar", wind: "Wind", hydro: "Hydro", coal: "Coal", gas: "Gas",
    bioenergy: "Bioenergy", distillate: "Distillate",
    battery_discharging: "Battery", battery_charging: "Battery (Charge)",
    battery: "Battery (Net)", pumps: "Pumped Hydro",
  };
  return labels[base] ?? base;
}

function ftColor(name: string): string {
  const base = name.replace(/^(energy|power)_/, "");
  const colors: Record<string, string> = {
    solar: "#F59E0B", wind: "#3B82F6", hydro: "#06B6D4", coal: "#57534E",
    gas: "#EF4444", bioenergy: "#22C55E", distillate: "#A3A3A3",
    battery_discharging: "#8B5CF6", battery_charging: "#C4B5FD",
    battery: "#8B5CF6", pumps: "#7C3AED",
  };
  return colors[base] ?? "#9CA3AF";
}

const SKIP = new Set(["battery", "battery_charging", "pumps"]);

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENELECTRICITY_API_KEY not set" }, { status: 500 });
  }

  const region = request.nextUrl.searchParams.get("region"); // e.g. "NSW1" or null for NEM-wide

  const client = new OpenElectricityClient({ apiKey });
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const now = new Date().toISOString().split("T")[0];

  try {
    const [genRes, priceRes] = await Promise.all([
      client.getNetworkData("NEM", ["power"], {
        interval: "1h" as DataInterval,
        dateStart: yesterday,
        dateEnd: now,
        ...(region ? { primaryGrouping: "network_region" as const } : {}),
        secondaryGrouping: "fueltech_group",
      }),
      client.getMarket("NEM", ["price"], {
        interval: "1h" as DataInterval,
        dateStart: yesterday,
        dateEnd: now,
        primaryGrouping: "network_region",
      }),
    ]);

    // Filter generation results for the selected region
    let genSeries = genRes.response.data?.[0]?.results ?? [];

    if (region) {
      // With region grouping, names are like "power_NSW1|coal"
      // Filter to only matching region and strip prefix
      genSeries = genSeries
        .filter((r) => r.name.includes(`_${region}|`))
        .map((r) => ({
          ...r,
          name: "power_" + r.name.split("|")[1], // "power_NSW1|coal" -> "power_coal"
        }));
    }

    // Filter price for selected region
    const priceAllResults = priceRes.response.data?.[0]?.results ?? [];
    const priceSeriesName = region ? `price_${region}` : priceAllResults[0]?.name;
    const priceSeries = priceAllResults.find((r) => r.name === priceSeriesName);

    // Build timestamps
    const timestampSet = new Set<string>();
    for (const r of genSeries) {
      for (const [ts] of r.data) timestampSet.add(ts);
    }
    const timestamps = Array.from(timestampSet).sort();

    // Build generation data
    const generation: Record<string, number[]> = {};
    const fueltechs: { key: string; label: string; color: string }[] = [];
    const ftTotals = new Map<string, number>();

    for (const r of genSeries) {
      const base = r.name.replace(/^(energy|power)_/, "");
      if (SKIP.has(base)) continue;
      const total = r.data.reduce((s, [, v]) => s + Math.max(v ?? 0, 0), 0);
      ftTotals.set(r.name, total);
    }

    const sorted = Array.from(ftTotals.entries()).sort((a, b) => b[1] - a[1]);
    for (const [ftName] of sorted) {
      const series = genSeries.find((r) => r.name === ftName);
      if (!series) continue;
      const tsMap = new Map(series.data.map(([ts, v]) => [ts, v]));
      generation[ftName] = timestamps.map((ts) => Math.max(tsMap.get(ts) ?? 0, 0));
      fueltechs.push({ key: ftName, label: ftLabel(ftName), color: ftColor(ftName) });
    }

    // Build price
    const priceMap = new Map((priceSeries?.data ?? []).map(([ts, v]) => [ts, v]));
    const prices = timestamps.map((ts) => priceMap.get(ts) ?? 0);

    return NextResponse.json({ timestamps, generation, price: prices, fueltechs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch intraday data" },
      { status: 500 }
    );
  }
}
