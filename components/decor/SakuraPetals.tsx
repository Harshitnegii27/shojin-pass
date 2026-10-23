"use client";
import { useEffect, useRef } from "react";

/**
 * Falling sakura petals on a <canvas>.
 * - Three depth layers: far petals are small, pale and slow; near ones bigger and quicker.
 * - Each petal tumbles (3D flip), spins and sways; a soft breeze swells into occasional gusts.
 * - Time-based, so it's equally smooth at 60 Hz and 120 Hz.
 * - Fewer petals on phones; pauses off-screen / in background tabs; honours "reduce motion".
 */
type Petal = {
  x: number; y: number; z: number; s: number; vy: number; vx: number;
  rot: number; vr: number; flip: number; vf: number; sway: number; vs: number; amp: number; c: number; a: number;
};

const COLORS: [number, number, number][] = [
  [253, 222, 230], [248, 196, 211], [243, 170, 193], [236, 143, 174], [255, 233, 239],
];

export default function SakuraPetals({
  density = 1,
  className = "",
  origin = "top-right",
  glow = false,
}: { density?: number; className?: string; origin?: "top-right" | "top"; glow?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0;
    let petals: Petal[] = [];
    let raf = 0, last = 0, t = 0;
    let visible = true;

    const spawn = (anywhere: boolean): Petal => {
      const z = Math.random(); // 0 far … 1 near
      const s = 5 + z * 9 + Math.random() * 2;
      // Most petals come from the canopy (top-right), some from across the top.
      const fromCanopy = origin === "top-right" && Math.random() < 0.7;
      return {
        x: anywhere ? Math.random() * w : fromCanopy ? w * (0.45 + Math.random() * 0.6) : Math.random() * (w + 120),
        y: anywhere ? Math.random() * h : fromCanopy ? Math.random() * h * 0.35 - 20 : -20 - Math.random() * 80,
        z, s,
        vy: 18 + z * 34 + Math.random() * 10,          // px / second
        vx: -(8 + z * 16 + Math.random() * 10),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 1.6,
        flip: Math.random() * Math.PI * 2,
        vf: 1 + Math.random() * 2.2,
        sway: Math.random() * Math.PI * 2,
        vs: 0.6 + Math.random() * 0.9,
        amp: 10 + z * 18,
        c: Math.floor(Math.random() * COLORS.length),
        a: 0.45 + z * 0.45,
      };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w < 640 ? 16 : 34) * density);
      petals = Array.from({ length: count }, () => spawn(true)).sort((a, b) => a.z - b.z);
    };

    const drawPetal = (p: Petal, wind: number) => {
      const [r, g, b] = COLORS[p.c];
      const s = p.s;
      ctx.save();
      ctx.translate(p.x + Math.sin(p.sway) * p.amp, p.y);
      ctx.rotate(p.rot + wind * 0.15);
      ctx.scale(1, 0.18 + Math.abs(Math.cos(p.flip)) * 0.82);
      if (glow) { ctx.shadowColor = `rgba(${r},${g},${b},0.6)`; ctx.shadowBlur = 8; }
      const grad = ctx.createLinearGradient(0, -s, 0, s);
      grad.addColorStop(0, `rgba(255,244,247,${p.a})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${p.a})`);
      ctx.fillStyle = grad;
      // petal outline with the little notch at the tip
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.78, -s * 0.78, -s * 0.2, -s);
      ctx.quadraticCurveTo(0, -s * 0.7, s * 0.2, -s);
      ctx.bezierCurveTo(s * 0.78, -s * 0.78, s * 0.95, s * 0.35, 0, s);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(214,120,150,${p.a * 0.3})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, s * 0.85); ctx.lineTo(0, -s * 0.35); ctx.stroke();
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now; t += dt;
      // gentle breeze that occasionally swells into a gust
      const wind = Math.sin(t * 0.35) * 0.6 + Math.max(0, Math.sin(t * 0.13)) ** 6 * 2.2;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.vy * dt;
        p.x += (p.vx - wind * (20 + p.z * 30)) * dt;
        p.rot += p.vr * dt * (1 + wind * 0.5);
        p.flip += p.vf * dt;
        p.sway += p.vs * dt;
        if (p.y > h + 30 || p.x < -60) { petals[i] = spawn(false); continue; }
        drawPetal(p, wind);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => { cancelAnimationFrame(raf); last = 0; if (visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => cancelAnimationFrame(raf);

    resize();
    if (reduce) { petals.slice(0, 10).forEach((p) => drawPetal(p, 0)); return; }
    start();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [density, origin, glow]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
