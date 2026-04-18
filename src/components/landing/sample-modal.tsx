"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ArrowIcon = () => (
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
          <ArrowIcon />
        </button>

        <div className="mail-meta">
          <span>Tue 22 Apr · 05:47 AEST</span>
          <span>5 min read</span>
        </div>
        <h2 className="mail-subject">
          The CIS auction results, and a quiet signal from the AER.
        </h2>
        <div className="mail-from">FROM NICK · CLIMATEPULSE DAILY · FOR YOUR SECTORS</div>

        <div className="mail-section-title">
          <span>Top of brief</span>
          <span>2 of 6</span>
        </div>

        <article className="mail-item">
          <div className="mail-item-head">
            <span className="mail-sector">Large-scale generation · Tender</span>
            <span className="mail-score">
              Significance <span className="mail-score-num">94</span>
            </span>
          </div>
          <h3 className="mail-item-title">Round 3 CIS closes: 19 GW bid into 6 GW band.</h3>
          <p className="mail-item-body">
            Bids well above cap means DCCEEW gets to pick. Watch for co-located storage
            ratios and the balance between NSW and VIC awards — both were quietly flagged
            in last week&rsquo;s consultation response.
          </p>
          <div className="mail-sources">DCCEEW · AEMO · RenewEconomy</div>
        </article>

        <article className="mail-item">
          <div className="mail-item-head">
            <span className="mail-sector">Networks · Regulation</span>
            <span className="mail-score">
              Significance <span className="mail-score-num">71</span>
            </span>
          </div>
          <h3 className="mail-item-title">
            AER draft determination: a softer line on network CAPEX.
          </h3>
          <p className="mail-item-body">
            Buried on page 47: an openness to accelerating grid augmentation spend where
            it unlocks REZ capacity. Quiet but real — and at odds with AEMC&rsquo;s last
            public signal.
          </p>
          <div className="mail-sources">AER · AEMC · The Australian</div>
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
          + 4 MORE ITEMS IN THE FULL BRIEF
        </div>
      </div>
    </div>
  );
}
