"use client";

import { useEffect, useRef } from "react";

/**
 * Algorithmic hero art — a flow-field of soft sage/forest lines suggesting
 * organic, interconnected movement. Renders once and stops to save battery
 * (per the landing-page brief).
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      // Warm paper background
      ctx.fillStyle = "#FAF9F7";
      ctx.fillRect(0, 0, width, height);

      // Seeded randomness for a repeatable composition
      let seed = 42;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      // Flow-field parameters
      const cols = 48;
      const rows = 32;
      const cellW = width / cols;
      const cellH = height / rows;

      const angleAt = (x: number, y: number) => {
        const nx = x / width;
        const ny = y / height;
        // Layered sinusoids — cheap, deterministic, smooth
        return (
          Math.sin(nx * 3.2 + ny * 1.5) * 0.9 +
          Math.sin(ny * 4.1 - nx * 2.2) * 0.6 +
          Math.cos((nx + ny) * 5.3) * 0.4
        );
      };

      // Soft sage lines, very thin
      ctx.lineWidth = 0.6;
      ctx.lineCap = "round";

      const LINE_COUNT = 180;
      for (let i = 0; i < LINE_COUNT; i++) {
        const startX = rand() * width;
        const startY = rand() * height;
        let x = startX;
        let y = startY;

        // Colour gradient — deeper near top, sage near bottom
        const vert = startY / height;
        const alpha = 0.08 + 0.18 * (1 - Math.abs(vert - 0.5) * 1.4);
        const isForest = rand() > 0.7;
        ctx.strokeStyle = isForest
          ? `rgba(30, 77, 43, ${alpha})`
          : `rgba(148, 168, 138, ${alpha * 1.2})`;

        ctx.beginPath();
        ctx.moveTo(x, y);
        const steps = 45;
        for (let s = 0; s < steps; s++) {
          const angle = angleAt(x, y) * Math.PI;
          x += Math.cos(angle) * cellW * 0.35;
          y += Math.sin(angle) * cellH * 0.35;
          if (x < 0 || x > width || y < 0 || y > height) break;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // A few deliberate "anchor" dots, evoking signal points on a grid
      const dotCount = 9;
      for (let i = 0; i < dotCount; i++) {
        const dx = ((i + 0.5) / dotCount) * width + (rand() - 0.5) * cellW * 4;
        const dy = height * (0.3 + rand() * 0.4);
        ctx.beginPath();
        ctx.arc(dx, dy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30, 77, 43, 0.55)";
        ctx.fill();
      }
    };

    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  );
}
