"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Printer } from "lucide-react";
import { useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { DIET_ORDER, DIET_PROFILES, type Diet } from "@/lib/ui/diets";

// stage 5: replace with POST /api/chef-card (spec 15.1), which builds the card from the rulebook.
type Tag = "meat" | "fish" | "gelatin" | "egg" | "onion_garlic" | "root" | "honey" | "alcohol" | "fungus";

// Polite Japanese phrases per avoided tag (reviewed with a native speaker before launch).
const AVOID: Partial<Record<Tag, { jp: string; en: string }>> = {
  meat: { jp: "肉（豚・牛・鶏）", en: "meat (pork, beef, chicken)" },
  fish: { jp: "魚・魚介類・かつおだし", en: "fish, seafood and bonito stock" },
  gelatin: { jp: "ゼラチン", en: "gelatin" },
  egg: { jp: "卵", en: "egg" },
  onion_garlic: { jp: "玉ねぎ・にんにく・ねぎ", en: "onion, garlic and green onion" },
  root: { jp: "根菜類（人参・じゃがいも・大根・生姜など）", en: "root vegetables (carrot, potato, radish, ginger…)" },
  honey: { jp: "はちみつ", en: "honey" },
  alcohol: { jp: "お酒・みりん", en: "alcohol and mirin" },
  fungus: { jp: "きのこ類", en: "mushrooms" },
};

// What each preset cannot eat (no) and would rather avoid (ask), summarised from rulebook/diets.json.
const BASE: Tag[] = ["meat", "fish", "gelatin"];
const CARD: Record<Diet, { no: Tag[]; ask: Tag[] }> = {
  vegetarian_egg: { no: BASE, ask: [] },
  vegetarian: { no: [...BASE, "egg"], ask: [] },
  no_onion_garlic: { no: [...BASE, "egg", "onion_garlic"], ask: [] },
  jain_flexible: { no: [...BASE, "egg", "onion_garlic", "honey"], ask: ["root", "fungus", "alcohol"] },
  jain_strict: { no: [...BASE, "egg", "onion_garlic", "honey", "root", "fungus", "alcohol"], ask: [] },
};

function buildCard(diet: Diet) {
  const jain = DIET_PROFILES[diet].jain;
  const pick = (tags: Tag[]) => tags.map((t) => AVOID[t]).filter(Boolean) as { jp: string; en: string }[];
  const items = pick(CARD[diet].no);
  const ask = pick(CARD[diet].ask);
  const jp = [
    "申し訳ありませんが、",
    jain ? "私はジャイナ教の菜食主義者です。" : "私は菜食主義者（ベジタリアン）です。",
    `${items.map((i) => i.jp).join("・")}は食べられません。`,
    ask.length ? `${ask.map((i) => i.jp).join("・")}も、できれば避けたいです。` : "",
    "乳製品は大丈夫です。",
    "この料理に入っているか教えていただけますか。よろしくお願いします。",
  ].join("");
  const en = `I’m sorry — I am ${jain ? "a Jain vegetarian" : "vegetarian"}. I cannot eat ${items.map((i) => i.en).join(", ")}.${ask.length ? ` If possible, I would also like to avoid ${ask.map((i) => i.en).join(", ")}.` : ""} Dairy is fine. Could you tell me whether this dish contains any of these? Thank you very much.`;
  return { jp, en };
}

const REPLIES = [
  { jp: "かつおだしが入っています", en: "It contains bonito (fish) stock", cls: "bg-shu" },
  { jp: "抜いて作れます", en: "I can make it without", cls: "bg-amber" },
  { jp: "この料理は大丈夫です", en: "This dish is fine for you", cls: "bg-moss" },
  { jp: "確認します。少々お待ちください", en: "Let me check. One moment please", cls: "bg-ai-600" },
];

export default function ChefCard() {
  const { diet, setDiet } = useDiet();
  const [name, setName] = useState("");
  const [reply, setReply] = useState<number | null>(null);
  const card = buildCard(diet);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <div className="card h-fit space-y-6 p-6 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sumi-400">Your diet</p>
          <div className="mt-3 grid gap-2">
            {DIET_ORDER.map((d) => (
              <button key={d} onClick={() => setDiet(d)} className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${diet === d ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 hover:border-ai-400"}`}>
                <span className="font-semibold">{DIET_PROFILES[d].label}</span>
                <span className={`block text-xs ${diet === d ? "text-white/70" : "text-sumi-400"}`}>{DIET_PROFILES[d].note}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm font-medium text-ai-600">Name on card (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shah family" className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
        </label>
        <button onClick={() => window.print()} className="btn-primary w-full"><Printer size={16} /> Print card for elders</button>
        <p className="text-xs text-sumi-400">Printed cards let grandparents travel with the same confidence, no smartphone needed.</p>
      </div>

      <div className="space-y-6">
        {/* The card itself — this is what prints */}
        <article className="relative overflow-hidden rounded-3xl border-2 border-ai-600 bg-white p-8 shadow-card md:p-10 print:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">お願い · Please read</p>
              {name && <p className="mt-1 text-sm text-sumi-500">{name}</p>}
            </div>
            <motion.span key={diet} initial={{ scale: 2, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-shu font-jp text-lg font-bold text-shu">精</motion.span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={diet} lang="ja" className="mt-6 font-jp text-2xl leading-[1.9] text-sumi md:text-[28px]"
              initial={{ opacity: 0, filter: "blur(6px)", y: 8 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.35 }}>
              {card.jp}
            </motion.p>
          </AnimatePresence>
          <p className="mt-6 border-t border-washi-300 pt-5 text-sumi-500">{card.en}</p>
          <p className="mt-6 text-xs text-sumi-400">Shojin Pass · {DIET_PROFILES[diet].label} · {DIET_PROFILES[diet].hi}</p>
        </article>

        <div className="card p-6 print:hidden">
          <p className="font-semibold text-ai-600">Chef taps a reply <span className="font-jp text-sm font-normal text-sumi-400">シェフの方へ：返答をタップしてください</span></p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {REPLIES.map((r, i) => (
              <button key={r.jp} onClick={() => setReply(i)} className={`${r.cls} rounded-xl px-4 py-3 text-left text-white transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[.97] ${reply === i ? "ring-4 ring-offset-2 ring-offset-washi-50 ring-current" : ""}`}>
                <p lang="ja" className="font-jp font-semibold">{r.jp}</p>
                <p className="text-xs text-white/80">{r.en}</p>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
          {reply !== null && (
            <motion.div key={reply} className="mt-5 rounded-2xl bg-washi-100 p-5 text-center"
              initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}>
              <p className="text-xs uppercase tracking-wider text-sumi-400">The chef says</p>
              <p className="mt-1 font-serif text-3xl text-ai-600">{REPLIES[reply].en}</p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
