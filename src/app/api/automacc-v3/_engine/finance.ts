// AutoMACC v3 — NPV / cost-per-tCO2e helpers.
// Ported from _outputs/teaching/2026-05-15-bootcamp-portal v1.1 portal.
// Defaults: hurdle_rate=0.08, horizon_years=10 per .claude/skills/automacc/defaults.md.

export const DEFAULT_HURDLE_RATE = 0.08;
export const DEFAULT_HORIZON_YEARS = 10;

export function annuityFactor(rate: number, years: number): number {
  if (rate === 0) return years;
  return (1 - Math.pow(1 + rate, -years)) / rate;
}

export function flatNpv(
  capex: number,
  annualCashflow: number,
  discountRate: number,
  years: number,
): number {
  return -capex + annualCashflow * annuityFactor(discountRate, years);
}

export function discountedCashflowsNpv(
  capex: number,
  cashflows: number[],
  discountRate: number,
): number {
  return -capex + cashflows.reduce(
    (sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1),
    0,
  );
}

export function costPerTco2e(npv: number, tco2eAbatedHorizon: number): number {
  if (tco2eAbatedHorizon <= 0) return 999;
  return -npv / tco2eAbatedHorizon;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
