interface Node {
  x: number;
  y: number;
  name: string;
  mlf: number;
  ref?: boolean;
  gen?: boolean;
}

export function MLFViz({ dark = false }: { dark?: boolean }) {
  const nodes: Node[] = [
    { x: 80, y: 150, name: "WA", mlf: 0.92 },
    { x: 170, y: 120, name: "SA", mlf: 0.88 },
    { x: 240, y: 80, name: "QLD", mlf: 0.94 },
    { x: 230, y: 160, name: "NSW", mlf: 1.0, ref: true },
    { x: 215, y: 210, name: "VIC", mlf: 0.96 },
    { x: 260, y: 240, name: "TAS", mlf: 0.83 },
    { x: 140, y: 190, name: "MLF·0.78", mlf: 0.78, gen: true },
    { x: 185, y: 90, name: "MLF·0.91", mlf: 0.91, gen: true },
    { x: 275, y: 130, name: "MLF·0.97", mlf: 0.97, gen: true },
  ];
  const edges: [number, number][] = [
    [3, 0], [3, 1], [3, 2], [3, 4], [4, 5], [1, 6], [2, 7], [3, 8],
  ];
  const bg = dark ? "transparent" : "var(--paper-inset)";
  const stroke = dark ? "rgba(239,232,238,0.35)" : "rgba(30, 77, 43, 0.35)";
  const ink = dark ? "#EFE8EE" : "#1A1A1A";
  const muted = dark ? "#D9B8D9" : "#6B6B6B";
  const accent = dark ? "#A8C2B0" : "#1E4D2B";

  return (
    <svg
      viewBox="0 0 360 320"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", background: bg }}
    >
      <g stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} strokeWidth="0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="360" y2={i * 40} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="320" />
        ))}
      </g>
      {edges.map(([a, b], i) => (
        <line
          key={`e${i}`}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      ))}
      {nodes.map((n, i) => {
        const r = n.ref ? 7 : n.gen ? 4.5 : 5.5;
        const fill = n.ref ? accent : n.gen ? (dark ? "#EFE8EE" : "#3D1F3D") : ink;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={r} fill={fill} opacity={n.gen ? 0.85 : 1} />
            {n.ref && <circle cx={n.x} cy={n.y} r="12" fill="none" stroke={accent} strokeWidth="0.8" />}
            <text
              x={n.x + 9}
              y={n.y + 3}
              fontFamily="JetBrains Mono, monospace"
              fontSize={n.gen ? "8" : "9"}
              fill={n.gen ? muted : ink}
            >
              {n.name}
            </text>
          </g>
        );
      })}
      <text x="12" y="22" fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="1" fill={muted}>
        FY26 · MARGINAL LOSS FACTORS · NEM
      </text>
      <text x="12" y="308" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={muted}>
        REF · NSW
      </text>
      <text x="300" y="308" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={muted} textAnchor="end">
        AEMO · 2025
      </text>
    </svg>
  );
}
