// AutoMACC sample portfolio tile — static horizontal bars with a zero-line split.
// Server component. Bars are CSS-animated on mount.

import { Arrow } from "./primitives";

export type MaccBar = { l: string; cost: number; abate: number };

const SAMPLE_BARS: MaccBar[] = [
  { l: "Behind-the-meter solar", cost: -42, abate: 14 },
  { l: "Industrial heat pumps", cost: -18, abate: 18 },
  { l: "Fleet electrification", cost: 8, abate: 22 },
  { l: "Process electrification", cost: 46, abate: 28 },
  { l: "Green H₂ feedstock swap", cost: 84, abate: 11 },
  { l: "BECCS retrofit", cost: 142, abate: 6 },
];

export function MaccTile({
  href,
  bars = SAMPLE_BARS,
}: {
  href: string;
  bars?: MaccBar[];
}) {
  const max = 160;
  const min = -50;
  const range = max - min;
  const zero = ((0 - min) / range) * 100;

  return (
    <a className="lp-macc" href={href}>
      <div className="head">
        <span>AutoMACC · sample portfolio</span>
        <span>A$/tCO₂e</span>
      </div>
      {bars.map((b, i) => {
        const len = (Math.abs(b.cost) / range) * 100;
        const isNeg = b.cost < 0;
        const left = isNeg ? zero - len : zero;
        return (
          <div className="lp-macc-row" key={`${b.l}-${i}`} title={b.l}>
            <div className="b">
              <span
                className={`bar${isNeg ? " neg" : ""}`}
                style={{
                  left: `${left}%`,
                  width: `${len}%`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            </div>
            <span className="price">
              {b.cost > 0 ? "+" : ""}
              {b.cost}
            </span>
          </div>
        );
      })}
      <div className="foot">
        <span>Try AutoMACC</span>
        <span>
          /automacc <Arrow />
        </span>
      </div>
    </a>
  );
}
