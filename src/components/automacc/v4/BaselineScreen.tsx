"use client";

import { useMemo, useState } from "react";
import {
  BoltIcon,
  FireIcon,
  TruckIcon,
  BuildingOffice2Icon,
  GlobeAltIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import type { MaccStore } from "@/lib/automacc/v4-store";
import { newSourceId } from "@/lib/automacc/v4-store";
import {
  SOURCE_BUCKETS,
  INDUSTRIES,
  type CompanyMeta,
  type EmployeeRange,
  type RevenueRange,
  type SourceBucket as SourceBucketId,
  type SourceEntry,
  type SourceFactor,
} from "@/lib/automacc/v4-types";
import { SOURCE_FACTORS } from "@/lib/automacc/factors";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { SourceBucketCard } from "./SourceBucket";
import { SegmentedField } from "./SegmentedField";

const EMPLOYEE_OPTS: EmployeeRange[] = ["1-50", "51-200", "201-1000", "1001-10000", "10000+"];
const REVENUE_OPTS: RevenueRange[] = ["<10M", "10-100M", "100M-1B", "1B-10B", ">10B"];

const BUCKET_ICONS: Record<SourceBucketId, React.ComponentType<{ width?: number; height?: number; style?: React.CSSProperties }>> = {
  stationary_electricity: BoltIcon,
  stationary_fuel: FireIcon,
  mobility: TruckIcon,
  industrial_process: BuildingOffice2Icon,
  ag_nature: GlobeAltIcon,
  other: EllipsisHorizontalIcon,
};

interface NormaliseResponseRow {
  source_id: string;
  numerical_value: number | null;
  numerical_unit: string;
  factor_used: number | null;
  tco2y: number | null;
  confidence: "high" | "medium" | "low" | null;
  rationale: string | null;
}

const inputBase: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: "9px 12px",
  fontSize: 14,
  fontFamily: FONTS.sans,
  color: COLORS.ink,
  background: "#fff",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: COLORS.inkSec,
  marginBottom: 6,
  fontFamily: FONTS.sans,
};

export function BaselineScreen({ store }: { store: MaccStore }) {
  const { session, setMeta, addSource, updateSource, removeSource, setSources, setStep } = store;
  const { meta, sources } = session;

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const factorsLoaded = SOURCE_FACTORS.length > 0;
  const factors: SourceFactor[] = SOURCE_FACTORS;

  const rowsByBucket = useMemo(() => {
    const m = new Map<SourceBucketId, SourceEntry[]>();
    for (const b of SOURCE_BUCKETS) m.set(b.id, []);
    for (const s of sources) {
      const bucket = m.get(s.bucket);
      if (bucket) bucket.push(s);
    }
    return m;
  }, [sources]);

  const canSubmit = Boolean(meta.industry) && sources.length > 0 && !submitting;

  function handleAdd(bucketId: SourceBucketId, factor: SourceFactor) {
    const entry: SourceEntry = {
      id: newSourceId(),
      bucket: bucketId,
      sourceId: factor.id,
      numericalValue: null,
      numericalUnit: factor.numerical.unit,
      freeText: "",
      tco2y: null,
      factorUsed: null,
      rationale: null,
      confidence: null,
    };
    addSource(entry);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/automacc/normalise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meta, sources }),
      });
      if (res.status === 404) {
        setErrorMsg("Coming online — please retry in a moment.");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setErrorMsg(text || `Normalisation failed (${res.status}). Please retry.`);
        return;
      }
      const json = (await res.json()) as { normalised?: NormaliseResponseRow[] };
      const byId = new Map<string, NormaliseResponseRow>();
      for (const r of json.normalised ?? []) byId.set(r.source_id, r);
      const merged = sources.map((s) => {
        const r = byId.get(s.id);
        if (!r) return s;
        return {
          ...s,
          numericalValue: r.numerical_value ?? s.numericalValue,
          numericalUnit: r.numerical_unit || s.numericalUnit,
          factorUsed: r.factor_used ?? s.factorUsed,
          tco2y: r.tco2y ?? s.tco2y,
          confidence: r.confidence ?? s.confidence,
          rationale: r.rationale ?? s.rationale,
        };
      });
      setSources(merged);
      setStep(2);
    } catch {
      setErrorMsg("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "24px 24px 48px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      {/* Company meta card */}
      <section
        style={{
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: COLORS.forest,
            }}
          >
            Step 1 of 3
          </p>
          <h2
            style={{
              margin: "4px 0 0",
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.ink,
              letterSpacing: "-0.01em",
            }}
          >
            About your company
          </h2>
        </header>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="cm-industry" style={labelStyle}>
              Industry
            </label>
            <select
              id="cm-industry"
              value={meta.industry}
              onChange={(e) => setMeta({ industry: e.target.value })}
              style={{ ...inputBase, width: "100%", appearance: "auto" }}
            >
              <option value="">Select an industry…</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cm-desc" style={labelStyle}>
              Description
            </label>
            <textarea
              id="cm-desc"
              rows={3}
              value={meta.description}
              onChange={(e) => setMeta({ description: e.target.value })}
              placeholder="Briefly: what does the business do? (e.g. 'Regional manufacturer of food packaging, 2 plants in VIC, mostly sells to FMCG customers')"
              style={{
                ...inputBase,
                width: "100%",
                resize: "vertical",
                lineHeight: 1.5,
                fontFamily: FONTS.sans,
              }}
            />
          </div>

          <SegmentedField<EmployeeRange>
            label="Employees"
            value={meta.employees as EmployeeRange | ""}
            options={EMPLOYEE_OPTS}
            onChange={(v) => setMeta({ employees: v } as Partial<CompanyMeta>)}
          />

          <SegmentedField<RevenueRange>
            label="Revenue (AUD)"
            value={meta.revenue as RevenueRange | ""}
            options={REVENUE_OPTS}
            onChange={(v) => setMeta({ revenue: v } as Partial<CompanyMeta>)}
          />

          <div style={{ maxWidth: 220 }}>
            <label htmlFor="cm-buildings" style={labelStyle}>
              Number of buildings
            </label>
            <input
              id="cm-buildings"
              type="number"
              min={0}
              value={Number.isFinite(meta.buildings) ? meta.buildings : 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                setMeta({ buildings: Number.isFinite(n) && n >= 0 ? n : 0 });
              }}
              style={{ ...inputBase, width: "100%" }}
            />
          </div>
        </div>
      </section>

      {/* Sources block */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Where are your emissions coming from?
        </h2>
        <p
          style={{
            margin: "6px 0 18px",
            fontSize: 13,
            color: COLORS.inkSec,
            lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          Add the sources you think apply to your business. Each row needs one
          rough number plus any extra context. If you don&rsquo;t know the
          number, leave it blank and write what you do know — we&rsquo;ll
          estimate.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          {SOURCE_BUCKETS.map((b) => (
            <SourceBucketCard
              key={b.id}
              bucketId={b.id}
              label={b.label}
              blurb={b.blurb}
              Icon={BUCKET_ICONS[b.id]}
              rows={rowsByBucket.get(b.id) ?? []}
              factors={factors}
              factorsLoaded={factorsLoaded}
              onAdd={(f) => handleAdd(b.id, f)}
              onUpdate={updateSource}
              onRemove={removeSource}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          marginTop: 8,
        }}
      >
        {errorMsg && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#b1422a",
              background: "#FCEDE8",
              border: "1px solid #F2C9BD",
              borderRadius: 6,
              padding: "6px 10px",
              fontFamily: FONTS.sans,
            }}
          >
            {errorMsg}
          </p>
        )}
        {submitting && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: COLORS.inkSec,
              fontFamily: FONTS.sans,
            }}
          >
            Computing your baseline…
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: "10px 24px",
            background: canSubmit ? COLORS.forest : COLORS.border,
            color: canSubmit ? "#fff" : COLORS.inkMuted,
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: FONTS.sans,
          }}
        >
          {submitting ? "Computing…" : "Compute baseline →"}
        </button>
        {!canSubmit && !submitting && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: COLORS.inkMuted,
              fontFamily: FONTS.sans,
            }}
          >
            {!meta.industry
              ? "Pick an industry to continue."
              : sources.length === 0
              ? "Add at least one emission source."
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}

