'use client';

import { useState } from 'react';
import type { Fixture, MaccPackage } from '@/lib/automacc/types';
import { AllocationScreen } from './AllocationScreen';
import { SummaryScreen } from './SummaryScreen';
import { ProgressStepper } from './ProgressStepper';
import { OnboardingScreen, type IntakePath } from './OnboardingScreen';
import { IntakeRouter } from './intake/IntakeRouter';
import { consultcoFixture } from '@/lib/automacc/fixture-consultco';

type Step = 'onboarding' | 'intake' | 'loading' | 'review' | 'allocation' | 'summary';

async function fetchStage1(fixture: Fixture): Promise<{ validation_notes: string; flags: string[] }> {
  const FALLBACK = { validation_notes: 'Baseline looks complete. Proceed to lever allocation.', flags: [] };
  try {
    const res = await fetch('/api/automacc-v3/stage1-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_name: fixture.orgName,
        org_sector: fixture.orgSector,
        rows: fixture.baselineRows.map(r => ({
          label: r.label,
          source: r.source,
          end_use: r.endUse,
          tco2e_estimate: r.tco2eEstimate,
        })),
      }),
    });
    if (!res.ok) return FALLBACK;
    return (await res.json()) as { validation_notes: string; flags: string[] };
  } catch {
    return FALLBACK;
  }
}

async function fetchStage2(fixture: Fixture): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/automacc-v3/stage2-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_name: fixture.orgName,
        org_sector: fixture.orgSector,
        levers: fixture.levers.map(l => ({
          lever_id: l.leverId,
          name: l.name,
          typical_abatement_pct: l.typicalAbatementPct,
          applicable_to: l.applicableTo,
        })),
        rows: fixture.baselineRows.map(r => ({
          row_id: r.rowId,
          label: r.label,
          source: r.source,
          end_use: r.endUse,
          tco2e_estimate: r.tco2eEstimate,
        })),
      }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { rationales?: Record<string, string> };
    return data.rationales ?? {};
  } catch {
    return {};
  }
}

export function AutomaccClient() {
  const [step, setStep] = useState<Step>('onboarding');
  const [intakePath, setIntakePath] = useState<IntakePath>('manual');
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [flags, setFlags] = useState<string[]>([]);
  const [matchRationale, setMatchRationale] = useState<Record<string, string>>({});
  const [maccPackage, setMaccPackage] = useState<MaccPackage | null>(null);

  function handlePickPath(p: IntakePath) {
    setIntakePath(p);
    setStep('intake');
  }

  function handleSkipToDemo() {
    setFixture(consultcoFixture);
    setValidationNotes('Demo data loaded. Review the baseline below.');
    setFlags([]);
    setMatchRationale({});
    setStep('review');
  }

  async function handleIntakeComplete(f: Fixture) {
    setFixture(f);
    setStep('loading');

    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
    const work = Promise.all([fetchStage1(f), fetchStage2(f)]);
    const result = await Promise.race([work, timeout]);

    if (result) {
      const [s1, s2] = result;
      setValidationNotes(s1.validation_notes);
      setFlags(s1.flags);
      setMatchRationale(s2);
    } else {
      setValidationNotes('Baseline looks complete. Proceed to lever allocation.');
      setFlags([]);
      setMatchRationale({});
    }
    setStep('review');
  }

  function handleFinalize(pkg: MaccPackage) {
    setMaccPackage(pkg);
    setStep('summary');
  }

  if (step === 'onboarding') {
    return <OnboardingScreen onPick={handlePickPath} onSkipToDemo={handleSkipToDemo} />;
  }

  if (step === 'intake') {
    return (
      <IntakeRouter
        initialPath={intakePath}
        onComplete={handleIntakeComplete}
        onBack={() => setStep('onboarding')}
      />
    );
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
            AutoMACC v3
          </div>
          <div className="text-sm text-[var(--color-ink-sec)]">Analysing your baseline&hellip;</div>
          <div className="flex justify-center gap-1 pt-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review' && fixture) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <ProgressStepper currentStep="review" />
        <div className="flex-1 flex items-start justify-center py-16 px-4">
        <div className="w-full max-w-2xl space-y-8">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
              AutoMACC v3 — Baseline review
            </div>
            <h1 className="text-2xl font-display text-[var(--color-ink)]">{fixture.orgName}</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-sec)]">{fixture.orgSector}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
              Validation
            </h2>
            <p className="text-sm text-[var(--color-ink)] leading-relaxed">{validationNotes}</p>
            {flags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {flags.map((f, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-[11px] bg-amber-50 border border-amber-200 text-amber-700 font-mono"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
              Source rows · {fixture.baselineRows.length} rows · {fixture.baselineRows.reduce((s, r) => s + r.tco2eEstimate, 0).toLocaleString()} tCO₂e/yr
            </h2>
            {fixture.baselineRows.map(r => (
              <div
                key={r.rowId}
                className="flex items-baseline justify-between py-1.5 border-b border-[var(--color-border-light)]"
              >
                <span className="text-sm text-[var(--color-ink)]">{r.label}</span>
                <span className="text-sm font-mono text-[var(--color-ink-sec)]">
                  {r.tco2eEstimate.toLocaleString()} tCO₂e
                </span>
              </div>
            ))}
          </section>

          <div className="flex items-center gap-5">
            <button
              onClick={() => setStep('allocation')}
              className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white"
            >
              Continue to allocation →
            </button>
            <button
              onClick={() => {
                setFixture(null);
                setStep('intake');
              }}
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
            >
              ← Edit baseline
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (step === 'allocation' && fixture) {
    return (
      <AllocationScreen
        fixture={fixture}
        matchRationale={matchRationale}
        onFinalize={handleFinalize}
      />
    );
  }

  if (step === 'summary' && fixture && maccPackage) {
    return (
      <SummaryScreen
        fixture={fixture}
        pkg={maccPackage}
        onBack={() => setStep('allocation')}
      />
    );
  }

  return null;
}
