import { MapPin } from "lucide-react";
import { ROUTE } from "@/lib/ui/content";
import Phone from "./Phone";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const REPLIES = [
  { jp: "かつおだしが入っています", en: "Contains bonito stock", cls: "bg-shu" },
  { jp: "抜いて作れます", en: "I can make it without", cls: "bg-amber" },
  { jp: "この料理は大丈夫です", en: "This dish is fine", cls: "bg-moss" },
];

export default function Routes() {
  return (
    <section id="routes" className="py-24 md:py-32">
      <div className="container grid items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="05 · Shojin Routes & Show the Chef"
            title={<>Curated days that make food <em className="text-shu">the reason to go.</em></>}
            sub="Premium, full-price itineraries through Kyoto’s Zen temples and Koyasan’s temple lodgings — every stop checked against your profile. And a polite two-way card for the moment you sit down."
          />
          <Reveal className="mt-8 flex flex-wrap gap-2">
            {["Kyoto · 1 day", "Koyasan temple stay", "Diwali break route", "Cherry blossom route", "Printable card for elders"].map((t) => (
              <span key={t} className="chip"><MapPin size={12} className="text-shu" /> {t}</span>
            ))}
          </Reveal>
          <Reveal className="mt-8 flex flex-wrap gap-3">
            <a href="/routes" className="btn-primary">Browse all routes</a>
            <a href="/chef-card" className="btn-ghost">Make your chef card</a>
          </Reveal>
        </div>

        <Reveal className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-start">
          <Phone title="Shojin Route" subtitle="Kyoto · 1 day · Jain (strict)">
            <ol className="space-y-3">
              {ROUTE.map((r) => (
                <li key={r.time} className="border-l-[3px] border-moss pl-3">
                  <p className="text-[13px] font-semibold text-ai-600">{r.time} · {r.title}</p>
                  <p className="text-[11px] text-sumi-400">{r.place}{r.tag && <> · <span className="text-moss">✓ {r.tag}</span></>}</p>
                </li>
              ))}
            </ol>
            <button className="mt-5 w-full rounded-lg bg-moss py-2.5 text-sm font-semibold text-white">Book this route</button>
            <p className="mt-2 text-[11px] text-sumi-400">Premium, full price. Commission shared with partners.</p>
          </Phone>
          <Phone title="Show the Chef" subtitle="Two-way card · omotenashi mode" className="sm:mt-16">
            <div className="rounded-lg border-2 border-ai-600 p-3 font-jp text-[12px] leading-relaxed">
              申し訳ありませんが、私はジャイナ教の菜食主義者です。肉・魚・卵・かつおだし・玉ねぎ・にんにく・根菜類は食べられません。
            </div>
            <p className="mt-3 text-[11px] font-semibold text-sumi">Chef taps a reply:</p>
            <div className="mt-2 space-y-2">
              {REPLIES.map((r) => (
                <div key={r.en} className={`${r.cls} rounded-lg px-3 py-2 text-white`}>
                  <p className="font-jp text-[12px] font-semibold">{r.jp}</p>
                  <p className="text-[10px] text-white/80">{r.en}</p>
                </div>
              ))}
            </div>
          </Phone>
        </Reveal>
      </div>
    </section>
  );
}
