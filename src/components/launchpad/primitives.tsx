// Small server-safe primitives used by the launchpad triptych.
// All pure SVG / spans — no interactivity, no client boundary needed.

import type { CSSProperties } from "react";

export function PulseDot({ size = 6 }: { size?: number }) {
  return (
    <span
      className="lp-pulse-dot"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function MonoEyebrow({ children }: { children: React.ReactNode }) {
  return <span className="lp-mono-eye">{children}</span>;
}

export function Arrow({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: -1 }}
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MiniSpark({
  data,
  w = 64,
  h = 18,
  style,
}: {
  data: number[];
  w?: number;
  h?: number;
  style?: CSSProperties;
}) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ display: "block", ...style }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Reusable feature row inside a column — explicit link with destination path. */
export function Row({
  href,
  name,
  meta,
  desc,
  tag,
}: {
  href: string;
  name: string;
  meta: string;
  desc: string;
  tag?: string;
}) {
  return (
    <a className="lp-row" href={href}>
      <span className="nm">
        {name}
        {tag && <span className="tag">{tag}</span>}
      </span>
      <span className="go">
        <span className="meta">{meta}</span>
        <span className="sep">·</span>
        <span className="open">
          OPEN <Arrow />
        </span>
      </span>
      <span className="desc">{desc}</span>
    </a>
  );
}
