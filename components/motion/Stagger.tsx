"use client";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const child: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const C = motion[as];
  return <C className={className} variants={parent} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>{children}</C>;
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const C = motion[as];
  return <C className={className} variants={child}>{children}</C>;
}
