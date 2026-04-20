import { PATHS } from "./mock-data";
import type { Path } from "./types";

function Progress({ value }: { value: number }) {
  return (
    <div
      aria-hidden
      style={{ height: 2, background: "var(--border)", width: 180, position: "relative" }}
    >
      <i
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          background: "var(--forest)",
          width: `${value * 100}%`,
          display: "block",
        }}
      />
    </div>
  );
}

export function FeaturedPaths({ onPreview }: { onPreview: (path: Path) => void }) {
  return (
    <div className="paths indexed">
      {PATHS.map((p, i) => (
        <div
          key={p.id}
          className={"path-row" + (p.inProgress ? " in-progress" : "")}
          role="button"
          tabIndex={0}
          onClick={() => onPreview(p)}
        >
          <div className="p-idx tabular">{String(i + 1).padStart(2, "0")}</div>
          <div>
            <div className="p-title">{p.title}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <span className="micro" style={{ color: "var(--forest-deep)" }}>{p.sector}</span>
              {p.inProgress && (
                <span className="meta tabular" style={{ color: "var(--forest-deep)" }}>
                  · {Math.round(p.progress * 100)}% read
                </span>
              )}
            </div>
            {p.inProgress && (
              <div style={{ marginTop: 10 }}>
                <Progress value={p.progress} />
              </div>
            )}
          </div>
          <div className="p-scope">{p.scope}</div>
          <div className="p-dur tabular">{p.duration}</div>
          <div className="p-chap tabular">{p.chapters} ch.</div>
          <div className="p-go">→</div>
        </div>
      ))}
    </div>
  );
}
