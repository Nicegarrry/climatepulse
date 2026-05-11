'use client';

import type { MaccPackage } from '@/lib/automacc/types';

const ZONE_COLOUR: Record<MaccPackage['maccData'][number]['zone'], string> = {
  do_now: '#1E4D2B',
  at_carbon_price: '#B8860B',
  strategic: '#6B4A6B',
};

export function MaccStrip({ pkg, recomputing }: { pkg: MaccPackage; recomputing: boolean }) {
  if (pkg.maccData.length === 0) {
    return (
      <div className="border-b border-[var(--color-border-light)] bg-white px-6 py-4">
        <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-mono">
          MACC strip
        </div>
        <div className="mt-2 text-sm text-[var(--color-ink-sec)]">
          Drag a lever onto a source row to start.
        </div>
      </div>
    );
  }

  const maxCost = Math.max(...pkg.maccData.map(r => Math.max(0, r.costPerTco2e)), 100);
  const minCost = Math.min(...pkg.maccData.map(r => Math.min(0, r.costPerTco2e)), -100);
  const totalWidth = pkg.maccData.reduce((sum, r) => sum + r.tco2eAbatedHorizon, 0);

  return (
    <div className="border-b border-[var(--color-border-light)] bg-white px-6 py-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-mono">
          MACC strip
          {recomputing && (
            <span className="ml-3 inline-flex items-center gap-1 text-[var(--color-ink-sec)] normal-case tracking-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-forest-mid)] animate-pulse" />
              Updating MACC.
            </span>
          )}
        </div>
        <div className="text-sm text-[var(--color-ink-sec)]">
          Total abatement{' '}
          <span className="font-semibold text-[var(--color-ink)]">
            {Math.round(pkg.totalAbatement).toLocaleString()}
          </span>{' '}
          tCO2e over horizon
        </div>
      </div>
      <div className="flex h-16 items-end gap-0.5">
        {pkg.maccData.map(r => {
          const widthPct = totalWidth > 0 ? (r.tco2eAbatedHorizon / totalWidth) * 100 : 0;
          const heightPct = r.costPerTco2e >= 0
            ? Math.min(100, (r.costPerTco2e / maxCost) * 100)
            : Math.min(100, (Math.abs(r.costPerTco2e) / Math.abs(minCost)) * 100);
          return (
            <div
              key={r.leverId}
              style={{ width: `${widthPct}%` }}
              className="relative flex flex-col items-center"
              title={`${r.leverName}: $${Math.round(r.costPerTco2e)}/tCO2e, ${Math.round(r.tco2eAbatedHorizon)} tCO2e`}
            >
              <div
                className="w-full"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: ZONE_COLOUR[r.zone],
                  opacity: r.costPerTco2e < 0 ? 0.7 : 1,
                }}
              />
              <div className="text-[9px] mt-1 text-[var(--color-ink-muted)] truncate w-full text-center font-mono">
                {r.leverId}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-wider font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ZONE_COLOUR.do_now }} />
          Do now
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ZONE_COLOUR.at_carbon_price }} />
          At carbon price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ZONE_COLOUR.strategic }} />
          Strategic
        </span>
      </div>
    </div>
  );
}
