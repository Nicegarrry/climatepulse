// NEM live snapshot tile — 5 state rows (NSW/VIC/QLD/SA/TAS).
// Server component. Renders sample data with a "sample" stamp if `isSample`.

import { PulseDot, MiniSpark, Arrow } from "./primitives";

export type LiveState = {
  code: string;
  price: number;
  mix: number; // renewables %
  spark?: number[]; // optional pre-computed sparkline points
};

type LiveTileProps = {
  href: string;
  states: LiveState[];
  renewablesPct: number;
  isSample?: boolean;
};

export function LiveTile({ href, states, renewablesPct, isSample }: LiveTileProps) {
  return (
    <a className="lp-live-tile" href={href}>
      <div className="head">
        <span>
          <PulseDot /> &nbsp; NEM · 5-min interval
        </span>
        <span>{Math.round(renewablesPct)}% RENEWABLES</span>
      </div>
      {isSample && (
        <span className="sample-stamp">sample · open live →</span>
      )}
      {states.map((s) => {
        const spark = s.spark ?? [40, 52, 48, 60, 64, 58, s.mix];
        return (
          <div className="lp-live-row" key={s.code}>
            <span className="c">{s.code}</span>
            <span className="p">${s.price.toFixed(2)} /MWh</span>
            <span>
              <MiniSpark data={spark} w={56} h={14} />
            </span>
            <span className="m">{Math.round(s.mix)}%</span>
          </div>
        );
      })}
      <div className="foot">
        <span>Open energy dashboard</span>
        <span>
          /dashboard?tab=energy <Arrow />
        </span>
      </div>
    </a>
  );
}
