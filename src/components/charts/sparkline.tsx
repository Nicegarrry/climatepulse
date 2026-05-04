"use client";

export type SparklinePoint = { date: string; value: number };

export function Sparkline({
  data,
  color = "var(--accent-emerald)",
  height = 40,
}: {
  data: SparklinePoint[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((d.value - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
