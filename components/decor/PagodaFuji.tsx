"use client";
import { motion } from "framer-motion";

/**
 * Line drawing of Mt Fuji with a five-storey pagoda and its reflection,
 * which draws itself the first time it scrolls into view.
 * A pagoda (Buddhist) fits shōjin ryōri — Buddhist temple cuisine.
 */
const CX = 455; // pagoda centre
const TIERS = Array.from({ length: 5 }, (_, i) => {
  const y = 108 + i * 34;     // roof line
  const w = 30 + i * 9;       // half-width of roof
  const b = 18 + i * 6;       // half-width of body
  return { y, w, b };
});

const draw = (delay: number, duration = 1.6) => ({
  initial: { pathLength: 0, opacity: 0 },
  whileInView: { pathLength: 1, opacity: 1 },
  viewport: { once: true, amount: 0.3 },
  transition: { pathLength: { duration, delay, ease: "easeInOut" as const }, opacity: { duration: 0.3, delay } },
});

export default function PagodaFuji({ className = "" }: { className?: string }) {
  const s = { stroke: "currentColor", fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 640 400" aria-hidden className={`pointer-events-none select-none ${className}`}>
      {/* Mt Fuji */}
      <motion.path d="M0 276 L120 276 C 180 250 230 190 290 128 Q 310 108 330 128 C 380 180 410 230 460 262 L640 276" {...s} strokeWidth="1.6" {...draw(0.2, 2.2)} />
      {/* snow cap */}
      <motion.path d="M262 158 L282 172 L296 158 L312 176 L328 160 L346 176" {...s} strokeWidth="1.4" {...draw(1.6, 1)} />
      {/* distant ridge */}
      <motion.path d="M0 290 C 80 278 150 284 220 280 C 300 276 380 290 470 284 C 540 280 600 286 640 284" {...s} strokeWidth="1" opacity="0.6" {...draw(0.6, 2)} />

      {/* Pagoda: spire */}
      <motion.path d={`M${CX} 50 L${CX} 104`} {...s} strokeWidth="1.6" {...draw(1.2, 0.6)} />
      {[62, 72, 82, 92].map((y, i) => (
        <motion.path key={y} d={`M${CX - 5} ${y} L${CX + 5} ${y}`} {...s} strokeWidth="1.4" {...draw(1.4 + i * 0.08, 0.3)} />
      ))}
      {/* Pagoda: five roofs with up-turned eaves, and the body under each */}
      {TIERS.map((t, i) => (
        <g key={i}>
          <motion.path
            d={`M${CX - t.w - 8} ${t.y + 2} Q${CX - t.w * 0.6} ${t.y + 6} ${CX - t.b * 0.6} ${t.y - 10} L${CX + t.b * 0.6} ${t.y - 10} Q${CX + t.w * 0.6} ${t.y + 6} ${CX + t.w + 8} ${t.y + 2}`}
            {...s} strokeWidth="1.7" {...draw(1.5 + i * 0.18, 0.8)} />
          <motion.path
            d={`M${CX - t.b} ${t.y + 4} L${CX - t.b} ${t.y + 26} M${CX + t.b} ${t.y + 4} L${CX + t.b} ${t.y + 26} M${CX - 4} ${t.y + 10} L${CX - 4} ${t.y + 22} L${CX + 4} ${t.y + 22} L${CX + 4} ${t.y + 10}`}
            {...s} strokeWidth="1.2" {...draw(1.7 + i * 0.18, 0.6)} />
        </g>
      ))}
      {/* platform */}
      <motion.path d={`M${CX - 70} 280 L${CX + 70} 280 M${CX - 58} 274 L${CX + 58} 274`} {...s} strokeWidth="1.6" {...draw(2.6, 0.6)} />

      {/* water + reflection ripples */}
      {[300, 316, 334, 354, 376].map((y, i) => (
        <motion.path key={y}
          d={`M${CX - 80 + i * 10} ${y} L${CX - 20} ${y} M${CX + 4} ${y} L${CX + 80 - i * 12} ${y} M${60 + i * 30} ${y + 6} L${200 + i * 24} ${y + 6}`}
          {...s} strokeWidth="1" opacity={0.7 - i * 0.12} {...draw(2.8 + i * 0.12, 0.8)} />
      ))}
    </svg>
  );
}
