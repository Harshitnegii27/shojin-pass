"use client";
import { motion } from "framer-motion";

export default function GrowBar({ width, className, delay = 0 }: { width: string; className: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ width: 0 }} whileInView={{ width }} viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }} />
  );
}
