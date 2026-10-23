import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "About", description: "Why we built Shojin Pass, and the team behind it." };

const TEAM = [
  { name: "Shubham Garg", role: "Team lead · Business model, partners, pitch & design", initial: "S" },
  { name: "Harshit Negi", role: "Scanner pipeline · OCR, rulebook matching, verdict logic", initial: "H" },
  { name: "Karmanjot Singh", role: "Web front end · profile, partner map, Shojin Routes", initial: "K" },
];

const METRICS = [
  ["Spend per visitor", "Above the ¥249,807 national baseline — with no discounts."],
  ["Family trips", "Share of trips with 3+ travellers, and business trips extended with family."],
  ["Scanner accuracy", "Target: 95%+ correct verdicts on held-out real labels, and zero confident false “safe”. Not measured yet."],
  ["Venue network", "Certified venues and Indian guests per venue. Pilot target: 30 in Kyoto."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About" jp="架け橋" title={<>A bridge between <em className="text-shu">two kitchens.</em></>}
        sub="Japan’s temples have cooked pure vegetarian food for centuries. India has hundreds of millions of vegetarians. The only thing missing between them was trust." />

      <section className="pb-20">
        <div className="container grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-serif text-3xl text-ai-600">Why this exists</h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-sumi-500">
              <p>Indians made 30.8 million trips abroad in 2024. Japan received fewer than 1 in 100 of them — 0.23 million, against 1.48 million for Thailand.</p>
              <p>Distance and price don’t explain the gap. Food does: 39% of Indian adults are vegetarian, and many avoid onion, garlic and root vegetables. On a Japanese label, hidden fish stock is invisible.</p>
              <p>So we didn’t build another translator. We built a trust layer — a scanner that judges food against Indian diet rules, a polite card for the chef, and curated routes through Japan’s own vegetarian tradition, <span className="font-jp">精進料理</span>.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="grain relative overflow-hidden rounded-3xl bg-ai-800 p-8 text-washi md:p-10">
            <p className="eyebrow text-shu-100">How we’ll know it worked</p>
            <ul className="mt-6 space-y-5">
              {METRICS.map(([t, b]) => (
                <li key={t} className="border-l-2 border-shu pl-4"><p className="font-serif text-xl">{t}</p><p className="mt-1 text-sm text-washi/70">{b}</p></li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-washi-300 bg-washi-50 py-20">
        <div className="container">
          <p className="eyebrow">Team Kakehashi · Thapar Institute</p>
          <h2 className="mt-3 font-serif text-4xl text-ai-600">The people building it</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TEAM.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="card p-7">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-shu font-serif text-2xl text-white">{t.initial}</div>
                <p className="mt-5 font-serif text-2xl text-ai-600">{t.name}</p>
                <p className="mt-1 text-sm text-sumi-500">{t.role}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-12 text-xs text-sumi-400">Sources: JNTO; Japan Tourism Agency; India Tourism Data Compendium 2025; Pew Research Center (2021); Embassy of Japan in India. Thapar Japan Hackathon 2026 · HAK-PS-01 (Hakuhodo).</p>
        </div>
      </section>
    </>
  );
}
