import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function PageHeader({ eyebrow, title, sub, jp, children }: { eyebrow: string; title: ReactNode; sub?: string; jp?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-6 pt-24 md:pb-14 md:pt-40">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      {jp && <div className="pointer-events-none absolute -right-6 top-16 hidden select-none font-jp text-[150px] leading-none text-ai-600/[0.05] sm:block md:text-[220px]" aria-hidden>{jp}</div>}
      <div className="container relative">
        <Reveal className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="h-display mt-2 text-[32px] leading-[1.08] sm:text-5xl md:mt-4 md:text-6xl">{title}</h1>
          {sub && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-sumi-500 md:mt-5 md:text-lg">{sub}</p>}
          {children}
        </Reveal>
      </div>
    </section>
  );
}
