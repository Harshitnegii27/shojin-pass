"use client";
import { motion } from "framer-motion";
import { Leaf, ScanLine, Smile } from "lucide-react";
import SectionHeading from "../SectionHeading";

const STEPS = [
  { Icon: Leaf, title: "Set your diet once", body: "Vegetarian, eggless, no onion & garlic, or Jain — strict or flexible." },
  { Icon: ScanLine, title: "Scan any label or menu", body: "Point at Japanese text. Get a clear verdict and the reason, in English or हिंदी." },
  { Icon: Smile, title: "Eat with confidence", body: "Unsure? Show the chef a polite card in Japanese — they tap a reply you can read." },
];

export default function HowItWorks() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <SectionHeading center eyebrow="How it works" title={<>Three steps. <em className="text-shu">Two seconds.</em></>} />
        <div className="relative mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
          {/* connecting line (desktop) */}
          <motion.span aria-hidden className="absolute left-[16%] right-[16%] top-9 hidden h-0.5 origin-left bg-gradient-to-r from-shu via-ai-400 to-moss md:block"
            initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
          {STEPS.map(({ Icon, title, body }, i) => (
            <motion.div key={title}
              className="card relative flex items-start gap-4 p-5 md:flex-col md:items-center md:p-7 md:text-center"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ai-600 text-white md:h-14 md:w-14">
                <Icon size={22} />
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-shu text-[11px] font-bold">{i + 1}</span>
              </span>
              <div>
                <p className="font-serif text-xl text-ai-600 md:text-2xl">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-sumi-500 md:mt-2 md:text-[15px]">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
