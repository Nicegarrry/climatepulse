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

type InteractionType = "play" | "resume" | "complete" | "quit" | "skip_back" | "skip_forward";

// Fire-and-forget interact emit. Uses keepalive so it survives page unload.
// Safely skips when the episode id looks synthetic (mock data, no DB row).
function emitInteraction(
  episodeId: string | undefined,
  type: InteractionType,
  positionSeconds: number
) {
  if (!episodeId || episodeId.startsWith("mock-")) return;
  const body = JSON.stringify({
    podcast_episode_id: episodeId,
    type,
    position_seconds: Math.max(0, Math.floor(positionSeconds)),
  });
  try {
    fetch("/api/podcast/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Ignore — telemetry must never block playback.
  }
}

export function PodcastPlayer({
  episode,
  compact = false,
  onPlayingChange,
}: {
  episode: PodcastEpisode;
  compact?: boolean;
  // Called whenever the underlying <audio> element starts or stops playing.
  // Used by the mobile briefing shell to make the player sticky-at-top while
  // audio is live. Not wired to raw React state to keep the internal
  // event-driven sync the single source of truth.
  onPlayingChange?: (playing: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(episode.audio_duration_seconds ?? 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Telemetry bookkeeping. Refs so event handlers stay stable across renders.
  const hasStartedRef = useRef(false);   // first play vs subsequent resume
  const completedRef = useRef(false);    // skip the unmount `quit` after natural end
  const episodeIdRef = useRef(episode.id);

  // Reset telemetry flags when a different episode is loaded into the player.
  useEffect(() => {
    hasStartedRef.current = false;
    completedRef.current = false;
    episodeIdRef.current = episode.id;
  }, [episode.id]);

  // Stable ref to the latest `onPlayingChange` so the listener effect doesn't
  // have to re-run (and re-attach every handler) when the prop identity changes.
  const onPlayingChangeRef = useRef(onPlayingChange);
  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange;
  }, [onPlayingChange]);

  // Sync with audio element — mirror *actual* element state so external pauses
  // (phone call, headphones unplugged, lock-screen control) don't desync the UI.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const notifyPlaying = (playing: boolean) => {
      onPlayingChangeRef.current?.(playing);
    };

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : (episode.audio_duration_seconds ?? 0));
    };
    const onDurationChange = onMeta;
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
      notifyPlaying(true);
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        emitInteraction(episodeIdRef.current, "play", audio.currentTime);
      } else {
        emitInteraction(episodeIdRef.current, "resume", audio.currentTime);
      }
    };
    const onPause = () => {
      setPlaying(false);
      setLoading(false);
      notifyPlaying(false);
    };
    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
      notifyPlaying(true);
    };
    const onWaiting = () => setLoading(true);
    const onStalled = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setPlaying(false);
      setLoading(false);
      notifyPlaying(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setLoading(false);
      notifyPlaying(false);
      completedRef.current = true;
      emitInteraction(episodeIdRef.current, "complete", audio.duration || audio.currentTime);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [episode.audio_duration_seconds]);

  // Emit `quit` if the user navigates away (or this component unmounts) mid-episode.
  useEffect(() => {
    const onUnload = () => {
      const audio = audioRef.current;
      if (!audio || completedRef.current || !hasStartedRef.current) return;
      emitInteraction(episodeIdRef.current, "quit", audio.currentTime);
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      onUnload();
    };
  }, []);

  // Wrap audio.play() so we catch iOS autoplay / session-interruption rejections
  // instead of leaving the UI in a fake "playing" state.
  const safePlay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      setLoading(true);
      await audio.play();
    } catch {
      setPlaying(false);
      setLoading(false);
    }
  }, []);

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

    navigator.mediaSession.setActionHandler("play", () => { void safePlay(audio); });
    navigator.mediaSession.setActionHandler("pause", () => { audio.pause(); });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
      emitInteraction(episodeIdRef.current, "skip_back", audio.currentTime);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
      emitInteraction(episodeIdRef.current, "skip_forward", audio.currentTime);
    });
  }, [episode.briefing_date, safePlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
    } else {
      if (!expanded) setExpanded(true);
      void safePlay(audio);
    }
  }, [expanded, safePlay]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    // defaultPlaybackRate survives seeks/reloads on iOS where playbackRate alone resets to 1.0
    audio.defaultPlaybackRate = SPEEDS[next];
    audio.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  // Drag-to-scrub bookkeeping. `scrubbingRef` gates move events so we only seek
  // while the pointer is down; `rafRef` coalesces pointermove updates to one per
  // frame so a drag doesn't thrash `currentTime` (which can cause audible chatter
  // on iOS). `isScrubbing` state mirrors the ref for render-time styling (CSS
  // transition toggle). We intentionally do NOT emit skip_* telemetry from drag
  // seeks — that's reserved for the explicit 15s media-session handlers.
  const scrubbingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const seek = useCallback((clientX: number) => {
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
  }, [duration]);

  const flushScrub = useCallback(() => {
    rafRef.current = null;
    const x = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (x !== null) seek(x);
  }, [seek]);

  const onSeekPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      scrubbingRef.current = true;
      setIsScrubbing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some older browsers throw if capture isn't supported — ignore.
      }
      seek(e.clientX);
    },
    [seek]
  );

  const onSeekPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      pendingClientXRef.current = e.clientX;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushScrub);
      }
    },
    [flushScrub]
  );

  const onSeekPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore — capture may have been lost already (e.g., pointercancel).
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Final commit in case a pointermove was queued without flushing.
      if (pendingClientXRef.current !== null) {
        const x = pendingClientXRef.current;
        pendingClientXRef.current = null;
        seek(x);
      }
    },
    [seek]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Single persistent <audio> element — rendered once at the root so that
  // compact→expanded transitions on mobile don't unmount/remount it and orphan
  // the event listeners wired up above. The three UI states (compact CTA,
  // collapsed inline button, expanded full controls) are rendered as siblings.
  const showCompact = compact && !expanded;

  return (
    <>
      <audio ref={audioRef} src={episode.audio_url} preload="metadata" playsInline />

      {showCompact && (
        <button
          onClick={togglePlay}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "14px 18px",
            background: COLORS.ink,
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            textAlign: "left",
            minHeight: 56,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {loading ? <Spinner size={18} color="#fff" /> : <PlayIcon playing={playing} size={16} color="#fff" />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: 0.2 }}>
              Listen to today&apos;s briefing
            </span>
            <span style={{ display: "block", fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {playing || currentTime > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : `~${formatTime(duration)} \u00B7 two-speaker audio`}
            </span>
          </span>
        </button>
      )}

      {!showCompact && (
        <div style={{ marginBottom: expanded ? 0 : 4 }}>
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
              {loading ? <Spinner size={22} /> : <PlayIcon playing={playing} size={22} />}
              <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500, color: COLORS.forest, flex: 1 }}>
                {loading ? "Loading…" : "Listen to today\u2019s briefing"}
              </span>
              <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.inkMuted }}>
                {playing || currentTime > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : formatTime(duration)}
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
                  aria-label={playing ? "Pause" : "Play"}
                  style={{
                    width: 44,
                    height: 44,
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
                  {loading ? <Spinner size={18} color="#fff" /> : <PlayIcon playing={playing} size={18} color="#fff" />}
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
                  contentType="podcast"
                  episodeId={episode.id}
                  compact
                />
              </div>

              {/* Progress bar — padded wrapper gives an iOS-friendly ~44px tap target */}
              <div
                ref={progressRef}
                onPointerDown={onSeekPointerDown}
                onPointerMove={onSeekPointerMove}
                onPointerUp={onSeekPointerUp}
                onPointerCancel={onSeekPointerUp}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={currentTime}
                style={{
                  padding: "14px 0",
                  marginTop: -6,
                  marginBottom: -2,
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
                    overflow: "visible",
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
                  {/* scrubber knob */}
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
      )}
    </>
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

// ─── Spinner (inline SVG) ─────────────────────────────────────────────────

function Spinner({ size = 16, color = COLORS.forest }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ animation: "cp-spin 0.9s linear infinite" }}
    >
      <circle cx="12" cy="12" r="9" stroke={`${color}33`} strokeWidth="3" fill="none" />
      <path
        d="M12 3 a9 9 0 0 1 9 9"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } } svg { transform-origin: center; }`}</style>
    </svg>
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
