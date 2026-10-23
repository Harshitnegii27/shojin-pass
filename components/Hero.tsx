"use client";
import type { ReactNode } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Check, ScanLine, Star, Utensils } from "lucide-react";
import { useRef } from "react";
import Phone from "./Phone";
import { useIntro } from "@/lib/ui/intro-context";
import { SAMPLE_COUNTS } from "@/lib/ui/stage5";
import HeadlineRotator from "./home/HeadlineRotator";
import SakuraCanopy from "./decor/SakuraCanopy";
import SakuraPetals from "./decor/SakuraPetals";

const fade = (d: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } });

// Wait for the welcome intro, so the hero animations play where people can see them.
export default function Hero() {
  const { ready } = useIntro();
  if (!ready) return <section className="min-h-[100svh]" aria-hidden />;
  return <HeroInner />;
}

function HeroInner() {
  const ref = useRef<HTMLElement>(null);
  // Scroll parallax: layers move at different speeds as the hero scrolls away.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sunY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const kanjiY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Pointer tilt for the phone.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 18 });

  return (
    <section id="top" ref={ref} className="relative overflow-hidden pt-24 md:pt-36">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      {/* Sakura canopy over the rising sun, and petals drifting across the hero (behind the content) */}
      <SakuraCanopy className="absolute -right-6 top-14 w-[78vw] opacity-50 sm:w-[64vw] sm:opacity-80 lg:-right-4 lg:top-12 lg:w-[58vw] lg:max-w-[880px] lg:opacity-100" />
      <SakuraPetals />
      <div className="drift pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-shu/10 blur-3xl" aria-hidden />
      <div className="container relative grid items-center gap-10 pb-12 md:gap-16 md:pb-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
        {/* Copy */}
        <motion.div style={{ y: copyY, opacity: copyOpacity }}>
          <motion.p {...fade(0)} className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-shu" /> Kyoto pilot demo · {SAMPLE_COUNTS.venues} sample venues · {SAMPLE_COUNTS.routes} sample Shojin Routes
          </motion.p>

          <HeadlineRotator className="h-display mt-5 text-[38px] leading-[1.06] sm:text-6xl lg:text-7xl" />

          <p className="font-jp mt-3 text-xl text-shu md:mt-4 md:text-2xl" aria-label="精進パス">
            {"精進パス".split("").map((c, i) => (
              <motion.span key={i} className="inline-block pr-[0.3em]" initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.6 + i * 0.12, ease: "backOut" }}>{c}</motion.span>
            ))}
          </p>

          <motion.p {...fade(1.9)} className="mt-5 max-w-xl text-base leading-relaxed text-sumi-500 md:mt-6 md:text-lg">
            Japan already has a centuries-old vegetarian cuisine. Shojin Pass is the trust layer that lets Indian
            families find it — scan any label or menu and know, in two seconds, whether <strong className="text-ai-600">you</strong> can eat it.
          </motion.p>

          <motion.div {...fade(2.05)} className="mt-7 flex flex-wrap gap-3">
            <a href="/scanner" className="btn-primary"><ScanLine size={18} /> Try the scanner</a>
            <a href="/routes" className="btn-ghost">Explore Shojin Routes <ArrowRight size={16} /></a>
          </motion.div>

          <motion.ul {...fade(2.2)} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sumi-500">
            {["Built on Indian diet rules", "Strict & flexible Jain", "English · हिंदी · 日本語"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-moss" /> {t}</li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Visual: phone + floating cards (TravelPerk-style hero) */}
        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex h-[500px] w-full max-w-[480px] items-center justify-center [perspective:1000px] sm:h-[560px]"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width - 0.5);
            my.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => { mx.set(0); my.set(0); }}
        >
          {/* Rising sun: scales in like a hanko stamp, then drifts with scroll */}
          <motion.div style={{ y: sunY }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 60, damping: 12, delay: 0.5 }}
            className="absolute right-4 top-6 h-64 w-64 rounded-full bg-shu/90 md:right-0" aria-hidden />
          <motion.div style={{ y: kanjiY }} className="absolute -left-6 bottom-10 select-none font-jp text-[180px] leading-none text-ai-600/[0.06]" aria-hidden>精進</motion.div>

          <motion.div style={{ y: phoneY, rotateX: rotX, rotateY: rotY }} className="relative z-10 [transform-style:preserve-3d]">
          <Phone title="Trust Scanner" subtitle="Profile: Jain (strict) · Vegetarian" className="relative rotate-[-3deg]">
            <div className="relative overflow-hidden rounded-lg border border-dashed border-sumi-400/40 p-3 font-jp text-[12px] leading-relaxed">
              原材料名：野菜(キャベツ、<mark className="bg-shu-100 text-shu">人参</mark>)、しょうゆ、砂糖、
              <mark className="bg-shu-100 text-shu">かつお節エキス</mark>、<mark className="bg-shu-100 text-shu">玉ねぎ</mark>、ごま油
              <span className="absolute inset-x-0 h-0.5 animate-scan bg-shu/70 shadow-[0_0_12px_2px_rgba(194,67,47,.5)]" />
            </div>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.08, 1], opacity: 1 }} transition={{ duration: 0.6, delay: 2.4 }}
              className="mt-3 rounded-lg bg-shu px-3 py-2.5 text-sm font-semibold text-white">✕ Not suitable</motion.div>
            <div className="mt-3 space-y-1.5 text-[12px] text-sumi-500">
              <p><b className="font-jp text-sumi">かつお節エキス</b> = bonito (fish) extract.</p>
              <p><b className="font-jp text-sumi">玉ねぎ</b> = onion. <b className="font-jp text-sumi">人参</b> = carrot, a root vegetable.</p>
              <p>Both avoided in strict Jain diets.</p>
            </div>
            <p className="mt-4 text-[11px] text-sumi-400">Illustration · Tap to see similar products marked ✓</p>
          </Phone>
          </motion.div>

          <FloatCard className="-left-1 bottom-28 md:-left-8" delay={0}>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-moss-50 text-moss"><Check size={16} /></div>
            <div><p className="text-xs font-semibold text-ai-600">Kyoto temple lunch</p><p className="text-[11px] text-sumi-400">Jain menu pre-arranged</p></div>
          </FloatCard>

          <FloatCard className="-right-2 top-14 hidden sm:flex md:-right-6" delay={1.5}>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-50 text-amber"><Utensils size={15} /></div>
            <div><p className="font-jp text-xs font-semibold text-ai-600">抜いて作れます</p><p className="text-[11px] text-sumi-400">“I can make it without”</p></div>
          </FloatCard>

          <FloatCard className="bottom-6 right-2 sm:left-10 sm:right-auto" delay={3}>
            <div className="flex -space-x-2">
              {["bg-shu", "bg-ai-400", "bg-moss", "bg-amber"].map((c) => <span key={c} className={`h-6 w-6 rounded-full border-2 border-white ${c}`} />)}
            </div>
            <div>
              <p className="flex items-center gap-0.5 text-amber">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} fill="currentColor" />)}</p>
              <p className="text-[11px] text-sumi-400">Shah family, Ahmedabad</p>
            </div>
          </FloatCard>
        </motion.div>
      </div>
    </section>
  );
}

function FloatCard({ children, className, delay }: { children: ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 14, delay: 2.6 + delay / 3 }}
      whileHover={{ scale: 1.06 }}
      className={`absolute z-20 ${className}`}>
      <div className="flex animate-floaty items-center gap-2.5 rounded-xl border border-washi-300 bg-white/95 px-3 py-2.5 shadow-float backdrop-blur" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </motion.div>
  );
}
