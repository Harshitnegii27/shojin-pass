import Link from "next/link";
import Reveal from "./Reveal";
import PagodaFuji from "./decor/PagodaFuji";
import SakuraPetals from "./decor/SakuraPetals";

const FACTS = [
  ["No meat, fish or egg", "The temple kitchen rule for over 700 years."],
  ["Traditionally no onion or garlic", "A natural fit for Jain and sattvic diets."],
  ["Served where you’ll travel", "Kyoto’s Zen temples and Koyasan’s monasteries."],
];

export default function Insight() {
  return (
    <section className="grain relative overflow-hidden bg-ai-800 pb-56 pt-16 text-washi md:pb-64 md:pt-28">
      {/* Pink night glow (like sakura over still water), the pagoda + Fuji line drawing, and drifting petals */}
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-10%] h-[520px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(240,150,180,0.28),transparent)] blur-2xl" />
      <PagodaFuji className="absolute -bottom-2 right-0 w-full max-w-[720px] text-washi opacity-[0.22] md:right-[3%] md:w-[52%] md:opacity-[0.3]" />
      <SakuraPetals density={0.55} origin="top" glow />
      <div className="container relative z-10">
        <Reveal>
          <p className="eyebrow text-shu-100">Did you know?</p>
          <h2 className="mt-3 max-w-3xl font-serif text-3xl leading-[1.1] sm:text-4xl md:text-6xl">
            Japan already has its own <em className="text-shu-100">vegetarian tradition.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-base text-washi/70 md:mt-6 md:text-lg">
            <span className="font-jp">精進料理</span>, <b className="text-washi">shōjin ryōri</b>: the plant-based cuisine of Japan’s Buddhist temples.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-3 md:mt-12 md:grid-cols-3 md:gap-5">
          {FACTS.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.08} className="rounded-2xl border border-white/10 bg-ai-800/70 p-5 backdrop-blur-md md:p-6">
              <p className="font-serif text-xl md:text-2xl">{t}</p>
              <p className="mt-1 text-sm text-washi/60">{b}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8 md:mt-10">
          <Link href="/routes" className="btn bg-washi text-ai-800 hover:bg-white">Taste it on a Shojin Route →</Link>
        </Reveal>
      </div>
    </section>
  );
}
