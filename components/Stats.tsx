"use client";
import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { STATS } from "@/lib/ui/content";
import { Stagger, StaggerItem } from "./motion/Stagger";

function Counter({ to, decimals = 0, prefix, suffix }: { to: number; decimals?: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{prefix}{v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

export default function Stats() {
  return (
    <section className="relative bg-ai-600 text-washi">
      <Stagger className="container grid gap-px overflow-hidden py-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <StaggerItem key={s.label} className="border-l-2 border-shu px-6 py-8">
            <p className="font-serif text-4xl md:text-5xl"><Counter to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} /></p>
            <p className="mt-2 text-sm text-washi/70">{s.label}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
