"use client";
import { motion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import { COMPARE } from "@/lib/ui/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const Cell = ({ v, pop, delay = 0 }: { v: string; pop?: boolean; delay?: number }) =>
  pop && v === "yes" ? (
    <motion.span className="inline-flex w-full justify-center" initial={{ scale: 0, rotate: -45 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 300, damping: 12, delay }}>
      <Check className="text-moss" size={22} strokeWidth={3} />
    </motion.span>
  ) :
  v === "yes" ? <Check className="mx-auto text-moss" size={20} /> : v === "no" ? <X className="mx-auto text-shu/70" size={18} /> : <Minus className="mx-auto text-amber" size={18} />;

export default function Compare() {
  return (
    <section className="pb-24 md:pb-32">
      <div className="container">
        <SectionHeading center eyebrow="Why it’s different" title="Translators translate. We judge — and explain." />
        <Reveal className="card mx-auto mt-12 max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-washi-300 text-xs uppercase tracking-wider text-sumi-400">
                <th className="p-5 text-left font-semibold">Capability</th>
                {COMPARE.cols.map((c, i) => (
                  <th key={c} className={`p-5 font-semibold ${i === 2 ? "bg-ai-600 text-white" : ""}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.rows.map((r, ri) => (
                <motion.tr key={r.label} className="border-b border-washi-200 last:border-0" initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: ri * 0.08 }}>
                  <td className="p-5 font-medium text-ai-600">{r.label}</td>
                  {r.v.map((v, i) => (
                    <td key={i} className={`p-5 ${i === 2 ? "bg-ai-50" : ""}`}><Cell v={v} pop={i === 2} delay={0.3 + ri * 0.08} /></td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}
