"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";

// ─── WobblyRule ─────────────────────────────────────────────────────────────

export function WobblyRule({ color = COLORS.border }: { color?: string }) {
  return (
    <svg
      width="100%"
      height="4"
      viewBox="0 0 600 4"
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <path
        d="M0,2 C40,1.2 80,2.8 120,1.8 C160,0.8 200,2.6 240,2.2 C280,1.8 320,2.4 360,1.6 C400,2.8 440,1.4 480,2.2 C520,2.6 560,1.8 600,2"
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Micro ──────────────────────────────────────────────────────────────────

export function Micro({
  children,
  color = COLORS.inkMuted,
  mb = 0,
}: {
  children: React.ReactNode;
  color?: string;
  mb?: number;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: FONTS.sans,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color,
        marginBottom: mb,
        display: mb ? "block" : "inline",
      }}
    >
      {children}
    </span>
  );
}

// ─── SourceTag ──────────────────────────────────────────────────────────────

export function SourceTag({
  name,
  type,
}: {
  name: string;
  type?: string;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: FONTS.sans,
        color: COLORS.inkMuted,
        borderBottom: "1px dotted #D0CCC6",
        paddingBottom: 1,
        cursor: "pointer",
      }}
    >
      {name}
      {type && (
        <span
          style={{
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginLeft: 4,
            color: COLORS.inkFaint,
            fontWeight: 600,
          }}
        >
          {type}
        </span>
      )}
    </span>
  );
}

// ─── SectorArt ──────────────────────────────────────────────────────────────

const SECTOR_SVG: Record<
  string,
  { bg: string; el: React.ReactNode }
> = {
  "GRID & TRANSMISSION": {
    bg: "#E2E8DC",
    el: (
      <>
        <line x1="25" y1="85" x2="50" y2="20" stroke={COLORS.forest} strokeWidth="2.5" />
        <line x1="50" y1="20" x2="75" y2="20" stroke={COLORS.forest} strokeWidth="2.5" />
        <line x1="75" y1="20" x2="100" y2="85" stroke={COLORS.forest} strokeWidth="2.5" />
        <line x1="37" y1="52" x2="88" y2="52" stroke={COLORS.forest} strokeWidth="1.5" />
        <line x1="32" y1="68" x2="93" y2="68" stroke={COLORS.forestMid} strokeWidth="1" />
        <circle cx="50" cy="20" r="3.5" fill={COLORS.forest} />
        <circle cx="75" cy="20" r="3.5" fill={COLORS.forest} />
        <circle cx="115" cy="22" r="12" fill={COLORS.sage} opacity="0.35" />
      </>
    ),
  },
  "CRITICAL MINERALS": {
    bg: "#E5E2DD",
    el: (
      <>
        <polygon points="50,12 70,8 82,28 76,52 58,56 44,40" fill="none" stroke={COLORS.plumMid} strokeWidth="1.8" />
        <polygon points="60,18 72,16 76,34 64,42" fill={COLORS.plumLight} opacity="0.6" />
        <polygon points="85,42 105,36 112,62 92,68" fill="none" stroke={COLORS.inkMuted} strokeWidth="1.2" />
        <polygon points="22,55 35,48 42,68 30,74" fill="none" stroke={COLORS.sage} strokeWidth="1.2" />
      </>
    ),
  },
  "CARBON & OFFSETS": {
    bg: "#E5E8E0",
    el: (
      <>
        <circle cx="55" cy="45" r="18" fill="none" stroke={COLORS.inkMuted} strokeWidth="1.5" strokeDasharray="4 3" />
        <circle cx="88" cy="32" r="12" fill="none" stroke={COLORS.sage} strokeWidth="1.5" />
        <circle cx="88" cy="62" r="12" fill="none" stroke={COLORS.sage} strokeWidth="1.5" />
        <path d="M12 85 L22 52 L32 85Z" fill={COLORS.forest} opacity="0.2" />
        <path d="M36 85 L50 42 L64 85Z" fill={COLORS.forest} opacity="0.3" />
      </>
    ),
  },
  "BUILT ENVIRONMENT": {
    bg: "#E2E6DF",
    el: (
      <>
        <rect x="18" y="28" width="28" height="58" fill="none" stroke={COLORS.forest} strokeWidth="1.8" rx="1" />
        <rect x="54" y="14" width="22" height="72" fill="none" stroke={COLORS.forestMid} strokeWidth="1.8" rx="1" />
        <rect x="84" y="34" width="30" height="52" fill="none" stroke={COLORS.sage} strokeWidth="1.8" rx="1" />
      </>
    ),
  },
  HYDROGEN: {
    bg: "#DDE8E1",
    el: (
      <>
        <circle cx="48" cy="46" r="16" fill="none" stroke={COLORS.forest} strokeWidth="1.8" />
        <text x="41" y="51" fontSize="14" fill={COLORS.forest} fontWeight="600" fontFamily={FONTS.sans}>
          H
        </text>
        <circle cx="92" cy="46" r="16" fill="none" stroke={COLORS.forest} strokeWidth="1.8" />
        <text x="85" y="51" fontSize="14" fill={COLORS.forest} fontWeight="600" fontFamily={FONTS.sans}>
          H
        </text>
        <line x1="64" y1="46" x2="76" y2="46" stroke={COLORS.forest} strokeWidth="2.5" />
      </>
    ),
  },
};

export function SectorArt({
  sector,
  height = 100,
  style,
}: {
  sector: string;
  height?: number;
  style?: React.CSSProperties;
}) {
  const data = SECTOR_SVG[sector] || { bg: COLORS.borderLight, el: null };
  return (
    <div
      style={{
        width: "100%",
        height,
        background: data.bg,
        overflow: "hidden",
        ...style,
      }}
    >
      {data.el && (
        <svg
          viewBox="0 0 140 90"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {data.el}
        </svg>
      )}
    </div>
  );
}
