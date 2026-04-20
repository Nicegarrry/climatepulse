"use client";

/**
 * CohortCodeForm — redemption gate for `access.kind = 'cohort_code'` surfaces.
 *
 * POSTs the code to /api/s/[slug]/cohort-redeem. On success, reloads the page
 * so the server component re-evaluates access with the newly created member
 * row. On failure, surfaces an inline error.
 */
import { useState } from "react";
import { KeyIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

export function CohortCodeForm({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/s/${encodeURIComponent(slug)}/cohort-redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        allowed?: boolean;
        reason?: string;
        error?: string;
      };
      if (res.ok && data.allowed) {
        window.location.reload();
        return;
      }
      setError(
        data.error ??
          (data.reason === "needs_sign_in"
            ? "Please sign in first."
            : "Invalid cohort code."),
      );
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        width: "min(480px, 100%)",
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        padding: "32px 28px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: COLORS.inkMuted,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        <KeyIcon width={14} height={14} strokeWidth={1.6} />
        Cohort access
      </div>
      <h1
        style={{
          fontFamily: FONTS.serif,
          fontSize: 26,
          margin: "0 0 10px",
          fontWeight: 500,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: "0 0 20px",
          color: COLORS.inkSec,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        This surface is private to a cohort. Enter the access code you were given.
      </p>
      <label
        htmlFor="cohort-code"
        style={{
          display: "block",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
          marginBottom: 6,
        }}
      >
        Access code
      </label>
      <input
        id="cohort-code"
        type="text"
        autoComplete="off"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={busy}
        style={{
          display: "block",
          width: "100%",
          fontFamily: FONTS.sans,
          fontSize: 15,
          padding: "10px 12px",
          border: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          color: COLORS.ink,
          outline: "none",
          letterSpacing: "0.04em",
        }}
      />
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            fontSize: 13,
            color: COLORS.plum,
            background: COLORS.plumLight,
            padding: "6px 10px",
            border: `1px solid ${COLORS.plum}`,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !code.trim()}
        style={{
          marginTop: 16,
          fontFamily: FONTS.sans,
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "10px 16px",
          border: `1px solid ${COLORS.forest}`,
          background: busy ? COLORS.paperDark : COLORS.forest,
          color: busy ? COLORS.inkSec : COLORS.surface,
          cursor: busy || !code.trim() ? "not-allowed" : "pointer",
          opacity: busy || !code.trim() ? 0.7 : 1,
        }}
      >
        {busy ? "Verifying…" : "Unlock surface"}
      </button>
    </form>
  );
}
