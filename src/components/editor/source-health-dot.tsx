"use client";

import { useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface UnhealthySource {
  id: string;
  name: string;
  type: string;
  consecutive_failures: number;
  last_success_at: string | null;
  last_error: string | null;
}

interface HealthPayload {
  total: number;
  unhealthy_count: number;
  unhealthy: UnhealthySource[];
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SourceHealthDot() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/editorial/source-health");
        if (!res.ok) return;
        const body = (await res.json()) as HealthPayload;
        if (!cancelled) setData(body);
      } catch {
        /* no-op */
      }
    };
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!data) return null;

  const unhealthy = data.unhealthy_count;
  const ok = unhealthy === 0;
  const accent = ok ? COLORS.forest : "#A03030";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 55,
        fontFamily: FONTS.sans,
      }}
    >
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 0,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "10px 12px",
            minWidth: 260,
            maxWidth: 360,
            maxHeight: 320,
            overflowY: "auto",
            boxShadow: "0 10px 24px rgba(26,26,26,0.15)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: COLORS.inkMuted,
              marginBottom: 6,
            }}
          >
            Source health &mdash; {data.total} active
          </div>
          {ok ? (
            <div style={{ fontSize: 12, color: COLORS.inkSec }}>
              All sources fetching normally.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.unhealthy.map((s) => (
                <li
                  key={s.id}
                  style={{
                    padding: "6px 0",
                    borderBottom: `1px solid ${COLORS.paperDark}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: COLORS.ink, fontWeight: 500 }}>
                    {s.name}{" "}
                    <span
                      style={{
                        fontSize: 10,
                        color: COLORS.inkFaint,
                        marginLeft: 4,
                      }}
                    >
                      ({s.type})
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#A03030",
                      marginTop: 2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.consecutive_failures} failures &middot; last OK{" "}
                    {formatRelative(s.last_success_at)}
                  </div>
                  {s.last_error && (
                    <div
                      style={{
                        fontSize: 10,
                        color: COLORS.inkMuted,
                        marginTop: 2,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {s.last_error.slice(0, 120)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          ok
            ? "All sources healthy"
            : `${unhealthy} unhealthy source${unhealthy === 1 ? "" : "s"}`
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: COLORS.surface,
          border: `1px solid ${ok ? COLORS.borderLight : accent}`,
          borderRadius: 20,
          cursor: "pointer",
          fontSize: 11,
          color: COLORS.inkSec,
          boxShadow: "0 2px 6px rgba(26,26,26,0.06)",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            display: "inline-block",
          }}
        />
        {ok ? "Sources OK" : `${unhealthy} failing`}
      </button>
    </div>
  );
}
