"use client";

import { useEffect } from "react";

export function ConceptOverlay({
  open,
  onClose,
  showTrust = true,
}: {
  open: boolean;
  onClose: () => void;
  showTrust?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <div className={"cp-learn-overlay" + (open ? " open" : "")} onClick={onClose} aria-hidden={!open}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="overlay-head">
          <span className="o-breadcrumb">Learn / Concepts / Energy — Grid</span>
          {showTrust && (
            <span className="trust" style={{ marginLeft: 16 }}>
              <span className="tick" />
              <span>EDITOR REVIEWED · 2 APR 26</span>
            </span>
          )}
          <button className="o-close" onClick={onClose} aria-label="Close" type="button">
            ×
          </button>
        </div>
        <div className="overlay-body">
          <div className="c-full-grid">
            <div className="c-full-main">
              <div className="micro" style={{ color: "var(--plum)" }}>CONCEPT · ENERGY — GRID</div>
              <h1>
                Marginal Loss Factor{" "}
                <span style={{ color: "var(--plum)", fontWeight: 300 }}>· MLF</span>
              </h1>
              <div className="lede">
                A per-generator coefficient the market operator applies to every megawatt-hour you sell —
                a number that quietly decides whether a project pencils.
              </div>

              <h2>What it is</h2>
              <p>
                Every generator connected to the National Electricity Market has an MLF attached to its
                connection point. When electricity travels from your generator to the regional reference
                node, some of it is lost to heat and reactance. The MLF is the coefficient that settles
                you against those losses — it's applied to your metered output before you get paid.
              </p>
              <p>
                A solar farm with an MLF of 0.78 sells 78 megawatt-hours of revenue for every 100 it
                generates. A gas peaker near the reference node might sit at 1.02, and earn above
                nameplate. The factors reset every July.
              </p>

              <div className="pull">
                In the 2025–26 update, 38 renewable projects moved by more than 5 points —
                a shift large enough to re-open hedge books and re-price several PPAs.
              </div>

              <h2>Why it matters now</h2>
              <p>
                MLFs have been trending down in western NSW and north-west Victoria as congestion grows
                ahead of transmission build-out. For new projects, MLF risk is increasingly priced into
                financing — lenders are asking for 3–5 year MLF forecasts in base-case revenue models,
                and the bid side of merchant contracts has widened accordingly.
              </p>

              <h2>How to read AEMO's MLF table</h2>
              <p>
                The annual publication lists every connection point with its prior year, current, and
                forecast coefficient. Pay attention to the delta column — a drop of more than 3 points
                year-on-year usually signals either a new generator commissioning nearby, or a known
                transmission constraint that hasn't been resolved.
              </p>
            </div>

            <aside className="c-full-side">
              <div className="side-block">
                <h4>At a glance</h4>
                <ul>
                  <li style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 350, color: "var(--ink)" }}>0.78</li>
                  <li className="meta">Lowest MLF in the 2025–26 AEMO update</li>
                </ul>
              </div>
              <div className="side-block">
                <h4>Related concepts</h4>
                <ul>
                  <li><a>Regional Reference Node</a></li>
                  <li><a>Renewable Energy Zone (REZ)</a></li>
                  <li><a>Connection queue</a></li>
                  <li><a>System strength remediation</a></li>
                  <li><a>Transmission congestion</a></li>
                </ul>
              </div>
              <div className="side-block">
                <h4>Part of paths</h4>
                <ul>
                  <li><a>Grid connection queue tracker · ch 3</a></li>
                  <li><a>AEMO ISP 2026 · ch 4</a></li>
                </ul>
              </div>
              <div className="side-block">
                <h4>Sources</h4>
                <ul>
                  <li className="meta">AEMO · MLF publication 2025–26</li>
                  <li className="meta">ARENA · Connection cost data</li>
                  <li className="meta">Windlab annual report · 2025</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

