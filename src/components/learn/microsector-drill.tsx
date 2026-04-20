"use client";

import { useEffect, useState } from "react";
import { MICROSECTOR_SAMPLE_PODS, PATHS } from "./mock-data";
import { PauseIcon, PlayIcon, Waveform } from "./waveform";
import { TrustMarker } from "./trust-marker";
import type { Microsector } from "./types";

const BRIEFS = [
  { date: "19 APR", title: "FERC tees up June decision on data center interconnection reform", src: "Utility Dive", tag: "REGULATION", reviewed: false },
  { date: "18 APR", title: "AEMO publishes FY26 MLF update — 38 generators shift >5 points", src: "AEMO", tag: "DATA", reviewed: true },
  { date: "17 APR", title: "Transgrid awards HumeLink construction package to UGL–CPB joint venture", src: "RenewEconomy", tag: "PROJECT", reviewed: false },
  { date: "16 APR", title: "NSW approves four REZ access authorisations ahead of schedule", src: "NSW DPE", tag: "POLICY", reviewed: true },
  { date: "15 APR", title: "Battery storage bids dominate latest AEMO connection queue — 42 GW pending", src: "Clean Energy Council", tag: "ANALYSIS", reviewed: false },
  { date: "12 APR", title: "Marinus Link cost estimate revised upward; commissioning slips to 2030", src: "Utility Magazine", tag: "PROJECT", reviewed: false },
];

const CONCEPTS = [
  "Marginal Loss Factor",
  "Regional Reference Node",
  "System strength remediation",
  "Renewable Energy Zone (REZ)",
  "Connection queue",
  "Firming capacity",
  "Dispatch interval",
  "Constraint equation",
];

export function MicrosectorDrill({
  sector,
  onClose,
  onOpenConcept,
}: {
  sector: Microsector;
  onClose: () => void;
  onOpenConcept: () => void;
}) {
  return (
    <div className="main-inner" style={{ paddingTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span
          className="micro"
          style={{ color: "var(--ink-3)", cursor: "pointer" }}
          onClick={onClose}
          role="button"
          tabIndex={0}
        >
          ← LEARN
        </span>
        <span style={{ color: "var(--ink-5)" }}>/</span>
        <span className="micro" style={{ color: "var(--ink-3)" }}>MICROSECTOR</span>
        <span style={{ color: "var(--ink-5)" }}>/</span>
        <span className="micro-ink">{sector.num}</span>
      </div>

      <div className="drill-head-row">
        <div>
          <h1 className="drill-title">{sector.name}</h1>
          <div className="drill-lede">
            Transmission, distribution, connection queues, congestion economics and the market mechanics that
            govern how electricity gets from where it's made to where it's used.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
          <span className="meta tabular" style={{ fontSize: 11 }}>THIS WEEK</span>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 350,
              fontSize: 40,
              letterSpacing: "-0.6px",
            }}
          >
            {sector.briefs}
          </span>
          <span className="meta tabular">briefs · {sector.reviewed} editor-reviewed</span>
        </div>
      </div>

      <div className="drill-body">
        <div>
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div className="section-title">Latest briefs</div>
            <span className="section-link">All {sector.briefs} →</span>
          </div>
          <div style={{ borderTop: "1px solid var(--ink)" }}>
            {BRIEFS.map((b, i) => (
              <div key={i} className="brief-row">
                <span className="micro tabular" style={{ color: "var(--ink-3)" }}>{b.date}</span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      lineHeight: 1.35,
                      color: "var(--ink)",
                      fontWeight: 420,
                    }}
                  >
                    {b.title}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                    <span className="meta">{b.src}</span>
                    <span style={{ width: 3, height: 3, background: "var(--ink-4)", borderRadius: "50%" }} />
                    <span className="micro" style={{ color: "var(--ink-4)", fontSize: 10 }}>{b.tag}</span>
                    {b.reviewed && <TrustMarker label="REVIEWED" />}
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-4)" }}>→</span>
              </div>
            ))}
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div
              className="micro-ink"
              style={{ paddingBottom: 8, borderBottom: "1px solid var(--ink)", marginBottom: 12 }}
            >
              KEY CONCEPTS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CONCEPTS.map((c) => (
                <a
                  key={c}
                  role="button"
                  tabIndex={0}
                  onClick={() => c.startsWith("Marginal") && onOpenConcept()}
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    color: "var(--ink-2)",
                    padding: "2px 0",
                  }}
                >
                  {c}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div
              className="micro-ink"
              style={{ paddingBottom: 8, borderBottom: "1px solid var(--ink)", marginBottom: 12 }}
            >
              ACTIVE PATHS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {PATHS.slice(0, 3).map((p) => (
                <div key={p.id} style={{ cursor: "pointer" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.3, color: "var(--ink)" }}>
                    {p.title}
                  </div>
                  <div className="meta tabular" style={{ marginTop: 2 }}>
                    {p.duration} · {p.chapters} ch.
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SectorPodList />

          <div>
            <div
              className="micro-ink"
              style={{ paddingBottom: 8, borderBottom: "1px solid var(--ink)", marginBottom: 12 }}
            >
              WEEKLY ACTIVITY
            </div>
            <svg viewBox="0 0 220 60" style={{ width: "100%", height: 60 }}>
              {[9, 12, 7, 14, 11, 18, 13].map((v, i) => (
                <g key={i}>
                  <rect x={i * 30 + 4} y={60 - v * 3} width="22" height={v * 3} fill="var(--forest-mid)" opacity="0.85" />
                  <text
                    x={i * 30 + 15}
                    y="58"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="7"
                    fill="var(--ink-4)"
                  >
                    {["M","T","W","T","F","S","S"][i]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </aside>
      </div>

      <div className="provenance">
        <span>
          Micro-sector briefs are AI-summarised from primary sources; reviewed content is signed off by a
          domain editor.
        </span>
        <span className="tabular">LAST UPDATE · 04:30 AEST · 19·APR·26</span>
      </div>
    </div>
  );
}

function SectorPodList() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div>
      <div
        className="micro-ink"
        style={{ paddingBottom: 8, borderBottom: "1px solid var(--ink)", marginBottom: 12 }}
      >
        LATEST PODCASTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MICROSECTOR_SAMPLE_PODS.map((pod, i) => (
          <SectorPodRow
            key={i}
            pod={pod}
            id={`sp-${i}`}
            isPlaying={playing === `sp-${i}`}
            onToggle={(id) => setPlaying(playing === id ? null : id)}
          />
        ))}
      </div>
    </div>
  );
}

function SectorPodRow({
  pod,
  id,
  isPlaying,
  onToggle,
}: {
  pod: { title: string; dur: string; date: string; kind: string };
  id: string;
  isPlaying: boolean;
  onToggle: (id: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const t = window.setInterval(() => setProgress((p) => Math.min(1, p + 0.004)), 100);
    return () => window.clearInterval(t);
  }, [isPlaying]);

  const color = pod.kind === "WEEKLY" ? "sky" : "forest";
  const bars = [6,9,14,11,17,22,19,14,21,26,22,17,13,19,24,20,16,12,18,23,27,23,18,14,10,16];

  return (
    <div className={`pod-sector-row pod-${color}`} onClick={() => onToggle(id)} role="button" tabIndex={0}>
      <button
        type="button"
        className="pod-play"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id);
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon size={9} /> : <PlayIcon size={9} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: 0.6,
              color: pod.kind === "WEEKLY" ? "var(--sky)" : "var(--forest-deep)",
            }}
          >
            {pod.kind}
          </span>
          <span
            className="tabular"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-4)" }}
          >
            {pod.date} · {pod.dur}
          </span>
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.3, color: "var(--ink)", marginTop: 2 }}>
          {pod.title}
        </div>
        <div style={{ height: 16, marginTop: 4 }}>
          <Waveform bars={bars} progress={progress} color={color} playing={isPlaying} />
        </div>
      </div>
    </div>
  );
}
