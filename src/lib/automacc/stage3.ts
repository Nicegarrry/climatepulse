import type { Allocation, Fixture, SessionContext } from './types';

const ANNUITY_FACTOR = 6.71;

export type Stage3Output = {
  leverId: string;
  addressesRows: string[];
  costPerTco2e: number;
  tco2eAbatedAnnual: number;
  tco2eAbatedHorizon: number;
  capexAud: number;
  opexDeltaAudAnnual: number;
  npvAud: number;
  sensitivity: { base: number; energyHigh: number; capexHigh: number; zoneStable: boolean };
};

function runPass(
  allocation: Allocation,
  fixture: Fixture,
  ctx: SessionContext,
  energyMul: number,
  capexMul: number,
): { costPerTco2e: number; abatedAnnual: number; abatedHorizon: number; capex: number; opex: number; npv: number } {
  const lever = fixture.levers.find(l => l.leverId === allocation.leverId)!;
  const rows = allocation.sourceRowIds
    .map(rid => fixture.baselineRows.find(r => r.rowId === rid))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const addressableAnnual = rows.reduce((sum, r) => sum + r.tco2eEstimate, 0);
  const abatedAnnual = allocation.isEnabler ? 0 : addressableAnnual * (lever.typicalAbatementPct / 100);
  const abatedHorizon = abatedAnnual * ctx.horizonYears;

  const capex = lever.capexAud * capexMul;
  const opex = lever.opexDeltaAudAnnual * energyMul;
  const npv = -capex - opex * ANNUITY_FACTOR;
  const costPerTco2e = abatedHorizon > 0 ? npv / abatedHorizon : Number.POSITIVE_INFINITY;
  return { costPerTco2e, abatedAnnual, abatedHorizon, capex, opex, npv };
}

export function runStage3(
  allocations: Allocation[],
  fixture: Fixture,
  ctx: SessionContext,
): Stage3Output[] {
  return allocations.map(a => {
    const base = runPass(a, fixture, ctx, 1.0, 1.0);
    const energyHigh = runPass(a, fixture, ctx, 1.3, 1.0);
    const capexHigh = runPass(a, fixture, ctx, 1.0, 1.3);
    const zoneStable =
      zoneOf(base.costPerTco2e, ctx.carbonCeilingAud) === zoneOf(energyHigh.costPerTco2e, ctx.carbonCeilingAud) &&
      zoneOf(base.costPerTco2e, ctx.carbonCeilingAud) === zoneOf(capexHigh.costPerTco2e, ctx.carbonCeilingAud);
    return {
      leverId: a.leverId,
      addressesRows: a.sourceRowIds,
      costPerTco2e: base.costPerTco2e,
      tco2eAbatedAnnual: base.abatedAnnual,
      tco2eAbatedHorizon: base.abatedHorizon,
      capexAud: base.capex,
      opexDeltaAudAnnual: base.opex,
      npvAud: base.npv,
      sensitivity: {
        base: base.costPerTco2e,
        energyHigh: energyHigh.costPerTco2e,
        capexHigh: capexHigh.costPerTco2e,
        zoneStable,
      },
    };
  });
}

export function zoneOf(costPerTco2e: number, carbonCeilingAud: number): 'do_now' | 'at_carbon_price' | 'strategic' {
  if (costPerTco2e <= 0) return 'do_now';
  if (costPerTco2e <= carbonCeilingAud) return 'at_carbon_price';
  return 'strategic';
}
