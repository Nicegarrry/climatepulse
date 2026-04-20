"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Mechanism {
  title: string;
  body: string;
}

/**
 * Client-side accordion for key_mechanisms. Only the interactive bits live
 * here — everything else on the concept card stays server-rendered.
 */
export function KeyMechanismsAccordion({
  mechanisms,
}: {
  mechanisms: Mechanism[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!mechanisms || mechanisms.length === 0) return null;

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 2,
        background: COLORS.surface,
      }}
    >
      {mechanisms.map((m, i) => {
        const open = openIndex === i;
        const panelId = `mechanism-panel-${i}`;
        const buttonId = `mechanism-button-${i}`;
        return (
          <li
            key={i}
            style={{
              borderBottom:
                i === mechanisms.length - 1
                  ? "none"
                  : `1px solid ${COLORS.borderLight}`,
            }}
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenIndex(open ? null : i)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "14px 16px",
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.ink,
                letterSpacing: "-0.005em",
              }}
            >
              <span>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    fontSize: 11,
                    color: COLORS.inkMuted,
                    marginRight: 10,
                    letterSpacing: "0.04em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {m.title}
              </span>
              <ChevronDownIcon
                width={16}
                height={16}
                strokeWidth={1.6}
                style={{
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                  color: COLORS.inkMuted,
                  flex: "none",
                }}
                aria-hidden="true"
              />
            </button>
            {open && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                style={{
                  padding: "0 16px 16px 44px",
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: COLORS.inkSec,
                }}
              >
                {m.body.split(/\n\n+/).map((para, j) => (
                  <p key={j} style={{ margin: j === 0 ? 0 : "0.75em 0 0" }}>
                    {para}
                  </p>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
