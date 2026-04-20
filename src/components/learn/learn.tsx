"use client";

import { useState } from "react";
import { BrowseMicrosectors } from "./browse-microsectors";
import { ConceptOverlay } from "./concept-overlay";
import { ContinueLearning } from "./continue-learning";
import { DeepDivePodcasts } from "./deep-dive-podcasts";
import { FeaturedPaths } from "./featured-paths";
import { HeaderArt } from "./header-art";
import {
  LEARN_HEADER,
  LEARN_PROVENANCE,
  SUBSTRATE_REVIEWED,
  SUBSTRATE_TOTAL,
  TODAY_CONCEPT,
} from "./mock-data";
import { MicrosectorDrill } from "./microsector-drill";
import { PathSidePanel } from "./path-side-panel";
import { TodayConceptHero } from "./today-concept-hero";
import type { Microsector, Path } from "./types";

import "./learn.css";

export function LearnTab() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState<Path | null>(null);
  const [drillSector, setDrillSector] = useState<Microsector | null>(null);

  return (
    <div className="cp-learn">
      {!drillSector && <HeaderArt seed={419} />}

      {drillSector ? (
        <MicrosectorDrill
          sector={drillSector}
          onClose={() => setDrillSector(null)}
          onOpenConcept={() => setOverlayOpen(true)}
        />
      ) : (
        <LearnLanding
          onOpenConcept={() => setOverlayOpen(true)}
          onPreviewPath={setPreviewPath}
          onDrillSector={setDrillSector}
        />
      )}

      <ConceptOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} showTrust />
      <PathSidePanel
        path={previewPath}
        onClose={() => setPreviewPath(null)}
        onOpenFull={() => setPreviewPath(null)}
      />
    </div>
  );
}

function LearnLanding({
  onOpenConcept,
  onPreviewPath,
  onDrillSector,
}: {
  onOpenConcept: () => void;
  onPreviewPath: (p: Path) => void;
  onDrillSector: (m: Microsector) => void;
}) {
  return (
    <div className="main-inner">
      <div className="page-header">
        <div>
          <div className="micro" style={{ color: "var(--ink-4)" }}>{LEARN_HEADER.eyebrow}</div>
          <div className="page-title" style={{ marginTop: 10 }}>{LEARN_HEADER.title}</div>
          <div className="page-sub">{LEARN_HEADER.sub}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
          <span className="meta tabular">SUBSTRATE</span>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 350,
              fontSize: 36,
              letterSpacing: "-0.4px",
            }}
          >
            {SUBSTRATE_TOTAL}
          </span>
          <span className="meta tabular">concepts · {SUBSTRATE_REVIEWED} editor-reviewed</span>
        </div>
      </div>

      <div className="section">
        <TodayConceptHero concept={TODAY_CONCEPT} onOpen={onOpenConcept} />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Deep dive podcasts</div>
          <span className="section-link">All episodes →</span>
        </div>
        <DeepDivePodcasts />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Continue learning</div>
          <span className="section-link">Your library →</span>
        </div>
        <ContinueLearning onPreview={onPreviewPath} />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Featured paths</div>
          <span className="section-link">All 14 paths →</span>
        </div>
        <FeaturedPaths onPreview={onPreviewPath} />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Browse by micro-sector</div>
          <span className="section-link">Full taxonomy →</span>
        </div>
        <BrowseMicrosectors onDrill={onDrillSector} />
      </div>

      <div className="provenance">
        <span>{LEARN_PROVENANCE.note}</span>
        <span className="tabular">{LEARN_PROVENANCE.stamp}</span>
      </div>
    </div>
  );
}

export default LearnTab;
