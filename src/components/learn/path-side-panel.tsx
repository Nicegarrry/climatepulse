"use client";

import { useEffect } from "react";
import type { Chapter, Path } from "./types";

const FALLBACK_CHAPTER_TITLES = [
  "What it is",
  "Why it matters now",
  "Key mechanics",
  "Who wins, who loses",
  "Counterfactuals",
  "What to watch",
  "Sources",
];

export function PathSidePanel({
  path,
  onClose,
  onOpenFull,
}: {
  path: Path | null;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const open = !!path;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const p = path;
  const list: Chapter[] = p
    ? p.chapterList ??
      Array.from({ length: p.chapters }, (_, i) => ({
        title: FALLBACK_CHAPTER_TITLES[i % FALLBACK_CHAPTER_TITLES.length],
        dur: `${4 + (i % 4)} min`,
        done: p.inProgress && i / p.chapters < p.progress,
      }))
    : [];

  return (
    <>
      {open && <div className="cp-learn-side-scrim" onClick={onClose} />}
      <aside
        className={"cp-learn-side-panel" + (open ? " open" : "")}
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
      >
        <div className="sp-head">
          <span className="sp-crumb">Learn / Paths / {p?.sector ?? ""}</span>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="sp-body">
          {p && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span className="micro" style={{ color: "var(--forest-deep)" }}>PATH PREVIEW</span>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 30,
                    fontWeight: 350,
                    lineHeight: 1.1,
                    letterSpacing: "-0.4px",
                  }}
                >
                  {p.title}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.55, color: "var(--ink-2)" }}>
                  {p.scope}
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 4 }}>
                  <span className="meta tabular">{p.duration}</span>
                  <span style={{ width: 3, height: 3, background: "var(--ink-4)", borderRadius: "50%" }} />
                  <span className="meta tabular">{p.chapters} chapters</span>
                  {p.inProgress && (
                    <>
                      <span style={{ width: 3, height: 3, background: "var(--ink-4)", borderRadius: "50%" }} />
                      <span className="meta tabular" style={{ color: "var(--forest-deep)" }}>
                        {Math.round(p.progress * 100)}% read
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 32 }}>
                <div
                  className="micro-ink"
                  style={{ paddingBottom: 8, borderBottom: "1px solid var(--ink)", marginBottom: 12 }}
                >
                  CHAPTERS
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {list.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr auto",
                        gap: 12,
                        alignItems: "baseline",
                        padding: "12px 0",
                        borderBottom: "1px solid var(--border-faint)",
                        opacity: c.done ? 0.55 : 1,
                      }}
                    >
                      <span
                        className="tabular"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: c.current ? "var(--forest-deep)" : "var(--ink-4)",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 16,
                            lineHeight: 1.35,
                            color: c.done ? "var(--ink-4)" : "var(--ink)",
                            textDecoration: c.done ? "line-through" : "none",
                            textDecorationColor: "var(--ink-5)",
                          }}
                        >
                          {c.title}
                        </div>
                        {c.current && (
                          <div className="meta" style={{ color: "var(--forest-deep)", marginTop: 2 }}>
                            ↳ you are here
                          </div>
                        )}
                      </div>
                      <span className="meta tabular">{c.dur}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: 28,
                  padding: 16,
                  background: "var(--forest-wash)",
                  borderRadius: 6,
                }}
              >
                <div className="micro" style={{ color: "var(--forest-deep)", marginBottom: 6 }}>
                  WHY THIS PATH
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: "var(--ink-2)",
                  }}
                >
                  Curated by our grid editor. Pairs well with today's concept card on Marginal Loss Factor.
                </div>
              </div>
            </>
          )}
        </div>
        <div className="sp-foot">
          <button type="button" className="btn btn-primary" onClick={onOpenFull}>
            {p?.inProgress ? "Continue reading" : "Start path"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
