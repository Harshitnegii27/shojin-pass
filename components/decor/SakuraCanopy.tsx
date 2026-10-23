"use client";
import { motion } from "framer-motion";

/**
 * A lush cherry-blossom canopy reaching in from the top-right corner.
 * Dark branches + dense clouds of blossom in five pinks + crisp five-petal flowers.
 * Generated from a fixed seed, so server and browser draw exactly the same tree.
 * Two branch groups sway at different speeds, like a real tree in a breeze.
 */

// tiny deterministic random
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PINKS = ["#FDE3EA", "#F9CAD7", "#F4AEC3", "#EC90AD", "#E37296"];

type Cluster = { x: number; y: number; r: number; n: number; g: 0 | 1 };
// g = which branch group it belongs to (0: long top reach, 1: hanging right side)
const CLUSTERS: Cluster[] = [
  { x: 565, y: 38, r: 62, n: 70, g: 0 }, { x: 488, y: 70, r: 58, n: 64, g: 0 }, { x: 415, y: 92, r: 52, n: 56, g: 0 },
  { x: 345, y: 96, r: 48, n: 48, g: 0 }, { x: 276, y: 82, r: 44, n: 40, g: 0 }, { x: 206, y: 76, r: 38, n: 32, g: 0 },
  { x: 140, y: 66, r: 32, n: 24, g: 0 }, { x: 262, y: 50, r: 26, n: 18, g: 0 }, { x: 432, y: 142, r: 36, n: 30, g: 0 },
  { x: 356, y: 146, r: 30, n: 24, g: 0 }, { x: 185, y: 112, r: 22, n: 14, g: 0 },
  { x: 590, y: 112, r: 48, n: 44, g: 1 }, { x: 545, y: 178, r: 50, n: 46, g: 1 }, { x: 478, y: 205, r: 40, n: 34, g: 1 },
  { x: 524, y: 258, r: 44, n: 38, g: 1 }, { x: 565, y: 312, r: 38, n: 30, g: 1 }, { x: 508, y: 352, r: 28, n: 20, g: 1 },
];

const BRANCHES: { d: string; w: number; g: 0 | 1 }[] = [
  { d: "M640 -14 C 585 28 530 58 470 78", w: 15, g: 0 },
  { d: "M470 78 C 420 96 360 102 300 92", w: 10, g: 0 },
  { d: "M300 92 C 240 82 185 70 120 76", w: 6, g: 0 },
  { d: "M470 80 C 455 104 440 122 428 144", w: 5, g: 0 },
  { d: "M380 98 C 368 118 360 132 352 150", w: 4, g: 0 },
  { d: "M300 92 C 288 76 276 62 260 52", w: 4, g: 0 },
  { d: "M215 80 C 205 92 195 102 182 114", w: 3, g: 0 },
  { d: "M150 74 C 140 68 128 62 112 58", w: 2.5, g: 0 },
  { d: "M612 20 C 584 72 566 128 548 184", w: 13, g: 1 },
  { d: "M548 184 C 532 232 522 280 516 352", w: 8, g: 1 },
  { d: "M552 170 C 528 182 504 192 480 206", w: 4, g: 1 },
  { d: "M528 262 C 542 280 556 296 566 314", w: 4, g: 1 },
];

type Dot = { x: number; y: number; r: number; fill: string; o: number; g: 0 | 1 };
type Flower = { x: number; y: number; s: number; rot: number; g: 0 | 1 };

const { dots, flowers } = (() => {
  const rand = rng(1907);
  const dots: Dot[] = [];
  const flowers: Flower[] = [];
  for (const c of CLUSTERS) {
    const n = Math.round(c.n * 1.9);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = c.r * Math.sqrt(rand());
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d * 0.8;
      const centre = 1 - d / c.r;
      // underside of each cloud is a deeper pink, top is paler → gives volume
      const shade = Math.min(4, Math.max(0, Math.round(1.6 + (y - c.y) / (c.r * 0.45) + (rand() - 0.5) * 1.6)));
      dots.push({ x, y, r: 3.5 + centre * 8 + rand() * 5, fill: PINKS[shade], o: 0.55 + rand() * 0.35, g: c.g });
    }
    // light flecks on top give the blossom cloud a soft, petal-y texture
    for (let i = 0; i < Math.round(c.n * 0.6); i++) {
      const a = rand() * Math.PI * 2;
      const d = c.r * Math.sqrt(rand()) * 0.95;
      dots.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8 - 3, r: 1.6 + rand() * 2.4, fill: rand() < 0.5 ? "#FFF3F6" : PINKS[0], o: 0.8, g: c.g });
    }
    for (let k = 0; k < 2; k++) {
      const a = rand() * Math.PI * 2;
      const d = c.r * (0.55 + rand() * 0.45);
      flowers.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8, s: 0.6 + rand() * 0.4, rot: rand() * 72, g: c.g });
    }
  }
  return { dots, flowers };
})();

function Blossom({ f }: { f: Flower }) {
  return (
    <g transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.rot.toFixed(1)}) scale(${f.s.toFixed(2)})`}>
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={r} transform={`rotate(${r})`} d="M0 0 C -5 -3 -6 -10 -2 -12.5 L 0 -10.8 L 2 -12.5 C 6 -10 5 -3 0 0Z" fill="url(#petalGrad)" />
      ))}
      <circle r="2.2" fill="#D9577F" />
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <circle key={r} cx={Math.cos((r * Math.PI) / 180) * 3.6} cy={Math.sin((r * Math.PI) / 180) * 3.6} r="0.8" fill="#B8406A" />
      ))}
    </g>
  );
}

function Group({ g }: { g: 0 | 1 }) {
  return (
    <>
      {/* soft glow behind each cloud */}
      <g filter="url(#bloom)" opacity="0.75">
        {CLUSTERS.filter((c) => c.g === g).map((c, i) => <ellipse key={i} cx={c.x} cy={c.y} rx={c.r * 1.12} ry={c.r * 0.92} fill="#F4B3C7" />)}
      </g>
      {BRANCHES.filter((b) => b.g === g).map((b, i) => (
        <path key={i} d={b.d} stroke="url(#barkGrad)" strokeWidth={b.w} strokeLinecap="round" fill="none" />
      ))}
      <g>
        {dots.filter((d) => d.g === g).map((d, i) => <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(1)} fill={d.fill} opacity={d.o.toFixed(2)} />)}
      </g>
      {flowers.filter((f) => f.g === g).map((f, i) => <Blossom key={i} f={f} />)}
    </>
  );
}

export default function SakuraCanopy({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 640 420" aria-hidden className={`pointer-events-none select-none ${className}`}
      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: "100% 0%" }}
    >
      <defs>
        <linearGradient id="barkGrad" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E2224" />
          <stop offset="1" stopColor="#5A4146" />
        </linearGradient>
        <radialGradient id="petalGrad" cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#FFF4F7" />
          <stop offset="1" stopColor="#F7B8CB" />
        </radialGradient>
        <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>

      {/* long top reach: slow, gentle sway */}
      <motion.g style={{ transformOrigin: "640px 0px" }}
        animate={{ rotate: [0, 0.9, 0, -0.6, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}>
        <Group g={0} />
      </motion.g>
      {/* hanging right side: a little quicker and wider */}
      <motion.g style={{ transformOrigin: "612px 20px" }}
        animate={{ rotate: [0, -1.4, 0, 1.1, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
        <Group g={1} />
      </motion.g>
    </motion.svg>
  );
}
