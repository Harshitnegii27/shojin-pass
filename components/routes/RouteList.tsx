"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import type { RouteSummary } from "@/lib/ui/stage5";
import RouteCard from "./RouteCard";

const FILTERS = ["All", "Kyoto", "Koyasan", "1 day", "Multi-day"] as const;

// initial: the routes rendered on the server (no diet yet); the diet check (fitsDiet) comes from
// GET /api/routes?preset= through shojinClient. exclude / showFilters: for "More routes".
export default function RouteList({ initial, exclude, showFilters = true }: { initial: RouteSummary[]; exclude?: string; showFilters?: boolean }) {
  const { client } = useShojin();
  const { diet } = useDiet();
  const [routes, setRoutes] = useState(initial);
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    let live = true;
    client.routes({ preset: diet }).then((r) => { if (live && r.ok) setRoutes((r.data as { routes: RouteSummary[] }).routes); });
    return () => { live = false; };
  }, [client, diet]);

  const list = routes.filter((r) => r.slug !== exclude).filter((r) =>
    f === "All" ? true : f === "1 day" ? r.days === 1 : f === "Multi-day" ? r.days > 1 : r.city === f);
  return (
    <>
      {showFilters && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter routes">
          {FILTERS.map((x) => (
            <button key={x} role="tab" aria-selected={f === x} onClick={() => setF(x)}
              className={`relative rounded-full border px-4 py-2 text-sm font-medium transition-colors ${f === x ? "border-ai-600 text-white" : "border-washi-300 text-sumi-500 hover:border-ai-400"}`}>
              {f === x && <motion.span layoutId="route-filter" className="absolute inset-0 rounded-full bg-ai-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{x}</span>
            </button>
          ))}
        </div>
      )}
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
      {showFilters && list.length === 0 && <p className="mt-6 text-sm text-sumi-500">No sample routes match this filter.</p>}
    </>
  );
}
