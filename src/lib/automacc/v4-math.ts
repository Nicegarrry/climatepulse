// AutoMACC v4 — deterministic NPV / cost-per-tonne math.
// Copied from v3 _engine/finance.ts to keep v4 independent.

export const DEFAULT_HURDLE_RATE = 0.08;
export const DEFAULT_HORIZON_YEARS = 10;

export function annuityFactor(rate: number, years: number): number {
  if (rate === 0) return years;
  return (1 - Math.pow(1 + rate, -years)) / rate;
}

export function flatNpv(
  capexAud: number,
  annualCashflowAud: number,
  discountRate = DEFAULT_HURDLE_RATE,
  years = DEFAULT_HORIZON_YEARS,
): number {
  return -capexAud + annualCashflowAud * annuityFactor(discountRate, years);
}

// $/tCO2 = -NPV / (tCO2/y × years).
// Negative NPV (cost) → positive $/t. Positive NPV (saving) → negative $/t.
export function costPerTco2(
  npvAud: number,
  tco2yPerYear: number,
  years = DEFAULT_HORIZON_YEARS,
): number {
  const lifetimeAbated = tco2yPerYear * years;
  if (lifetimeAbated <= 0) return 9999;
  return -npvAud / lifetimeAbated;
}

// Lifetime saving from avoided fuel/electricity cost.
// numerical × abatementPct/100 × costFactorAudPerUnit × years.
export function lifetimeAvoidedCost(
  numerical: number,
  abatementPct: number,
  costFactorAudPerUnit: number,
  years = DEFAULT_HORIZON_YEARS,
): number {
  return numerical * (abatementPct / 100) * costFactorAudPerUnit * years;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
