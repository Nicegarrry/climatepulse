"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { ArrowLeftIcon, UsersIcon, EyeIcon } from "@heroicons/react/24/outline";
import {
  AccessSection,
  BasicsSection,
  BrandingSection,
  OverlaySection,
  PreviewSection,
  ScopeSection,
  useTaxonomy,
  type SurfaceFormValue,
} from "@/components/admin/surface-form";
import type { KnowledgeSurface } from "@/lib/surfaces/types";

const TABS = ["Basics", "Scope", "Access", "Overlay", "Branding", "Preview"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  surface: KnowledgeSurface;
  cohortCodeSet: boolean;
}

export function EditSurfaceForm({ surface, cohortCodeSet }: Props) {
  const router = useRouter();
  const { domains, microsectors, loading: taxLoading } = useTaxonomy();

  const [form, setForm] = useState<SurfaceFormValue>({
    title: surface.title,
    slug: surface.slug,
    template: surface.template,
    scope: surface.scope,
    access: surface.access,
    overlay: surface.overlay,
    branding: surface.branding,
    lifecycle: surface.lifecycle,
  });
  const [tab, setTab] = useState<Tab>("Basics");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const update = (patch: Partial<SurfaceFormValue>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function patch(partial: Record<string, unknown>, busyLabel: string) {
    setBusy(busyLabel);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/surfaces/${encodeURIComponent(surface.slug)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(partial),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error
            ? `${json.error}${json.field ? ` (${json.field})` : ""}`
            : `HTTP ${res.status}`,
        );
        return false;
      }
      setMessage(`${busyLabel} — done.`);
      if (json.surface?.slug && json.surface.slug !== surface.slug) {
        router.replace(`/admin/surfaces/${json.surface.slug}/edit`);
      } else {
        router.refresh();
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const saveDraft = () =>
    patch(
      {
        title: form.title,
        slug: form.slug,
        template: form.template,
        scope: form.scope,
        access: form.access,
        cohort_code_plaintext: form.cohort_code_plaintext,
        overlay: form.overlay,
        branding: form.branding,
        lifecycle: "draft",
      },
      "Draft saved",
    );

  const publish = () =>
    patch(
      {
        title: form.title,
        slug: form.slug,
        template: form.template,
        scope: form.scope,
        access: form.access,
        cohort_code_plaintext: form.cohort_code_plaintext,
        overlay: form.overlay,
        branding: form.branding,
        lifecycle: "published",
      },
      "Published",
    );

  async function archive() {
    if (!confirm("Archive this surface? Readers will no longer see it.")) return;
    setBusy("Archiving");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/surfaces/${encodeURIComponent(surface.slug)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push("/admin/surfaces");
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("Duplicating");
    setError(null);
    try {
      const payload = {
        slug: `${surface.slug}-copy-${Date.now().toString(36)}`,
        title: `${surface.title} (copy)`,
        template: surface.template,
        scope: surface.scope,
        access: { kind: "authenticated" },
        overlay: surface.overlay,
        branding: surface.branding,
        lifecycle: "draft",
      };
      const res = await fetch("/api/admin/surfaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/admin/surfaces/${json.slug}/edit`);
    } finally {
      setBusy(null);
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
      <header style={{ marginBottom: 20 }}>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 24,
                color: COLORS.ink,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {surface.title}
            </h1>
            <div
              style={{
                fontSize: 11,
                color: COLORS.inkMuted,
                fontFamily: "monospace",
                marginTop: 2,
              }}
            >
              /{surface.slug} · v{surface.version} · {surface.lifecycle}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/s/${surface.slug}?preview=1`}
              target="_blank"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                fontSize: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                color: COLORS.ink,
                borderRadius: 3,
                textDecoration: "none",
              }}
            >
              <EyeIcon width={14} height={14} /> Preview
            </Link>
            <Link
              href={`/admin/surfaces/${surface.slug}/members`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                fontSize: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                color: COLORS.ink,
                borderRadius: 3,
                textDecoration: "none",
              }}
            >
              <UsersIcon width={14} height={14} /> Members
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 20,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "8px 14px",
              border: "none",
              background: "transparent",
              color: t === tab ? COLORS.ink : COLORS.inkMuted,
              fontSize: 12,
              fontWeight: t === tab ? 600 : 500,
              letterSpacing: 0.4,
              cursor: "pointer",
              borderBottom: `2px solid ${
                t === tab ? COLORS.forest : "transparent"
              }`,
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 780 }}>
        {tab === "Basics" && (
          <BasicsSection value={form} onChange={update} slugLocked={false} />
        )}
        {tab === "Scope" && (
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
        {tab === "Access" && (
          <AccessSection
            value={form}
            onChange={update}
            cohortCodeSet={cohortCodeSet}
          />
        )}
        {tab === "Overlay" && <OverlaySection value={form} onChange={update} />}
        {tab === "Branding" && <BrandingSection value={form} onChange={update} />}
        {tab === "Preview" && <PreviewSection value={form} />}

        {error && (
          <div
            style={{
              padding: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: 3,
              fontSize: 13,
              margin: "12px 0",
            }}
          >
            {error}
          </div>
        )}
        {message && !error && (
          <div
            style={{
              padding: 10,
              background: COLORS.sageTint,
              color: COLORS.forest,
              borderRadius: 3,
              fontSize: 12,
              margin: "12px 0",
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!!busy}
              onClick={duplicate}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                background: COLORS.surface,
                color: COLORS.inkSec,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={archive}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                background: COLORS.surface,
                color: "#b91c1c",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Archive
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!!busy}
              onClick={saveDraft}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                background: COLORS.surface,
                color: COLORS.ink,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={publish}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                background: COLORS.forest,
                color: "#fff",
                border: "none",
                fontWeight: 500,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {busy === "Published" ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
