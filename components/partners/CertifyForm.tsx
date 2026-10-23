"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import { CHECKLIST } from "@/lib/ui/site-data";

export default function CertifyForm() {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [sent, setSent] = useState(false);
  const score = checked.filter(Boolean).length;
  const ready = score >= 8;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card p-6 md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Self-assessment</p>
            <p className="mt-2 font-serif text-3xl text-ai-600">The 10-point checklist</p>
          </div>
          <p className="font-serif text-5xl text-shu">
            <AnimatePresence mode="popLayout">
              <motion.span key={score} className="inline-block" initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>{score}</motion.span>
            </AnimatePresence>
            <span className="text-xl text-sumi-400">/10</span>
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-washi-200"><div className={`h-full rounded-full transition-all ${ready ? "bg-moss" : "bg-shu"}`} style={{ width: `${score * 10}%`, transition: "width .5s cubic-bezier(.22,1,.36,1), background-color .3s" }} /></div>
        <ul className="mt-6 space-y-2">
          {CHECKLIST.map((c, i) => (
            <li key={c}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${checked[i] ? "border-moss/40 bg-moss-50" : "border-washi-300 hover:border-ai-400/40"}`}>
                <input type="checkbox" className="sr-only" checked={checked[i]} onChange={() => setChecked(checked.map((v, j) => (j === i ? !v : v)))} />
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${checked[i] ? "border-moss bg-moss text-white" : "border-washi-300"}`}>{checked[i] && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}><Check size={13} strokeWidth={3} /></motion.span>}</span>
                <span className="text-sumi">{i + 1}. {c}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {sent ? (
          <div className="card p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-moss text-white"><Check /></div>
            <p className="mt-4 font-serif text-2xl text-ai-600">ありがとうございます</p>
            <p className="mt-2 text-sm text-sumi-500">We’ll schedule a visit to review your kitchen against the checklist ({score}/10 today).</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="card space-y-4 p-6 md:p-8">
            <p className="font-serif text-2xl text-ai-600">Apply for the mark</p>
            <p className={`rounded-xl p-3 text-sm ${ready ? "bg-moss-50 text-moss" : "bg-amber-50 text-sumi-500"}`}>
              {ready ? "You look ready for certification." : "8 of 10 points are needed. We can help you close the gaps."}
            </p>
            {[["Venue name", "text", "e.g. Kawabe Yudōfu"], ["Contact email", "email", "owner@venue.jp"], ["City", "text", "Kyoto"]].map(([l, t, ph]) => (
              <label key={l} className="block text-sm font-medium text-ai-600">{l}
                <input required type={t} placeholder={ph} className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
              </label>
            ))}
            <label className="block text-sm font-medium text-ai-600">Venue type
              <select className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none">
                {["Temple", "Restaurant", "Ryokan", "Konbini / food brand"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <button className="btn-primary w-full">Request a certification visit</button>
            {/* Certification is a pilot feature (spec 15.4); nothing is sent yet. */}
            <p className="text-center text-xs text-amber">Demo: this request is not sent anywhere yet.</p>
          </form>
        )}
      </div>
    </div>
  );
}
