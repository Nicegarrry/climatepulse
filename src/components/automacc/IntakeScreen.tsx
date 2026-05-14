'use client';

import { useState, useId } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Fixture } from '@/lib/automacc/types';
import {
  EMISSION_CATEGORIES,
  SECTOR_OPTIONS,
  type IntakeRow,
  type IntakeFormData,
  buildFixture,
} from '@/lib/automacc/intake';
import { consultcoFixture } from '@/lib/automacc/fixture-consultco';
import { ProgressStepper } from './ProgressStepper';

type Props = {
  onComplete: (fixture: Fixture) => void;
};

function makeRow(): IntakeRow {
  return { id: crypto.randomUUID(), categoryKey: '', tco2eEstimate: 0 };
}

const CATEGORY_GROUPS = [...new Set(EMISSION_CATEGORIES.map(c => c.group))];

export function IntakeScreen({ onComplete }: Props) {
  const formId = useId();
  const [orgName, setOrgName] = useState('');
  const [orgSector, setOrgSector] = useState('');
  const [rows, setRows] = useState<IntakeRow[]>([makeRow()]);
  const [error, setError] = useState('');

  const totalTco2e = rows.reduce((sum, r) => sum + (r.tco2eEstimate || 0), 0);

  function addRow() {
    setRows(prev => [...prev, makeRow()]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<IntakeRow>) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) { setError('Organisation name is required.'); return; }
    if (!orgSector) { setError('Please select a sector.'); return; }
    const validRows = rows.filter(r => r.categoryKey && r.tco2eEstimate > 0);
    if (validRows.length === 0) {
      setError('Add at least one emission source with a tCO₂e estimate greater than zero.');
      return;
    }
    setError('');
    const data: IntakeFormData = { orgName: orgName.trim(), orgSector, rows: validRows };
    onComplete(buildFixture(data));
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      <ProgressStepper currentStep="intake" />
      <div className="flex-1 flex items-start justify-center py-16 px-4">
      <form id={formId} onSubmit={handleSubmit} className="w-full max-w-2xl space-y-10">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
            AutoMACC v3
          </div>
          <h1 className="text-2xl font-display text-[var(--color-ink)]">Baseline intake</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-sec)]">
            Enter your organisation&apos;s emission sources to generate a tailored abatement plan.
          </p>
        </div>

        {/* Org profile */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
            Organisation
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm text-[var(--color-ink-sec)] mb-1"
                htmlFor={`${formId}-orgName`}
              >
                Name
              </label>
              <input
                id={`${formId}-orgName`}
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label
                className="block text-sm text-[var(--color-ink-sec)] mb-1"
                htmlFor={`${formId}-orgSector`}
              >
                Sector
              </label>
              <select
                id={`${formId}-orgSector`}
                value={orgSector}
                onChange={e => setOrgSector(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select sector…</option>
                {SECTOR_OPTIONS.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Emission rows */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
              Emission sources
            </h2>
            {totalTco2e > 0 && (
              <span className="text-xs text-[var(--color-ink-sec)]">
                Total:{' '}
                <span className="font-medium text-emerald-600">
                  {totalTco2e.toLocaleString()} tCO₂e
                </span>
              </span>
            )}
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                <div>
                  <label className="sr-only">Emission source {idx + 1}</label>
                  <select
                    value={row.categoryKey}
                    onChange={e => updateRow(row.id, { categoryKey: e.target.value })}
                    className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select source…</option>
                    {CATEGORY_GROUPS.map(group => (
                      <optgroup key={group} label={group}>
                        {EMISSION_CATEGORIES.filter(c => c.group === group).map(c => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sr-only">Annual tCO₂e for source {idx + 1}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.tco2eEstimate || ''}
                    onChange={e =>
                      updateRow(row.id, { tco2eEstimate: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="tCO₂e / yr"
                    className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="p-2 rounded-md text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Remove row"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-500"
          >
            <PlusIcon className="w-4 h-4" />
            Add source
          </button>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-5">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white"
          >
            Generate plan →
          </button>
          <button
            type="button"
            onClick={() => onComplete(consultcoFixture)}
            className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
          >
            Use demo data (ConsultCo)
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
