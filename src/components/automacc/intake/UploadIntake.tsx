'use client';

import { useState, useRef } from 'react';
import {
  ArrowUpTrayIcon,
  CheckIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Fixture, SourceRow } from '@/lib/automacc/types';
import { getLeversForFixture } from '@/lib/automacc/lever-db';

type DocType = 'electricity_bill' | 'gas_bill' | 'fleet_log' | 'annual_report';

const DOC_TYPE_HUMAN: Record<DocType, string> = {
  electricity_bill: 'electricity bill',
  gas_bill: 'gas bill',
  fleet_log: 'fleet or fuel-card statement',
  annual_report: 'annual or sustainability report',
};

const ACCEPTED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;

type FileState = 'queued' | 'classifying' | 'extracted' | 'unsupported' | 'failed';

type ExtractedRow = {
  id: string;
  field: string;
  fieldHuman: string;
  envelopeSource: string;
  envelopeEndUse: string | null;
  value: number;
  unit: string;
  factor: number;
  factorUnit: string;
  factorCitation: string;
  tco2e: number;
  sourceText: string;
  pageNo: number;
  confidence: 'H' | 'M' | 'L';
  confidenceRationale: string;
  userConfirmed: boolean;
};

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  state: FileState;
  docType: DocType | null;
  rows: ExtractedRow[];
};

type Props = {
  orgNameDefault?: string;
  onComplete: (fixture: Fixture) => void;
};

export function UploadIntake({ orgNameDefault = 'My business', onComplete }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [orgName, setOrgName] = useState(orgNameDefault);
  const [orgSector, setOrgSector] = useState<string>('professional_services');
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const acceptedSoFar = files.length;
    const room = MAX_FILES - acceptedSoFar;
    const toProcess = incoming.slice(0, Math.max(0, room));

    for (const f of toProcess) {
      const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const initial: UploadedFile = { id, name: f.name, size: f.size, state: 'queued', docType: null, rows: [] };

      if (!ACCEPTED_MIMES.includes(f.type) && !f.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
        setFiles(prev => [...prev, { ...initial, state: 'unsupported' }]);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFiles(prev => [...prev, { ...initial, state: 'failed' }]);
        continue;
      }

      setFiles(prev => [...prev, { ...initial, state: 'classifying' }]);

      // Simulated extraction. Real Gemini wiring lands in a later qubit.
      const docType = inferDocType(f.name);
      setTimeout(() => {
        setFiles(prev =>
          prev.map(p =>
            p.id === id
              ? docType
                ? { ...p, state: 'extracted', docType, rows: mockExtractedRows(id, docType) }
                : { ...p, state: 'unsupported' }
              : p,
          ),
        );
      }, 700);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function onDragLeave() {
    setDragActive(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function acceptRow(fileId: string, rowId: string) {
    setFiles(prev =>
      prev.map(p =>
        p.id === fileId
          ? { ...p, rows: p.rows.map(r => (r.id === rowId ? { ...r, userConfirmed: true } : r)) }
          : p,
      ),
    );
  }

  function skipRow(fileId: string, rowId: string) {
    setFiles(prev =>
      prev.map(p =>
        p.id === fileId
          ? { ...p, rows: p.rows.map(r => (r.id === rowId ? { ...r, userConfirmed: true, value: 0, tco2e: 0 } : r)) }
          : p,
      ),
    );
  }

  function removeFile(fileId: string) {
    setFiles(prev => prev.filter(p => p.id !== fileId));
  }

  const allRows = files.flatMap(f => f.rows);
  const totalRows = allRows.length;
  const confirmedRows = allRows.filter(r => r.userConfirmed).length;
  const unreviewed = totalRows - confirmedRows;
  const canSubmit = totalRows > 0 && unreviewed === 0;

  function finalize() {
    const baselineRows: SourceRow[] = allRows
      .filter(r => r.userConfirmed && r.tco2e > 0)
      .map((r, i) => ({
        rowId: `R${i + 1}`,
        source: r.envelopeSource,
        endUse: r.envelopeEndUse,
        label: r.fieldHuman,
        tco2eEstimate: Math.round(r.tco2e),
      }));
    const fixture: Fixture = {
      orgName,
      orgSector,
      baselineRows,
      levers: getLeversForFixture(orgSector, baselineRows.map(r => ({ source: r.source, endUse: r.endUse }))),
    };
    onComplete(fixture);
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-[var(--color-ink-sec)] mb-1">Business name</label>
          <input
            type="text"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="My business"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-ink-sec)] mb-1">Sector</label>
          <select
            value={orgSector}
            onChange={e => setOrgSector(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="professional_services">Professional services</option>
            <option value="services">Other services / hospitality</option>
            <option value="retail">Retail</option>
            <option value="built_environment">Built environment</option>
            <option value="industrial">Industrial / manufacturing</option>
            <option value="transport">Transport / logistics</option>
            <option value="agriculture">Agriculture</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-[var(--color-ink-sec)] leading-relaxed">
        We read four document types: electricity bills, gas bills, fleet or fuel-card statements, and
        corporate annual or sustainability reports. We extract the volumes only. We do not store the
        file after you submit.
      </p>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-[var(--color-forest)] bg-[var(--color-sage-tint)]'
            : 'border-[var(--color-border-light)] bg-white hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]'
        }`}
      >
        <ArrowUpTrayIcon className="w-6 h-6 mx-auto text-[var(--color-forest-mid)] mb-3" />
        <p className="text-base font-medium text-[var(--color-ink)]">
          {dragActive ? 'Release to upload.' : 'Drop your bills here.'}
        </p>
        <p className="text-sm text-[var(--color-ink-sec)] mt-1">Or pick files from your computer.</p>
        <p className="text-xs text-[var(--color-ink-muted)] mt-3">
          PDF, JPG, or PNG. Up to ten files. Up to 20 MB per file. Up to 50 pages per PDF.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          {files.map(f => (
            <FileCard
              key={f.id}
              file={f}
              onAcceptRow={rid => acceptRow(f.id, rid)}
              onSkipRow={rid => skipRow(f.id, rid)}
              onRemove={() => removeFile(f.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--color-ink-muted)]">
        We delete your uploaded files when you submit, or after 24 hours, whichever comes first. The
        values you accept stay in your baseline.
      </p>

      {totalRows > 0 && (
        <div className="border-t border-[var(--color-border-light)] pt-4 space-y-3">
          <p className="text-sm text-[var(--color-ink)]">
            {files.length} files processed. {confirmedRows} of {totalRows} values reviewed.
          </p>
          {unreviewed > 0 && (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Review the remaining {unreviewed} before continuing.
            </p>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={finalize}
            className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-[var(--color-ink-faint)] disabled:cursor-not-allowed text-sm font-medium text-white"
            title={canSubmit ? undefined : `${unreviewed} rows still need a click before we can continue.`}
          >
            Continue to baseline review
          </button>
        </div>
      )}
    </div>
  );
}

function FileCard({
  file,
  onAcceptRow,
  onSkipRow,
  onRemove,
}: {
  file: UploadedFile;
  onAcceptRow: (rowId: string) => void;
  onSkipRow: (rowId: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-[var(--color-border-light)] rounded-md bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
        <div>
          <div className="text-sm font-medium text-[var(--color-ink)] truncate max-w-xs" title={file.name}>
            {file.name}
          </div>
          <div className="text-xs text-[var(--color-ink-muted)] mt-0.5">{stateLine(file)}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-md text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-50"
          aria-label="Remove file"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      {file.state === 'extracted' && (
        <div className="divide-y divide-[var(--color-border-light)]">
          {file.rows.map(r => (
            <ExtractedRowCard
              key={r.id}
              row={r}
              filename={file.name}
              onAccept={() => onAcceptRow(r.id)}
              onSkip={() => onSkipRow(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExtractedRowCard({
  row,
  filename,
  onAccept,
  onSkip,
}: {
  row: ExtractedRow;
  filename: string;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const chip =
    row.confidence === 'H'
      ? { text: 'H - printed clearly', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
      : row.confidence === 'M'
      ? { text: 'M - read with light interpretation', cls: 'bg-amber-50 border-amber-200 text-amber-700' }
      : { text: 'L - low certainty', cls: 'bg-red-50 border-red-200 text-red-700' };
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--color-ink)]">{row.fieldHuman}</div>
          <div className="text-sm font-mono text-[var(--color-ink-sec)] mt-0.5">
            {row.value.toLocaleString()} {row.unit}
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] border font-mono ${chip.cls}`}>{chip.text}</span>
      </div>
      <div className="text-xs text-[var(--color-ink-muted)] leading-relaxed">
        From page {row.pageNo} of {filename}: &lsquo;{row.sourceText}&rsquo;
      </div>
      <div className="text-xs text-[var(--color-ink-muted)]">
        {row.value.toLocaleString()} {row.unit} x {row.factor} {row.factorUnit} ={' '}
        <span className="font-mono">{row.tco2e.toFixed(1)} tCO2-e per year</span>
      </div>
      <div className="text-[11px] text-[var(--color-ink-muted)] italic">{row.factorCitation}</div>
      {!row.userConfirmed && (
        <div className="flex items-center gap-2 pt-1.5">
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white inline-flex items-center gap-1.5"
          >
            <CheckIcon className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-[var(--color-border-light)] hover:bg-[var(--color-sage-tint)] text-xs text-[var(--color-ink)] inline-flex items-center gap-1.5"
            disabled
          >
            <PencilSquareIcon className="w-3.5 h-3.5" /> Edit value
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)] underline underline-offset-2"
          >
            Skip this row
          </button>
        </div>
      )}
      {row.userConfirmed && (
        <div className="pt-1">
          <span className="text-[11px] text-emerald-700 font-mono">Accepted</span>
        </div>
      )}
    </div>
  );
}

function stateLine(f: UploadedFile): string {
  if (f.state === 'queued') return 'Queued';
  if (f.state === 'classifying') return 'Reading the first page.';
  if (f.state === 'extracted') {
    const human = f.docType ? DOC_TYPE_HUMAN[f.docType] : 'document';
    return `Looks like a ${human}. ${f.rows.length} values found. Review them below.`;
  }
  if (f.state === 'unsupported') return "This doesn't look like a bill, fleet statement, or report. Use the form path for this one.";
  if (f.state === 'failed') return 'Files need to be under 20 MB. Try splitting a multi-year statement into single-year PDFs.';
  return '';
}

function inferDocType(filename: string): DocType | null {
  const n = filename.toLowerCase();
  if (n.includes('elec') || n.includes('agl') || n.includes('origin') || n.includes('energy')) return 'electricity_bill';
  if (n.includes('gas') || n.includes('jemena')) return 'gas_bill';
  if (n.includes('fleet') || n.includes('fuel') || n.includes('bp') || n.includes('shell') || n.includes('caltex')) return 'fleet_log';
  if (n.includes('annual') || n.includes('sustainab') || n.includes('report')) return 'annual_report';
  return 'electricity_bill'; // demo fallback so the path is testable without real bills
}

function mockExtractedRows(fileId: string, docType: DocType): ExtractedRow[] {
  const stamp = (k: string) => `${fileId}_${k}`;
  if (docType === 'electricity_bill') {
    const kwh = 41832;
    return [
      {
        id: stamp('elec'),
        field: 'electricity_kwh_buildings',
        fieldHuman: 'Annual building electricity',
        envelopeSource: 'electricity',
        envelopeEndUse: 'lighting_hvac',
        value: kwh,
        unit: 'kWh',
        factor: 0.64,
        factorUnit: 'kg CO2-e/kWh',
        factorCitation: 'NGER 2025 Scope 2 - NSW and ACT (DCCEEW, August 2025)',
        tco2e: (kwh * 0.64) / 1000,
        sourceText: "Your usage history - Apr 2025 to Mar 2026 - total 41,832 kWh",
        pageNo: 2,
        confidence: 'H',
        confidenceRationale: '12-month history table extracted on page 2.',
        userConfirmed: false,
      },
    ];
  }
  if (docType === 'gas_bill') {
    const gj = 320;
    return [
      {
        id: stamp('gas'),
        field: 'natural_gas_gj_low_temp',
        fieldHuman: 'Annual gas - heating, hot water, cooking',
        envelopeSource: 'stationary_combustion',
        envelopeEndUse: 'space_heating',
        value: gj,
        unit: 'GJ',
        factor: 51.53,
        factorUnit: 'kg CO2-e/GJ',
        factorCitation: 'NGER 2025 stationary natural gas (DCCEEW, August 2025)',
        tco2e: (gj * 51.53) / 1000,
        sourceText: 'Total usage for billing period: 320 GJ',
        pageNo: 1,
        confidence: 'M',
        confidenceRationale: 'Annualised from a single billing period.',
        userConfirmed: false,
      },
    ];
  }
  if (docType === 'fleet_log') {
    const diesel = 18450;
    const petrol = 4200;
    return [
      {
        id: stamp('diesel'),
        field: 'diesel_transport_litres',
        fieldHuman: 'Annual fleet diesel',
        envelopeSource: 'mobile_combustion',
        envelopeEndUse: 'fleet_heavy_vehicles',
        value: diesel,
        unit: 'L',
        factor: 2.72,
        factorUnit: 'kg CO2-e/L',
        factorCitation: 'NGER 2025 mobile diesel (DCCEEW, August 2025)',
        tco2e: (diesel * 2.72) / 1000,
        sourceText: '12-month diesel total across cards: 18,450 L',
        pageNo: 1,
        confidence: 'H',
        confidenceRationale: 'Aggregate fuel-card total across 12-month period.',
        userConfirmed: false,
      },
      {
        id: stamp('petrol'),
        field: 'petrol_transport_litres',
        fieldHuman: 'Annual fleet petrol',
        envelopeSource: 'mobile_combustion',
        envelopeEndUse: 'fleet_light_vehicles',
        value: petrol,
        unit: 'L',
        factor: 2.32,
        factorUnit: 'kg CO2-e/L',
        factorCitation: 'NGER 2025 mobile petrol (DCCEEW, August 2025)',
        tco2e: (petrol * 2.32) / 1000,
        sourceText: '12-month petrol total across cards: 4,200 L',
        pageNo: 1,
        confidence: 'H',
        confidenceRationale: 'Aggregate fuel-card total across 12-month period.',
        userConfirmed: false,
      },
    ];
  }
  // annual_report
  const kwh = 156000;
  const stationary = 88;
  return [
    {
      id: stamp('elec_ar'),
      field: 'electricity_kwh_buildings',
      fieldHuman: 'Annual building electricity',
      envelopeSource: 'electricity',
      envelopeEndUse: 'lighting_hvac',
      value: kwh,
      unit: 'kWh',
      factor: 0.64,
      factorUnit: 'kg CO2-e/kWh',
      factorCitation: 'NGER 2025 Scope 2 - NSW and ACT (DCCEEW, August 2025)',
      tco2e: (kwh * 0.64) / 1000,
      sourceText: 'Scope 2 electricity 156 MWh',
      pageNo: 32,
      confidence: 'M',
      confidenceRationale: 'Disclosed in MWh on the sustainability data table.',
      userConfirmed: false,
    },
    {
      id: stamp('stat_ar'),
      field: 'scope1_stationary_tco2e',
      fieldHuman: 'Stationary combustion (Scope 1)',
      envelopeSource: 'stationary_combustion',
      envelopeEndUse: 'space_heating',
      value: stationary,
      unit: 'tCO2-e',
      factor: 1,
      factorUnit: 'tCO2-e',
      factorCitation: 'NGER s.19 disclosure (verbatim)',
      tco2e: stationary,
      sourceText: 'Scope 1 stationary: 88 tCO2-e',
      pageNo: 32,
      confidence: 'H',
      confidenceRationale: 'Verbatim from NGER-aligned disclosure.',
      userConfirmed: false,
    },
  ];
}
