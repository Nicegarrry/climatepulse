import { MICROSECTOR_TILE_ACCENTS, MICROSECTORS } from "./mock-data";
import type { Microsector } from "./types";

export function BrowseMicrosectors({ onDrill }: { onDrill: (m: Microsector) => void }) {
  return (
    <div className="browse">
      {MICROSECTORS.map((m, i) => {
        const coming = !!m.coming;
        return (
          <div
            key={m.num}
            data-accent={MICROSECTOR_TILE_ACCENTS[i]}
            className={"tile" + (m.cold ? " cold" : "") + (coming ? " coming" : "")}
            role="button"
            tabIndex={coming ? -1 : 0}
            aria-disabled={coming}
            onClick={() => {
              if (!coming) onDrill(m);
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="t-num tabular">{m.num}</span>
              {m.fresh && <span className="t-fresh" title="New this week" />}
            </div>
            <div className="t-name">{m.name}</div>
            <div className="t-stats">
              <span className="t-count tabular">
                {coming ? "brief coming soon" : `${m.briefs} briefs · ${m.reviewed} reviewed`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
