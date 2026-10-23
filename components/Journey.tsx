import { JOURNEY } from "@/lib/ui/content";
import Reveal from "./Reveal";
import Tilt from "./motion/Tilt";
import SectionHeading from "./SectionHeading";

// Colourful bento "N easy steps" layout — a recurring Saaspo how-it-works pattern.
export default function Journey() {
  return (
    <section id="how" className="py-24 md:py-32">
      <div className="container">
        <SectionHeading center eyebrow="03 · One intervention" title="A trust layer across the whole journey" sub="From the first Instagram reel in Ahmedabad to the souvenir you buy again back home." />
        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {JOURNEY.map((j, i) => (
            <Reveal key={j.title} delay={i * 0.07} className={i === 0 || i === 3 ? "md:col-span-4" : "md:col-span-2"}>
            <Tilt max={5} className={`${j.color} group h-full overflow-hidden rounded-3xl p-8 min-h-[240px] flex flex-col`}>
              <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${j.accent}`}>{String(i + 1).padStart(2, "0")} · {j.stage}</span>
              <h3 className="mt-auto pt-10 font-serif text-3xl leading-tight">{j.title}</h3>
              <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${j.accent}`}>{j.body}</p>
              <span className="absolute -right-3 -top-6 font-serif text-[140px] leading-none opacity-10 transition-transform duration-500 group-hover:-translate-x-2 group-hover:translate-y-2 group-hover:scale-110" aria-hidden>{i + 1}</span>
            </Tilt>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Food", "Solved through trust, not new restaurants. The supply already exists."],
            ["Language", "The scanner reads Japanese; the chef card speaks politely for you."],
            ["Information", "A new, emotional story Indian families will share."],
            ["Cost, no discount", "Higher perceived value: a heritage experience Thailand can’t offer."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-washi-300 p-5">
              <p className="text-sm font-semibold text-moss">{t}</p>
              <p className="mt-1 text-sm text-sumi-500">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
