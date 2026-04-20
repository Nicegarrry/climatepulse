"use client";

import { useEffect, useState } from "react";
import { PauseIcon, PlayIcon, Waveform } from "./waveform";
import { PODCASTS } from "./mock-data";
import type { Podcast } from "./types";

export function DeepDivePodcasts() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const featured = PODCASTS[0];
  const rest = PODCASTS.slice(1);

  return (
    <div className="pod-row">
      <FeaturedPlayer pod={featured} playingId={playingId} setPlayingId={setPlayingId} />
      <div className="pod-list">
        {rest.map((p) => (
          <MiniPlayer key={p.id} pod={p} playingId={playingId} setPlayingId={setPlayingId} />
        ))}
      </div>
    </div>
  );
}

function useSimulatedProgress(initial: number, playing: boolean) {
  const [progress, setProgress] = useState(initial);
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(
      () => setProgress((p) => Math.min(1, p + 0.0028)),
      100,
    );
    return () => window.clearInterval(t);
  }, [playing]);
  return [progress, setProgress] as const;
}

function FeaturedPlayer({
  pod,
  playingId,
  setPlayingId,
}: {
  pod: Podcast;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const isPlaying = playingId === pod.id;
  const [progress] = useSimulatedProgress(pod.progress, isPlaying);

  const totalMin = parseInt(pod.duration, 10);
  const playedSec = Math.round(progress * totalMin * 60);
  const mm = String(Math.floor(playedSec / 60)).padStart(2, "0");
  const ss = String(playedSec % 60).padStart(2, "0");

  const toggle = () => setPlayingId(isPlaying ? null : pod.id);

  return (
    <div className={`pod-player pod-${pod.color}`} onClick={toggle} role="button" tabIndex={0}>
      <div className="pod-head">
        <span className="pod-kind">◐ {pod.kind}</span>
        <span className="pod-sector">{pod.sector}</span>
        <span className="pod-pub tabular">{pod.published}</span>
      </div>
      <div className="pod-title">{pod.title}</div>
      <div className="pod-byline">
        <span className="pod-host">{pod.host}</span>
        {pod.guest && <span className="pod-guest"> · {pod.guest}</span>}
      </div>
      <div className="pod-waverow">
        <button
          type="button"
          className="pod-play"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
        <div className="pod-wave">
          <Waveform bars={pod.waveform} progress={progress} color={pod.color} playing={isPlaying} />
        </div>
        <span className="pod-time tabular">
          {mm}:{ss} <span style={{ opacity: 0.5 }}>/ {pod.duration}</span>
        </span>
      </div>
    </div>
  );
}

function MiniPlayer({
  pod,
  playingId,
  setPlayingId,
}: {
  pod: Podcast;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const isPlaying = playingId === pod.id;
  const [progress] = useSimulatedProgress(pod.progress, isPlaying);
  const toggle = () => setPlayingId(isPlaying ? null : pod.id);

  return (
    <div className={`pod-mini pod-${pod.color}`} onClick={toggle} role="button" tabIndex={0}>
      <button
        type="button"
        className="pod-play pod-play-sm"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pod-mini-meta">
          <span className="pod-mini-kind">{pod.kind}</span>
          <span style={{ width: 3, height: 3, background: "currentColor", borderRadius: "50%", opacity: 0.4 }} />
          <span className="pod-mini-pub tabular">{pod.published}</span>
          <span className="pod-mini-dur tabular">{pod.duration}</span>
        </div>
        <div className="pod-mini-title">{pod.title}</div>
        <div className="pod-mini-wave">
          <Waveform
            bars={pod.waveform.slice(0, 28)}
            progress={progress}
            color={pod.color}
            playing={isPlaying}
          />
        </div>
      </div>
    </div>
  );
}
