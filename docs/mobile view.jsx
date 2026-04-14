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

const SECTOR_SVG = {
  "GRID & TRANSMISSION": { bg: "#E2E8DC", el: (
    <>
      <line x1="25" y1="85" x2="50" y2="20" stroke={C.forest} strokeWidth="2.5" />
      <line x1="50" y1="20" x2="75" y2="20" stroke={C.forest} strokeWidth="2.5" />
      <line x1="75" y1="20" x2="100" y2="85" stroke={C.forest} strokeWidth="2.5" />
      <line x1="37" y1="52" x2="88" y2="52" stroke={C.forest} strokeWidth="1.5" />
      <line x1="32" y1="68" x2="93" y2="68" stroke={C.forestMid} strokeWidth="1" />
      <circle cx="50" cy="20" r="3.5" fill={C.forest} /><circle cx="75" cy="20" r="3.5" fill={C.forest} />
      <circle cx="115" cy="22" r="12" fill={C.sage} opacity="0.35" />
    </>
  )},
  "CRITICAL MINERALS": { bg: "#E5E2DD", el: (
    <>
      <polygon points="50,12 70,8 82,28 76,52 58,56 44,40" fill="none" stroke={C.plumMid} strokeWidth="1.8" />
      <polygon points="60,18 72,16 76,34 64,42" fill={C.plumLight} opacity="0.6" />
      <polygon points="85,42 105,36 112,62 92,68" fill="none" stroke={C.inkMuted} strokeWidth="1.2" />
      <polygon points="22,55 35,48 42,68 30,74" fill="none" stroke={C.sage} strokeWidth="1.2" />
    </>
  )},
  "CARBON & OFFSETS": { bg: "#E5E8E0", el: (
    <>
      <circle cx="55" cy="45" r="18" fill="none" stroke={C.inkMuted} strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx="88" cy="32" r="12" fill="none" stroke={C.sage} strokeWidth="1.5" />
      <circle cx="88" cy="62" r="12" fill="none" stroke={C.sage} strokeWidth="1.5" />
      <path d="M12 85 L22 52 L32 85Z" fill={C.forest} opacity="0.2" />
      <path d="M36 85 L50 42 L64 85Z" fill={C.forest} opacity="0.3" />
    </>
  )},
  "BUILT ENVIRONMENT": { bg: "#E2E6DF", el: (
    <>
      <rect x="18" y="28" width="28" height="58" fill="none" stroke={C.forest} strokeWidth="1.8" rx="1" />
      <rect x="54" y="14" width="22" height="72" fill="none" stroke={C.forestMid} strokeWidth="1.8" rx="1" />
      <rect x="84" y="34" width="30" height="52" fill="none" stroke={C.sage} strokeWidth="1.8" rx="1" />
    </>
  )},
  "HYDROGEN": { bg: "#DDE8E1", el: (
    <>
      <circle cx="48" cy="46" r="16" fill="none" stroke={C.forest} strokeWidth="1.8" />
      <text x="41" y="51" fontSize="14" fill={C.forest} fontWeight="600" fontFamily={FS}>H</text>
      <circle cx="92" cy="46" r="16" fill="none" stroke={C.forest} strokeWidth="1.8" />
      <text x="85" y="51" fontSize="14" fill={C.forest} fontWeight="600" fontFamily={FS}>H</text>
      <line x1="64" y1="46" x2="76" y2="46" stroke={C.forest} strokeWidth="2.5" />
    </>
  )},
};

function SectorArt({ sector, height = 100 }) {
  const data = SECTOR_SVG[sector] || { bg: C.borderLight, el: null };
  return (
    <div style={{ width: "100%", height, background: data.bg, overflow: "hidden" }}>
      <svg viewBox="0 0 140 90" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>{data.el}</svg>
    </div>
  );
}

const BRIEFING = [
  {
    id: 1, sector: "GRID & TRANSMISSION",
    headline: "Victoria\u2019s west region curtailment hits 18%",
    number: "18.3", unit: "%",
    body: "Solar curtailment in western Victoria reached 18.3% yesterday, marking the fourth consecutive day above the 15% threshold that project developers consider economically significant.\n\nThe Western Renewables Link \u2014 the transmission upgrade expected to relieve this bottleneck \u2014 now faces a revised completion date of late 2028, pushed back from 2027 after contractor disputes disclosed in AusNet\u2019s quarterly update.\n\nFor the dozen utility-scale solar projects committed to the region, each percentage point of curtailment directly erodes revenue. At current levels, some developers are reportedly revisiting their financial models entirely.",
    whyItMatters: "This is no longer a grid operations issue. It\u2019s becoming a capital allocation story that could slow new renewable commitments in Victoria\u2019s west.",
    sources: ["AEMO Dashboard", "AusNet Q3 Update"],
  },
  {
    id: 2, sector: "CRITICAL MINERALS",
    headline: "Lithium spot price falls below A$900/t",
    number: "880", unit: "A$/t",
    body: "Spodumene concentrate traded at A$880 per tonne on the Pilbara spot market yesterday \u2014 its lowest level since October 2022 and well below the A$1,200/t most Australian producers need to break even on processing.\n\nAlbemarle has flagged potential production deferrals at its Kemerton hydroxide facility in WA. IGO confirmed a review of its downstream processing timelines.\n\nThe decline reflects oversupply from new African mines and softening demand from Chinese battery manufacturers who have shifted toward LFP chemistry for standard-range EVs.",
    whyItMatters: "Sub-$900 spodumene threatens the viability of Australia\u2019s lithium processing ambitions and the critical minerals supply chain for domestic battery manufacturing.",
    sources: ["Fastmarkets", "ASX Filings"],
  },
  {
    id: 3, sector: "CARBON & OFFSETS",
    headline: "CER flags methodology review for landfill gas credits",
    body: "The Clean Energy Regulator has initiated a formal review of the ACCU methodology for landfill gas capture projects after identifying discrepancies between reported methane destruction rates and satellite-derived emissions estimates.\n\nThe review was triggered by data from the Global Methane Pledge monitoring network, which suggested several accredited projects may be overstating capture rates by 20\u201340%.\n\nThe landfill gas category represents approximately 15% of total ACCU issuances. If the methodology is tightened, a material portion of the current supply pipeline could be invalidated or repriced.",
    whyItMatters: "Carbon credit integrity underpins the Safeguard Mechanism. A methodology correction here ripples through every portfolio holding landfill gas ACCUs.",
    sources: ["CER Media Release"],
  },
  {
    id: 4, sector: "BUILT ENVIRONMENT",
    headline: "NABERS 6-star threshold proposed for 2028",
    body: "The Climate Change Authority\u2019s draft recommendation would mandate 6-star NABERS energy ratings for all new commercial buildings over 2,000 square metres, up from the current 5.5-star requirement.\n\nThe proposal includes a transition pathway: 5.75 stars from July 2026, rising to the full 6-star requirement by January 2028. Existing buildings would be exempt but face disclosure requirements.\n\nThe Property Council has signalled cautious support, noting most new premium-grade developments already target 6 stars. The real impact falls on mid-tier commercial construction.",
    whyItMatters: "This sets the trajectory for building energy performance through 2030 and creates a clear signal for building services and retrofit providers.",
    sources: ["CCA Draft Report"],
  },
  {
    id: 5, sector: "HYDROGEN",
    headline: "Fortescue scales back Gibson Island to 50 MW",
    number: "50", unit: "MW",
    body: "Fortescue Future Industries confirmed the Gibson Island green hydrogen project in Brisbane will proceed as a 50 MW pilot rather than the previously announced 250 MW commercial facility.\n\nCEO Mark Hutchinson cited \u201Cmarket readiness\u201D concerns, noting that offtake agreements for green hydrogen remain difficult to secure at prices that justify large-scale electrolyser investment.\n\nOf the 1,000+ green hydrogen projects announced globally since 2020, fewer than 10% have reached final investment decision. The gap between announcement and execution continues to widen.",
    whyItMatters: "If FFI \u2014 with its balance sheet \u2014 can\u2019t make the economics work at scale, smaller developers face an even steeper path.",
    sources: ["Fortescue ASX Announcement"],
  },
];

const SEVERITY_MAP = { "GRID & TRANSMISSION": "alert", "CRITICAL MINERALS": "alert", "CARBON & OFFSETS": "watch", "BUILT ENVIRONMENT": "ready", "HYDROGEN": "watch" };
const SEV = { alert: { border: C.ink, color: C.ink }, watch: { border: C.inkMuted, color: C.inkSec }, ready: { border: C.forest, color: C.forest } };

const Micro = ({ children, color = C.inkMuted, mb = 0 }) => (
  <span style={{ fontSize: 10, fontFamily: FS, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color, marginBottom: mb, display: mb ? "block" : "inline" }}>{children}</span>
);
const Src = ({ name }) => (
  <span style={{ fontSize: 10, fontFamily: FS, color: C.inkMuted, borderBottom: "1px dotted #D0CCC6", paddingBottom: 1 }}>{name}</span>
);
const WobblyRule = ({ color = C.border }) => (
  <svg width="100%" height="4" viewBox="0 0 600 4" preserveAspectRatio="none" style={{ display: "block" }}>
    <path d="M0,2 C40,1.2 80,2.8 120,1.8 C160,0.8 200,2.6 240,2.2 C280,1.8 320,2.4 360,1.6 C400,2.8 440,1.4 480,2.2 C520,2.6 560,1.8 600,2" fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

// ——— Stories Overlay with transitions ———

function StoriesOverlay({ stories, startIndex, onClose, phase }) {
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [slideDir, setSlideDir] = useState(null); // "left" | "right" | null
  const [contentKey, setContentKey] = useState(0);
  const timerRef = useRef(null);
  const DURATION = 15000;

  const story = stories[current];

  const startTimer = useCallback(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / DURATION, 1);
      setProgress(pct);
      if (pct < 1) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        if (current < stories.length - 1) navigate(1);
        else onClose();
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [current, stories.length, onClose]);

  useEffect(() => {
    setProgress(0);
    startTimer();
    return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current); };
  }, [current, startTimer]);

  const navigate = (dir) => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    const next = current + dir;
    if (next < 0) return;
    if (next >= stories.length) { onClose(); return; }

    setSlideDir(dir > 0 ? "left" : "right");
    // Brief pause for exit animation
    setTimeout(() => {
      setCurrent(next);
      setContentKey(k => k + 1);
      setSlideDir(null);
    }, 150);
  };

  const sev = SEV[SEVERITY_MAP[story.sector]] || SEV.watch;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: C.ink,
      animation: phase === "entering" ? "expandIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" : undefined,
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @keyframes expandIn {
          0% { clip-path: inset(28% 5% 45% 5% round 12px); opacity: 0.6; }
          100% { clip-path: inset(0 0 0 0 round 0px); opacity: 1; }
        }
        @keyframes contentEnter {
          0% { opacity: 0; transform: translateX(30px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes contentEnterReverse {
          0% { opacity: 0; transform: translateX(-30px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes contentExit {
          0% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-20px); }
        }
        @keyframes contentExitReverse {
          0% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(20px); }
        }
      `}</style>

      {/* Progress bars */}
      <div style={{ display: "flex", gap: 3, padding: "10px 14px 0", flexShrink: 0, zIndex: 20 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2.5, background: "rgba(255,255,255,0.12)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 1,
              background: i < current ? "rgba(255,255,255,0.6)" : i === current ? C.surface : "transparent",
              width: i < current ? "100%" : i === current ? `${progress * 100}%` : "0%",
              transition: i === current ? "none" : "width 0.3s ease",
            }} />
          </div>
        ))}
      </div>

      {/* Sector + close */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px 4px", flexShrink: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: FS, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            {story.sector}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontVariantNumeric: "tabular-nums" }}>
            {current + 1}/{stories.length}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.5)",
          fontSize: 16, cursor: "pointer", padding: "4px 10px", borderRadius: 6, lineHeight: 1,
        }}>{"\u00D7"}</button>
      </div>

      {/* Story content — animated between stories */}
      <div
        key={contentKey}
        style={{
          flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
          animation: slideDir === null
            ? `contentEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards`
            : slideDir === "left"
              ? `contentExit 0.15s ease forwards`
              : `contentExitReverse 0.15s ease forwards`,
        }}
      >
        {/* Sector art */}
        <SectorArt sector={story.sector} height={130} />

        {/* Content card */}
        <div style={{
          flex: 1, background: C.surface, backgroundImage: GRAIN,
          borderRadius: "14px 14px 0 0", marginTop: -12,
          padding: "22px 22px 32px", position: "relative",
        }}>
          {/* Floating number badge */}
          {story.number && (
            <div style={{
              position: "absolute", top: -20, right: 22,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "7px 16px",
              display: "flex", alignItems: "baseline", gap: 4,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}>
              <span style={{ fontSize: 24, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums", fontFamily: FS }}>{story.number}</span>
              <span style={{ fontSize: 11, color: C.inkMuted }}>{story.unit}</span>
            </div>
          )}

          <h2 style={{
            fontFamily: FD, fontSize: 23, fontWeight: 400,
            color: C.ink, lineHeight: 1.25, margin: "0 0 18px",
            paddingRight: story.number ? 90 : 0,
          }}>{story.headline}</h2>

          {story.body.split("\n\n").map((para, i) => (
            <p key={i} style={{
              fontSize: 14, fontFamily: FD, color: C.inkSec,
              lineHeight: 1.7, margin: "0 0 12px",
            }}>{para}</p>
          ))}

          {/* Why it matters */}
          <div style={{
            background: C.sageTint, borderLeft: `2px solid ${C.forest}`,
            padding: "10px 14px", borderRadius: "0 8px 8px 0",
            marginTop: 6, marginBottom: 14,
          }}>
            <Micro color={C.forest} mb={4}>Why it matters</Micro>
            <p style={{ fontSize: 13, fontFamily: FD, color: C.ink, lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>
              {story.whyItMatters}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Micro color={C.inkFaint}>Sources</Micro>
            {story.sources.map((s, i) => <Src key={i} name={s} />)}
          </div>
        </div>
      </div>

      {/* Tap zones */}
      <div onClick={() => navigate(-1)} style={{ position: "absolute", top: 50, left: 0, bottom: 0, width: "28%", cursor: "pointer", zIndex: 10 }} />
      <div onClick={() => navigate(1)} style={{ position: "absolute", top: 50, right: 0, bottom: 0, width: "72%", cursor: "pointer", zIndex: 10 }} />
    </div>
  );
}

// ——— Main ———

export default function App() {
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesStart, setStoriesStart] = useState(0);
  const [storiesPhase, setStoriesPhase] = useState("entering");

  const openBriefing = (idx = 0) => {
    setStoriesStart(idx);
    setStoriesPhase("entering");
    setStoriesOpen(true);
    // Reset phase after animation
    setTimeout(() => setStoriesPhase("active"), 450);
  };

  return (
    <div style={{ fontFamily: FS, display: "flex", justifyContent: "center", padding: "1rem 0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        width: 375, height: 780, background: C.bg, backgroundImage: GRAIN,
        borderRadius: 20, overflow: "hidden", border: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", position: "relative",
        boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
      }}>

        {/* Header */}
        <div style={{ height: 44, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: C.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 9, fontStyle: "italic" }}>cp</div>
            <span style={{ fontSize: 13, fontFamily: FD }}>
              <span style={{ color: C.forest }}>climate</span><span style={{ color: C.plum }}>pulse</span>
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.inkMuted, fontVariantNumeric: "tabular-nums" }}>14 Apr 2026</span>
        </div>

        {/* Digest */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

          {/* Daily Number */}
          <div style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <Micro color={C.plum}>Daily Number</Micro>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
                  <span style={{ fontFamily: FD, fontSize: 42, fontWeight: 300, color: C.plum, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>34.2</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.plumMid }}>GW</span>
                </div>
                <div style={{ fontSize: 12, color: C.inkSec, marginTop: 4 }}>Renewable generation yesterday</div>
              </div>
              <div style={{ textAlign: "right", paddingBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.forest, fontVariantNumeric: "tabular-nums" }}>+7.5%</span>
                <div style={{ fontSize: 9, color: C.inkMuted, marginTop: 1 }}>vs. 30-day avg</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 20px" }}><WobblyRule /></div>

          {/* ——— Glowing briefing card ——— */}
          <div style={{ padding: "14px 16px 18px" }}>
            <div
              onClick={() => openBriefing(0)}
              style={{
                position: "relative",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "18px 20px",
                cursor: "pointer",
                // The glow — warm, subtle, pulsing via CSS
                boxShadow: `
                  0 0 0 1px ${C.border},
                  0 0 20px rgba(30, 77, 43, 0.06),
                  0 0 40px rgba(30, 77, 43, 0.04),
                  0 0 60px rgba(30, 77, 43, 0.02)
                `,
                transition: "box-shadow 150ms ease",
                overflow: "hidden",
              }}
            >
              {/* Animated glow pulse */}
              <style>{`
                @keyframes glowPulse {
                  0%, 100% { opacity: 0.4; }
                  50% { opacity: 0.7; }
                }
              `}</style>
              <div style={{
                position: "absolute", inset: -1, borderRadius: 12,
                border: `1.5px solid ${C.forest}`,
                opacity: 0.15,
                animation: "glowPulse 3s ease-in-out infinite",
                pointerEvents: "none",
              }} />

              {/* Top accent line */}
              <div style={{
                position: "absolute", top: 0, left: 20, right: 20, height: 2,
                background: `linear-gradient(90deg, ${C.forest}, ${C.sage}, transparent)`,
                borderRadius: "0 0 2px 2px", opacity: 0.4,
              }} />

              <Micro color={C.forest} mb={8}>Today{"\u2019"}s Read</Micro>
              <p style={{ fontFamily: FD, fontSize: 15, fontStyle: "italic", color: C.inkSec, lineHeight: 1.6, margin: "0 0 18px" }}>
                Curtailment, commodity slides, and carbon methodology doubts {"\u2014"} today{"\u2019"}s briefing traces three pressure points converging on Australia{"\u2019"}s energy transition.
              </p>

              {/* Start briefing bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: C.ink, color: C.surface,
                padding: "13px 18px", borderRadius: 8,
                position: "relative",
              }}>
                {/* Play icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  border: `1.5px solid rgba(255,255,255,0.2)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="12" height="14" viewBox="0 0 12 14">
                    <polygon points="1,0.5 11,7 1,13.5" fill={C.surface} />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>Start my briefing</div>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{BRIEFING.length} stories {"\u00B7"} ~3 min read</div>
                </div>
                {/* Mini progress pips */}
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  {BRIEFING.map((_, i) => (
                    <div key={i} style={{ width: 3, height: 12, borderRadius: 1.5, background: C.surface, opacity: 0.15 + (i === 0 ? 0.15 : 0) }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 20px" }}><WobblyRule color={C.borderLight} /></div>

          {/* Story list */}
          <div style={{ padding: "12px 20px 6px" }}>
            <Micro>Today{"\u2019"}s Stories</Micro>
          </div>

          {BRIEFING.map((story, idx) => {
            const sev = SEV[SEVERITY_MAP[story.sector]] || SEV.watch;
            return (
              <div
                key={story.id}
                onClick={() => openBriefing(idx)}
                style={{
                  padding: "12px 20px",
                  borderBottom: `1px solid ${C.borderLight}`,
                  borderLeft: `2px solid ${sev.border}`,
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
                  <Micro color={sev.color}>{story.sector}</Micro>
                  {story.number && (
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{story.number}</span>
                      <span style={{ fontSize: 9, color: C.inkMuted, marginLeft: 2 }}>{story.unit}</span>
                    </span>
                  )}
                </div>
                <h3 style={{ fontFamily: FD, fontSize: 15, fontWeight: 400, color: C.ink, lineHeight: 1.3, margin: 0 }}>{story.headline}</h3>
                <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 4 }}>
                  {story.sources[0]}{story.sources.length > 1 && ` +${story.sources.length - 1}`}
                </div>
              </div>
            );
          })}

          {/* Market Context */}
          <div style={{ padding: "16px 20px 6px" }}><Micro color={C.forest}>Market Context</Micro></div>
          <div style={{ padding: "0 20px 14px" }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>NEM Renewable Output {"\u2014"} 7 Day</div>
              <svg viewBox="0 0 310 55" style={{ width: "100%", height: "auto" }}>
                {[0, 15, 30, 45].map(v => { const y = 2 + 40 - (v / 48) * 40; return <g key={v}><line x1="16" x2="310" y1={y} y2={y} stroke={C.borderLight} strokeWidth="0.3" /><text x="12" y={y + 3} textAnchor="end" fontSize="6" fill={C.inkFaint}>{v}</text></g>; })}
                {[{ s: 14.2, w: 11.8, h: 4.1 }, { s: 15.1, w: 10.2, h: 4.3 }, { s: 13.8, w: 13.5, h: 4.0 }, { s: 16.2, w: 9.8, h: 4.2 }, { s: 15.9, w: 12.1, h: 3.9 }, { s: 14.5, w: 14.8, h: 4.1 }, { s: 15.8, w: 14.3, h: 4.1 }].map((d, i) => {
                  const x = 20 + i * 41; const bw = 30;
                  const layers = [{ v: d.h, f: C.sage }, { v: d.w, f: C.forestMid }, { v: d.s, f: C.forest }];
                  let cum = 0;
                  return <g key={i}>{layers.map((l, j) => { const bh = (l.v / 48) * 40; const y = 2 + 40 - cum - bh; cum += bh; return <rect key={j} x={x} y={y} width={bw} height={bh} fill={l.f} rx={1} />; })}<text x={x + bw / 2} y={52} textAnchor="middle" fontSize="7" fill={C.inkMuted}>{"Mon,Tue,Wed,Thu,Fri,Sat,Sun".split(",")[i]}</text></g>;
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
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 8, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>Wholesale</div>
                <span style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>$138</span><span style={{ fontSize: 9, color: C.inkMuted }}>/MWh</span>
              </div>
              <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 8, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 3 }}>ACCU Spot</div>
                <span style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>$34.50</span><span style={{ fontSize: 10, color: C.forest, fontWeight: 500, marginLeft: 3 }}>+$0.80</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "4px 20px 24px" }}>
            <WobblyRule color={C.borderLight} />
            <p style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5, margin: "10px 0 0" }}>
              Stories ranked by sector relevance. Data: AEMO, CER. AI analysis {"\u2014"} verify against primary sources. 06:00 AEST
            </p>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ height: 50, borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-around", flexShrink: 0 }}>
          {[
            { icon: "\u25C7", label: "Briefing", active: true },
            { icon: "\u2197", label: "Explore" },
            { icon: "\u25CE", label: "Storylines" },
            { icon: "\u25A4", label: "Weekly" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, cursor: "pointer" }}>
              <span style={{ fontSize: 15, color: item.active ? C.forest : C.inkMuted }}>{item.icon}</span>
              <span style={{ fontSize: 8, color: item.active ? C.forest : C.inkMuted, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stories overlay */}
        {storiesOpen && (
          <StoriesOverlay
            stories={BRIEFING}
            startIndex={storiesStart}
            onClose={() => setStoriesOpen(false)}
            phase={storiesPhase}
          />
        )}
      </div>
    </div>
  );
}
