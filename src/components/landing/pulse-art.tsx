"use client";

import { useEffect, useRef } from "react";

/**
 * ECG-style pulse visualisation — ported from the design handoff's
 * p5.js sketch into plain canvas so the landing page doesn't need to
 * pull in p5 (~700KB). Same flow: a few seeded gaussian spikes over a
 * subtle carrier wave; amplitude eases in over ~180 frames then freezes.
 */
export function PulseArt() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    el.prepend(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Phase = { x: number; amp: number; spread: number; sign: number };
    const phases: Phase[] = [];

    // Seeded PRNG so the composition is stable between reloads
    let seed = 17;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const rbtw = (a: number, b: number) => a + rand() * (b - a);

    const generatePhases = () => {
      phases.length = 0;
      const count = 7;
      for (let i = 0; i < count; i++) {
        phases.push({
          x: rbtw(0.05, 0.95),
          amp: rbtw(0.15, 0.85),
          spread: rbtw(0.025, 0.06),
          sign: rand() > 0.35 ? 1 : -1,
        });
      }
    };
    generatePhases();

    const readTheme = () => {
      const style = getComputedStyle(el);
      const bg = style.getPropertyValue("--bg").trim() || "#F5EFE6";
      const forest = style.getPropertyValue("--forest").trim() || "#0F4D2A";
      const forest2 = style.getPropertyValue("--forest-2").trim() || "#2F7A4A";
      const ink3 = style.getPropertyValue("--ink-3").trim() || "#8B7288";
      return { bg, forest, forest2, ink3 };
    };

    let w = 0;
    let h = 0;
    let t = 0;
    let settled = false;
    let rafId = 0;
    const SETTLE_FRAMES = 180;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const hexToRgb = (hex: string) => {
      const m = hex.replace("#", "");
      const full =
        m.length === 3
          ? m.split("").map((c) => c + c).join("")
          : m;
      const n = parseInt(full, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const drawLine = (
      offset: number,
      amp: number,
      color: string,
      alpha: number,
      weight: number,
      driftT: number
    ) => {
      const [r, g, b] = hexToRgb(color);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`;
      ctx.lineWidth = weight;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const step = 2;
      for (let x = 0; x <= w; x += step) {
        const nx = x / w;
        let y = h / 2 + offset;
        y += Math.sin(nx * 12 + driftT * 0.6) * 3 * amp;
        y += Math.sin(nx * 22 + driftT * 0.9 + offset) * 1.5 * amp;
        for (const ph of phases) {
          const dx = nx - ph.x;
          const sigma = ph.spread;
          const gauss = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const lead =
            Math.exp(-((dx + sigma * 1.2) ** 2) / (2 * (sigma * 0.6) ** 2)) * 0.15;
          y -= (gauss - lead) * (h * 0.34) * ph.amp * ph.sign * amp;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const draw = () => {
      const { bg, forest, forest2, ink3 } = readTheme();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Baseline
      const [ir, ig, ib] = hexToRgb(ink3);
      ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, 0.11)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Monitor grid
      ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, 0.055)`;
      const gridStep = 40;
      for (let x = 0; x < w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const amp = settled ? 1 : Math.min(1, t / SETTLE_FRAMES);
      const driftT = settled ? SETTLE_FRAMES * 0.02 : t * 0.02;

      // Ghost lines + primary
      drawLine(8, amp, forest2, 34, 1, driftT);
      drawLine(-6, amp, forest, 46, 1, driftT);
      drawLine(0, amp, forest, 240, 1.7, driftT);

      // Tick marks
      ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, 0.24)`;
      ctx.lineWidth = 1;
      for (let x = 20; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, h - 12);
        ctx.lineTo(x, h - 6);
        ctx.stroke();
      }

      t++;
      if (!settled && t >= SETTLE_FRAMES) settled = true;
      if (!settled) rafId = requestAnimationFrame(draw);
      else {
        // One final composite frame to lock in place
        rafId = 0;
      }
    };

    resize();
    draw();

    const handleResize = () => {
      resize();
      // Redraw a single settled frame at the new size
      t = SETTLE_FRAMES;
      settled = true;
      cancelAnimationFrame(rafId);
      draw();
    };
    window.addEventListener("resize", handleResize);

    // React to dark-mode toggle on the landing root (class change)
    const landingRoot = el.closest(".cp-landing");
    let observer: MutationObserver | null = null;
    if (landingRoot) {
      observer = new MutationObserver(() => {
        // Re-settle briefly so the wave animates back in with the new palette
        t = 0;
        settled = false;
        cancelAnimationFrame(rafId);
        draw();
      });
      observer.observe(landingRoot, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
      canvas.remove();
    };
  }, []);

  return (
    <div className="hero-art" ref={containerRef}>
      <div className="hero-art-label">live · classified · scored</div>
    </div>
  );
}
