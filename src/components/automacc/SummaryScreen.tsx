'use client';

import type { Fixture, MaccPackage } from '@/lib/automacc/types';
import { MaccStrip } from './MaccStrip';
import { ProgressStepper } from './ProgressStepper';

const ZONE_LABELS: Record<string, string> = {
  do_now: 'Do now',
  at_carbon_price: 'At carbon price',
  strategic: 'Strategic',
};

const ZONE_STYLES: Record<string, string> = {
  do_now: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  at_carbon_price: 'bg-amber-50 text-amber-800 border-amber-200',
  strategic: 'bg-purple-50 text-purple-800 border-purple-200',
};

function fmtCost(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '−$' : '$';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString()}`;
}

function ZoneBadge({ zone }: { zone: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${ZONE_STYLES[zone] ?? ''}`}>
      {ZONE_LABELS[zone] ?? zone}
    </span>
  );
}

const HORIZON_YEARS = 10;

export function SummaryScreen({
  fixture,
  pkg,
  onBack,
}: {
  fixture: Fixture;
  pkg: MaccPackage;
  onBack: () => void;
}) {
  const baselineAnnual = fixture.baselineRows.reduce((s, r) => s + r.tco2eEstimate, 0);
  const baselineHorizon = baselineAnnual * HORIZON_YEARS;
  const reductionPct = baselineHorizon > 0 ? (pkg.totalAbatement / baselineHorizon) * 100 : 0;

  const doNow = pkg.maccData.filter(r => r.zone === 'do_now');
  const atPrice = pkg.maccData.filter(r => r.zone === 'at_carbon_price');
  const strategic = pkg.maccData.filter(r => r.zone === 'strategic');

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-background)]">
      <ProgressStepper currentStep="summary" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
              AutoMACC v3 — Results
            </div>
            <h1 className="text-2xl font-display text-[var(--color-ink)]">{fixture.orgName}</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-sec)]">{fixture.orgSector}</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="border border-[var(--color-border-light)] bg-white p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                Baseline
              </div>
              <div className="mt-2 text-2xl font-display text-[var(--color-ink)]">
                {baselineAnnual.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-ink-sec)]">tCO₂e / yr</div>
            </div>
            <div className="border border-[var(--color-border-light)] bg-white p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                Total abatement
              </div>
              <div className="mt-2 text-2xl font-display text-[var(--color-forest)]">
                {Math.round(pkg.totalAbatement).toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-ink-sec)]">tCO₂e over {HORIZON_YEARS} yr</div>
            </div>
            <div className="border border-[var(--color-border-light)] bg-white p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                Reduction
              </div>
              <div className="mt-2 text-2xl font-display text-[var(--color-forest)]">
                {reductionPct.toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-ink-sec)]">vs {HORIZON_YEARS}-yr baseline</div>
            </div>
          </div>

          {pkg.maccData.length > 0 && (
            <section>
              <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-3">
                Marginal abatement cost curve
              </h2>
              <div className="border border-[var(--color-border-light)]">
                <MaccStrip pkg={pkg} recomputing={false} />
              </div>
            </section>
          )}

          {pkg.maccData.length > 0 && (
            <section>
              <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-3">
                Allocated levers · ranked by cost
              </h2>
              <div className="border border-[var(--color-border-light)] overflow-hidden">
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="border-b border-[var(--color-border-light)]">
                      <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] w-8">
                        #
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                        Lever
                      </th>
                      <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                        $/tCO₂e
                      </th>
                      <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                        Abatement ({HORIZON_YEARS} yr)
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                        Zone
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.maccData.map(r => (
                      <tr
                        key={r.leverId}
                        className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-paper-dark)]"
                      >
                        <td className="px-4 py-2.5 text-[var(--color-ink-muted)] font-mono text-xs">
                          {r.rank}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-ink)]">{r.leverName}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--color-ink-sec)]">
                          {fmtCost(r.costPerTco2e)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--color-ink-sec)]">
                          {Math.round(r.tco2eAbatedHorizon).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <ZoneBadge zone={r.zone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {pkg.maccData.length === 0 && (
            <div className="border border-[var(--color-border-light)] bg-white p-8 text-center">
              <p className="text-sm text-[var(--color-ink-muted)]">No levers allocated. Go back and drag levers onto source rows.</p>
            </div>
          )}

          <section className="border border-[var(--color-border-light)] bg-white p-5 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-3">
              ASRS disclosure note
            </div>
            <p className="text-sm text-[var(--color-ink)] leading-relaxed">
              This abatement plan covers Scope 1 and Scope 2 emissions for {fixture.orgName} ({fixture.orgSector}).
              Scope 3 emissions are not assessed. Marginal abatement costs are modelled over a {HORIZON_YEARS}-year
              horizon at a carbon ceiling of $82.68/tCO₂e and an 8% discount rate.
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Prepared with AutoMACC v3 &middot; {doNow.length} do-now &middot; {atPrice.length} at carbon price &middot;{' '}
              {strategic.length} strategic {pkg.maccData.length === 1 ? 'lever' : 'levers'} identified
            </p>
          </section>

          <div>
            <button
              onClick={onBack}
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
            >
              ← Back to allocation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
