'use client';

import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAllocationStore } from '@/lib/automacc/store';
import { LeverPalette } from './LeverPalette';
import { SourceRows } from './SourceRows';
import { MaccStrip } from './MaccStrip';
import { SensitivityTornado } from './SensitivityTornado';
import { UndoBar } from './UndoBar';
import { ProgressStepper } from './ProgressStepper';
import type { Fixture, MaccPackage, SessionContext } from '@/lib/automacc/types';

type Props = {
  fixture: Fixture;
  matchRationale?: Record<string, string>;
  onFinalize: (pkg: MaccPackage) => void;
};

export function AllocationScreen({ fixture, matchRationale, onFinalize }: Props) {
  const ctx = useMemo<SessionContext>(
    () => ({ discountRate: 0.08, horizonYears: 10, carbonCeilingAud: 82.68, orgSector: fixture.orgSector }),
    [fixture.orgSector],
  );
  const store = useAllocationStore(fixture, ctx);
  const [recomputing, setRecomputing] = useState(false);
  const [lastAction, setLastAction] = useState<number>(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (lastAction === 0) return;
    setRecomputing(true);
    const t = setTimeout(() => setRecomputing(false), 300);
    return () => clearTimeout(t);
  }, [lastAction]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (store.canUndo) {
          store.undo();
          setLastAction(Date.now());
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        if (store.canRedo) {
          store.redo();
          setLastAction(Date.now());
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  function handleDragEnd(e: DragEndEvent) {
    const leverId = e.active.data.current?.leverId as string | undefined;
    const isEnabler = (e.active.data.current?.isEnabler as boolean | undefined) ?? false;
    const rowId = e.over?.data.current?.rowId as string | undefined;
    if (!leverId || !rowId) return;

    const lever = fixture.levers.find(l => l.leverId === leverId);
    const row = fixture.baselineRows.find(r => r.rowId === rowId);
    if (!lever || !row) return;

    const compatible = lever.applicableTo.some(
      a => a.source === row.source && (a.endUse === null || a.endUse === row.endUse),
    );
    if (!compatible) return;
    if (store.mutexBlocked.has(leverId)) return;

    store.allocate(leverId, [rowId], isEnabler, `allocated ${lever.name}`);
    setLastAction(Date.now());
  }

  function handleDeallocate(allocationId: string, label: string) {
    store.deallocate(allocationId, label);
    setLastAction(Date.now());
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-[var(--color-background)]">
        <ProgressStepper currentStep="allocation" />
        <div className="border-b border-[var(--color-border-light)] bg-white px-6 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                AutoMACC v3 — Lever allocation
              </div>
              <h1 className="text-xl font-display text-[var(--color-ink)]">
                Build the marginal abatement curve for {fixture.orgName}
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-xs text-[var(--color-ink-sec)] font-mono">
                {fixture.orgSector} · {ctx.horizonYears}-year horizon · ${ctx.carbonCeilingAud}/tCO2e ceiling
              </div>
              <button
                type="button"
                onClick={() => onFinalize(store.maccPackage)}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white shrink-0"
              >
                Generate summary →
              </button>
            </div>
          </div>
        </div>

        <MaccStrip pkg={store.maccPackage} recomputing={recomputing} />

        <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
          <SourceRows
            fixture={fixture}
            allocations={store.state.allocations}
            onDeallocate={handleDeallocate}
          />
          <LeverPalette
            levers={fixture.levers}
            allocatedLeverIds={store.allocatedLeverIds}
            mutexBlocked={store.mutexBlocked}
            matchRationale={matchRationale}
          />
        </div>

        <SensitivityTornado pkg={store.maccPackage} />

        <UndoBar
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          lastUndoLabel={store.lastUndoLabel}
          onUndo={() => {
            store.undo();
            setLastAction(Date.now());
          }}
          onRedo={() => {
            store.redo();
            setLastAction(Date.now());
          }}
          onReset={() => {
            store.reset();
            setLastAction(Date.now());
          }}
          allocationCount={store.state.allocations.length}
        />
      </div>
    </DndContext>
  );
}
