"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path
      d="M1 1l10 10M11 1L1 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export function SampleBriefingModal({ open, onClose }: Props) {
  // Lock page scroll while the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal-backdrop ${open ? "visible" : ""}`}
      onClick={onClose}
      role="dialog"
      aria-hidden={!open}
      aria-label="Sample briefing preview"
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <button className="mail-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <div className="mail-meta">
          <span>Sun 19 Apr · 05:47 AEST</span>
          <span>5 min read</span>
        </div>
        <h2 className="mail-subject">
          FERC&rsquo;s June timeline, rare-earth supply risk, and the solar rollback.
        </h2>
        <div className="mail-from">FROM NICK · CLIMATEPULSE DAILY · FOR YOUR SECTORS</div>

        {/* ─── Live data strip ─────────────────────────────────────────── */}
        <div className="mail-dashboard">
          <div className="mail-dashboard-title">
            <span>
              <span className="dot" aria-hidden /> Energy snapshot · live
            </span>
            <span>Updated 05:45 AEST</span>
          </div>
          <div className="mail-dashboard-grid">
            <div className="md-tile">
              <div className="md-label">NEM spot avg</div>
              <div className="md-value">
                $84<span className="md-unit">/MWh</span>
              </div>
              <div className="md-delta down">−$5 vs. 24h avg</div>
            </div>
            <div className="md-tile">
              <div className="md-label">Renewables share</div>
              <div className="md-value">
                44.7<span className="md-unit">%</span>
              </div>
              <div className="md-delta up">↑ 7-day high</div>
            </div>
            <div className="md-tile">
              <div className="md-label">Gen mix, 24h</div>
              <div className="md-value md-mix">
                <span style={{ color: "var(--ink-3)" }}>Coal 51</span>
                <span style={{ color: "var(--forest)" }}>· Solar 22</span>
                <span style={{ color: "var(--forest-2)" }}>· Wind 18</span>
              </div>
              <div className="md-delta">Hydro 5 · Gas 2 · Battery 2</div>
            </div>
          </div>

          <div className="md-tickers">
            <div className="md-tickers-title">
              <span>ASX energy · last close</span>
              <span>$A</span>
            </div>
            <div className="md-ticker-row">
              <span className="md-ticker-code">ORG</span>
              <span className="md-ticker-name">Origin Energy</span>
              <span className="md-ticker-px">11.42</span>
              <span className="md-ticker-chg down">−0.8%</span>
            </div>
            <div className="md-ticker-row">
              <span className="md-ticker-code">STO</span>
              <span className="md-ticker-name">Santos</span>
              <span className="md-ticker-px">7.18</span>
              <span className="md-ticker-chg up">+1.2%</span>
            </div>
            <div className="md-ticker-row">
              <span className="md-ticker-code">PLS</span>
              <span className="md-ticker-name">Pilbara Minerals</span>
              <span className="md-ticker-px">2.06</span>
              <span className="md-ticker-chg down">−2.4%</span>
            </div>
            <div className="md-ticker-row">
              <span className="md-ticker-code">LYC</span>
              <span className="md-ticker-name">Lynas Rare Earths</span>
              <span className="md-ticker-px">8.41</span>
              <span className="md-ticker-chg up">+0.6%</span>
            </div>
          </div>
        </div>

        {/* ─── Top of brief ────────────────────────────────────────────── */}
        <div className="mail-section-title">
          <span>Top of brief</span>
          <span>4 of 9</span>
        </div>

        {/* Hero item */}
        <article className="mail-item mail-hero">
          <div className="mail-item-head">
            <span className="mail-sector">Grid &amp; Transmission · Regulation</span>
            <span className="mail-score">
              Significance <span className="mail-score-num">86</span>
            </span>
          </div>
          <h3 className="mail-item-title">
            FERC tees up June decision on data-centre interconnection reform.
          </h3>
          <p className="mail-item-body">
            FERC&rsquo;s accelerated timeline signals that current interconnection queues
            can&rsquo;t handle data-centre load growth. The June decision will likely set
            new standards that fast-track large-load connections while imposing
            cost-sharing — moving from first-come-first-served toward economic-efficiency
            models.
          </p>
          <div className="mail-whymatters">
            <div className="mail-whymatters-label">Why it matters</div>
            <p>
              Transmission infrastructure funds face accelerated deployment timelines as
              grid-connection processes for large loads get expedited. Same dynamic
              building in the NEM: watch AEMO&rsquo;s large-load protocol consultation.
            </p>
          </div>
          <div className="mail-sources">Utility Dive · FERC filing</div>
        </article>

        {/* Compact items */}
        <article className="mail-item mail-compact">
          <div className="mail-compact-head">
            <span className="mail-sector">Critical Minerals</span>
            <span className="mail-score-tight">77</span>
          </div>
          <h3 className="mail-item-title">
            Rare-earth supply-chain risk draws new projects, partnerships, and policy.
          </h3>
          <div className="mail-sources">CleanTechnica · US DOE</div>
        </article>

        <article className="mail-item mail-compact">
          <div className="mail-compact-head">
            <span className="mail-sector">Energy Generation · Policy</span>
            <span className="mail-score-tight">72</span>
          </div>
          <h3 className="mail-item-title">
            American farmers bet on solar. Then Trump changed the rules.
          </h3>
          <div className="mail-compact-stat">
            <span className="md-value" style={{ fontSize: 22 }}>
              20<span className="md-unit">GW</span>
            </span>
            <span className="mail-compact-stat-label">agrivoltaics pipeline at risk</span>
          </div>
          <div className="mail-sources">Grist · USDA REAP</div>
        </article>

        <article className="mail-item mail-compact">
          <div className="mail-compact-head">
            <span className="mail-sector">Battery Recycling</span>
            <span className="mail-score-tight">64</span>
          </div>
          <h3 className="mail-item-title">
            Battery recycling still isn&rsquo;t easy. Just ask Ascend Elements.
          </h3>
          <div className="mail-sources">Canary Media</div>
        </article>

        <div
          style={{
            padding: "20px 0 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-3)",
            textAlign: "center",
            letterSpacing: "0.08em",
          }}
        >
          + 5 MORE ITEMS · ENERGY DASHBOARD · WEEKLY PULSE
        </div>
      </div>
    </div>
  );
}
