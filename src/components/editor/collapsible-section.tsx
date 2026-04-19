"use client";

import { useState, type ReactNode } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

/**
 * A header + chevron that collapses/expands its children. Persists open/closed
 * state in localStorage when `storageKey` is provided so editors don't have
 * to re-collapse noisy sections (e.g. StoryPicker) on every page load.
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  storageKey,
  rightSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return defaultOpen;
    const stored = window.localStorage.getItem(`editor-collapse:${storageKey}`);
    if (stored === null) return defaultOpen;
    return stored === "1";
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined" && storageKey) {
        window.localStorage.setItem(
          `editor-collapse:${storageKey}`,
          next ? "1" : "0"
        );
      }
      return next;
    });
  };

  return (
    <section
      style={{
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 8,
        background: COLORS.surface,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderBottom: open ? `1px solid ${COLORS.borderLight}` : "none",
          background: open ? COLORS.paperDark : "transparent",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 10,
            color: COLORS.inkMuted,
            width: 10,
            display: "inline-block",
            transition: "transform 150ms ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: COLORS.inkFaint,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {rightSlot && (
          <div onClick={(e) => e.stopPropagation()}>{rightSlot}</div>
        )}
      </header>
      {open && <div>{children}</div>}
    </section>
  );
}
