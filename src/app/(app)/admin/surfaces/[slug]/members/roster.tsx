"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { ArrowLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { AccessLevel } from "@/lib/surfaces/types";

interface Member {
  id: string;
  user_id: string | null;
  email: string | null;
  domain: string | null;
  access_level: AccessLevel;
  redeemed_via_code: boolean;
  granted_at: string;
  revoked_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

interface Props {
  surface: { slug: string; title: string };
}

const LEVELS: AccessLevel[] = ["viewer", "contributor", "admin"];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: COLORS.inkMuted,
  fontWeight: 600,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  fontSize: 13,
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

export function MembersRoster({ surface }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<"email" | "domain">("email");
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [level, setLevel] = useState<AccessLevel>("viewer");
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/surfaces/${encodeURIComponent(surface.slug)}/members`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setMembers(json.members ?? []);
    } finally {
      setLoading(false);
    }
  }, [surface.slug]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { access_level: level };
      if (kind === "email") {
        if (!email.trim()) {
          setError("Email required");
          return;
        }
        body.email = email.trim().toLowerCase();
      } else {
        if (!domain.trim()) {
          setError("Domain required");
          return;
        }
        body.domain = domain.trim().toLowerCase();
      }
      const res = await fetch(
        `/api/admin/surfaces/${encodeURIComponent(surface.slug)}/members`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setEmail("");
      setDomain("");
      await fetchMembers();
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this member's access?")) return;
    const res = await fetch(
      `/api/admin/surfaces/${encodeURIComponent(surface.slug)}/members/${id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? `HTTP ${res.status}`);
      return;
    }
    await fetchMembers();
  }

  const active = members.filter((m) => m.revoked_at == null);
  const revoked = members.filter((m) => m.revoked_at != null);

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
          href={`/admin/surfaces/${surface.slug}/edit`}
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
          Back to {surface.title}
        </Link>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 24,
            color: COLORS.ink,
            margin: 0,
            fontWeight: 500,
          }}
        >
          Members — {surface.title}
        </h1>
      </header>

      {/* Invite form */}
      <form
        onSubmit={invite}
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["email", "domain"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  border: `1px solid ${
                    kind === k ? COLORS.forest : COLORS.border
                  }`,
                  background: kind === k ? COLORS.sageTint : COLORS.surface,
                  color: kind === k ? COLORS.forest : COLORS.ink,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        {kind === "email" ? (
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        )}
        <div>
          <label style={labelStyle}>Access</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as AccessLevel)}
            style={inputStyle}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={inviting}
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
          {inviting ? "Adding…" : "Add member"}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: 10,
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

      <section
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: COLORS.paperDark,
            borderBottom: `1px solid ${COLORS.border}`,
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            fontWeight: 600,
          }}
        >
          Active — {active.length}
        </div>
        {loading ? (
          <div style={{ padding: 20, color: COLORS.inkMuted }}>Loading…</div>
        ) : active.length === 0 ? (
          <div style={{ padding: 20, color: COLORS.inkMuted, fontSize: 13 }}>
            No active members yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Identifier", "Type", "Access", "Granted", "Via code", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 14px",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        color: COLORS.inkMuted,
                        fontWeight: 600,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {active.map((m) => {
                const identifier =
                  m.user_name || m.user_email || m.email || m.domain || m.user_id;
                const type = m.user_id
                  ? "user"
                  : m.email
                  ? "email"
                  : m.domain
                  ? "domain"
                  : "unknown";
                return (
                  <tr
                    key={m.id}
                    style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        color: COLORS.ink,
                        fontFamily: "monospace",
                      }}
                    >
                      {identifier}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: COLORS.inkSec,
                        textTransform: "uppercase",
                        fontSize: 10,
                        letterSpacing: 0.5,
                      }}
                    >
                      {type}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.inkSec }}>
                      {m.access_level}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: COLORS.inkMuted,
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {new Date(m.granted_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.inkSec }}>
                      {m.redeemed_via_code ? "yes" : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => revoke(m.id)}
                        title="Revoke"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: COLORS.inkMuted,
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {revoked.length > 0 && (
        <section
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            overflow: "hidden",
            marginTop: 20,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: COLORS.paperDark,
              borderBottom: `1px solid ${COLORS.border}`,
              fontSize: 10,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              fontWeight: 600,
            }}
          >
            Revoked — {revoked.length}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {revoked.map((m) => {
                const identifier =
                  m.user_name || m.user_email || m.email || m.domain || m.user_id;
                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: `1px solid ${COLORS.borderLight}`,
                      opacity: 0.6,
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        color: COLORS.inkMuted,
                      }}
                    >
                      {identifier}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.inkMuted }}>
                      {m.access_level}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: COLORS.inkMuted,
                        fontSize: 12,
                      }}
                    >
                      revoked{" "}
                      {m.revoked_at
                        ? new Date(m.revoked_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
