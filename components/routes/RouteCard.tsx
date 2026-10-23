"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, Clock } from "lucide-react";
import type { RouteT } from "@/lib/ui/site-data";
import { useDiet } from "@/lib/ui/diet-context";
import { DIET_PROFILES } from "@/lib/ui/diets";

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function RouteCard({ r }: { r: RouteT }) {
  const { diet } = useDiet();
  const fits = r.suits.includes(diet);
  return (
    <Link href={`/routes/${r.slug}`} className="card group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:shadow-float">
      <div className={`${r.color} relative h-40 overflow-hidden p-6 text-white`}>
        <p className="font-jp text-sm text-white/80">{r.jp}</p>
        <p className="absolute -bottom-6 -right-2 font-jp text-[110px] leading-none text-white/10 transition-transform duration-700 group-hover:-translate-x-6 group-hover:scale-110" aria-hidden>{r.jp.slice(0, 2)}</p>
        <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">{r.city}</span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-2xl text-ai-600">{r.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-sumi-500">{r.blurb}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sumi-400">
          <span className="flex items-center gap-1"><Clock size={13} /> {r.days} day{r.days > 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><CalendarDays size={13} /> {r.season.join(", ")}</span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-washi-200 pt-4">
          <span className={`flex items-center gap-1 text-xs font-semibold ${fits ? "text-moss" : "text-amber"}`}>
            {fits ? <><Check size={14} /> Fits {DIET_PROFILES[diet].label}</> : <>Needs adjusting for {DIET_PROFILES[diet].label}</>}
          </span>
          <span className="flex items-center gap-1 font-semibold text-ai-600">from {inr(r.priceINR)} <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}
