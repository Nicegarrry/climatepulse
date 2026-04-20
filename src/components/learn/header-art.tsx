"use client";

import { useEffect, useRef } from "react";

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function HeaderArt({ seed = 419 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const draw = (w: number, h: number) => {
      const rand = mulberry32(seed);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#F0EDE7";
      ctx.fillRect(0, 0, w, h);
      const greens = ["#1E4D2B", "#2E6B3E", "#5B8C6A", "#A8C2B0", "#3D1F3D"];
      const N = Math.floor(w / 6);
      for (let i = 0; i < N; i++) {
        const x = i * 6 + 3;
        const r = rand();
        const amp = 6 + Math.sin(i * 0.11 + seed * 0.03) * 5 + r * 10;
        const color = greens[Math.floor(r * greens.length * 0.88)];
        ctx.globalAlpha = 0.08 + r * 0.14;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, h / 2 - amp);
        ctx.lineTo(x, h / 2 + amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const mx = 80 + mulberry32(seed + 1)() * (w - 160);
      ctx.strokeStyle = "#3D1F3D";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, h / 2 - 14);
      ctx.lineTo(mx, h / 2 + 14);
      ctx.stroke();
    };

    const resize = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(w, h);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [seed]);

  return (
    <div className="header-art">
      <canvas ref={ref} />
      <span className="seed">SEED · {String(seed).padStart(6, "0")} · 19·APR·26</span>
    </div>
  );
}
