import type { Fixture, MaccPackage, MaccRow, SessionContext } from './types';
import { type Stage3Output, zoneOf } from './stage3';

export function runStage4(
  stage3: Stage3Output[],
  fixture: Fixture,
  ctx: SessionContext,
): MaccPackage {
  const sorted = [...stage3].sort((a, b) => a.costPerTco2e - b.costPerTco2e);

  const remainingByRow = new Map<string, number>();
  fixture.baselineRows.forEach(r => remainingByRow.set(r.rowId, r.tco2eEstimate * ctx.horizonYears));

  let cumulative = 0;
  const maccData: MaccRow[] = sorted.map((s, idx) => {
    let claimed = 0;
    s.addressesRows.forEach(rid => {
      const remaining = remainingByRow.get(rid) ?? 0;
      const lever = fixture.levers.find(l => l.leverId === s.leverId)!;
      const rowEstimate = fixture.baselineRows.find(r => r.rowId === rid)?.tco2eEstimate ?? 0;
      const rowClaim = Math.min(remaining, rowEstimate * ctx.horizonYears * (lever.typicalAbatementPct / 100));
      claimed += rowClaim;
      remainingByRow.set(rid, remaining - rowClaim);
    });
    cumulative += claimed;
    const lever = fixture.levers.find(l => l.leverId === s.leverId)!;
    return {
      rank: idx + 1,
      leverId: s.leverId,
      leverName: lever.name,
      costPerTco2e: s.costPerTco2e,
      tco2eAbatedAnnual: claimed / ctx.horizonYears,
      tco2eAbatedHorizon: claimed,
      cumulativeTco2eAbated: cumulative,
      capexAud: s.capexAud,
      opexDeltaAudAnnual: s.opexDeltaAudAnnual,
      npvAud: s.npvAud,
      zone: zoneOf(s.costPerTco2e, ctx.carbonCeilingAud),
      addressesRows: s.addressesRows,
      sensitivity: s.sensitivity,
    };
  });

  const top3Candidates = maccData.slice(0, 3).map(r => r.leverId);
  const top3Ids: string[] = [];
  for (const lid of top3Candidates) {
    const lever = fixture.levers.find(l => l.leverId === lid)!;
    const conflictsWithExisting = lever.mutexPartners.some(p => top3Ids.includes(p));
    if (!conflictsWithExisting) top3Ids.push(lid);
  }

  return {
    maccData,
    top3Ids,
    totalAbatement: cumulative,
  };
}
