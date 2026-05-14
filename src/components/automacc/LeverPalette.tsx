'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Lever } from '@/lib/automacc/types';

function fmtCapex(aud: number): string {
  if (aud === 0) return 'no capex';
  if (aud >= 1_000_000) return `$${(aud / 1_000_000).toFixed(aud >= 10_000_000 ? 0 : 1)}M capex`;
  return `$${(aud / 1_000).toFixed(0)}k capex`;
}

function LeverCard({
  lever,
  allocated,
  mutexBlocked,
  rationale,
}: {
  lever: Lever;
  allocated: boolean;
  mutexBlocked: boolean;
  rationale?: string;
}) {
  const disabled = mutexBlocked;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lever-${lever.leverId}`,
    data: { leverId: lever.leverId, isEnabler: lever.isEnabler },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : mutexBlocked ? 0.4 : allocated ? 0.75 : 1,
    cursor: disabled ? 'not-allowed' : 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      suppressHydrationWarning
      className="border border-[var(--color-border-light)] bg-white p-3 hover:border-[var(--color-forest-mid)]"
      data-testid={`lever-${lever.leverId}`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
          {lever.leverId}
        </div>
        {lever.isEnabler && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-plum-mid)]">
            enabler
          </div>
        )}
        {mutexBlocked && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-status-error)]">
            blocked
          </div>
        )}
        {allocated && !mutexBlocked && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-forest)]">
            allocated
          </div>
        )}
      </div>
      <div className="text-sm font-medium text-[var(--color-ink)] leading-tight">{lever.name}</div>
      <div className="mt-2 flex gap-3 text-[10px] text-[var(--color-ink-sec)]">
        <span>~{lever.typicalAbatementPct}% abatement</span>
        <span>{fmtCapex(lever.capexAud)}</span>
      </div>
      {rationale && (
        <div className="mt-1.5 text-[10px] text-[var(--color-ink-muted)] leading-snug line-clamp-2">
          {rationale}
        </div>
      )}
    </div>
  );
}

export function LeverPalette({
  levers,
  allocatedLeverIds,
  mutexBlocked,
  matchRationale,
}: {
  levers: Lever[];
  allocatedLeverIds: Set<string>;
  mutexBlocked: Set<string>;
  matchRationale?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border-light)] bg-[var(--color-paper-dark)]">
      <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-white">
        <div className="text-xs uppercase tracking-wider font-mono text-[var(--color-ink-muted)]">
          Lever palette
        </div>
        <div className="text-sm text-[var(--color-ink-sec)] mt-1">
          {levers.length} levers available. Drag onto a row.
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {levers.map(l => (
          <LeverCard
            key={l.leverId}
            lever={l}
            allocated={allocatedLeverIds.has(l.leverId)}
            mutexBlocked={mutexBlocked.has(l.leverId)}
            rationale={matchRationale?.[l.leverId]}
          />
        ))}
      </div>
    </div>
  );
}
