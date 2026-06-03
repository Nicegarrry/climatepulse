"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";

// Self-contained branded player for the PUBLIC podcast share landing.
//
// Deliberately decoupled from the dashboard PodcastPlayer: no playback
// telemetry (the share page is anonymous — /api/podcast/interact would 401)
// and no nested ShareButton. It just plays the episode with a ClimatePulse-
// styled transport so the unfurled link feels like product, not a raw file.

const SPEEDS = [1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SharePodcastPlayer({
  audioUrl,
  durationSeconds,
  dateLabel,
}: {
  audioUrl: string;
  durationSeconds: number | null;
  dateLabel: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speedIdx, setSpeedIdx] = useState(0);

  // Mirror the real <audio> element state so external interruptions (a phone
  // call, headphones unplugged) don't leave the UI showing a fake "playing".
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : durationSeconds ?? 0);
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => {
      setPlaying(false);
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onEnded = () => {
      setPlaying(false);
      setLoading(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
    };
  }, [durationSeconds]);

  const safePlay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      setLoading(true);
      await audio.play();
    } catch {
      // iOS autoplay / session-interruption rejection — drop back to paused.
      setPlaying(false);
      setLoading(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) audio.pause();
    else void safePlay(audio);
  }, [safePlay]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    audio.defaultPlaybackRate = SPEEDS[next];
    audio.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  // Click / drag to scrub. We keep this simple (no rAF coalescing) — the share
  // page is light and there's no telemetry to thrash.
  const scrubbingRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const seek = useCallback(
    (clientX: number) => {
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!audio || !bar) return;
      const rect = bar.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const target = ratio * (audio.duration || duration);
      if (isFinite(target)) {
        audio.currentTime = target;
        setCurrentTime(target);
      }
    },
    [duration]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      scrubbingRef.current = true;
      setIsScrubbing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* unsupported — ignore */
      }
      seek(e.clientX);
    },
    [seek]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      seek(e.clientX);
    },
    [seek]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be lost — ignore */
      }
    },
    []
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        marginTop: 24,
        padding: "16px 18px 18px",
        background: COLORS.sageTint,
        border: `1px solid ${COLORS.sage}40`,
        borderRadius: 8,
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" playsInline />

      {/* Top row: play/pause + title + speed */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: COLORS.forest,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {loading ? <Spinner size={20} color="#fff" /> : <PlayIcon playing={playing} size={20} color="#fff" />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: COLORS.forest }}>
            ClimatePulse Daily
          </div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.inkMuted, marginTop: 1 }}>
            {dateLabel ? `${dateLabel} edition · two-speaker audio` : "Two-speaker audio briefing"}
          </div>
        </div>
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label="Playback speed"
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.forestMid,
            background: `${COLORS.sage}30`,
            border: "none",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {SPEEDS[speedIdx]}x
        </button>
      </div>

      {/* Progress bar — padded wrapper gives an iOS-friendly ~44px tap target */}
      <div
        ref={progressRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime}
        style={{
          padding: "16px 0 6px",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        <div
          style={{
            height: 6,
            background: `${COLORS.sage}40`,
            borderRadius: 3,
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: COLORS.forest,
              borderRadius: 3,
              transition: isScrubbing ? "none" : "width 0.2s linear",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${progress}%`,
              top: "50%",
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              borderRadius: "50%",
              background: COLORS.forest,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </div>

      {/* Time display */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
          {formatTime(currentTime)}
        </span>
        <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────

function Spinner({ size = 16, color = COLORS.forest }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "cp-share-spin 0.9s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke={`${color}33`} strokeWidth="3" fill="none" />
      <path d="M12 3 a9 9 0 0 1 9 9" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <style>{`@keyframes cp-share-spin { to { transform: rotate(360deg); } } svg { transform-origin: center; }`}</style>
    </svg>
  );
}

// ─── Play / Pause icon ──────────────────────────────────────────────────────

function PlayIcon({ playing, size = 16, color = COLORS.forest }: { playing: boolean; size?: number; color?: string }) {
  if (playing) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
