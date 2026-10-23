"use client";
import { motion } from "framer-motion";

// Reveals a line word-by-word, rising from below a mask.
// `strikeAt` (seconds) then draws a vermilion strike through each word in turn.
export default function SplitWords({ text, className = "", delay = 0, strikeAt }: { text: string; className?: string; delay?: number; strikeAt?: number }) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="relative inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className="relative inline-block" initial={{ y: "110%" }} animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
            {w}
            {strikeAt !== undefined && (
              <motion.span className="absolute left-0 right-0 top-[52%] h-[3px] origin-left rounded bg-shu"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.25, delay: strikeAt + i * 0.09, ease: "easeOut" }} />
            )}
          </motion.span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}
