'use client';

import { ArrowUturnLeftIcon, ArrowUturnRightIcon, TrashIcon } from '@heroicons/react/24/outline';

export function UndoBar({
  canUndo,
  canRedo,
  lastUndoLabel,
  onUndo,
  onRedo,
  onReset,
  allocationCount,
}: {
  canUndo: boolean;
  canRedo: boolean;
  lastUndoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  allocationCount: number;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border-light)] bg-white px-6 py-3">
      <div className="text-xs text-[var(--color-ink-sec)] font-mono">
        {allocationCount} {allocationCount === 1 ? 'lever allocated' : 'levers allocated'}
        {lastUndoLabel && canUndo && (
          <span className="ml-3 text-[var(--color-ink-muted)]">last action: {lastUndoLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last action"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border-light)] hover:bg-[var(--color-paper-dark)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo last action"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border-light)] hover:bg-[var(--color-paper-dark)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowUturnRightIcon className="w-3.5 h-3.5" />
          Redo
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={allocationCount === 0}
          aria-label="Reset scenario"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-status-error)] border border-[var(--color-border-light)] hover:bg-[var(--color-paper-dark)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
}
