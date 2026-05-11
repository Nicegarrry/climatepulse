'use client';

import { useDroppable, useDndContext } from '@dnd-kit/core';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Allocation, Fixture, Lever, SourceRow } from '@/lib/automacc/types';

function isCompatible(lever: Lever, row: SourceRow): boolean {
  return lever.applicableTo.some(
    a => a.source === row.source && (a.endUse === null || a.endUse === row.endUse),
  );
}

function SourceRowZone({
  row,
  fixture,
  allocations,
  activeLever,
  onDeallocate,
}: {
  row: SourceRow;
  fixture: Fixture;
  allocations: Allocation[];
  activeLever: Lever | null;
  onDeallocate: (allocationId: string, label: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `row-${row.rowId}`,
    data: { rowId: row.rowId },
  });

  const compatible = activeLever ? isCompatible(activeLever, row) : true;
  const highlight = isOver && compatible;
  const reject = isOver && !compatible;

  const attached = allocations.filter(a => a.sourceRowIds.includes(row.rowId));

  return (
    <div
      ref={setNodeRef}
      className={
        'border-b border-[var(--color-border-light)] px-4 py-3 transition-colors ' +
        (highlight
          ? 'bg-[var(--color-sage-tint)]'
          : reject
          ? 'bg-red-50 outline outline-2 outline-[var(--color-status-error)]'
          : 'bg-white hover:bg-[var(--color-paper-dark)]')
      }
      data-testid={`row-${row.rowId}`}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
            {row.rowId} · {row.source}
            {row.endUse && ` / ${row.endUse}`}
          </div>
          <div className="text-sm font-medium text-[var(--color-ink)] mt-0.5">{row.label}</div>
        </div>
        <div className="text-sm font-mono text-[var(--color-ink-sec)]">
          {row.tco2eEstimate} tCO2e/yr
        </div>
      </div>
      {attached.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attached.map(a => {
            const lever = fixture.levers.find(l => l.leverId === a.leverId);
            if (!lever) return null;
            return (
              <span
                key={a.allocationId}
                className="inline-flex items-center gap-1 text-[11px] bg-[var(--color-sage-tint)] text-[var(--color-forest)] px-2 py-0.5 font-mono"
              >
                {lever.leverId}
                <button
                  type="button"
                  aria-label={`Remove ${lever.name}`}
                  onClick={() => onDeallocate(a.allocationId, `removed ${lever.name}`)}
                  className="hover:text-[var(--color-status-error)]"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {reject && activeLever && (
        <div className="mt-2 text-[11px] text-[var(--color-status-error)]">
          {activeLever.name} does not apply to this source.
        </div>
      )}
    </div>
  );
}

export function SourceRows({
  fixture,
  allocations,
  onDeallocate,
}: {
  fixture: Fixture;
  allocations: Allocation[];
  onDeallocate: (allocationId: string, label: string) => void;
}) {
  const { active } = useDndContext();
  const activeLeverId = active?.data.current?.leverId as string | undefined;
  const activeLever = activeLeverId
    ? fixture.levers.find(l => l.leverId === activeLeverId) ?? null
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-white">
        <div className="text-xs uppercase tracking-wider font-mono text-[var(--color-ink-muted)]">
          Source rows — {fixture.orgName}
        </div>
        <div className="text-sm text-[var(--color-ink-sec)] mt-1">
          {fixture.baselineRows.length} baseline rows. Drop a lever to allocate.
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {fixture.baselineRows.map(r => (
          <SourceRowZone
            key={r.rowId}
            row={r}
            fixture={fixture}
            allocations={allocations}
            activeLever={activeLever}
            onDeallocate={onDeallocate}
          />
        ))}
      </div>
    </div>
  );
}
