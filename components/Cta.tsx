"use client";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Cta() {
  const [done, setDone] = useState(false);
  return (
    <section id="cta" className="pb-16 md:pb-28">
      <div className="container">
        <div className="grain relative overflow-hidden rounded-[2rem] bg-shu px-5 py-12 text-center text-white md:px-16 md:py-24">
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border-[40px] border-white/10" aria-hidden />
          <div className="pointer-events-none absolute -right-10 -top-10 font-jp text-[200px] leading-none text-white/10" aria-hidden>信</div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Kyoto pilot · first 90 days</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-serif text-[30px] leading-tight sm:text-4xl md:text-6xl">Your family can eat in Japan. <em>Let us prove it.</em></h2>
          <p className="mx-auto mt-5 max-w-xl text-white/80">Join the early-access list for the scanner and the first five Shojin Routes.</p>
          {done ? (
            <p className="mt-8 font-serif text-2xl">ありがとう — we’ll be in touch.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              <label htmlFor="email" className="sr-only">Email</label>
              <input id="email" type="email" required placeholder="you@family.in" className="flex-1 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-white placeholder:text-white/60 focus:border-white focus:outline-none" />
              <button className="btn whitespace-nowrap bg-white text-shu hover:bg-washi">Get early access <ArrowRight size={16} /></button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
