"use client";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Respect the OS "reduce motion" setting for every framer-motion animation on the site.
export default function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
