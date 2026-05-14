// Latest Weekly Pulse edition hero. Server component.
// Render-suppressed by the page when no published edition exists.

import { Arrow } from "./primitives";

type WeeklyTileProps = {
  href: string;
  edition: string; // e.g. "Edition 14"
  date: string;    // e.g. "Sunday 11 May"
  title: string;
  lede: string;
};

export function WeeklyTile({ href, edition, date, title, lede }: WeeklyTileProps) {
  return (
    <a className="lp-weekly" href={href}>
      <div className="edition">
        <span>
          {edition} · {date}
        </span>
        <span>READ →</span>
      </div>
      <h4>{title}</h4>
      <p>{lede}</p>
      <div className="foot">
        <span>Open the weekly</span>
        <span>
          {href} <Arrow />
        </span>
      </div>
    </a>
  );
}
