"use client";
import { ChevronDown, Leaf } from "lucide-react";
import { DIET_ORDER, DIET_PROFILES, type Diet } from "@/lib/ui/diets";
import { useDiet } from "@/lib/ui/diet-context";

export default function DietSelect({ className = "" }: { className?: string }) {
  const { diet, setDiet } = useDiet();
  return (
    <label className={`relative inline-flex items-center gap-2 rounded-full border border-ai-600/15 bg-washi-50 py-2 pl-3 pr-8 text-sm text-ai-600 ${className}`}>
      <Leaf size={15} className="text-moss" aria-hidden />
      <span className="sr-only">My diet</span>
      <select value={diet} onChange={(e) => setDiet(e.target.value as Diet)} className="appearance-none bg-transparent font-medium focus:outline-none">
        {DIET_ORDER.map((d) => <option key={d} value={d}>{DIET_PROFILES[d].label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3" aria-hidden />
    </label>
  );
}
