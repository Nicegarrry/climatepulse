"use client";

import { useCallback, useMemo, useState } from "react";
import type { MaccStore } from "@/lib/automacc/v4-store";
import type { LeverChoice } from "@/lib/automacc/v4-types";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { LeverRow } from "./LeverRow";

interface MaccApiLever {
  source_id: string;
  refined_capex_aud: number | null;
  lifetime_opex_delta_aud_annual: number | null;
  abatement_tco2y_final: number | null;
  npv_aud: number | null;
  cost_per_tco2: number | null;
  rationale: string | null;
  library_lever_id?: string | null;
}

export function LeverMatchScreen({ store }: { store: MaccStore }) {
  const { session, setLever, setLevers, setStep } = store;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Index levers by sourceId for O(1) lookup.
  const leverBySourceId = useMemo(() => {
    const m = new Map<string, LeverChoice>();
    for (const l of session.levers) m.set(l.sourceId, l);
    return m;
  }, [session.levers]);

  // A lever is "valid" when the student picked an approach + >0% abatement +
  // at least one of (description, capex). Sources without an approach are
  // intentionally skipped — students can leave levers off sources they
  // don't plan to abate.
  const validLeverCount = useMemo(() => {
    let n = 0;
    for (const s of session.sources) {
      const l = leverBySourceId.get(s.id);
      if (!l || l.approach === null) continue;
      if (l.abatementPct <= 0) continue;
      const hasCapex = l.capexAud != null;
      const hasDesc = (l.description ?? "").trim().length > 0;
      if (!hasCapex && !hasDesc) continue;
      n += 1;
    }
    return n;
  }, [session.sources, leverBySourceId]);

  const allReady = validLeverCount > 0;

  const handleBuild = useCallback(async () => {
    if (!allReady || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/automacc/macc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meta: session.meta,
          sources: session.sources,
          levers: session.levers,
        }),
      });
      if (res.status === 404) {
        setError("Coming online — please retry.");
        return;
      }
      if (!res.ok) {
        setError(`Couldn't build MACC (${res.status}). Try again.`);
        return;
      }
      const json = (await res.json()) as { levers: MaccApiLever[] };
      const incoming = json.levers ?? [];
      // Merge by source_id into existing levers; preserve student inputs.
      const byId = new Map<string, MaccApiLever>();
      for (const r of incoming) byId.set(r.source_id, r);
      const merged: LeverChoice[] = session.levers.map((l) => {
        const r = byId.get(l.sourceId);
        if (!r) return l;
        return {
          ...l,
          refinedCapexAud: r.refined_capex_aud,
          lifetimeOpexDeltaAudAnnual: r.lifetime_opex_delta_aud_annual,
          abatementTco2yFinal: r.abatement_tco2y_final,
          npvAud: r.npv_aud,
          costPerTco2: r.cost_per_tco2,
          libraryLeverId: r.library_lever_id ?? null,
          geminiRationale: r.rationale,
        };
      });
      setLevers(merged);
      setStep(3);
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  }, [allReady, submitting, session.meta, session.sources, session.levers, setLevers, setStep]);

  if (session.sources.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          border: `1px dashed ${COLORS.border}`,
          borderRadius: 8,
          fontFamily: FONTS.sans,
          color: COLORS.inkSec,
        }}
      >
        No emission sources yet — go back to Screen 1 to add some.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONTS.sans }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: COLORS.ink,
          }}
        >
          Pick how you&apos;d cut each source
        </h2>
        <p
          style={{
            marginTop: 6,
            marginBottom: 0,
            fontSize: 14,
            color: COLORS.inkSec,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          For sources you want to abate, pick an <em>approach</em> and describe what you&apos;d
          do in plain English (e.g. &quot;switch to a corporate PPA&quot;). Capex is optional —
          leave it blank and we&apos;ll estimate. Skip any source you don&apos;t plan to address.
        </p>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {session.sources.map((entry) => (
          <LeverRow
            key={entry.id}
            entry={entry}
            lever={leverBySourceId.get(entry.id)}
            onChange={(patch) => setLever(entry.id, patch)}
          />
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        {error && (
          <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>{error}</span>
        )}
        {submitting && (
          <span style={{ fontSize: 13, color: COLORS.inkSec }}>Building your MACC…</span>
        )}
        <button
          type="button"
          disabled={!allReady || submitting}
          onClick={handleBuild}
          title={
            allReady
              ? `Build MACC for ${validLeverCount} lever${validLeverCount === 1 ? "" : "s"}`
              : "Pick an approach + abatement + (description or capex) for at least one source."
          }
          style={{
            padding: "10px 22px",
            background: allReady && !submitting ? COLORS.forest : COLORS.inkFaint,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: allReady && !submitting ? "pointer" : "not-allowed",
            fontFamily: FONTS.sans,
            letterSpacing: "0.01em",
            transition: "background 120ms",
          }}
        >
          {submitting ? "Building…" : "Build MACC →"}
        </button>
      </div>
    </div>
  );
}
