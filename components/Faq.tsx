"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FAQ } from "@/lib/ui/content";
import SectionHeading from "./SectionHeading";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-16 md:py-28">
      <div className="container grid gap-6 md:gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow="Questions" title="What families ask first" />
        <div className="divide-y divide-washi-300 border-y border-washi-300">
          {FAQ.map((f, i) => (
            <div key={f.q}>
              <button className="flex w-full items-center justify-between gap-6 py-5 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="font-serif text-lg text-ai-600 md:text-xl">{f.q}</span>
                <Plus className={`shrink-0 text-shu transition-transform ${open === i ? "rotate-45" : ""}`} />
              </button>
              <div className={`grid transition-all duration-300 ${open === i ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"}`}>
                <p className="overflow-hidden text-[15px] text-sumi-500 md:text-base">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
