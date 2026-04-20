import { MLFViz } from "./mlf-viz";
import { TrustMarker } from "./trust-marker";
import type { Concept } from "./types";

export function TodayConceptHero({
  concept,
  showTrust = true,
  onOpen,
}: {
  concept: Concept;
  showTrust?: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className="concept-hero editorial"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="c-body">
        <div className="c-eyebrow">
          <span className="dot" />
          <span>TODAY'S CONCEPT · ENERGY — GRID</span>
        </div>
        <div className="c-title">
          {concept.term}{" "}
          <span style={{ color: "var(--ink-3)" }}>·</span>{" "}
          <span style={{ color: "var(--plum)" }}>{concept.abbrev}</span>
        </div>
        <div className="c-sum" style={{ fontFamily: "var(--font-body)", fontSize: 15.5, color: "var(--ink-2)" }}>
          {concept.summary}
        </div>
        <div className="c-meta">
          {showTrust && <TrustMarker />}
          <span className="meta tabular">{concept.updated}</span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--forest-deep)",
            }}
          >
            Read the full card <span className="editorial-arrow">→</span>
          </span>
        </div>
      </div>
      <div className="c-visual">
        <MLFViz />
      </div>
    </div>
  );
}
