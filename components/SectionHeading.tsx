import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function SectionHeading({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h-display mt-3 text-[30px] leading-[1.1] sm:text-4xl md:text-5xl">{title}</h2>
      {sub && <p className="mt-3 text-base text-sumi-500 md:mt-4 md:text-lg">{sub}</p>}
    </Reveal>
  );
}
