import { PATHS } from "./mock-data";
import type { Path } from "./types";

export function ContinueLearning({ onPreview }: { onPreview: (path: Path) => void }) {
  const inProg = PATHS.filter((p) => p.inProgress);

  return (
    <div className="continue-strip">
      {inProg.map((p) => {
        const list = p.chapterList ?? [];
        const cur = list.find((c) => c.current);
        const minsLeft = Math.round((1 - p.progress) * parseInt(p.duration, 10));

        return (
          <div
            key={p.id}
            className="continue-card"
            role="button"
            tabIndex={0}
            onClick={() => onPreview(p)}
          >
            <div className="cc-eyebrow">
              <span className="cc-kind">CONTINUE · {p.sector}</span>
              <span className="cc-chap tabular">{Math.round(p.progress * 100)}%</span>
            </div>
            <div className="cc-title">{p.title}</div>
            <div className="meta" style={{ color: "var(--ink-3)" }}>
              {cur ? (
                <>
                  Next: <span style={{ color: "var(--ink-2)" }}>{cur.title}</span> · {cur.dur}
                </>
              ) : (
                `${minsLeft} min left`
              )}
            </div>
            <div className="progress">
              <i style={{ width: `${p.progress * 100}%`, display: "block", height: "100%" }} />
            </div>
          </div>
        );
      })}

      <div className="continue-card" style={{ background: "var(--paper-dark)" }}>
        <div className="cc-eyebrow">
          <span className="cc-kind" style={{ color: "var(--ink-4)" }}>SAVED CONCEPT</span>
          <span className="cc-chap">◷ 3d ago</span>
        </div>
        <div className="cc-title">Renewable Energy Zone (REZ)</div>
        <div className="meta">Saved from Tuesday's briefing · 1 inline peek · not yet opened</div>
      </div>
    </div>
  );
}
