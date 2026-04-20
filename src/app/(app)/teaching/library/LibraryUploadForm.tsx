"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLORS, FONTS } from "@/lib/design-tokens";

export function LibraryUploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      // Convert the comma-separated lists to JSON arrays.
      for (const key of ["microsector_ids", "jurisdictions", "tags"] as const) {
        const raw = String(form.get(key) ?? "").trim();
        if (!raw) {
          form.delete(key);
          continue;
        }
        const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        const value =
          key === "microsector_ids"
            ? parts.map((p) => Number(p)).filter((n) => Number.isInteger(n) && n > 0)
            : parts;
        form.set(key, JSON.stringify(value));
      }
      const res = await fetch("/api/teaching/library", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string; document?: { title: string }; indexed?: { chunks: number; skipped: boolean } };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      const suffix = data.indexed
        ? data.indexed.skipped
          ? " (indexing skipped)"
          : ` (${data.indexed.chunks} chunks indexed)`
        : "";
      setOk(`Uploaded "${data.document?.title ?? ""}"${suffix}.`);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 14,
        fontFamily: FONTS.sans,
      }}
    >
      <Field label="Title" required>
        <input
          name="title"
          required
          placeholder="World Energy Outlook 2026"
          style={fieldStyle}
        />
      </Field>
      <Field label="Author / publisher">
        <input name="author" placeholder="IEA" style={fieldStyle} />
      </Field>

      <Field label="Publication">
        <input
          name="publication"
          placeholder="World Energy Outlook"
          style={fieldStyle}
        />
      </Field>
      <Field label="Published year">
        <input
          name="published_year"
          type="number"
          placeholder="2026"
          style={fieldStyle}
        />
      </Field>

      <Field label="Primary domain slug (optional)">
        <input
          name="primary_domain"
          placeholder="energy-generation"
          style={fieldStyle}
        />
      </Field>
      <Field label="Tags (comma-separated)">
        <input
          name="tags"
          placeholder="iea, outlook, 2050"
          style={fieldStyle}
        />
      </Field>

      <Field label="Microsector IDs (comma-separated)">
        <input name="microsector_ids" placeholder="5, 7, 12" style={fieldStyle} />
      </Field>
      <Field label="Jurisdictions (comma-separated)">
        <input name="jurisdictions" placeholder="AU, GLOBAL" style={fieldStyle} />
      </Field>

      <Field label="Summary" style={{ gridColumn: "1 / -1" }}>
        <textarea
          name="summary"
          rows={3}
          placeholder="One paragraph for your own reference."
          style={{ ...fieldStyle, fontFamily: FONTS.sans, resize: "vertical" }}
        />
      </Field>

      <Field label="External URL (if not uploading a file)" style={{ gridColumn: "1 / -1" }}>
        <input
          name="external_url"
          placeholder="https://iea.org/reports/..."
          style={fieldStyle}
        />
      </Field>

      <Field label="File (PDF / text / markdown / html — max 50 MB)" style={{ gridColumn: "1 / -1" }}>
        <input
          name="file"
          type="file"
          accept="application/pdf,text/plain,text/markdown,text/html,.md"
          style={{
            ...fieldStyle,
            padding: 8,
          }}
        />
      </Field>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 4,
        }}
      >
        <label style={{ fontSize: 13, color: COLORS.inkSec }}>
          <input
            name="index_now"
            type="checkbox"
            defaultChecked
            value="true"
            style={{ marginRight: 6 }}
          />
          Index for RAG immediately (text formats only; PDFs are deferred)
        </label>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 18px",
            border: `1px solid ${COLORS.forest}`,
            background: busy ? COLORS.paperDark : COLORS.forest,
            color: busy ? COLORS.inkMuted : COLORS.surface,
            fontFamily: FONTS.sans,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
        {ok && <span style={{ fontSize: 13, color: COLORS.forest }}>{ok}</span>}
        {error && <span style={{ fontSize: 13, color: COLORS.plum }}>{error}</span>}
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  fontSize: 14,
  fontFamily: FONTS.sans,
  color: COLORS.ink,
  borderRadius: 2,
};

function Field({
  label,
  required,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block", ...style }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
          marginBottom: 4,
        }}
      >
        {label} {required && <span style={{ color: COLORS.plum }}>*</span>}
      </div>
      {children}
    </label>
  );
}
