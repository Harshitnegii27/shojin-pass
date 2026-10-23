"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntro } from "@/lib/ui/intro-context";
import SakuraPetals from "./decor/SakuraPetals";

const KEY = "shojin-pass:intro-seen";
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Welcome intro: the 精 seal stamps onto the page with a welcoming line, then flies
 * into the logo spot in the top-left corner and the site appears underneath.
 * Plays once per browser tab; tap / click / any key skips it. Skipped for reduced motion.
 */
export default function Intro() {
  const { phase, setPhase } = useIntro();
  const sealRef = useRef<HTMLDivElement>(null);
  const flying = useRef(false);
  const [target, setTarget] = useState<{ x: number; y: number; scale: number } | null>(null);

  const fly = useCallback(() => {
    if (flying.current) return;
    flying.current = true;
    const to = document.getElementById("brand-seal")?.getBoundingClientRect();
    const from = sealRef.current?.getBoundingClientRect();
    if (to && from) {
      setTarget({
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.width / from.width,
      });
    }
    setPhase("fly");
    setTimeout(() => setPhase("done"), 950);
  }, [setPhase]);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) { setPhase("done"); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    window.scrollTo(0, 0);
    setPhase("intro");
    const t = setTimeout(fly, 3000);
    const onKey = () => fly();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [fly, setPhase]);

  if (phase === "done") return null;
  // Before JS decides, cover the page so nothing flashes.
  if (phase === "pending") return <div className="fixed inset-0 z-[100] bg-washi" aria-hidden />;

  const isFly = phase === "fly";

  return (
    <motion.div
      role="dialog" aria-label="Welcome to Shojin Pass"
      onClick={fly}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center px-6 text-center"
      initial={{ backgroundColor: "rgba(245,241,234,1)" }}
      animate={{ backgroundColor: isFly ? "rgba(245,241,234,0)" : "rgba(245,241,234,1)" }}
      transition={{ duration: 0.7, delay: isFly ? 0.15 : 0, ease: "easeInOut" }}
      style={{ pointerEvents: isFly ? "none" : "auto" }}
    >
      <motion.div className="bg-grid pointer-events-none absolute inset-0" animate={{ opacity: isFly ? 0 : 1 }} transition={{ duration: 0.4 }} />
      <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: isFly ? 0 : 1 }} transition={{ duration: isFly ? 0.4 : 1.2, delay: isFly ? 0 : 0.4 }}>
        <SakuraPetals density={0.7} origin="top" />
      </motion.div>

      {/* The seal */}
      <div className="relative">
        <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-shu"
          initial={{ scale: 1, opacity: 0 }} animate={isFly ? { opacity: 0 } : { scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 1, delay: 0.55, ease: "easeOut" }} />
        <motion.div
          ref={sealRef}
          className="relative grid h-24 w-24 place-items-center rounded-full border-[5px] border-shu bg-washi font-jp text-[42px] font-bold text-shu md:h-28 md:w-28 md:text-5xl"
          initial={{ scale: 2.6, opacity: 0, rotate: -35 }}
          animate={isFly && target ? { x: target.x, y: target.y, scale: target.scale, rotate: 0, opacity: 1 } : { scale: 1, opacity: 1, rotate: 0, x: 0, y: 0 }}
          transition={isFly ? { duration: 0.85, ease: [0.65, 0, 0.35, 1] } : { type: "spring", stiffness: 170, damping: 13, delay: 0.25 }}
        >
          精
        </motion.div>
      </div>

      {/* Welcome copy */}
      <AnimatePresence>
        {!isFly && (
          <motion.div key="copy" exit={{ opacity: 0, y: -12, filter: "blur(6px)" }} transition={{ duration: 0.35 }} className="relative mt-8">
            <p className="font-jp text-2xl text-shu md:text-3xl" aria-label="ようこそ">
              {"ようこそ".split("").map((c, i) => (
                <motion.span key={i} className="inline-block px-[0.2em]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + i * 0.1, ease: EASE }}>{c}</motion.span>
              ))}
            </p>
            <motion.h1 className="mt-3 font-serif text-[30px] leading-tight text-ai-600 sm:text-4xl md:text-5xl"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.35, ease: EASE }}>
              Welcome to Japan’s <em className="text-shu">vegetarian table.</em>
            </motion.h1>
            <motion.p className="mt-3 text-sm text-sumi-400 md:text-base"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.9 }}>
              Namaste · いらっしゃいませ
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {!isFly && (
        <motion.p className="absolute bottom-8 text-[11px] uppercase tracking-[0.25em] text-sumi-400"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          Tap to skip
        </motion.p>
      )}
    </motion.div>
  );
}
