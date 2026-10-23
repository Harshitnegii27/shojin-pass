"use client";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";
import type { Stop } from "@/lib/ui/site-data";

// The vertical line draws itself as you scroll; each stop's dot pops and its text slides in.
export default function Timeline({ stops }: { stops: Stop[] }) {
  return (
    <div className="relative mt-8 pl-8">
      <motion.span aria-hidden className="absolute left-0 top-1 w-0.5 origin-top bg-washi-300" style={{ bottom: 0 }}
        initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
      <ol className="space-y-6">
        {stops.map((s, i) => (
          <motion.li key={s.time + s.title} className="relative"
            initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
            <motion.span className={`absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-washi ${s.food ? "bg-moss" : "bg-ai-400"}`}
              initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.15 + i * 0.12 }} />
            <p className="text-xs font-semibold uppercase tracking-wider text-shu">{s.time}</p>
            <p className="mt-1 font-serif text-2xl text-ai-600">{s.title}</p>
            <p className="text-sumi-500">{s.place}</p>
            {s.note && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1 text-xs font-semibold text-moss"><UtensilsCrossed size={12} /> {s.note}</p>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
