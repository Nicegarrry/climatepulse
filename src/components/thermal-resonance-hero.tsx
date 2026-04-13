"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

// ─── Seeded PRNG (mulberry32) ──────────────────────────────────────────────
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Simple harmonic noise (no dependency needed) ──────────────────────────
function harmonicNoise(x: number, t: number) {
  return (
    Math.sin(x * 3.7 + t) * 0.3 +
    Math.sin(x * 7.3 + t * 1.3) * 0.2 +
    Math.sin(x * 13.1 + t * 0.7) * 0.1
  );
}

// ─── Curve data type ───────────────────────────────────────────────────────
interface CurveData {
  mu: number;
  sigma: number;
  amp: number;
  phase: number;
  speed: number;
  sigmaSpeed: number;
  sigmaPhase: number;
  noiseOff: number;
}

function generateCurves(rng: () => number, count: number): CurveData[] {
  const curves: CurveData[] = [];
  for (let i = 0; i < count; i++) {
    curves.push({
      mu: 0.12 + rng() * 0.76,
      sigma: 0.08 + rng() * 0.06,
      amp: 0.35 + rng() * 0.45, // reduced amplitude to stay in upper region
      phase: rng() * Math.PI * 2,
      speed: (0.005 + rng() * 0.015) * (rng() > 0.5 ? 1 : -1), // ~0.35x of original
      sigmaSpeed: 0.003 + rng() * 0.008, // ~0.35x of original
      sigmaPhase: rng() * Math.PI * 2,
      noiseOff: rng() * 1000,
    });
  }
  return curves;
}

function getDateSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ─── Constants ─────────────────────────────────────────────────────────────
const CURVE_COUNT = 5;
const STEPS = 300;
const BASE_Y_RATIO = 0.65; // moved up to keep curves away from bottom overlay
const AMP_HEIGHT_RATIO = 0.45; // reduced to constrain curves to upper portion

interface DailyNumberData {
  value: string;
  label: string;
  trend?: string | null;
  context: string;
}

interface ThermalResonanceHeroProps {
  title?: string;
  subtitle?: string;
  dailyNumber?: DailyNumberData;
  storyCount?: number;
  className?: string;
}

export function ThermalResonanceHero({
  title = "Daily Intelligence Briefing",
  subtitle,
  dailyNumber,
  storyCount,
  className,
}: ThermalResonanceHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const curvesRef = useRef<CurveData[]>([]);
  const frameRef = useRef(0);
  const noiseRef = useRef(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    // Background gradient: Plum → Deep Forest → Forest Green
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#4A1942");
    grad.addColorStop(0.5, "#1B4332");
    grad.addColorStop(1, "#2D6A4F");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const baseY = H * BASE_Y_RATIO;

    // Baseline
    ctx.strokeStyle = "rgba(248,246,243,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(W, baseY);
    ctx.stroke();

    // Signal curves
    const curves = curvesRef.current;
    const frameT = frameRef.current;
    const noiseT = noiseRef.current;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let ci = 0; ci < curves.length; ci++) {
      const c = curves[ci];
      const muNow =
        c.mu +
        Math.sin(frameT * c.speed + c.phase) * 0.09 +
        Math.sin(frameT * c.speed * 2.3 + c.phase * 1.7) * 0.025;
      const sigNow =
        c.sigma * (1 + Math.sin(frameT * c.sigmaSpeed + c.sigmaPhase) * 0.22);
      const ampNow =
        c.amp * (1 + Math.sin(frameT * c.speed * 1.5 + c.phase * 0.8) * 0.18);
      const alpha = 0.15 + (ci / curves.length) * 0.4;

      ctx.strokeStyle = `rgba(248,246,243,${alpha})`;
      ctx.beginPath();
      for (let xi = 0; xi <= STEPS; xi++) {
        const xn = xi / STEPS;
        const x = xn * W;
        const z = (xn - muNow) / sigNow;
        const g = Math.exp(-0.5 * z * z);
        const nd =
          harmonicNoise(xn * 4 + c.noiseOff, noiseT * 0.4) * 0.05 * g;
        const y = baseY - (g + nd) * ampNow * (H * AMP_HEIGHT_RATIO);
        if (xi === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    frameRef.current++;
    noiseRef.current += 0.008; // slower noise evolution
    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Init curves
    const rng = mulberry32(getDateSeed());
    curvesRef.current = generateCurves(rng, CURVE_COUNT);

    // Size canvas
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Start animation
    animFrameRef.current = requestAnimationFrame(draw);

    // Pause when hidden
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [draw]);

  return (
    <div className={className}>
      {/* Desktop: animated canvas with merged daily number */}
      <div
        ref={containerRef}
        className="relative hidden md:block w-full h-[180px] rounded-xl overflow-hidden"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Bottom overlay with title + daily number */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 pt-16 bg-gradient-to-t from-[rgba(27,67,50,0.75)] via-[rgba(27,67,50,0.4)] to-transparent">
          <div className="flex items-end justify-between gap-6">
            {/* Left: title */}
            <div className="min-w-0">
              <h1 className="font-display text-xl font-medium text-white tracking-tight">
                {title}
              </h1>
              <p className="text-xs text-white/60 mt-0.5">{subtitle}</p>
            </div>

            {/* Right: daily number (inline) */}
            {dailyNumber && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-baseline gap-2 shrink-0"
              >
                <span className="font-mono text-3xl font-bold tracking-tight text-white">
                  {dailyNumber.value}
                </span>
                {dailyNumber.trend && (
                  <span className="flex items-center gap-0.5 font-mono text-xs text-[#95D5B2]">
                    {dailyNumber.trend.startsWith("-") ? (
                      <TrendingDown className="h-3 w-3 text-red-300" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {dailyNumber.trend}
                  </span>
                )}
                <span className="text-xs text-white/50 max-w-[180px] truncate">
                  {dailyNumber.label}
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Hover tooltip */}
        <div
          className={`absolute top-3 right-4 bg-[rgba(27,67,50,0.85)] backdrop-blur-sm rounded-lg px-3 py-2 transition-opacity duration-200 ${
            showTooltip ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wider text-[#95D5B2] mb-0.5">
            Signal Pulse
          </p>
          <p className="text-[11px] text-[#F8F6F3] leading-relaxed">
            {CURVE_COUNT} signals · {storyCount ?? 0} stories
          </p>
        </div>
      </div>

      {/* Mobile: simple gradient header with daily number */}
      <div className="block md:hidden w-full rounded-xl overflow-hidden bg-gradient-to-br from-[#4A1942] via-[#1B4332] to-[#2D6A4F] px-5 py-5">
        <h1 className="font-display text-lg font-medium text-white tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-white/60 mt-0.5">{subtitle}</p>
        {dailyNumber && (
          <div className="flex items-baseline gap-2 mt-3 pt-3 border-t border-white/10">
            <span className="font-mono text-2xl font-bold text-white">
              {dailyNumber.value}
            </span>
            {dailyNumber.trend && (
              <span className="font-mono text-xs text-[#95D5B2]">
                {dailyNumber.trend}
              </span>
            )}
            <span className="text-xs text-white/50">{dailyNumber.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
