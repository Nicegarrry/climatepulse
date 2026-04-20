import type { PodcastColor } from "./types";

const COLORS: Record<PodcastColor, { played: string; unplayed: string }> = {
  forest: { played: "var(--forest-deep)", unplayed: "var(--forest-light)" },
  plum:   { played: "var(--plum)",        unplayed: "#D9B8D9" },
  ochre:  { played: "var(--ochre-deep)",  unplayed: "#E8CB9B" },
  sky:    { played: "var(--sky)",         unplayed: "#A6BDCB" },
  clay:   { played: "var(--clay)",        unplayed: "#E8BCAB" },
};

export function Waveform({
  bars,
  progress = 0,
  color = "forest",
  playing = false,
}: {
  bars: number[];
  progress?: number;
  color?: PodcastColor;
  playing?: boolean;
}) {
  const c = COLORS[color] ?? COLORS.forest;
  const max = Math.max(...bars);
  const w = 4;
  const gap = 2;
  const total = bars.length * (w + gap);

  return (
    <svg
      viewBox={`0 0 ${total} 40`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      {bars.map((v, i) => {
        const h = (v / max) * 34 + 2;
        const y = (40 - h) / 2;
        const x = i * (w + gap);
        const played = i / bars.length < progress;
        const nearHead = playing && !played && i / bars.length - progress < 0.04;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="1"
            fill={played ? c.played : c.unplayed}
            opacity={played ? 1 : 0.7}
            className={nearHead ? "wf-pulse" : undefined}
          />
        );
      })}
    </svg>
  );
}

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <path d="M4 2 L13 8 L4 14 Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <rect x="3" y="2" width="3.5" height="12" fill="currentColor" />
      <rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" />
    </svg>
  );
}
