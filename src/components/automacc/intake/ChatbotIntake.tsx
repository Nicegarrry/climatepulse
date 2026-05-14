'use client';

import { useState } from 'react';
import type { Fixture, SourceRow } from '@/lib/automacc/types';
import { getLeversForFixture } from '@/lib/automacc/lever-db';

type TurnId =
  | 'T1_Sector'
  | 'T2_Region'
  | 'T3_Size'
  | 'T5_Primary'
  | 'T6_Secondary'
  | 'T7_Playback'
  | 'T8_FB_Estimate';

type Sector =
  | 'professional_services'
  | 'hospitality'
  | 'built_environment'
  | 'retail'
  | 'industrial_light'
  | 'industrial_heavy'
  | 'transport'
  | 'agriculture'
  | 'other';

type Band = { value: string; label: string; midpoint: number | null };

type Envelope = {
  sector: Sector | null;
  sectorFreeText: string;
  region: string | null;
  sizeBand: string | null;
  sizeMidpoint: number | null;
  primaryBand: Band | null;
  secondaryBand: Band | null;
  fallback: boolean;
  fallbackReason: string;
  turnsUsed: number;
};

type Props = {
  orgName: string;
  onComplete: (fixture: Fixture) => void;
  onAbort: () => void;
};

const SECTOR_OPTIONS: { value: Sector; label: string }[] = [
  { value: 'professional_services', label: 'Professional services (consultancy, legal, finance, agency)' },
  { value: 'hospitality', label: 'Hospitality (cafe, restaurant, hotel, pub)' },
  { value: 'built_environment', label: 'Built environment (commercial landlord, property manager)' },
  { value: 'retail', label: 'Retail (shop, supermarket, e-commerce fulfilment)' },
  { value: 'industrial_light', label: 'Industrial - light (small manufacturing, fabrication, food processing)' },
  { value: 'industrial_heavy', label: 'Industrial - heavy (cement, steel, glass, smelting, petchem)' },
  { value: 'transport', label: 'Transport and logistics (fleet, freight, distribution)' },
  { value: 'agriculture', label: 'Agriculture (livestock, cropping, horticulture)' },
  { value: 'other', label: 'Something else (describe it in one line)' },
];

const REGION_OPTIONS = ['NSW', 'ACT', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'Multiple states - no single main site'];

const SIZE_BANDS: Band[] = [
  { value: '1-10', label: '1 to 10 people', midpoint: 5 },
  { value: '11-50', label: '11 to 50 people', midpoint: 30 },
  { value: '51-200', label: '51 to 200 people', midpoint: 125 },
  { value: '201-500', label: '201 to 500 people', midpoint: 350 },
  { value: '501-1000', label: '501 to 1,000 people', midpoint: 750 },
  { value: 'gt-1000', label: 'More than 1,000 people', midpoint: 1500 },
];

const ELEC_BANDS: Band[] = [
  { value: 'lt-10k', label: 'Under 10,000 kWh', midpoint: 5000 },
  { value: '10-50k', label: '10,000 to 50,000 kWh', midpoint: 30000 },
  { value: '50-250k', label: '50,000 to 250,000 kWh', midpoint: 150000 },
  { value: '250k-1m', label: '250,000 to 1,000,000 kWh (1 GWh)', midpoint: 625000 },
  { value: 'gt-1m', label: 'More than 1 GWh', midpoint: 2000000 },
];

const GAS_BANDS: Band[] = [
  { value: 'lt-500', label: 'Under 500 GJ', midpoint: 250 },
  { value: '500-5k', label: '500 to 5,000 GJ', midpoint: 2750 },
  { value: '5k-50k', label: '5,000 to 50,000 GJ', midpoint: 27500 },
  { value: 'gt-50k', label: 'More than 50,000 GJ', midpoint: 100000 },
];

const DIESEL_BANDS: Band[] = [
  { value: 'lt-5k', label: 'Under 5,000 L', midpoint: 2500 },
  { value: '5-25k', label: '5,000 to 25,000 L', midpoint: 15000 },
  { value: '25-100k', label: '25,000 to 100,000 L', midpoint: 62500 },
  { value: '100-500k', label: '100,000 to 500,000 L', midpoint: 300000 },
  { value: 'gt-500k', label: 'More than 500,000 L', midpoint: 1000000 },
];

const REGION_FACTOR: Record<string, number> = {
  NSW: 0.64, ACT: 0.64, VIC: 0.78, QLD: 0.67, SA: 0.22, WA: 0.50, TAS: 0.20, NT: 0.56,
  'Multiple states - no single main site': 0.62,
};

const SECTOR_DEFAULT_INTENSITY: Record<Sector, number> = {
  professional_services: 1.5, hospitality: 4.0, built_environment: 3.0, retail: 2.5,
  industrial_light: 8.0, industrial_heavy: 20.0, transport: 12.0, agriculture: 12.0, other: 1.5,
};

const SECTOR_TO_INTAKE_KEY: Record<Sector, string> = {
  professional_services: 'professional_services',
  hospitality: 'services',
  built_environment: 'built_environment',
  retail: 'retail',
  industrial_light: 'industrial',
  industrial_heavy: 'industrial',
  transport: 'transport',
  agriculture: 'agriculture',
  other: 'services',
};

type Msg = { who: 'bot' | 'you'; text: string };

export function ChatbotIntake({ orgName, onComplete, onAbort }: Props) {
  const [turn, setTurn] = useState<TurnId>('T1_Sector');
  const [envelope, setEnvelope] = useState<Envelope>({
    sector: null, sectorFreeText: '', region: null, sizeBand: null, sizeMidpoint: null,
    primaryBand: null, secondaryBand: null, fallback: false, fallbackReason: '', turnsUsed: 0,
  });
  const [transcript, setTranscript] = useState<Msg[]>([
    { who: 'bot', text: 'Tell me about your business.' },
    { who: 'bot', text: "Five to eight short questions. Skip any you don't know. I will estimate the rest from what we have." },
  ]);

  function say(text: string, who: 'bot' | 'you' = 'bot') {
    setTranscript(t => [...t, { who, text }]);
  }

  function pickSector(s: Sector, label: string) {
    say(label, 'you');
    setEnvelope(e => ({ ...e, sector: s, turnsUsed: e.turnsUsed + 1 }));
    say('Which state or territory is your main site in?');
    setTurn('T2_Region');
  }

  function pickRegion(r: string) {
    say(r, 'you');
    setEnvelope(e => ({ ...e, region: r, turnsUsed: e.turnsUsed + 1 }));
    say('Roughly how many people work in the business?');
    setTurn('T3_Size');
  }

  function pickSize(b: Band) {
    say(b.label, 'you');
    setEnvelope(e => ({ ...e, sizeBand: b.value, sizeMidpoint: b.midpoint, turnsUsed: e.turnsUsed + 1 }));
    const next = nextPrimaryPrompt(envelope.sector ?? 'professional_services');
    say(next);
    setTurn('T5_Primary');
  }

  function pickPrimary(b: Band) {
    say(b.label, 'you');
    setEnvelope(e => ({ ...e, primaryBand: b, turnsUsed: e.turnsUsed + 1 }));
    say(secondaryPrompt(envelope.sector ?? 'professional_services'));
    setTurn('T6_Secondary');
  }

  function pickSecondary(b: Band | null, label: string) {
    say(label, 'you');
    setEnvelope(e => ({ ...e, secondaryBand: b, turnsUsed: e.turnsUsed + 1 }));
    say('Here is what I have. Anything wrong?');
    setTurn('T7_Playback');
  }

  function skipToEstimate() {
    say("I am not sure - estimate from what we have", 'you');
    setEnvelope(e => ({ ...e, fallback: true, fallbackReason: 'skip_to_estimate_clicked' }));
    say('Skipping to the estimate. Lines below are calculated from sector defaults, not your own volumes.');
    setTurn('T8_FB_Estimate');
  }

  function finalize() {
    const fixture = envelopeToFixture(envelope, orgName);
    onComplete(fixture);
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {transcript.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.who === 'you' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-md text-sm leading-relaxed ${
                m.who === 'you'
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'bg-white border border-[var(--color-border-light)] text-[var(--color-ink)]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-border-light)] pt-4 space-y-3">
        {turn === 'T1_Sector' && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-ink-muted)]">
              Pick the one closest to your main activity. We will tailor the next questions to your sector.
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {SECTOR_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pickSector(o.value, o.label)}
                  className="text-left px-3 py-2 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {turn === 'T2_Region' && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-ink-muted)]">
              Drives your Scope 2 electricity factor. NSW and ACT share one factor.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REGION_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickRegion(r)}
                  className="px-3 py-1.5 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {turn === 'T3_Size' && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-ink-muted)]">
              Headcount band, not exact. Includes full-time, part-time pro-rata, and regular contractors.
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SIZE_BANDS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => pickSize(b)}
                  className="text-left px-3 py-2 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {turn === 'T5_Primary' && (
          <PrimaryPicker
            sector={envelope.sector ?? 'professional_services'}
            onPick={pickPrimary}
            onSkip={skipToEstimate}
          />
        )}

        {turn === 'T6_Secondary' && (
          <SecondaryPicker
            sector={envelope.sector ?? 'professional_services'}
            onPick={pickSecondary}
            onNone={() => pickSecondary(null, 'No, none of that')}
            onSkip={skipToEstimate}
          />
        )}

        {(turn === 'T7_Playback' || turn === 'T8_FB_Estimate') && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-ink-muted)]">
              Each line shows the volume, the factor, and the maths. You can review and edit on the next screen.
            </p>
            <PlaybackSummary envelope={envelope} />
            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={finalize}
                className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white"
              >
                Looks right, continue
              </button>
              <button
                type="button"
                onClick={onAbort}
                className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
              >
                Start the questions again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function nextPrimaryPrompt(s: Sector): string {
  if (s === 'industrial_light' || s === 'industrial_heavy') return 'Roughly how much natural gas does the process use in a year?';
  if (s === 'transport') return 'Roughly how much diesel does the fleet burn in a year?';
  if (s === 'agriculture') return 'Roughly how many head of livestock?';
  return 'Roughly how much electricity does the business use in a year?';
}

function secondaryPrompt(s: Sector): string {
  if (s === 'industrial_light') return 'Any building electricity in addition to the process load?';
  if (s === 'industrial_heavy') return 'Any specialised process emissions (cement clinker, ammonia, aluminium, glass, lime)?';
  if (s === 'transport') return 'Any passenger fleet - cars or utes - in addition to the trucks?';
  if (s === 'agriculture') return 'Any synthetic nitrogen fertiliser applied?';
  if (s === 'retail') return 'Any refrigerant top-ups in the last 12 months?';
  if (s === 'built_environment') return 'Any gas for hot water or heating?';
  return 'Any gas for hot water, cooktops, or heating?';
}

function PrimaryPicker({ sector, onPick, onSkip }: { sector: Sector; onPick: (b: Band) => void; onSkip: () => void }) {
  const bands =
    sector === 'industrial_light' || sector === 'industrial_heavy'
      ? GAS_BANDS
      : sector === 'transport'
      ? DIESEL_BANDS
      : sector === 'agriculture'
      ? DIESEL_BANDS
      : ELEC_BANDS;
  const helpline =
    sector === 'industrial_light' || sector === 'industrial_heavy'
      ? 'From your gas bill, in GJ or MJ. Small bakery: 100 to 500 GJ. Light foundry: 5,000 to 20,000 GJ.'
      : sector === 'transport'
      ? 'Annual litres of diesel across all on-road vehicles. Look at your fuel-card statements.'
      : sector === 'agriculture'
      ? 'Average head count over the year, by species. From NLIS export or your stock records.'
      : 'Annual kilowatt-hours from your retail electricity bill. Most small offices land between 10,000 and 100,000 kWh.';
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-ink-muted)]">{helpline}</p>
      <div className="grid grid-cols-1 gap-1.5">
        {bands.map(b => (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b)}
            className="text-left px-3 py-2 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onSkip}
          className="text-left px-3 py-2 rounded-md border border-dashed border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)] hover:border-[var(--color-ink-muted)]"
        >
          I am not sure - estimate from what we have
        </button>
      </div>
    </div>
  );
}

function SecondaryPicker({
  sector,
  onPick,
  onNone,
  onSkip,
}: {
  sector: Sector;
  onPick: (b: Band, label: string) => void;
  onNone: () => void;
  onSkip: () => void;
}) {
  const bands = sector === 'industrial_heavy' ? [] : sector === 'transport' ? DIESEL_BANDS : GAS_BANDS;
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-ink-muted)]">
        A second source of emissions, sized smaller than the primary one. Skip if none.
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {bands.map(b => (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b, b.label)}
            className="text-left px-3 py-2 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onNone}
          className="text-left px-3 py-2 rounded-md border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink)] hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)]"
        >
          No, none of that
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-left px-3 py-2 rounded-md border border-dashed border-[var(--color-border-light)] bg-white text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)] hover:border-[var(--color-ink-muted)]"
        >
          I am not sure - estimate from what we have
        </button>
      </div>
    </div>
  );
}

function PlaybackSummary({ envelope }: { envelope: Envelope }) {
  const rows = computePreviewRows(envelope);
  const total = rows.reduce((s, r) => s + r.tco2e, 0);
  return (
    <div className="space-y-2 border border-[var(--color-border-light)] rounded-md bg-white p-4">
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between py-1 border-b last:border-0 border-[var(--color-border-light)]">
          <span className="text-sm text-[var(--color-ink)]">{r.label}</span>
          <span className="text-sm font-mono text-[var(--color-ink-sec)]">
            {r.tco2e.toLocaleString()} tCO2-e
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between pt-2 text-sm font-medium">
        <span>Total</span>
        <span className="font-mono">{total.toLocaleString()} tCO2-e per year</span>
      </div>
    </div>
  );
}

function computePreviewRows(env: Envelope): { label: string; tco2e: number }[] {
  if (env.fallback || !env.primaryBand) {
    const sector = env.sector ?? 'professional_services';
    const intensity = SECTOR_DEFAULT_INTENSITY[sector];
    const mid = env.sizeMidpoint ?? 125;
    const total = Math.round(intensity * mid);
    return [{ label: 'Imputed from sector default per-FTE intensity', tco2e: total }];
  }
  const factor = REGION_FACTOR[env.region ?? 'Multiple states - no single main site'] ?? 0.62;
  const sector = env.sector ?? 'professional_services';
  const rows: { label: string; tco2e: number }[] = [];
  if (sector === 'industrial_light' || sector === 'industrial_heavy') {
    const gj = env.primaryBand.midpoint ?? 0;
    rows.push({ label: 'Natural gas - process heat', tco2e: Math.round((gj * 51.53) / 1000) });
    if (env.secondaryBand) {
      const kwh = env.secondaryBand.midpoint ?? 0;
      rows.push({ label: 'Electricity - buildings', tco2e: Math.round((kwh * factor) / 1000) });
    }
  } else if (sector === 'transport') {
    const l = env.primaryBand.midpoint ?? 0;
    rows.push({ label: 'Diesel - fleet on-road', tco2e: Math.round((l * 2.72) / 1000) });
    if (env.secondaryBand) {
      const l2 = env.secondaryBand.midpoint ?? 0;
      rows.push({ label: 'Petrol - fleet passenger', tco2e: Math.round((l2 * 2.32) / 1000) });
    }
  } else if (sector === 'agriculture') {
    const head = env.primaryBand.midpoint ?? 0;
    rows.push({ label: 'Livestock - beef cattle', tco2e: Math.round(head * 1.4) });
  } else {
    const kwh = env.primaryBand.midpoint ?? 0;
    rows.push({ label: 'Electricity - lighting, HVAC, office', tco2e: Math.round((kwh * factor) / 1000) });
    if (env.secondaryBand) {
      const gj = env.secondaryBand.midpoint ?? 0;
      rows.push({ label: 'Natural gas - space heating', tco2e: Math.round((gj * 51.53) / 1000) });
    }
  }
  return rows.filter(r => r.tco2e > 0);
}

function envelopeToFixture(env: Envelope, orgName: string): Fixture {
  const previews = computePreviewRows(env);
  const sector = env.sector ?? 'professional_services';
  const baselineRows: SourceRow[] = previews.map((r, i) => ({
    rowId: `R${i + 1}`,
    source: inferSource(sector, i),
    endUse: inferEndUse(sector, i),
    label: r.label,
    tco2eEstimate: r.tco2e,
  }));
  const sectorKey = SECTOR_TO_INTAKE_KEY[sector];
  return {
    orgName,
    orgSector: sectorKey,
    baselineRows,
    levers: getLeversForFixture(sectorKey, baselineRows.map(r => ({ source: r.source, endUse: r.endUse }))),
  };
}

function inferSource(sector: Sector, idx: number): string {
  if (sector === 'industrial_light' || sector === 'industrial_heavy') return idx === 0 ? 'stationary_combustion' : 'electricity';
  if (sector === 'transport') return 'mobile_combustion';
  if (sector === 'agriculture') return 'process';
  return idx === 0 ? 'electricity' : 'stationary_combustion';
}

function inferEndUse(sector: Sector, idx: number): string | null {
  if (sector === 'industrial_light' || sector === 'industrial_heavy') return idx === 0 ? 'space_heating' : 'lighting_hvac';
  if (sector === 'transport') return idx === 0 ? 'fleet_heavy_vehicles' : 'fleet_light_vehicles';
  if (sector === 'agriculture') return 'livestock_enteric_fermentation';
  return idx === 0 ? 'lighting_hvac' : 'space_heating';
}
