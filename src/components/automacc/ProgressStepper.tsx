'use client';

export type ProgressStep = 'intake' | 'review' | 'allocation' | 'summary';

const STEPS: { id: ProgressStep; label: string }[] = [
  { id: 'intake', label: 'Baseline' },
  { id: 'review', label: 'Review' },
  { id: 'allocation', label: 'Allocate' },
  { id: 'summary', label: 'Summary' },
];

const ORDER: Record<ProgressStep, number> = { intake: 0, review: 1, allocation: 2, summary: 3 };

export function ProgressStepper({ currentStep }: { currentStep: ProgressStep }) {
  const cur = ORDER[currentStep];
  return (
    <div className="flex items-center px-6 py-3 bg-white border-b border-[var(--color-border-light)]">
      {STEPS.map((step, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-px w-10 mx-3 ${done ? 'bg-[var(--color-forest)]' : 'bg-[var(--color-border-light)]'}`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium shrink-0 ${
                  done
                    ? 'bg-[var(--color-forest)] text-white'
                    : active
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'border border-[var(--color-border-light)] text-[var(--color-ink-muted)]'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider ${
                  active
                    ? 'text-[var(--color-ink)]'
                    : done
                    ? 'text-[var(--color-forest-mid)]'
                    : 'text-[var(--color-ink-muted)]'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
