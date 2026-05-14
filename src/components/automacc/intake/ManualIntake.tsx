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

type Props = {
  orgNameDefault?: string;
  onComplete: (fixture: Fixture) => void;
};

const CATEGORY_GROUPS = [...new Set(EMISSION_CATEGORIES.map(c => c.group))];

const REGION_OPTIONS = ['NSW', 'ACT', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT'];

const REGION_FACTOR: Record<string, number> = {
  NSW: 0.64, ACT: 0.64, VIC: 0.78, QLD: 0.67, SA: 0.22, WA: 0.50, TAS: 0.20, NT: 0.56,
};

const REGION_FACTOR_TIP =
  'Where your main site draws power. Sets your Scope 2 electricity factor. NSW and ACT share 0.64 kg CO2-e per kWh; VIC 0.78; QLD 0.67; SA 0.22; WA SWIS 0.50; TAS 0.20.';

function makeRow(): IntakeRow {
  return { id: crypto.randomUUID(), categoryKey: '', tco2eEstimate: 0 };
}

export function ManualIntake({ orgNameDefault = '', onComplete }: Props) {
  const formId = useId();
  const [orgName, setOrgName] = useState(orgNameDefault);
  const [orgSector, setOrgSector] = useState('');
  const [region, setRegion] = useState('');
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
    if (!region) {
      setError('Pick a state or territory to continue. This sets your electricity factor.');
      return;
    }
    if (!orgSector) {
      setError('Pick a sector to continue. We tailor the rest of the form to it.');
      return;
    }
    const validRows = rows.filter(r => r.categoryKey && r.tco2eEstimate > 0);
    if (validRows.length === 0) {
      setError("Add at least one number. Electricity, fuel, gas, livestock, or waste - anything you have to hand.");
      return;
    }
    setError('');
    const data: IntakeFormData = {
      orgName: orgName.trim() || 'My business',
      orgSector,
      rows: validRows,
    };
    onComplete(buildFixture(data));
  }

  const factor = region ? REGION_FACTOR[region] : null;

  return (
    <form id={formId} onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-10">
      <section className="space-y-4">
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
          §0 - About your business
        </h2>
        <p className="text-xs text-[var(--color-ink-muted)]">Where you are, what you do, and how big you are.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-[var(--color-ink-sec)] mb-1" htmlFor={`${formId}-region`}>
              Primary operating state or territory
            </label>
            <select
              id={`${formId}-region`}
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title={REGION_FACTOR_TIP}
            >
              <option value="">Pick a state or territory...</option>
              {REGION_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {factor !== null && (
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                Scope 2 electricity factor: {factor} kg CO2-e/kWh (NGER 2025).
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[var(--color-ink-sec)] mb-1" htmlFor={`${formId}-orgSector`}>
              Sector
            </label>
            <select
              id={`${formId}-orgSector`}
              value={orgSector}
              onChange={e => setOrgSector(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Pick the closest match. Drives which sections are shown and which levers you see at the end."
            >
              <option value="">Pick a sector...</option>
              {SECTOR_OPTIONS.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-ink-sec)] mb-1" htmlFor={`${formId}-orgName`}>
            Business name (optional)
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
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
              §1 - Emission sources
            </h2>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Electricity, gas, fuel, refrigerants, livestock, waste. Add one row per source.
            </p>
          </div>
          {totalTco2e > 0 && (
            <span className="text-xs text-[var(--color-ink-sec)]">
              Total: <span className="font-medium text-emerald-600">{totalTco2e.toLocaleString()} tCO2-e</span>
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
                  <option value="">Pick a source...</option>
                  {CATEGORY_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {EMISSION_CATEGORIES.filter(c => c.group === group).map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">Annual tCO2-e for source {idx + 1}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={row.tco2eEstimate || ''}
                  onChange={e => updateRow(row.id, { tco2eEstimate: parseFloat(e.target.value) || 0 })}
                  placeholder="tCO2-e / yr"
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
          Calculate my baseline
        </button>
      </div>
    </form>
  );
}
