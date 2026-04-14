import { useState, useRef, useEffect, useCallback } from "react";

const FS = "'Source Sans 3', system-ui, sans-serif";
const FD = "'Crimson Pro', Georgia, serif";

const C = {
  bg: "#FAF9F7", surface: "#FFFFFF", paperDark: "#F5F3F0",
  border: "#E8E5E0", borderLight: "#F0EEEA",
  ink: "#1A1A1A", inkSec: "#5C5C5C", inkMuted: "#8C8C8C", inkFaint: "#B3B3B3",
  forest: "#1E4D2B", forestMid: "#4A7C59", sage: "#94A88A", sageTint: "#EFF4EC",
  plum: "#3D1F3D", plumLight: "#F5EEF5", plumMid: "#6B4A6B",
};

const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

const IMG_STYLE = {
  filter: "saturate(0.45) sepia(0.1) contrast(0.92) brightness(1.05)",
  objectFit: "cover", width: "100%", height: "100%", display: "block",
};

const SECTOR_IMG = {
  "GRID & TRANSMISSION": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&h=300&fit=crop",
  "CARBON & OFFSETS": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=300&fit=crop",
  "CRITICAL MINERALS": "https://images.unsplash.com/photo-1504197832061-98356e3dcdcf?w=600&h=300&fit=crop",
  "BUILT ENVIRONMENT": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=300&fit=crop",
  "HYDROGEN": "https://images.unsplash.com/photo-1581092160607-ee67df4e02ce?w=600&h=300&fit=crop",
};

// SVG sector illustrations as fallback when images don't load
const SECTOR_SVG = {
  "GRID & TRANSMISSION": (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="120" height="80" fill="#E8EFE4" />
      <line x1="20" y1="70" x2="40" y2="20" stroke={C.forest} strokeWidth="2" />
      <line x1="40" y1="20" x2="60" y2="20" stroke={C.forest} strokeWidth="2" />
      <line x1="60" y1="20" x2="80" y2="70" stroke={C.forest} strokeWidth="2" />
      <line x1="30" y1="45" x2="70" y2="45" stroke={C.forest} strokeWidth="1.5" />
      <circle cx="40" cy="20" r="3" fill={C.forest} /><circle cx="60" cy="20" r="3" fill={C.forest} />
      <circle cx="95" cy="18" r="8" fill={C.sage} opacity="0.4" />
    </svg>
  ),
  "CARBON & OFFSETS": (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="120" height="80" fill="#EDEAE4" />
      <circle cx="50" cy="40" r="14" fill="none" stroke={C.inkMuted} strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="75" cy="30" r="9" fill="none" stroke={C.sage} strokeWidth="1.5" />
      <circle cx="75" cy="55" r="9" fill="none" stroke={C.sage} strokeWidth="1.5" />
      <path d="M15 70 L20 50 L25 70Z" fill={C.forest} opacity="0.2" />
      <path d="M28 70 L35 42 L42 70Z" fill={C.forest} opacity="0.3" />
    </svg>
  ),
  "CRITICAL MINERALS": (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="120" height="80" fill="#EAE8E4" />
      <polygon points="45,15 60,10 70,25 65,45 50,48 40,35" fill="none" stroke={C.plumMid} strokeWidth="1.5" />
      <polygon points="55,20 65,18 68,32 58,38" fill={C.plumLight} />
      <polygon points="70,40 85,35 90,55 75,60" fill="none" stroke={C.inkMuted} strokeWidth="1" />
    </svg>
  ),
  "BUILT ENVIRONMENT": (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="120" height="80" fill="#E8ECE6" />
      <rect x="20" y="25" width="22" height="45" fill="none" stroke={C.forest} strokeWidth="1.5" rx="1" />
      <rect x="50" y="15" width="18" height="55" fill="none" stroke={C.forestMid} strokeWidth="1.5" rx="1" />
      <rect x="75" y="30" width="25" height="40" fill="none" stroke={C.sage} strokeWidth="1.5" rx="1" />
    </svg>
  ),
  "HYDROGEN": (
    <svg viewBox="0 0 120 80" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="120" height="80" fill="#E6EDE8" />
      <circle cx="42" cy="40" r="12" fill="none" stroke={C.forest} strokeWidth="1.5" />
      <text x="37" y="44" fontSize="10" fill={C.forest} fontWeight="600">H</text>
      <circle cx="78" cy="40" r="12" fill="none" stroke={C.forest} strokeWidth="1.5" />
      <text x="73" y="44" fontSize="10" fill={C.forest} fontWeight="600">H</text>
      <line x1="54" y1="40" x2="66" y2="40" stroke={C.forest} strokeWidth="2" />
    </svg>
  ),
};

function SectorVisual({ sector, style = {} }) {
  const [imgError, setImgError] = useState(false);
  const src = SECTOR_IMG[sector];
  const fallback = SECTOR_SVG[sector];

  if (imgError || !src) {
    return <div style={{ ...style, overflow: "hidden" }}>{fallback || <div style={{ width: "100%", height: "100%", background: C.borderLight }} />}</div>;
  }
  return (
    <div style={{ ...style, overflow: "hidden", position: "relative" }}>
      <img src={src} alt="" style={IMG_STYLE} onError={() => setImgError(true)} loading="lazy" />
    </div>
  );
}

const LEADS = [
  {
    id: 1, sector: "GRID & TRANSMISSION", severity: "alert",
    headline: "Victoria\u2019s west region curtailment hits 18% as transmission bottleneck deepens",
    summary: "AEMO data shows solar curtailment in western Victoria reached 18.3% yesterday \u2014 the fourth consecutive day above 15%. The Western Renewables Link faces a revised completion date of late 2028 following contractor disputes.",
    sources: ["AEMO Dashboard", "AusNet Q3 Update"], sourceTypes: ["data", "filing"],
    number: "18.3", unit: "%", trend: "\u2191 4th day >15%",
    whyItMatters: "Persistent curtailment erodes project economics for existing solar farms and delays ROI timelines for committed capacity across the NEM.",
  },
  {
    id: 2, sector: "CRITICAL MINERALS", severity: "alert",
    headline: "Pilbara lithium spot price falls below A$900/t for first time since 2022",
    summary: "Spodumene concentrate traded at A$880/t on the Pilbara spot market. Albemarle has flagged potential production deferrals at its Kemerton hydroxide facility, while IGO confirmed a review of downstream processing timelines.",
    sources: ["Fastmarkets", "ASX Filings"], sourceTypes: ["data", "filing"],
    number: "880", unit: "A$/t", trend: "\u2193 lowest since Oct 2022",
    whyItMatters: "Sub-$900 spodumene threatens Australian lithium processing viability and may delay the critical minerals supply chain needed for domestic battery manufacturing.",
  },
  {
    id: 3, sector: "CARBON & OFFSETS", severity: "watch",
    headline: "CER flags methodology review for landfill gas credits after satellite discrepancy",
    summary: "The Clean Energy Regulator has initiated a review of ACCU methodology for landfill gas capture projects, citing discrepancies between reported methane destruction and satellite-derived emissions estimates from the Global Methane Pledge monitoring network.",
    sources: ["CER Media Release"], sourceTypes: ["release"],
    whyItMatters: "A methodology review could invalidate or repricing a material portion of the ACCU supply pipeline, affecting carbon credit portfolios across the market.",
  },
];

const ALSO = [
  { id: 4, sector: "BUILT ENVIRONMENT", severity: "ready", headline: "NABERS 6-star threshold proposed for new commercial buildings from 2028", sources: ["CCA Draft Report"], sourceTypes: ["report"] },
  { id: 5, sector: "HYDROGEN", severity: "watch", headline: "Fortescue scales back Gibson Island electrolyser to 50\u2009MW pilot", sources: ["Fortescue ASX Announcement"], sourceTypes: ["filing"], number: "50", unit: "MW" },
];

const SEVERITY = { alert: { border: C.ink, color: C.ink }, watch: { border: C.inkMuted, color: C.inkSec }, ready: { border: C.forest, color: C.forest } };
const NAV = [{ icon: "\u25C7", label: "Briefing" }, { icon: "\u2197", label: "Explore" }, { icon: "\u2261", label: "Sectors" }, { icon: "\u25CE", label: "Storylines" }, { icon: "\u25A4", label: "Weekly" }];

const Micro = ({ children, color = C.inkMuted, mb = 0 }) => (
  <span style={{ fontSize: 10, fontFamily: FS, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color, marginBottom: mb, display: mb ? "block" : "inline" }}>{children}</span>
);
const Src = ({ name, type }) => (
  <span style={{ fontSize: 11, fontFamily: FS, color: C.inkMuted, borderBottom: "1px dotted #D0CCC6", paddingBottom: 1, cursor: "pointer" }}>
    {name}{type && <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 4, color: C.inkFaint, fontWeight: 600 }}>{type}</span>}
  </span>
);
const WobblyRule = ({ color = C.border }) => (
  <svg width="100%" height="4" viewBox="0 0 600 4" preserveAspectRatio="none" style={{ display: "block" }}>
    <path d="M0,2 C40,1.2 80,2.8 120,1.8 C160,0.8 200,2.6 240,2.2 C280,1.8 320,2.4 360,1.6 C400,2.8 440,1.4 480,2.2 C520,2.6 560,1.8 600,2" fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

// ——— Desktop ———

function Desktop() {
  const [expanded, setExpanded] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(0);

  return (
    <div style={{ display: "flex", height: "100%", background: C.bg, backgroundImage: GRAIN, fontFamily: FS, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <nav style={{ width: sidebarOpen ? 150 : 52, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: sidebarOpen ? "stretch" : "center", paddingTop: 18, transition: "width 150ms ease", overflow: "hidden" }}>
        <div onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: 26, height: 26, borderRadius: 5, background: C.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 12, fontStyle: "italic", cursor: "pointer", marginBottom: 22, marginLeft: sidebarOpen ? 12 : 0, flexShrink: 0 }}>cp</div>
        {NAV.map((item, i) => (
          <div key={i} onClick={() => setActiveNav(i)} style={{ display: "flex", alignItems: "center", gap: 9, padding: sidebarOpen ? "8px 12px" : "0", width: sidebarOpen ? "auto" : 34, height: sidebarOpen ? "auto" : 34, justifyContent: sidebarOpen ? "flex-start" : "center", borderRadius: 6, marginBottom: 2, cursor: "pointer", background: activeNav === i ? C.sageTint : "transparent", color: activeNav === i ? C.forest : C.inkMuted, fontSize: 14, transition: "all 150ms ease" }}>
            <span style={{ width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: activeNav === i ? 500 : 400, whiteSpace: "nowrap" }}>{item.label}</span>}
          </div>
        ))}
      </nav>

      <main style={{ flex: 1, overflowY: "auto", padding: "26px 32px 60px", maxWidth: 800 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontFamily: FD, fontSize: 34, fontWeight: 400, color: C.ink, margin: 0, letterSpacing: -0.8, lineHeight: 1.1 }}>Monday 14 April 2026</h1>
            <div style={{ marginTop: 5, display: "flex", alignItems: "baseline", gap: 12 }}>
              <Micro>Daily Briefing</Micro>
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: C.inkFaint }}>No.\u2009312 \u00B7 {LEADS.length + ALSO.length} stories</span>
            </div>
          </div>
          <span style={{ fontSize: 13, fontFamily: FD, fontStyle: "italic", paddingBottom: 2 }}>
            <span style={{ color: C.forest }}>climate</span><span style={{ color: C.plum }}>pulse</span>
          </span>
        </div>
        <div style={{ margin: "18px 0 22px" }}><WobblyRule /></div>

        {/* Daily Number + Today's Read */}
        <div style={{ display: "flex", gap: 20, marginBottom: 26, alignItems: "flex-start" }}>
          <div style={{ borderTop: `2px solid ${C.plum}`, background: C.surface, border: `1px solid ${C.border}`, borderTopWidth: 2, borderTopColor: C.plum, borderRadius: 8, padding: "18px 22px", flex: "0 0 215px", marginTop: -4 }}>
            <Micro color={C.plum}>Daily Number</Micro>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
              <span style={{ fontFamily: FD, fontSize: 46, fontWeight: 300, color: C.plum, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>34.2</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.plumMid }}>GW</span>
            </div>
            <div style={{ fontSize: 12, color: C.inkSec, marginTop: 5 }}>Renewable generation yesterday</div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.borderLight}`, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.forest, fontVariantNumeric: "tabular-nums" }}>+7.5%</span>
              <span style={{ fontSize: 10, color: C.inkMuted }}>vs.\u200930-day avg</span>
            </div>
            <p style={{ fontSize: 10, color: C.inkMuted, lineHeight: 1.5, margin: "5px 0 0" }}>Highest April weekday on record.</p>
            <div style={{ marginTop: 8 }}><Src name="AEMO" type="data" /></div>
          </div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            <Micro color={C.forest} mb={8}>Today\u2019s Read</Micro>
            <p style={{ fontFamily: FD, fontSize: 16, fontStyle: "italic", color: C.inkSec, lineHeight: 1.65, margin: 0 }}>
              Western Victoria\u2019s curtailment crisis is no longer a grid operations footnote \u2014 it\u2019s becoming a capital allocation story. Four consecutive days above 15% are forcing developers to revisit financial models, while lithium\u2019s slide below A$900/t compounds the pressure on Australia\u2019s critical minerals ambitions.
            </p>
          </div>
        </div>

        {/* Lead Stories */}
        <div style={{ marginBottom: 6 }}><Micro>Lead Stories</Micro></div>
        <div style={{ marginBottom: 10 }}><WobblyRule color={C.borderLight} /></div>
        {LEADS.map((story, idx) => {
          const sev = SEVERITY[story.severity] || SEVERITY.watch;
          const isOpen = expanded === story.id;
          return (
            <div key={story.id} onClick={() => setExpanded(isOpen ? null : story.id)} style={{
              display: "flex", gap: 14, background: C.surface, border: `1px solid ${C.border}`,
              borderLeft: idx === 0 ? `3px solid ${C.ink}` : `2px solid ${sev.border}`,
              borderRadius: idx === 0 ? "0 8px 8px 0" : 8,
              padding: "14px 20px 14px 16px", marginBottom: 8, cursor: "pointer",
              marginLeft: idx === 0 ? -4 : 0,
              transition: "background 150ms ease",
            }}>
              <SectorVisual sector={story.sector} style={{ width: 90, height: 62, borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {idx === 0 && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.plum }}>Lead</span>}
                    <Micro color={sev.color}>{story.sector}</Micro>
                  </div>
                  {story.number && (
                    <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{story.number}</span>
                      <span style={{ fontSize: 10, color: C.inkMuted, marginLeft: 3 }}>{story.unit}</span>
                    </span>
                  )}
                </div>
                <h3 style={{ fontFamily: FD, fontSize: idx === 0 ? 18 : 15, fontWeight: 400, color: C.ink, lineHeight: 1.3, margin: 0 }}>{story.headline}</h3>
                {isOpen && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 13, color: C.inkSec, lineHeight: 1.65, margin: "0 0 8px" }}>{story.summary}</p>
                    {story.trend && <div style={{ fontSize: 11, color: C.forest, fontWeight: 500, marginBottom: 8 }}>{story.trend}</div>}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <Micro color={C.inkFaint}>Sources</Micro>
                      {story.sources.map((s, i) => <Src key={i} name={s} type={story.sourceTypes?.[i]} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Also Today */}
        <div style={{ marginTop: 20, marginBottom: 6 }}><Micro>Also Today</Micro></div>
        <div style={{ marginBottom: 10 }}><WobblyRule color={C.borderLight} /></div>
        {ALSO.map((story) => {
          const sev = SEVERITY[story.severity] || SEVERITY.watch;
          return (
            <div key={story.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ flex: 1 }}>
                <Micro color={sev.color}>{story.sector}</Micro>
                <h3 style={{ fontFamily: FD, fontSize: 14, fontWeight: 400, color: C.ink, lineHeight: 1.3, margin: "3px 0 0" }}>{story.headline}</h3>
              </div>
              {story.number && <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 12 }}>{story.number}<span style={{ fontSize: 9, color: C.inkMuted, marginLeft: 2 }}>{story.unit}</span></span>}
            </div>
          );
        })}

        <div style={{ marginTop: 28 }}><WobblyRule color={C.borderLight} /></div>
        <div style={{ paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: 10, color: C.inkFaint, lineHeight: 1.5, margin: 0, maxWidth: 420 }}>Stories ranked by sector relevance. AI analysis \u2014 verify against primary sources.</p>
          <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: C.inkFaint }}>06:00\u2009AEST</span>
        </div>
      </main>

      {/* Sidebar */}
      <aside style={{ width: 215, flexShrink: 0, borderLeft: `1px solid ${C.border}`, background: C.bg, backgroundImage: GRAIN, padding: "26px 14px", overflowY: "auto" }}>
        <Micro color={C.forest}>Energy Snapshot</Micro>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginTop: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>NEM Generation 7\u2009Day</div>
          <svg viewBox="0 0 180 65" style={{ width: "100%", height: "auto" }}>
            {[0, 15, 30, 45].map(v => { const y = 2 + 48 - (v / 48) * 48; return <line key={v} x1="0" x2="180" y1={y} y2={y} stroke={C.borderLight} strokeWidth="0.3" />; })}
            {[{ s: 14.2, w: 11.8, h: 4.1 }, { s: 15.1, w: 10.2, h: 4.3 }, { s: 13.8, w: 13.5, h: 4.0 }, { s: 16.2, w: 9.8, h: 4.2 }, { s: 15.9, w: 12.1, h: 3.9 }, { s: 14.5, w: 14.8, h: 4.1 }, { s: 15.8, w: 14.3, h: 4.1 }].map((d, i) => {
              const x = 4 + i * 25; const bw = 18;
              const layers = [{ v: d.h, f: C.sage }, { v: d.w, f: C.forestMid }, { v: d.s, f: C.forest }];
              let cum = 0;
              return <g key={i}>{layers.map((l, j) => { const bh = (l.v / 48) * 48; const y = 2 + 48 - cum - bh; cum += bh; return <rect key={j} x={x} y={y} width={bw} height={bh} fill={l.f} rx={1} />; })}<text x={x + bw / 2} y={60} textAnchor="middle" fontSize="7" fill={C.inkMuted} fontFamily={FS}>{"MTWTFSS"[i]}</text></g>;
            })}
          </svg>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[["Solar", C.forest], ["Wind", C.forestMid], ["Hydro", C.sage]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 6, height: 3, borderRadius: 1, background: c }} /><span style={{ fontSize: 8, color: C.inkMuted }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Wholesale Price</div>
          <svg viewBox="0 0 180 28" style={{ width: "100%", height: 28, marginTop: 4 }}>
            <path d="M0,24 C20,22 40,23 60,18 C80,14 100,8 120,5 C140,2 160,5 180,3" fill="none" stroke={C.forest} strokeWidth="1.5" />
            <path d="M0,24 C20,22 40,23 60,18 C80,14 100,8 120,5 C140,2 160,5 180,3 L180,28 L0,28Z" fill={C.forest} opacity="0.05" />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span style={{ fontSize: 10, color: C.inkMuted, fontVariantNumeric: "tabular-nums" }}>Avg $67</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>Now $138/MWh</span>
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>By State \u2014 $/MWh</div>
          {[{ s: "NSW", v: 82 }, { s: "QLD", v: 71 }, { s: "SA", v: 63 }, { s: "TAS", v: 88 }, { s: "VIC", v: 41 }].map(d => (
            <div key={d.s} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: C.inkMuted, width: 22, fontVariantNumeric: "tabular-nums" }}>{d.s}</span>
              <div style={{ flex: 1, height: 5, background: C.borderLight, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, width: `${d.v}%`, background: d.v > 80 ? C.forest : C.sage }} /></div>
              <span style={{ fontSize: 10, fontWeight: 500, color: C.ink, width: 26, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>${d.v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>ACCU Spot</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontFamily: FD, fontWeight: 300, color: C.ink, fontVariantNumeric: "tabular-nums" }}>$34.50</span>
            <span style={{ fontSize: 11, color: C.forest, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>+$0.80</span>
          </div>
          <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 2 }}>Prev close $33.70</div>
        </div>
        <div style={{ marginTop: 14 }}><WobblyRule color={C.borderLight} /></div>
        <div style={{ fontSize: 8, color: C.inkFaint, marginTop: 8, lineHeight: 1.5 }}>Data delayed 15\u2009min. AEMO, CER.</div>
      </aside>
    </div>
  );
}

// ——— Mobile: Digest with swipeable leads ———

function Mobile() {
  const scrollRef = useRef(null);
  const [activeCard, setActiveCard] = useState(0);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const cardWidth = el.offsetWidth * 0.88;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveCard(Math.min(idx, LEADS.length - 1));
  }, []);

  return (
    <div style={{ width: 375, height: 780, background: C.bg, backgroundImage: GRAIN, borderRadius: 20, overflow: "hidden", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", fontFamily: FS, boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ height: 44, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: C.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 9, fontStyle: "italic" }}>cp</div>
          <span style={{ fontSize: 13, fontFamily: FD }}><span style={{ color: C.forest }}>climate</span><span style={{ color: C.plum }}>pulse</span></span>
        </div>
        <span style={{ fontSize: 10, color: C.inkMuted, fontVariantNumeric: "tabular-nums" }}>14 Apr 2026</span>
      </div>

      {/* Scrollable digest */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

        {/* Daily Number — subtle, not a full banner */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <Micro color={C.plum}>Daily Number</Micro>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                <span style={{ fontFamily: FD, fontSize: 40, fontWeight: 300, color: C.plum, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>34.2</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.plumMid }}>GW</span>
              </div>
              <div style={{ fontSize: 12, color: C.inkSec, marginTop: 3 }}>Renewable generation yesterday</div>
            </div>
            <div style={{ textAlign: "right", paddingBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.forest, fontVariantNumeric: "tabular-nums" }}>+7.5%</span>
              <div style={{ fontSize: 9, color: C.inkMuted, marginTop: 1 }}>vs.\u200930-day avg</div>
              <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 1 }}>April record</div>
            </div>
          </div>
          {/* Plum accent line — the only hint of plum, replaces the full banner */}
          <div style={{ height: 2, background: C.plum, borderRadius: 1, marginTop: 14, opacity: 0.25 }} />
        </div>

        {/* Today's Read */}
        <div style={{ padding: "14px 20px 16px", borderBottom: `1px solid ${C.borderLight}` }}>
          <Micro color={C.forest} mb={6}>Today\u2019s Read</Micro>
          <p style={{ fontFamily: FD, fontSize: 14, fontStyle: "italic", color: C.inkSec, lineHeight: 1.65, margin: 0 }}>
            Curtailment, commodity slides, and carbon methodology doubts \u2014 today\u2019s briefing traces three pressure points converging on Australia\u2019s energy transition investment case.
          </p>
        </div>

        {/* ——— Swipeable Lead Stories ——— */}
        <div style={{ padding: "14px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 20px", marginBottom: 10 }}>
            <Micro>Lead Stories</Micro>
            {/* Typographic progress — not dots */}
            <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: C.inkFaint }}>
              <span style={{ color: C.ink, fontWeight: 600 }}>{activeCard + 1}</span>
              <span style={{ margin: "0 3px", color: C.borderLight }}>/</span>
              {LEADS.length}
            </span>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              display: "flex", gap: 12, overflowX: "auto",
              scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
              padding: "0 20px 16px", scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style>{`.lead-scroll::-webkit-scrollbar { display: none; }`}</style>
            {LEADS.map((story, idx) => {
              const sev = SEVERITY[story.severity] || SEVERITY.watch;
              return (
                <div key={story.id} style={{
                  flex: `0 0 ${idx === 0 ? "90" : "85"}%`,
                  scrollSnapAlign: "start",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `2px solid ${sev.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}>
                  {/* Sector image */}
                  <SectorVisual sector={story.sector} style={{ width: "100%", height: 110, borderRadius: 0 }} />

                  <div style={{ padding: "12px 16px 14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                      <Micro color={sev.color}>{story.sector}</Micro>
                      {story.number && (
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{story.number}</span>
                          <span style={{ fontSize: 9, color: C.inkMuted, marginLeft: 2 }}>{story.unit}</span>
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontFamily: FD, fontSize: 17, fontWeight: 400, color: C.ink, lineHeight: 1.3, margin: "0 0 8px" }}>{story.headline}</h3>

                    <p style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.6, margin: "0 0 10px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{story.summary}</p>

                    {/* Why it matters — compact */}
                    <div style={{ background: C.sageTint, borderLeft: `2px solid ${C.forest}`, padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontFamily: FD, color: C.ink, lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>{story.whyItMatters}</p>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Micro color={C.inkFaint}>Sources</Micro>
                      {story.sources.map((s, i) => <Src key={i} name={s} type={story.sourceTypes?.[i]} />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll hint bar — subtle, not dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 8 }}>
            {LEADS.map((_, i) => (
              <div key={i} style={{
                height: 2, borderRadius: 1,
                width: i === activeCard ? 24 : 12,
                background: i === activeCard ? C.forest : C.borderLight,
                transition: "all 200ms ease",
              }} />
            ))}
          </div>
        </div>

        {/* Also Today */}
        <div style={{ padding: "8px 20px 6px" }}><Micro>Also Today</Micro></div>
        {ALSO.map((story) => {
          const sev = SEVERITY[story.severity] || SEVERITY.watch;
          return (
            <div key={story.id} style={{ display: "flex", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${C.borderLight}`, borderLeft: `2px solid ${sev.border}` }}>
              <SectorVisual sector={story.sector} style={{ width: 56, height: 38, borderRadius: 3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
                  <Micro color={sev.color}>{story.sector}</Micro>
                  {story.number && <span style={{ fontSize: 11, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{story.number}<span style={{ fontSize: 8, color: C.inkMuted, marginLeft: 2 }}>{story.unit}</span></span>}
                </div>
                <h3 style={{ fontFamily: FD, fontSize: 13, fontWeight: 400, color: C.ink, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{story.headline}</h3>
              </div>
            </div>
          );
        })}

        {/* Market Context */}
        <div style={{ padding: "16px 20px 6px" }}><Micro color={C.forest}>Market Context</Micro></div>
        <div style={{ padding: "0 20px 14px" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>NEM Renewable Output \u2014 7\u2009Day</div>
            <svg viewBox="0 0 310 60" style={{ width: "100%", height: "auto" }}>
              {[0, 15, 30, 45].map(v => { const y = 2 + 44 - (v / 48) * 44; return <g key={v}><line x1="16" x2="310" y1={y} y2={y} stroke={C.borderLight} strokeWidth="0.3" /><text x="12" y={y + 3} textAnchor="end" fontSize="6" fill={C.inkFaint}>{v}</text></g>; })}
              {[{ s: 14.2, w: 11.8, h: 4.1 }, { s: 15.1, w: 10.2, h: 4.3 }, { s: 13.8, w: 13.5, h: 4.0 }, { s: 16.2, w: 9.8, h: 4.2 }, { s: 15.9, w: 12.1, h: 3.9 }, { s: 14.5, w: 14.8, h: 4.1 }, { s: 15.8, w: 14.3, h: 4.1 }].map((d, i) => {
                const x = 20 + i * 41; const bw = 30;
                const layers = [{ v: d.h, f: C.sage }, { v: d.w, f: C.forestMid }, { v: d.s, f: C.forest }];
                let cum = 0;
                return <g key={i}>{layers.map((l, j) => { const bh = (l.v / 48) * 44; const y = 2 + 44 - cum - bh; cum += bh; return <rect key={j} x={x} y={y} width={bw} height={bh} fill={l.f} rx={1} />; })}<text x={x + bw / 2} y={56} textAnchor="middle" fontSize="7" fill={C.inkMuted}>{"Mon,Tue,Wed,Thu,Fri,Sat,Sun".split(",")[i]}</text></g>;
              })}
            </svg>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {[["Solar", C.forest], ["Wind", C.forestMid], ["Hydro", C.sage]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 7, height: 3, borderRadius: 1, background: c }} /><span style={{ fontSize: 9, color: C.inkMuted }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>Wholesale</div>
              <span style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>$138</span><span style={{ fontSize: 9, color: C.inkMuted }}>/MWh</span>
            </div>
            <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>ACCU Spot</div>
              <span style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>$34.50</span><span style={{ fontSize: 10, color: C.forest, fontWeight: 500, marginLeft: 3 }}>+$0.80</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {[{ s: "NSW", v: "$82" }, { s: "QLD", v: "$71" }, { s: "SA", v: "$63" }, { s: "TAS", v: "$88" }, { s: "VIC", v: "$41" }].map(d => (
              <div key={d.s} style={{ flex: 1, textAlign: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 0" }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{d.v}</div>
                <div style={{ fontSize: 8, color: C.inkMuted }}>{d.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "4px 20px 20px" }}>
          <WobblyRule color={C.borderLight} />
          <p style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5, margin: "10px 0 0" }}>
            Stories ranked by sector relevance. Data: AEMO, CER. AI analysis \u2014 verify against primary sources. 06:00\u2009AEST
          </p>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ height: 50, borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-around", flexShrink: 0 }}>
        {[{ icon: "\u25C7", label: "Briefing", active: true }, { icon: "\u2197", label: "Explore" }, { icon: "\u25CE", label: "Storylines" }, { icon: "\u25A4", label: "Weekly" }].map((item, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: item.active ? C.forest : C.inkMuted }}>{item.icon}</span>
            <span style={{ fontSize: 8, color: item.active ? C.forest : C.inkMuted, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("mobile");
  return (
    <div style={{ fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", gap: 3, background: C.borderLight, borderRadius: 8, padding: 3, width: "fit-content", marginBottom: 16 }}>
        {["desktop", "mobile"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", background: view === v ? C.surface : "transparent", color: view === v ? C.ink : C.inkMuted, fontWeight: view === v ? 500 : 400, fontSize: 12, fontFamily: FS, boxShadow: view === v ? "0 1px 2px rgba(0,0,0,0.06)" : "none", textTransform: "capitalize" }}>{v}</button>
        ))}
      </div>
      {view === "desktop" ? (
        <div style={{ height: 640, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}><Desktop /></div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center" }}><Mobile /></div>
      )}
    </div>
  );
}
