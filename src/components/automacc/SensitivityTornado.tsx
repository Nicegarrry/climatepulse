'use client';

import type { MaccPackage } from '@/lib/automacc/types';

export function SensitivityTornado({ pkg }: { pkg: MaccPackage }) {
  const top3 = pkg.maccData.filter(r => pkg.top3Ids.includes(r.leverId));

  if (top3.length === 0) {
    return (
      <div className="border-t border-[var(--color-border-light)] bg-[var(--color-paper-dark)] px-6 py-4">
        <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-mono">
          Sensitivity — top 3
        </div>
        <div className="mt-2 text-sm text-[var(--color-ink-sec)]">
          Allocate levers to see how the top 3 hold up under energy-price and capex stress.
        </div>
      </div>
    );
  }

  const maxRange = Math.max(
    ...top3.map(r =>
      Math.max(
        Math.abs(r.sensitivity.energyHigh - r.sensitivity.base),
        Math.abs(r.sensitivity.capexHigh - r.sensitivity.base),
      ),
    ),
    1,
  );

  return (
    <div className="border-t border-[var(--color-border-light)] bg-[var(--color-paper-dark)] px-6 py-4">
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-mono mb-3">
        Sensitivity — top 3
      </div>
      <div className="space-y-3">
        {top3.map(r => {
          const energyDelta = r.sensitivity.energyHigh - r.sensitivity.base;
          const capexDelta = r.sensitivity.capexHigh - r.sensitivity.base;
          return (
            <div key={r.leverId} className="grid grid-cols-[140px_1fr_60px] gap-3 items-center">
              <div className="text-sm">
                <div className="font-medium text-[var(--color-ink)]">{r.leverName}</div>
                <div className="text-[10px] font-mono text-[var(--color-ink-muted)]">{r.leverId}</div>
              </div>
              <div className="relative h-6 bg-white border border-[var(--color-border-light)]">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-ink-faint)]" />
                <div
                  className="absolute top-1 h-2"
                  style={{
                    left: `${50 + (Math.min(0, energyDelta) / maxRange) * 45}%`,
                    width: `${(Math.abs(energyDelta) / maxRange) * 45}%`,
                    backgroundColor: '#B8860B',
                    opacity: 0.7,
                  }}
                  title={`Energy high: ${Math.round(r.sensitivity.energyHigh)} ($/tCO2e)`}
                />
                <div
                  className="absolute bottom-1 h-2"
                  style={{
                    left: `${50 + (Math.min(0, capexDelta) / maxRange) * 45}%`,
                    width: `${(Math.abs(capexDelta) / maxRange) * 45}%`,
                    backgroundColor: '#6B4A6B',
                    opacity: 0.7,
                  }}
                  title={`Capex high: ${Math.round(r.sensitivity.capexHigh)} ($/tCO2e)`}
                />
              </div>
              <div className="text-xs font-mono text-right">
                {r.sensitivity.zoneStable ? (
                  <span className="text-[var(--color-forest)]">stable</span>
                ) : (
                  <span className="text-[var(--color-status-error)]">may flip</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[10px] uppercase tracking-wider font-mono text-[var(--color-ink-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: '#B8860B' }} />
          Energy +30%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: '#6B4A6B' }} />
          Capex +30%
        </span>
      </div>
    </div>
  );
}
