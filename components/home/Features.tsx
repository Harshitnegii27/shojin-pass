"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, MessageSquareText, Route as RouteIcon, ScanLine } from "lucide-react";
import SectionHeading from "../SectionHeading";
import Tilt from "../motion/Tilt";

const CARDS = [
  { href: "/scanner", Icon: ScanLine, title: "Trust Scanner", body: "Is there fish stock, egg or onion hiding in it? Know before you bite.", cls: "bg-shu text-white", sub: "text-white/75", big: true,
    demo: (
      <div className="mt-6 rounded-xl bg-white/95 p-3 text-left text-sumi shadow-float">
        <p className="font-jp text-xs leading-relaxed">原材料：野菜、しょうゆ、<mark className="rounded bg-shu-100 px-0.5 text-shu">かつお節エキス</mark>、ごま油</p>
        <p className="mt-2 rounded-lg bg-shu px-3 py-1.5 text-xs font-semibold text-white">✕ Not suitable · contains bonito fish extract</p>
      </div>
    ) },
  { href: "/chef-card", Icon: MessageSquareText, title: "Show the Chef", body: "Your diet in polite Japanese. The chef taps a reply you can read.", cls: "bg-ai-600 text-white", sub: "text-white/70" },
  { href: "/routes", Icon: RouteIcon, title: "Shojin Routes", body: "Temple-cuisine days in Kyoto and Koyasan, every meal pre-checked.", cls: "bg-moss text-white", sub: "text-white/75" },
  { href: "/venues", Icon: MapPin, title: "Partner venues", body: "Temples, restaurants and ryokans carrying the Shojin Pass mark.", cls: "bg-washi-50 text-ai-600 border border-washi-300", sub: "text-sumi-500" },
];

export default function Features() {
  return (
    <section className="pb-16 md:pb-24">
      <div className="container">
        <SectionHeading eyebrow="Everything you need" title={<>Built for Indian families <em className="text-shu">in Japan.</em></>} />
        <div className="mt-8 grid gap-4 md:mt-12 md:grid-cols-3 md:grid-rows-2 md:gap-5">
          {CARDS.map((c, i) => (
            <motion.div key={c.href} className={c.big ? "md:row-span-2" : i === 3 ? "md:col-span-2" : ""}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
              <Link href={c.href} className="block h-full">
                <Tilt max={5} className={`group flex h-full flex-col overflow-hidden rounded-3xl p-6 md:p-8 ${c.cls}`}>
                  <div className="flex items-start justify-between">
                    <c.Icon size={26} />
                    <ArrowUpRight size={22} className="opacity-60 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:opacity-100" />
                  </div>
                  <p className="mt-6 font-serif text-2xl md:mt-auto md:pt-10 md:text-3xl">{c.title}</p>
                  <p className={`mt-2 text-sm leading-relaxed md:text-[15px] ${c.sub}`}>{c.body}</p>
                  {c.demo}
                </Tilt>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
