'use client';

import { useState } from 'react';
import { CheckIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  type EvidenceEnvelope,
  type EvidenceRow,
  type Confidence,
  renderSourceLine,
} from '@/lib/automacc/evidence-map';
import { ProgressStepper } from './ProgressStepper';

type Props = {
  envelope: EvidenceEnvelope;
  onContinue?: (confirmedEnvelope: EvidenceEnvelope) => void;
  onBack?: () => void;
};

type RowState = {
  userConfirmed: boolean;
  userEdited: boolean;
  editedVolume: number | null;
  editedUnit: string | null;
};

const CONFIDENCE_CHIP: Record<Confidence, { label: string; bg: string; text: string; border: string }> = {
  H: { label: 'H — measured', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  M: { label: 'M — banded', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  L: { label: 'L — imputed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export function PlaybackScreen({ envelope, onContinue, onBack }: Props) {
  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      envelope.rows.map(r => [
        r.rowId,
        {
          userConfirmed: r.userConfirmed,
          userEdited: r.userEdited,
          editedVolume: null,
          editedUnit: null,
        },
      ])
    )
  );
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ value: string; unit: string }>({ value: '', unit: '' });

  const acceptedCount = Object.values(rowStates).filter(s => s.userConfirmed).length;
  const totalCount = envelope.rows.length;
  const allAccepted = acceptedCount === totalCount;

  function handleAccept(rowId: string) {
    setRowStates(prev => ({ ...prev, [rowId]: { ...prev[rowId], userConfirmed: true } }));
  }

  function handleStartEdit(row: EvidenceRow) {
    setEditingRowId(row.rowId);
    setEditDraft({
      value: row.computed.volumeUser?.toString() ?? '',
      unit: row.computed.volumeUserUnit ?? '',
    });
  }

  function handleSaveEdit(rowId: string) {
    const value = parseFloat(editDraft.value);
    if (Number.isNaN(value) || value < 0) return;
    setRowStates(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        userConfirmed: true,
        userEdited: true,
        editedVolume: value,
        editedUnit: editDraft.unit,
      },
    }));
    setEditingRowId(null);
  }

  function handleCancelEdit() {
    setEditingRowId(null);
  }

  function handleRemove(rowId: string) {
    // Stub: real removal wires into engine in D4. Mark as confirmed-skipped.
    setRowStates(prev => ({ ...prev, [rowId]: { ...prev[rowId], userConfirmed: true } }));
  }

  function handleContinue() {
    const next: EvidenceEnvelope = {
      ...envelope,
      rows: envelope.rows.map(r => {
        const s = rowStates[r.rowId];
        return {
          ...r,
          userConfirmed: s.userConfirmed,
          userEdited: s.userEdited,
          computed:
            s.userEdited && s.editedVolume != null
              ? {
                  ...r.computed,
                  volumeUser: s.editedVolume,
                  volumeUserUnit: s.editedUnit ?? r.computed.volumeUserUnit,
                }
              : r.computed,
        };
      }),
    };
    onContinue?.(next);
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      <ProgressStepper currentStep="review" />
      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-3xl space-y-8">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
              AutoMACC v3 — Baseline review
            </div>
            <h1 className="text-2xl font-display text-[var(--color-ink)]">Review your baseline.</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-sec)]">
              Each line below is one source of emissions in your business. Accept the line, or correct it. Levers come next.
            </p>
            <p className="mt-3 text-xs font-mono text-[var(--color-ink-muted)]">
              {envelope.orgName} · {envelope.orgSector} · Total {envelope.totalBaselineTco2e.toLocaleString()} tCO₂-e/yr
            </p>
          </div>

          <div className="space-y-4">
            {envelope.rows.map(row => {
              const state = rowStates[row.rowId];
              const isEditing = editingRowId === row.rowId;
              const chip = CONFIDENCE_CHIP[row.confidence];
              const isImputed = row.computed.volumeUser == null;
              const displayVolume = state.userEdited && state.editedVolume != null
                ? `${state.editedVolume.toLocaleString()} ${state.editedUnit ?? ''}`
                : row.computed.volumeUser != null
                  ? `${row.computed.volumeUser.toLocaleString()} ${row.computed.volumeUserUnit ?? ''}`
                  : '(no value supplied — imputed)';

              return (
                <article
                  key={row.rowId}
                  className={`rounded-lg border bg-white p-5 transition ${
                    state.userConfirmed
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-[var(--color-border)]'
                  }`}
                  data-testid={`playback-card-${row.rowId}`}
                >
                  <header className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-medium text-[var(--color-ink)]">{row.label}</h2>
                      <p className="mt-1 text-xs text-[var(--color-ink-sec)]">{displayVolume}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border ${chip.bg} ${chip.text} ${chip.border}`}
                        title={isImputed ? 'Imputed from sector default' : undefined}
                      >
                        {chip.label}
                      </span>
                      {isImputed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                          Imputed
                        </span>
                      )}
                    </div>
                  </header>

                  <div className="mt-3 text-sm font-mono text-[var(--color-ink)]">
                    {row.computed.formulaRendered}
                  </div>

                  <footer
                    className="mt-4 pt-3 border-t border-dashed border-[var(--color-border-light)] space-y-1 text-xs text-[var(--color-ink-sec)] leading-relaxed"
                    data-testid={`citation-footer-${row.rowId}`}
                  >
                    <div>{renderSourceLine(row)}</div>
                    <div>
                      <span className="font-medium text-[var(--color-ink-muted)]">{row.factor.name}</span>
                      {' — '}
                      <span className="text-[var(--color-ink-muted)]">{row.factor.edition}</span>
                    </div>
                  </footer>

                  {isEditing ? (
                    <div className="mt-4 grid grid-cols-[1fr_120px_auto_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
                          Replace with
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={editDraft.value}
                          onChange={e => setEditDraft(d => ({ ...d, value: e.target.value }))}
                          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={editDraft.unit}
                          onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))}
                          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(row.rowId)}
                        className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white"
                      >
                        Save and accept
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3 py-2 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleAccept(row.rowId)}
                        disabled={state.userConfirmed && !state.userEdited}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white disabled:bg-emerald-200 disabled:cursor-not-allowed"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        {state.userConfirmed && !state.userEdited ? 'Accepted' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(row)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-stone-50 text-xs text-[var(--color-ink-sec)]"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(row.rowId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Remove
                      </button>
                      {state.userEdited && (
                        <span className="text-[11px] font-mono text-amber-600">edited</span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--color-ink-muted)]">
              {acceptedCount} of {totalCount} lines reviewed
            </p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!allAccepted}
                title={allAccepted ? undefined : `${totalCount - acceptedCount} lines still need a click.`}
                className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:bg-emerald-200 disabled:cursor-not-allowed"
              >
                Continue to lever recommendations →
              </button>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
                >
                  ← Go back to my answers
                </button>
              )}
            </div>
            {allAccepted && (
              <p className="text-xs text-emerald-700">
                All lines accepted. Total baseline: {envelope.totalBaselineTco2e.toLocaleString()} tCO₂-e per year.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
