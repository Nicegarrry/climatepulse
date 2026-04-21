"use client";

import { useEffect, useMemo, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type {
  AccessKind,
  SurfaceAccess,
  SurfaceBranding,
  SurfaceLifecycle,
  SurfaceOverlay,
  SurfaceScope,
  SurfaceTemplate,
} from "@/lib/surfaces/types";

/* ----------------------------------------------------------------------------
   Shared primitives
---------------------------------------------------------------------------- */

export interface SurfaceFormValue {
  title: string;
  slug: string;
  template: SurfaceTemplate;
  scope: SurfaceScope;
  access: SurfaceAccess;
  overlay: SurfaceOverlay;
  branding: SurfaceBranding;
  lifecycle: SurfaceLifecycle;
  cohort_code_plaintext?: string;
}

export const DEFAULT_FORM: SurfaceFormValue = {
  title: "",
  slug: "",
  template: "hub",
  scope: { microsector_ids: [], domain_slugs: [], time_window: { rolling_days: 30 } },
  access: { kind: "authenticated" },
  overlay: { introduction: "", editor_note: "", custom_modules: [] },
  branding: {},
  lifecycle: "draft",
};

export interface TaxonomyDomain {
  id: number;
  slug: string;
  name: string;
}

export interface TaxonomyMicrosector {
  id: number;
  slug: string;
  name: string;
  sector_name: string;
  domain_id: number;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: COLORS.inkMuted,
  fontWeight: 600,
  marginBottom: 6,
  fontFamily: FONTS.sans,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  fontSize: 13,
  fontFamily: FONTS.sans,
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

const sectionStyle: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  padding: 20,
  marginBottom: 16,
};

/* ----------------------------------------------------------------------------
   Step sections
---------------------------------------------------------------------------- */

export function BasicsSection({
  value,
  onChange,
  slugLocked,
}: {
  value: SurfaceFormValue;
  onChange: (next: Partial<SurfaceFormValue>) => void;
  slugLocked?: boolean;
}) {
  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Basics
      </h3>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => {
            const t = e.target.value;
            const next: Partial<SurfaceFormValue> = { title: t };
            if (!slugLocked && !value.slug) {
              next.slug = t
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")
                .slice(0, 63);
            }
            onChange(next);
          }}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Slug</label>
        <input
          type="text"
          value={value.slug}
          disabled={slugLocked}
          onChange={(e) => onChange({ slug: e.target.value })}
          style={{
            ...inputStyle,
            fontFamily: "monospace",
            opacity: slugLocked ? 0.6 : 1,
          }}
        />
        <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 4 }}>
          Lowercase letters, numbers, hyphens. Used in /s/[slug] URL.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Template</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["hub", "course"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ template: t })}
              style={{
                padding: "10px 14px",
                border: `1px solid ${
                  value.template === t ? COLORS.forest : COLORS.border
                }`,
                background:
                  value.template === t ? COLORS.sageTint : COLORS.surface,
                color: value.template === t ? COLORS.forest : COLORS.ink,
                fontSize: 13,
                borderRadius: 3,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScopeSection({
  value,
  onChange,
  domains,
  microsectors,
}: {
  value: SurfaceFormValue;
  onChange: (next: Partial<SurfaceFormValue>) => void;
  domains: TaxonomyDomain[];
  microsectors: TaxonomyMicrosector[];
}) {
  const selectedMicros = new Set(value.scope.microsector_ids ?? []);
  const selectedDomains = new Set(value.scope.domain_slugs ?? []);

  const toggleMicro = (id: number) => {
    const next = new Set(selectedMicros);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({
      scope: { ...value.scope, microsector_ids: Array.from(next) },
    });
  };
  const toggleDomain = (slug: string) => {
    const next = new Set(selectedDomains);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    onChange({
      scope: { ...value.scope, domain_slugs: Array.from(next) },
    });
  };

  const windowKind =
    value.scope.time_window?.rolling_days != null
      ? "rolling"
      : value.scope.time_window?.from || value.scope.time_window?.to
      ? "absolute"
      : "rolling";

  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Scope
      </h3>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Domains</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {domains.map((d) => {
            const on = selectedDomains.has(d.slug);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDomain(d.slug)}
                style={{
                  padding: "5px 10px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  border: `1px solid ${on ? COLORS.forest : COLORS.border}`,
                  background: on ? COLORS.sageTint : COLORS.surface,
                  color: on ? COLORS.forest : COLORS.inkSec,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Microsectors</label>
        <div
          style={{
            maxHeight: 260,
            overflowY: "auto",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3,
            padding: 8,
            background: COLORS.paperDark,
          }}
        >
          {domains.map((d) => {
            const ms = microsectors.filter((m) => m.domain_id === d.id);
            if (ms.length === 0) return null;
            return (
              <div key={d.id} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: COLORS.inkMuted,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {d.name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ms.map((m) => {
                    const on = selectedMicros.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMicro(m.id)}
                        style={{
                          padding: "3px 8px",
                          fontSize: 11,
                          border: `1px solid ${
                            on ? COLORS.forest : COLORS.borderLight
                          }`,
                          background: on ? COLORS.sageTint : COLORS.surface,
                          color: on ? COLORS.forest : COLORS.inkSec,
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 4 }}>
          {selectedMicros.size} selected
        </p>
      </div>

      <div>
        <label style={labelStyle}>Time window</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() =>
              onChange({
                scope: {
                  ...value.scope,
                  time_window: { rolling_days: 30 },
                },
              })
            }
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: `1px solid ${
                windowKind === "rolling" ? COLORS.forest : COLORS.border
              }`,
              background:
                windowKind === "rolling" ? COLORS.sageTint : COLORS.surface,
              color: windowKind === "rolling" ? COLORS.forest : COLORS.ink,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Rolling
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                scope: {
                  ...value.scope,
                  time_window: { from: "", to: "", rolling_days: null },
                },
              })
            }
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: `1px solid ${
                windowKind === "absolute" ? COLORS.forest : COLORS.border
              }`,
              background:
                windowKind === "absolute" ? COLORS.sageTint : COLORS.surface,
              color: windowKind === "absolute" ? COLORS.forest : COLORS.ink,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Absolute
          </button>
        </div>
        {windowKind === "rolling" ? (
          <input
            type="number"
            min={1}
            value={value.scope.time_window?.rolling_days ?? 30}
            onChange={(e) =>
              onChange({
                scope: {
                  ...value.scope,
                  time_window: { rolling_days: Number(e.target.value) || 30 },
                },
              })
            }
            style={{ ...inputStyle, width: 120 }}
          />
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date"
              value={value.scope.time_window?.from ?? ""}
              onChange={(e) =>
                onChange({
                  scope: {
                    ...value.scope,
                    time_window: {
                      ...(value.scope.time_window ?? {}),
                      from: e.target.value,
                      rolling_days: null,
                    },
                  },
                })
              }
              style={{ ...inputStyle, width: 170 }}
            />
            <input
              type="date"
              value={value.scope.time_window?.to ?? ""}
              onChange={(e) =>
                onChange({
                  scope: {
                    ...value.scope,
                    time_window: {
                      ...(value.scope.time_window ?? {}),
                      to: e.target.value,
                      rolling_days: null,
                    },
                  },
                })
              }
              style={{ ...inputStyle, width: 170 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AccessSection({
  value,
  onChange,
  cohortCodeSet,
}: {
  value: SurfaceFormValue;
  onChange: (next: Partial<SurfaceFormValue>) => void;
  cohortCodeSet?: boolean;
}) {
  const kinds: AccessKind[] = [
    "public",
    "unlisted",
    "authenticated",
    "email_allowlist",
    "domain_allowlist",
    "cohort_code",
  ];
  const [emailDraft, setEmailDraft] = useState("");
  const [domainDraft, setDomainDraft] = useState("");

  const emails = value.access.emails ?? [];
  const domains = value.access.domains ?? [];

  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Access
      </h3>

      <label style={labelStyle}>Kind</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() =>
              onChange({
                access: { kind: k },
                cohort_code_plaintext: "",
              })
            }
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: `1px solid ${
                value.access.kind === k ? COLORS.forest : COLORS.border
              }`,
              background:
                value.access.kind === k ? COLORS.sageTint : COLORS.surface,
              color: value.access.kind === k ? COLORS.forest : COLORS.ink,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {value.access.kind === "email_allowlist" && (
        <div>
          <label style={labelStyle}>Allowed emails</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="name@example.com"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => {
                const e = emailDraft.trim().toLowerCase();
                if (e && !emails.includes(e)) {
                  onChange({
                    access: { ...value.access, emails: [...emails, e] },
                  });
                }
                setEmailDraft("");
              }}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                background: COLORS.ink,
                color: "#fff",
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {emails.map((e) => (
              <span
                key={e}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  background: COLORS.paperDark,
                  fontSize: 11,
                  borderRadius: 3,
                  fontFamily: "monospace",
                }}
              >
                {e}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      access: {
                        ...value.access,
                        emails: emails.filter((x) => x !== e),
                      },
                    })
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: COLORS.inkMuted,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {value.access.kind === "domain_allowlist" && (
        <div>
          <label style={labelStyle}>Allowed domains</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={domainDraft}
              onChange={(e) => setDomainDraft(e.target.value)}
              placeholder="example.com"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => {
                const d = domainDraft.trim().toLowerCase();
                if (d && !domains.includes(d)) {
                  onChange({
                    access: { ...value.access, domains: [...domains, d] },
                  });
                }
                setDomainDraft("");
              }}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                background: COLORS.ink,
                color: "#fff",
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {domains.map((d) => (
              <span
                key={d}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  background: COLORS.paperDark,
                  fontSize: 11,
                  borderRadius: 3,
                  fontFamily: "monospace",
                }}
              >
                {d}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      access: {
                        ...value.access,
                        domains: domains.filter((x) => x !== d),
                      },
                    })
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: COLORS.inkMuted,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {value.access.kind === "cohort_code" && (
        <div>
          <label style={labelStyle}>
            Cohort code {cohortCodeSet ? "(already set — enter new to replace)" : ""}
          </label>
          <input
            type="text"
            value={value.cohort_code_plaintext ?? ""}
            onChange={(e) =>
              onChange({ cohort_code_plaintext: e.target.value })
            }
            placeholder={cohortCodeSet ? "•••••• (hash on file)" : "e.g. CLIMATE-2026"}
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
          <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 4 }}>
            Stored as a SHA-256 hash only. The plaintext is not retrievable
            after save.
          </p>
        </div>
      )}
    </div>
  );
}

export function OverlaySection({
  value,
  onChange,
}: {
  value: SurfaceFormValue;
  onChange: (next: Partial<SurfaceFormValue>) => void;
}) {
  const modules = value.overlay.custom_modules ?? [];

  const addModule = () => {
    const id = `m_${Date.now().toString(36)}`;
    onChange({
      overlay: {
        ...value.overlay,
        custom_modules: [...modules, { id, title: "", body: "" }],
      },
    });
  };
  const updateModule = (
    idx: number,
    patch: Partial<{ title: string; body: string }>,
  ) => {
    const next = modules.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange({ overlay: { ...value.overlay, custom_modules: next } });
  };
  const removeModule = (idx: number) => {
    onChange({
      overlay: {
        ...value.overlay,
        custom_modules: modules.filter((_, i) => i !== idx),
      },
    });
  };

  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Overlay
      </h3>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Introduction</label>
        <textarea
          rows={4}
          value={value.overlay.introduction ?? ""}
          onChange={(e) =>
            onChange({
              overlay: { ...value.overlay, introduction: e.target.value },
            })
          }
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Editor note</label>
        <textarea
          rows={2}
          value={value.overlay.editor_note ?? ""}
          onChange={(e) =>
            onChange({
              overlay: { ...value.overlay, editor_note: e.target.value },
            })
          }
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>Custom modules</label>
          <button
            type="button"
            onClick={addModule}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: COLORS.ink,
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>
        {modules.map((m, i) => (
          <div
            key={m.id}
            style={{
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: 3,
              padding: 10,
              marginBottom: 8,
            }}
          >
            <input
              type="text"
              value={m.title}
              onChange={(e) => updateModule(i, { title: e.target.value })}
              placeholder="Module title"
              style={{ ...inputStyle, marginBottom: 6 }}
            />
            <textarea
              rows={3}
              value={m.body ?? ""}
              onChange={(e) => updateModule(i, { body: e.target.value })}
              placeholder="Body"
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button
              type="button"
              onClick={() => removeModule(i)}
              style={{
                marginTop: 6,
                padding: "3px 8px",
                fontSize: 11,
                background: "transparent",
                color: COLORS.inkMuted,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandingSection({
  value,
  onChange,
}: {
  value: SurfaceFormValue;
  onChange: (next: Partial<SurfaceFormValue>) => void;
}) {
  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Branding
      </h3>

      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Primary colour</label>
          <input
            type="color"
            value={value.branding.primary_colour ?? "#1E4D2B"}
            onChange={(e) =>
              onChange({
                branding: { ...value.branding, primary_colour: e.target.value },
              })
            }
            style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Accent colour</label>
          <input
            type="color"
            value={value.branding.accent_colour ?? "#3D1F3D"}
            onChange={(e) =>
              onChange({
                branding: { ...value.branding, accent_colour: e.target.value },
              })
            }
            style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Logo URL</label>
        <input
          type="url"
          value={value.branding.logo_url ?? ""}
          onChange={(e) =>
            onChange({
              branding: {
                ...value.branding,
                logo_url: e.target.value || null,
              },
            })
          }
          placeholder="https://..."
          style={inputStyle}
        />
      </div>
    </div>
  );
}

export function PreviewSection({ value }: { value: SurfaceFormValue }) {
  const primary = value.branding.primary_colour ?? COLORS.forest;
  const accent = value.branding.accent_colour ?? COLORS.plum;
  const summary = useMemo(() => {
    return [
      `${value.scope.microsector_ids?.length ?? 0} microsectors`,
      `${value.scope.domain_slugs?.length ?? 0} domains`,
      value.scope.time_window?.rolling_days
        ? `${value.scope.time_window.rolling_days}-day rolling`
        : value.scope.time_window?.from
        ? `from ${value.scope.time_window.from}`
        : "all-time",
    ].join(" · ");
  }, [value.scope]);

  return (
    <div style={sectionStyle}>
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 18,
          margin: "0 0 12px",
          color: COLORS.ink,
          fontWeight: 500,
        }}
      >
        Preview
      </h3>
      <div
        style={{
          border: `2px solid ${primary}`,
          borderRadius: 6,
          padding: 20,
          background: "#fff",
        }}
      >
        {value.branding.logo_url && (
          <img
            src={value.branding.logo_url}
            alt=""
            style={{ height: 28, marginBottom: 12 }}
          />
        )}
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            background: accent,
            color: "#fff",
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            borderRadius: 3,
            marginBottom: 10,
          }}
        >
          {value.template}
        </div>
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 24,
            color: primary,
            margin: "0 0 6px",
            fontWeight: 500,
          }}
        >
          {value.title || "Untitled surface"}
        </h2>
        <div style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 12 }}>
          {summary}
        </div>
        {value.overlay.introduction && (
          <p
            style={{
              fontSize: 14,
              color: COLORS.inkSec,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {value.overlay.introduction}
          </p>
        )}
      </div>
      <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 8 }}>
        After creation, you can view the full surface at{" "}
        <code>/s/{value.slug || "[slug]"}</code>.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Taxonomy fetch helper (client-side hook)
---------------------------------------------------------------------------- */

export function useTaxonomy() {
  const [data, setData] = useState<{
    domains: TaxonomyDomain[];
    microsectors: TaxonomyMicrosector[];
  }>({ domains: [], microsectors: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/surfaces/taxonomy");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}
