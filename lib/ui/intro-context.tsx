"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

// pending → (intro → fly) → done.  "ready" = page content may start animating.
export type IntroPhase = "pending" | "intro" | "fly" | "done";
type Ctx = { phase: IntroPhase; setPhase: (p: IntroPhase) => void; ready: boolean };
const IntroCtx = createContext<Ctx>({ phase: "done", setPhase: () => {}, ready: true });

export function IntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>("pending");
  return <IntroCtx.Provider value={{ phase, setPhase, ready: phase === "fly" || phase === "done" }}>{children}</IntroCtx.Provider>;
}

export const useIntro = () => useContext(IntroCtx);
