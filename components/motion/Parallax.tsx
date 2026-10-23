"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

// Moves its children vertically by `distance` px across the time it's on screen.
export default function Parallax({ children, className, distance = 120 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance / 2, distance / 2]);
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}
