import { BARRIERS } from "@/lib/ui/content";
import Reveal from "./Reveal";
import GrowBar from "./motion/GrowBar";
import SectionHeading from "./SectionHeading";

const BARS = [
  { name: "Thailand", v: 1.48 },
  { name: "Singapore", v: 1.38 },
  { name: "UK", v: 1.27 },
  { name: "Japan", v: 0.23, hl: true },
];

export default function Problem() {
  return (
    <section id="problem" className="py-24 md:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="01 · The barrier"
          title={<>Indians travel abroad in record numbers. <span className="text-shu">Very few choose Japan.</span></>}
          sub="30.8 million outbound trips in 2024. Japan received fewer than 1 in 100. Distance and price don’t explain it — trust does."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="card p-7">
            <p className="font-semibold text-ai-600">Indian visitors per destination, 2024</p>
            <div className="mt-6 space-y-4">
              {BARS.map((b, i) => (
                <div key={b.name} className="grid grid-cols-[84px_1fr] items-center gap-3 text-sm">
                  <span className={b.hl ? "font-semibold text-shu" : "text-sumi-500"}>{b.name}</span>
                  <div className="flex items-center gap-2">
                    <GrowBar delay={i * 0.12} width={`${(b.v / 1.48) * 82}%`} className={`h-7 rounded-md ${b.hl ? "bg-shu" : "bg-ai-400"}`} />
                    <span className="font-semibold tabular-nums">{b.v} M</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-sumi-400">India Tourism Data Compendium 2025; Japan: JNTO.</p>
            <blockquote className="mt-8 border-l-2 border-shu pl-4 font-serif text-xl italic text-ai-600">
              “Japan is beautiful, but what will we eat? Everything has fish in it.”
            </blockquote>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {BARRIERS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.06} className="card flex flex-col p-6">
                <p className="font-serif text-2xl text-ai-600">{b.title}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-sumi-500">{b.body}</p>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-sumi-400">Does a discount fix it?</p>
                <p className={`mt-1 text-sm font-semibold ${b.tone === "shu" ? "text-shu" : "text-amber"}`}>{b.fix}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
