"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { PodcastEpisode } from "@/lib/types";
import { ShareButton } from "@/components/share/ShareButton";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2] as const;

export function PodcastPlayer({
  episode,
  compact = false,
}: {
  episode: PodcastEpisode;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(episode.audio_duration_seconds ?? 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Sync with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : (episode.audio_duration_seconds ?? 0));
    };
    const onEnd = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [episode.audio_duration_seconds]);

  // Media Session API for lock screen controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "ClimatePulse Daily",
      artist: `${episode.briefing_date} Edition`,
      album: "ClimatePulse",
    });

    const audio = audioRef.current;
    if (!audio) return;

    navigator.mediaSession.setActionHandler("play", () => {
      audio.play();
      setPlaying(true);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audio.pause();
      setPlaying(false);
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
    });
  }, [episode.briefing_date]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      if (!expanded) setExpanded(true);
    }
  }, [playing, expanded]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    audio.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * (audio.duration || duration);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Compact mode: sticky mini-player for mobile
  if (compact && !expanded) {
    return (
      <>
        <audio ref={audioRef} src={episode.audio_url} preload="metadata" />
        <button
          onClick={togglePlay}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 16px",
            background: COLORS.sageTint,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <PlayIcon playing={playing} size={20} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500, color: COLORS.forest, flex: 1 }}>
            Listen to today&apos;s briefing
          </span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
            {formatTime(duration)}
          </span>
        </button>
      </>
    );
  }

  return (
    <div style={{ marginBottom: expanded ? 0 : 4 }}>
      <audio ref={audioRef} src={episode.audio_url} preload="metadata" />

      {/* Collapsed: single-line button */}
      {!expanded && (
        <button
          onClick={togglePlay}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 14px",
            background: COLORS.sageTint,
            border: `1px solid ${COLORS.sage}40`,
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.sage}30`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.sageTint)}
        >
          <PlayIcon playing={false} size={22} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500, color: COLORS.forest, flex: 1 }}>
            Listen to today&apos;s briefing
          </span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
            {formatTime(duration)}
          </span>
        </button>
      )}

      {/* Expanded: full controls */}
      {expanded && (
        <div
          style={{
            padding: "12px 14px",
            background: COLORS.sageTint,
            border: `1px solid ${COLORS.sage}40`,
            borderRadius: 8,
          }}
        >
          {/* Top row: play/pause + title + speed */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 36,
                height: 36,
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
              <PlayIcon playing={playing} size={16} color="#fff" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.sans, fontSize: 12, fontWeight: 500, color: COLORS.forest }}>
                ClimatePulse Daily
              </div>
              <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.inkMuted, marginTop: 1 }}>
                {episode.briefing_date} Edition
              </div>
            </div>
            <button
              onClick={cycleSpeed}
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.forestMid,
                background: `${COLORS.sage}30`,
                border: "none",
                borderRadius: 4,
                padding: "3px 7px",
                cursor: "pointer",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {SPEEDS[speedIdx]}x
            </button>
            <ShareButton
              articleUrl={episode.audio_url}
              headline={`ClimatePulse Daily — ${episode.briefing_date}`}
              sourceName="ClimatePulse"
              campaign={`podcast-${episode.briefing_date}`}
              compact
            />
          </div>

          {/* Progress bar */}
          <div
            ref={progressRef}
            onClick={seek}
            style={{
              height: 6,
              background: `${COLORS.sage}40`,
              borderRadius: 3,
              cursor: "pointer",
              position: "relative",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: COLORS.forest,
                borderRadius: 3,
                transition: "width 0.2s linear",
              }}
            />
          </div>

          {/* Time display */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
              {formatTime(currentTime)}
            </span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sticky mini-player for mobile (shows when audio is playing) ──────────

export function MiniPlayer({
  episode,
  audioRef,
  playing,
  currentTime,
  duration,
  onTogglePlay,
}: {
  episode: PodcastEpisode;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
}) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        zIndex: 100,
      }}
    >
      <button
        onClick={onTogglePlay}
        style={{
          width: 36,
          height: 36,
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
        <PlayIcon playing={playing} size={14} color="#fff" />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 500, color: COLORS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ClimatePulse Daily — {episode.briefing_date}
        </div>
        {/* Thin progress bar */}
        <div style={{ height: 3, background: `${COLORS.sage}40`, borderRadius: 2, marginTop: 4 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: COLORS.forest, borderRadius: 2, transition: "width 0.3s linear" }} />
        </div>
      </div>
      <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted, flexShrink: 0 }}>
        {formatTime(Math.max(0, duration - currentTime))}
      </span>
    </div>
  );
}

// ─── Play/Pause Icon (inline SVG) ─────────────────────────────────────────

function PlayIcon({
  playing,
  size = 16,
  color = COLORS.forest,
}: {
  playing: boolean;
  size?: number;
  color?: string;
}) {
  if (playing) {
    // Pause icon
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    );
  }
  // Play icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
