import { NextResponse } from "next/server";
import { fetchEnergyDashboard } from "@/lib/energy/openelectricity";

export const maxDuration = 60;

export async function GET() {
  try {
    const data = await fetchEnergyDashboard();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch energy data" },
      { status: 500 }
    );
  }
}
