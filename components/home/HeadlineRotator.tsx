"use client";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Rotating hero headline.
 * Each slide: the "myth" rises word by word → a red strike runs through it →
 * the answer arrives. Slides change with a 3D wheel turn, every HOLD_MS after
 * the answer has fully appeared. Hover pauses; the dots below jump to a slide.
 */
const SLIDES = [
  { myth: "What will we eat in Japan?", plain: "Itadakimasu.", em: "It’s all veg.", note: "Itadakimasu: Japanese for “let’s eat”" },
  { myth: "Japan has no veg food.", plain: "Japan has", em: "700 years of it." },
  { myth: "Veg food in Japan is hard.", plain: "Now it’s", em: "easy." },
];

const ENTER_S = 1.9;            // time for one slide to fully appear (seconds)
const HOLD_MS = 5000;           // how long it stays once fully shown
const CYCLE_MS = ENTER_S * 1000 + HOLD_MS;
const EASE = [0.22, 1, 0.36, 1] as const;

function Words({ text, delay, strikeAt }: { text: string; delay: number; strikeAt?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="relative inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span className="relative inline-block" initial={{ y: "110%" }} animate={{ y: 0 }}
            transition={{ duration: 0.65, delay: delay + i * 0.06, ease: EASE }}>
            {w}
            {strikeAt !== undefined && (
              <motion.span className="absolute left-0 right-0 top-[52%] h-[3px] origin-left rounded bg-shu"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.22, delay: strikeAt + i * 0.08, ease: "easeOut" }} />
            )}
          </motion.span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </>
  );
}

function Ring({ progress, active }: { progress: ReturnType<typeof useMotionValue<number>>; active: boolean }) {
  const offset = useTransform(progress, (p) => 1 - p);
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" className="text-washi-300" />
      {active && (
        <motion.circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className="text-shu" pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: offset }} />
      )}
      <circle cx="12" cy="12" r={active ? 3.2 : 2.6} className={active ? "fill-shu" : "fill-washi-300"} />
    </svg>
  );
}

export default function HeadlineRotator({ firstDelay = 0.15, className = "" }: { firstDelay?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0); // bumps on every change, so slides re-animate even when revisited
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // One rAF clock drives both the timer and the circular progress ring.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    elapsed.current = 0;
    progress.set(0);
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current && !document.hidden) {
        elapsed.current += dt;
        progress.set(Math.min(1, elapsed.current / CYCLE_MS));
        if (elapsed.current >= CYCLE_MS) {
          setIndex((i) => (i + 1) % SLIDES.length);
          setRound((r) => r + 1);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [round, progress]);

  const go = (i: number) => { setIndex(i); setRound((r) => r + 1); };
  const s = SLIDES[index];
  const d = round === 0 ? firstDelay : 0; // first slide waits for the hero intro

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <h1 className={className}>
      {/* Screen readers get one steady sentence instead of a moving one */}
      <span className="sr-only">With Shojin Pass, vegetarian food in Japan is easy.</span>

      <div aria-hidden className="relative min-h-[3.9em] [perspective:900px] sm:min-h-[3.55em]">
        <AnimatePresence mode="wait" initial={true}>
          <motion.div
            key={round}
            className="origin-[50%_50%_-0.6em] [transform-style:preserve-3d]"
            initial={{ rotateX: round === 0 ? 0 : -80, opacity: round === 0 ? 1 : 0, y: round === 0 ? 0 : 24, filter: "blur(0px)" }}
            animate={{ rotateX: 0, opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ rotateX: 80, opacity: 0, y: -24, filter: "blur(6px)", transition: { duration: 0.4, ease: [0.55, 0, 0.75, 0.2] } }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* The myth: rises, gets struck, then steps back */}
            <motion.span className="block text-[0.62em] leading-[1.18] text-sumi-400"
              initial={{ opacity: 1 }} animate={{ opacity: 0.6 }} transition={{ delay: d + 1.35, duration: 0.5 }}>
              <Words text={s.myth} delay={d} strikeAt={d + 0.75} />
            </motion.span>

            {/* The answer */}
            <span className="mt-2 block">
              <Words text={s.plain} delay={d + 1.15} />
              &nbsp;
              <motion.em className="inline-block font-medium italic text-shu"
                initial={{ opacity: 0, y: 26, rotate: -3, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, rotate: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: d + 1.35, ease: EASE }}>
                {s.em}
              </motion.em>
            </span>

            {s.note && (
              <motion.span className="mt-2 block font-sans text-[0.22em] font-normal tracking-normal text-sumi-400 sm:text-[0.2em]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 1.9, duration: 0.5 }}>
                {s.note}
              </motion.span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </h1>

      {/* Circular progress dots */}
      <div className="mt-3 flex items-center gap-1.5 font-sans" role="tablist" aria-label="Headline">
        {SLIDES.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === index} aria-label={`Show line ${i + 1}`} onClick={() => go(i)}
            className="rounded-full p-0.5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shu">
            <Ring progress={progress} active={i === index} />
          </button>
        ))}
        {paused && <span className="ml-1 text-[11px] uppercase tracking-wider text-sumi-400">Paused</span>}
      </div>
    </div>
  );
}
