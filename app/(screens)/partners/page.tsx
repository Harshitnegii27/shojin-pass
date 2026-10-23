import type { Metadata } from "next";
import { Building2, Plane, Store, Landmark, Megaphone, Ticket } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import CertifyForm from "@/components/partners/CertifyForm";
import InsightsPanel from "@/components/partners/InsightsPanel";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "For partners", description: "Earn the Shojin Pass mark and welcome high-value Indian guests — without discounts." };

const PARTNERS = [
  { Icon: Megaphone, name: "Hakuhodo", role: "Owns the “Sattvic Japan” story and runs the India campaign with creators and Jain community groups." },
  { Icon: Landmark, name: "JNTO & prefectures", role: "Co-fund Shojin Routes and promote them at India roadshows and travel fairs." },
  { Icon: Plane, name: "Airlines", role: "Use the same dietary profile for in-flight meals and offer Shojin Pass in-app." },
  { Icon: Building2, name: "Temples, restaurants & ryokans", role: "Earn the mark through the 10-point checklist. Gain Indian guests at full price." },
  { Icon: Store, name: "Konbini & food brands", role: "“Veg-OK” shelf tags in Japan; sell the products travellers scanned back in India." },
  { Icon: Ticket, name: "Indian travel agents & OTAs", role: "Sell Shojin Routes as premium packages." },
];

export default function PartnersPage() {
  return (
    <>
      <PageHeader eyebrow="For partners" jp="提携" title={<>Indian guests, at full price. <em className="text-shu">No discounts.</em></>}
        sub="Every visitor from India spends about ¥249,807. Shojin Pass removes the one thing stopping vegetarian families from coming: trust in the food." />

      <section className="pb-20">
        <div className="container"><div className="grid gap-px overflow-hidden rounded-3xl border border-washi-300 bg-washi-300 md:grid-cols-2 lg:grid-cols-3">
          {PARTNERS.map(({ Icon, name, role }, i) => (
            <Reveal key={name} delay={i * 0.04} className="bg-washi-50 p-7">
              <Icon className="text-shu" size={22} />
              <p className="mt-4 font-serif text-2xl text-ai-600">{name}</p>
              <p className="mt-2 text-sm text-sumi-500">{role}</p>
            </Reveal>
          ))}
        </div></div>
      </section>

      <section className="pb-20" id="insights">
        <div className="container"><InsightsPanel /></div>
      </section>

      <section className="bg-washi-200/50 py-20" id="certify">
        <div className="container"><CertifyForm /></div>
      </section>

      <section className="py-20">
        <div className="container grid gap-4 md:grid-cols-3">
          {[["Months 0–3", "Build & certify", "Rulebook to 500+ terms. Certify 30 Kyoto venues. Design 5 Shojin Routes."],
            ["Months 3–6", "Launch in India", "Campaign in Ahmedabad, Mumbai and Bengaluru. Season-matched routes."],
            ["Months 6–12", "Measure & scale", "Prove uplift, then add Tokyo, Osaka, Koyasan and airline integration."]].map(([w, t, b]) => (
            <div key={w} className="card p-6"><p className="eyebrow">{w}</p><p className="mt-2 font-serif text-2xl text-ai-600">{t}</p><p className="mt-2 text-sm text-sumi-500">{b}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
