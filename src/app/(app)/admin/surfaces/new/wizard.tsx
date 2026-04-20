"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import {
  AccessSection,
  BasicsSection,
  BrandingSection,
  DEFAULT_FORM,
  OverlaySection,
  PreviewSection,
  ScopeSection,
  useTaxonomy,
  type SurfaceFormValue,
} from "@/components/admin/surface-form";

const STEPS = ["Basics", "Scope", "Access", "Overlay", "Branding", "Preview"] as const;
type Step = (typeof STEPS)[number];

export function NewSurfaceWizard() {
  const router = useRouter();
  const { domains, microsectors, loading: taxLoading } = useTaxonomy();

  const [form, setForm] = useState<SurfaceFormValue>(DEFAULT_FORM);
  const [step, setStep] = useState<Step>("Basics");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIdx = STEPS.indexOf(step);
  const update = (patch: Partial<SurfaceFormValue>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(lifecycle: "draft" | "published") {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        lifecycle,
        owner_user_id: "",
      };
      const res = await fetch("/api/admin/surfaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error
            ? `${json.error}${json.field ? ` (${json.field})` : ""}`
            : `HTTP ${res.status}`,
        );
        return;
      }
      router.push(`/admin/surfaces/${json.slug}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: "24px 32px",
        fontFamily: FONTS.sans,
        background: COLORS.bg,
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <Link
          href="/admin/surfaces"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: COLORS.inkMuted,
            textDecoration: "none",
            marginBottom: 8,
          }}
        >
          <ArrowLeftIcon width={14} height={14} />
          Back to surfaces
        </Link>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 26,
            color: COLORS.ink,
            margin: 0,
            fontWeight: 500,
          }}
        >
          New knowledge surface
        </h1>
      </header>

      {/* Stepper */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          paddingBottom: 12,
          borderBottom: `1px solid ${COLORS.border}`,
          overflowX: "auto",
        }}
      >
        {STEPS.map((s, i) => {
          const active = s === step;
          const done = i < stepIdx;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              style={{
                padding: "6px 12px",
                border: `1px solid ${
                  active ? COLORS.forest : done ? COLORS.forestMid : COLORS.border
                }`,
                background: active
                  ? COLORS.sageTint
                  : done
                  ? COLORS.surface
                  : COLORS.surface,
                color: active
                  ? COLORS.forest
                  : done
                  ? COLORS.forestMid
                  : COLORS.inkMuted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontWeight: 600,
                borderRadius: 3,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {i + 1}. {s}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: 780 }}>
        {step === "Basics" && (
          <BasicsSection value={form} onChange={update} />
        )}
        {step === "Scope" && (
          <>
            {taxLoading ? (
              <div style={{ padding: 20, color: COLORS.inkMuted }}>
                Loading taxonomy…
              </div>
            ) : (
              <ScopeSection
                value={form}
                onChange={update}
                domains={domains}
                microsectors={microsectors}
              />
            )}
          </>
        )}
        {step === "Access" && <AccessSection value={form} onChange={update} />}
        {step === "Overlay" && <OverlaySection value={form} onChange={update} />}
        {step === "Branding" && <BrandingSection value={form} onChange={update} />}
        {step === "Preview" && <PreviewSection value={form} />}

        {error && (
          <div
            style={{
              padding: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: 3,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStep(STEPS[stepIdx - 1])}
            style={{
              padding: "8px 14px",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.ink,
              fontSize: 13,
              borderRadius: 3,
              cursor: stepIdx === 0 ? "not-allowed" : "pointer",
              opacity: stepIdx === 0 ? 0.5 : 1,
            }}
          >
            Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(STEPS[stepIdx + 1])}
                style={{
                  padding: "8px 14px",
                  background: COLORS.ink,
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                Next
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit("draft")}
                  style={{
                    padding: "8px 14px",
                    background: COLORS.surface,
                    color: COLORS.ink,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 13,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit("published")}
                  style={{
                    padding: "8px 14px",
                    background: COLORS.forest,
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Publishing…" : "Publish"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
