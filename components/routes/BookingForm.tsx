"use client";
import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { DIET_ORDER, DIET_PROFILES, type Diet } from "@/lib/ui/diets";
import { inr } from "./RouteCard";

export default function BookingForm({ title, price }: { title: string; price: number }) {
  const { diet, setDiet } = useDiet();
  const [people, setPeople] = useState(4);
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-moss text-white"><Check /></div>
        <p className="mt-4 font-serif text-2xl text-ai-600">Request noted (demo)</p>
        <p className="mt-2 text-sm text-sumi-500">We’ll confirm {title} for {people} traveller{people > 1 ? "s" : ""} ({DIET_PROFILES[diet].label}) and share the partner menus before you pay.</p>
      </div>
    );

  return (
    <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="card space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sumi-400">From</p>
        <p className="font-serif text-4xl text-ai-600">{inr(price)}<span className="text-base text-sumi-400"> / person</span></p>
      </div>
      <label className="block text-sm font-medium text-ai-600">Date
        <input required type="date" className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
      </label>
      <div className="text-sm font-medium text-ai-600">Travellers
        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-washi-300 bg-white px-2 py-1.5">
          <button type="button" aria-label="Fewer" onClick={() => setPeople(Math.max(1, people - 1))} className="rounded-lg p-2 hover:bg-washi-100"><Minus size={16} /></button>
          <span className="text-lg font-semibold">{people}</span>
          <button type="button" aria-label="More" onClick={() => setPeople(Math.min(12, people + 1))} className="rounded-lg p-2 hover:bg-washi-100"><Plus size={16} /></button>
        </div>
      </div>
      <label className="block text-sm font-medium text-ai-600">Dietary profile
        <select value={diet} onChange={(e) => setDiet(e.target.value as Diet)} className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none">
          {DIET_ORDER.map((d) => <option key={d} value={d}>{DIET_PROFILES[d].label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-ai-600">Email
        <input required type="email" placeholder="you@family.in" className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
      </label>
      <div className="flex justify-between border-t border-washi-200 pt-4 text-sm"><span className="text-sumi-500">Estimated total</span><span className="font-semibold text-ai-600">{inr(price * people)}</span></div>
      <button className="btn-primary w-full">Request this route</button>
      <p className="text-center text-xs text-sumi-400">No payment now. Menus are confirmed with each venue first.</p>
      {/* stage 5+: bookings are a pilot endpoint (spec 13.3); nothing is sent yet. */}
      <p className="text-center text-xs text-amber">Demo: this request is not sent anywhere yet.</p>
    </form>
  );
}
