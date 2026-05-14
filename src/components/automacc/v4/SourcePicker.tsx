"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { SourceFactor } from "@/lib/automacc/v4-types";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Props {
  open: boolean;
  bucketLabel: string;
  factors: SourceFactor[];
  existingSourceIds: Set<string>;
  onSelect: (factor: SourceFactor) => void;
  onClose: () => void;
}

export function SourcePicker({
  open,
  bucketLabel,
  factors,
  existingSourceIds,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return factors;
    return factors.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.numerical.name.toLowerCase().includes(q),
    );
  }, [factors, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add a source for ${bucketLabel}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 26, 26, 0.35)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "10vh 16px 24px",
        fontFamily: FONTS.sans,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div>
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
              Add source
            </p>
            <h3
              style={{
                margin: "2px 0 0",
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              {bucketLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.inkSec,
            }}
          >
            <XMarkIcon width={14} height={14} />
          </button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources…"
            style={{
              width: "100%",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: FONTS.sans,
              color: COLORS.ink,
              background: "#fff",
              outline: "none",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: 8 }}>
          {factors.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: COLORS.inkMuted,
                fontSize: 13,
              }}
            >
              No factors available yet for this bucket.
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: COLORS.inkMuted,
                fontSize: 13,
              }}
            >
              No matches for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((f) => {
              const already = existingSourceIds.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelect(f)}
                  disabled={already}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: "10px 12px",
                    borderRadius: 6,
                    cursor: already ? "default" : "pointer",
                    opacity: already ? 0.5 : 1,
                    fontFamily: FONTS.sans,
                  }}
                  onMouseEnter={(e) => {
                    if (!already) e.currentTarget.style.background = COLORS.sageTint;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.ink,
                      marginBottom: 2,
                    }}
                  >
                    {f.label}
                    {already && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: COLORS.inkMuted,
                        }}
                      >
                        added
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.inkSec }}>
                    {f.numerical.name} · {f.numerical.unit}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
