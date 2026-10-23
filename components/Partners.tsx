import { PARTNERS } from "@/lib/ui/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const MODEL = ["Sponsored routes from tourism bodies", "Commission on route bookings", "Venue certification fee", "Brand “Veg-OK” programme", "White-label licence for airlines", "“Indian Taste Index” for food brands"];

export default function Partners() {
  return (
    <section id="partners" className="border-y border-washi-300 bg-washi-50 py-24 md:py-32">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div className="min-w-0">
            <SectionHeading eyebrow="06 · Who implements it" title={<>Free for travellers. <span className="text-shu">Paid by those who gain.</span></>} sub="No discounts anywhere. Travellers pay full price for experiences and get confidence for free." />
            {/* Infinite marquee of revenue lines (Saaspo "logos" strip pattern) */}
            <div className="relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
              <div className="flex w-max animate-marquee gap-2">
                {[...MODEL, ...MODEL].map((m, i) => <span key={i} className="chip whitespace-nowrap">{m}</span>)}
              </div>
            </div>
            <a href="/partners" className="btn-ghost mt-8">Become a partner venue →</a>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-washi-300 bg-washi-300 sm:grid-cols-2">
            {PARTNERS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.04} className="bg-washi-50 p-6">
                <p className="font-serif text-xl text-ai-600">{p.name}</p>
                <p className="mt-1 text-sm text-sumi-500">{p.role}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["Months 0–3", "Build & certify", "Rulebook to 500+ terms. Certify 30 Kyoto venues. Design 5 Shojin Routes."],
            ["Months 3–6", "Launch in India", "Campaign in Ahmedabad, Mumbai and Bengaluru. Season-matched routes."],
            ["Months 6–12", "Measure & scale", "Prove uplift, then add Tokyo, Osaka, Koyasan and airline integration."],
          ].map(([w, t, b], i) => (
            <Reveal key={w} delay={i * 0.08} className="card p-6">
              <p className="eyebrow">{w}</p>
              <p className="mt-2 font-serif text-2xl text-ai-600">{t}</p>
              <p className="mt-2 text-sm text-sumi-500">{b}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
