"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ROUTES } from "@/lib/ui/site-data";
import RouteCard from "./RouteCard";

const FILTERS = ["All", "Kyoto", "Koyasan", "1 day", "Multi-day"] as const;

export default function RouteList() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const list = ROUTES.filter((r) =>
    f === "All" ? true : f === "1 day" ? r.days === 1 : f === "Multi-day" ? r.days > 1 : r.city === f);
  return (
    <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter routes">
        {FILTERS.map((x) => (
          <button key={x} role="tab" aria-selected={f === x} onClick={() => setF(x)}
            className={`relative rounded-full border px-4 py-2 text-sm font-medium transition-colors ${f === x ? "border-ai-600 text-white" : "border-washi-300 text-sumi-500 hover:border-ai-400"}`}>
            {f === x && <motion.span layoutId="route-filter" className="absolute inset-0 rounded-full bg-ai-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">{x}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((r, i) => (
            <motion.div key={r.slug} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
              <RouteCard r={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
