"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Printer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import { DIET_ORDER, DIET_PROFILES, LANGS, dietName, type Diet } from "@/lib/ui/diets";
import type { ChefCard as Card } from "@/lib/ui/stage5";

// The card is built on the server from fixed phrases (POST /api/chef-card via shojinClient): one
// family member's diet, or everyone at the table merged. Nothing here writes Japanese itself.
const EVERYONE = "everyone";
const REPLY_STYLE: Record<string, string> = { contains: "bg-shu", can_make_without: "bg-amber", fine: "bg-moss" };
const DISH_JA = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々・ 　]*$/u;

export default function ChefCard() {
  const { client } = useShojin();
  const { family, updateMember, options, lang, setLang } = useDiet();
  const [who, setWho] = useState<string>(family[0].id);
  const [name, setName] = useState("");
  const [dish, setDish] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const member = family.find((m) => m.id === who);
  const everyone = who === EVERYONE || !member;
  const dishOk = DISH_JA.test(dish) && dish.trim().length <= 40;
  // Person 1 keeps their saved options; other members use the preset alone.
  const optsFor = (i: number) => (i === 0 ? options : []);
  const membersKey = JSON.stringify(everyone
    ? family.map((m, i) => ({ preset: m.diet, options: optsFor(i) }))
    : [{ preset: member!.diet, options: optsFor(family.indexOf(member!)) }]);

  useEffect(() => {
    if (!dishOk) return;
    let live = true;
    const members = JSON.parse(membersKey) as { preset: Diet; options: string[] }[];
    const dishNameJa = dish.trim() || undefined;
    const body = members.length === 1 ? { ...members[0], dishNameJa } : { members, dishNameJa };
    const t = setTimeout(() => {
      client.chefCard(body).then((r) => {
        if (!live) return;
        setFailed(!r.ok);
        if (r.ok) { setCard(r.data as Card); setReply(null); }
      });
    }, 250); // typing the dish name sends one request, not one per key
    return () => { live = false; clearTimeout(t); };
  }, [client, membersKey, dish, dishOk]);

  const chosenReply = card?.buttons.find((b) => b.id === reply);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <div className="card h-fit space-y-6 p-6 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sumi-400">Card for</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {family.map((m, i) => (
              <button key={m.id} onClick={() => setWho(m.id)} className={`rounded-full border px-3 py-1.5 text-sm transition ${!everyone && who === m.id ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 hover:border-ai-400"}`}>
                {m.name || `Person ${i + 1}`}
              </button>
            ))}
            {family.length > 1 && (
              <button onClick={() => setWho(EVERYONE)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${everyone ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 hover:border-ai-400"}`}>
                <Users size={14} /> Everyone at the table
              </button>
            )}
          </div>
        </div>

        {!everyone && member ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sumi-400">{member.name || "Their"} diet</p>
            <div className="mt-3 grid gap-2">
              {DIET_ORDER.map((d) => (
                <button key={d} onClick={() => updateMember(member.id, { diet: d })} className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${member.diet === d ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 hover:border-ai-400"}`}>
                  <span className="font-semibold">{DIET_PROFILES[d].label}</span>
                  <span className={`block text-xs ${member.diet === d ? "text-white/70" : "text-sumi-400"}`}>{DIET_PROFILES[d].note}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-washi-100 p-3 text-sm text-sumi-500">One card for {family.length} people: everything any of them avoids. {family.map((m) => DIET_PROFILES[m.diet].short).join(" · ")}</p>
        )}

        <label className="block text-sm font-medium text-ai-600">Dish name in Japanese (optional)
          <input value={dish} onChange={(e) => setDish(e.target.value)} placeholder="例：野菜の天ぷら" maxLength={40} lang="ja"
            className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 font-jp font-normal text-sumi focus:outline-none ${dishOk ? "border-washi-300 focus:border-ai-400" : "border-shu"}`} />
          {!dishOk && <span className="mt-1 block text-xs text-shu">Japanese characters only, up to 40.</span>}
        </label>
        <label className="block text-sm font-medium text-ai-600">Name on card (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shah family" className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-4 py-2.5 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
        </label>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sumi-400">Translation</p>
          <div className="mt-2 flex rounded-full bg-washi-200 p-0.5 text-xs font-semibold">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)} className={`flex-1 rounded-full px-3 py-1.5 ${lang === l.id ? "bg-white text-ai-600 shadow-sm" : "text-sumi-400"}`}>{l.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => window.print()} disabled={!card} className="btn-primary w-full disabled:opacity-50"><Printer size={16} /> Print card for elders</button>
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
            <motion.span key={card?.identity} initial={{ scale: 2, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-shu font-jp text-lg font-bold text-shu">精</motion.span>
          </div>
          {!card && !failed && <p className="mt-6 text-sumi-400">Preparing the card…</p>}
          {failed && !card && <p className="mt-6 text-sumi-500">Couldn’t build the card right now. Please try again.</p>}
          <AnimatePresence mode="wait">
            {card && (
              <motion.div key={card.ja} initial={{ opacity: 0, filter: "blur(6px)", y: 8 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.35 }}>
                <div lang="ja" className="mt-6 space-y-2 font-jp text-2xl leading-[1.8] text-sumi md:text-[26px]">
                  {card.lines.map((l) => <p key={l.kind}>{l.ja}</p>)}
                </div>
                <div className="mt-6 space-y-1.5 border-t border-washi-300 pt-5 text-sumi-500">
                  {card.lines.map((l) => <p key={l.kind} lang={lang}>{l[lang]}</p>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {card && (
            <p className="mt-6 text-xs text-sumi-400">
              Shojin Pass · {card.profiles.map((p) => dietName(p.preset, lang)).join(" + ")} · {card.issuedAtJst}
            </p>
          )}
          {card?.reviewNeeded && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-sumi-500 print:hidden">
              <AlertTriangle size={14} className="mt-px shrink-0 text-amber" /> {card.reviewNeeded.note}
            </p>
          )}
        </article>

        {card && (
          <div className="card p-6 print:hidden">
            <p className="font-semibold text-ai-600">Chef taps a reply <span className="font-jp text-sm font-normal text-sumi-400">シェフの方へ：返答をタップしてください</span></p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {card.buttons.map((b) => (
                <button key={b.id} onClick={() => setReply(b.id)} className={`${REPLY_STYLE[b.id] ?? "bg-ai-600"} rounded-xl px-4 py-3 text-left text-white transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[.97] ${reply === b.id ? "ring-4 ring-current ring-offset-2 ring-offset-washi-50" : ""}`}>
                  <p lang="ja" className="font-jp font-semibold">{b.ja}</p>
                  <p className="text-xs text-white/80">{b[lang]}</p>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {chosenReply && (
                <motion.div key={chosenReply.id} className="mt-5 rounded-2xl bg-washi-100 p-5 text-center"
                  initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <p className="text-xs uppercase tracking-wider text-sumi-400">The chef says</p>
                  <p className="mt-1 font-serif text-3xl text-ai-600">{chosenReply[lang]}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
