"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, Check, ClipboardType, ImageUp, Loader2, MessageSquareText, Plus, RotateCcw, Sparkles, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MAX_MEMBERS, useDiet, type Member } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import { DIET_ORDER, DIET_PROFILES, LANGS, type Diet, type Lang, type Verdict } from "@/lib/ui/diets";
import { shrinkPhoto } from "@/lib/client/shrinkPhoto";
import { verdictLine } from "@/lib/text/templates";
import { familySummary } from "@/lib/ui/familySummary";

// Every verdict, verdict line and "why" comes from the server (our engine via shojinClient).
// This screen only shows them; it never judges an ingredient itself.

type Meaning = Partial<Record<Lang, string>>;
type Item = { original?: string; text: string; meaning?: Meaning; colour: Verdict; reason?: string | null };
type ScanData = {
  verdict: Verdict; reasons: string[]; verdictLine: string; why: string; whySource?: string;
  items: Item[]; unknown: { original?: string; text: string }[]; scanId: string | null;
};
type DietResult = {
  data?: ScanData; error?: { code?: string; message?: string };
  lang: Lang; // language the scan was made in
  why?: { text: string; lang: Lang; source: string }; // the explain() answer, swapped in place
};
type Source = { kind: "text"; text: string } | { kind: "photo"; blob: Blob; filename: string };
type Mode = "upload" | "paste" | "samples";
type Feedback = "wrong_verdict" | "unclear" | "unreadable" | "helpful";

const SAMPLES = [
  { name: "Konbini rice ball", jp: "おにぎり", text: "原材料名：ご飯、野菜(キャベツ、人参)、しょうゆ、砂糖、かつお節エキス、玉ねぎ、ごま油、のり" },
  { name: "Temple tofu set", jp: "精進豆腐", text: "原材料名：豆腐、昆布だし、しょうゆ、ごま油、砂糖、しいたけ" },
  { name: "Matcha pudding", jp: "抹茶プリン", text: "原材料名：牛乳、砂糖、抹茶、卵黄、ゼラチン" },
  { name: "Veg curry pouch", jp: "野菜カレー", text: "原材料名：野菜(じゃがいも、人参、玉ねぎ)、小麦粉、植物油、砂糖、食塩、にんにく、生姜、調味料(アミノ酸等)" },
  { name: "Udon soup base", jp: "うどんつゆ", text: "原材料名：しょうゆ、みりん、砂糖、だし(かつお、昆布)、食塩" },
  { name: "Veg croquette", jp: "野菜コロッケ", text: "原材料名：じゃがいも、玉ねぎ、小麦粉、植物油、食塩、砂糖" },
];

const STATUS: Record<Verdict | "error", { cls: string; Icon: typeof Check }> = {
  green: { cls: "bg-moss", Icon: Check },
  red: { cls: "bg-shu", Icon: X },
  amber: { cls: "bg-amber", Icon: AlertTriangle },
  retake: { cls: "bg-ai-400", Icon: Camera },
  error: { cls: "bg-sumi-500", Icon: AlertTriangle },
};
// Worst first. A failed scan counts as amber: uncertainty is never green.
const RANK: Record<Verdict | "error", number> = { red: 0, amber: 1, error: 1, retake: 2, green: 3 };
const PILL: Record<Verdict, string> = { green: "bg-moss-50 text-moss", red: "bg-shu-50 text-shu", amber: "bg-amber-50 text-amber", retake: "bg-amber-50 text-amber" };
const PILL_LABEL: Record<Verdict, string> = { green: "Not avoided", red: "Avoid", amber: "Ask", retake: "Unclear" };
const AVATAR = ["bg-shu", "bg-ai-600", "bg-moss", "bg-amber", "bg-ai-400", "bg-shu-600", "bg-moss-600", "bg-sumi-500"];

const GROUPS: { key: Verdict | "error"; en: string; dot: string; cls: string }[] = [
  { key: "green", en: "No avoided ingredients found", dot: "✓", cls: "text-moss" },
  { key: "red", en: "Not suitable", dot: "✕", cls: "text-shu" },
  { key: "amber", en: "Check with staff", dot: "!", cls: "text-amber" },
  { key: "retake", en: "Retake the photo", dot: "↺", cls: "text-ai-400" },
  { key: "error", en: "Couldn’t check", dot: "!", cls: "text-sumi-500" },
];
const FEEDBACK: { kind: Feedback; label: string }[] = [
  { kind: "helpful", label: "Helpful" },
  { kind: "wrong_verdict", label: "Verdict looks wrong" },
  { kind: "unclear", label: "Unclear" },
  { kind: "unreadable", label: "Couldn’t read the label" },
];

const uniqueDiets = (family: Member[]) => Array.from(new Set(family.map((m) => m.diet)));
const colourOf = (r: DietResult): Verdict | "error" => r.data?.verdict ?? "error";
const dietLabel = (d: Diet) => ({ en: DIET_PROFILES[d].label, hi: DIET_PROFILES[d].hi, gu: DIET_PROFILES[d].gu });

function Avatar({ m, i, size = "h-7 w-7 text-xs" }: { m: Member; i: number; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-semibold uppercase text-white ${AVATAR[i % AVATAR.length]} ${size}`}>
      {(m.name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** true below the lg breakpoint (phones & small tablets) */
function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export default function Scanner() {
  const isMobile = useIsMobile();
  const { client, status, whenReady } = useShojin();
  const { family, addMember, updateMember, removeMember, lang, setLang, options } = useDiet();
  const [editingId, setEditingId] = useState(family[0].id);
  const [viewId, setViewId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("samples");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [byDiet, setByDiet] = useState<Partial<Record<Diet, DietResult>>>({});
  const [showAll, setShowAll] = useState(false);
  const [sent, setSent] = useState<Record<string, Feedback>>({}); // scanId -> kind sent
  const fileRef = useRef<HTMLInputElement>(null);
  const run = useRef(0); // ignores answers from an older scan

  const editing = family.find((m) => m.id === editingId) ?? family[0];
  const dietKey = uniqueDiets(family).join(",");
  const lastText = source?.kind === "text" ? source.text : "";

  // Person 1 keeps their saved options (shared line …); other members use the preset alone.
  const dietFor = (d: Diet, l: Lang) => ({ preset: d, options: d === family[0].diet ? options : [], lang: l });

  async function scanDiets(src: Source, diets: Diet[], l: Lang, keep: Partial<Record<Diet, DietResult>>) {
    const id = ++run.current;
    setLoading(true);
    await whenReady(); // so the scan is saved (gets a scanId) when sign-in works; never waits forever
    if (id !== run.current) return;
    const answers = await Promise.all(diets.map(async (d) => {
      const r = src.kind === "text"
        ? await client.scanText(src.text, { diet: dietFor(d, l) })
        : await client.scanPhoto(src.blob, src.filename, { diet: dietFor(d, l) });
      const res: DietResult = r.data ? { data: r.data as ScanData, lang: l } : { error: r.error ?? { message: `HTTP ${r.status}` }, lang: l };
      return [d, res] as const;
    }));
    if (id !== run.current) return;
    const next = { ...keep, ...Object.fromEntries(answers) };
    setByDiet(next);
    setShowAll(false);
    setLoading(false);
    // Show details first for the first person who got anything other than green.
    const firstProblem = family.find((m) => next[m.diet] && colourOf(next[m.diet]!) !== "green");
    setViewId((firstProblem ?? family.find((m) => next[m.diet]) ?? family[0]).id);
  }

  // Text and samples: check everyone straight away.
  async function scanText(t: string, l = lang) {
    if (!t.trim()) return;
    const src: Source = { kind: "text", text: t };
    setSource(src);
    await scanDiets(src, uniqueDiets(family), l, {});
  }

  // Photos: Person 1's diet only (each diet is another OCR call); "Check for everyone" does the rest.
  async function scanImage() {
    if (!image) return;
    setLoading(true);
    const { blob, filename } = await shrinkPhoto(image.file);
    const src: Source = { kind: "photo", blob, filename };
    setSource(src);
    await scanDiets(src, [family[0].diet], lang, {});
  }

  const missing = source ? uniqueDiets(family).filter((d) => !byDiet[d]) : [];
  const checkEveryone = () => source && scanDiets(source, missing, lang, byDiet);

  // Text: re-check the last label whenever someone's diet changes or a new diet joins the family.
  // Photos are not re-sent automatically; new diets show up under "Check for everyone".
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (lastText) scanText(lastText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietKey]);

  // When someone is added, open them in the editor.
  const prevLen = useRef(family.length);
  useEffect(() => {
    if (family.length > prevLen.current) setEditingId(family[family.length - 1].id);
    prevLen.current = family.length;
  }, [family]);

  function changeLang(l: Lang) {
    setLang(l);
    if (lastText) scanText(lastText, l);
    // Photo: no new OCR call. The verdict line is re-worded below and a saved scan's "why" is
    // fetched again in the new language; an unsaved one keeps its first language.
  }

  const reset = () => { run.current++; setByDiet({}); setSource(null); setLoading(false); };
  const hasResult = Object.keys(byDiet).length > 0;
  const sheetOpen = isMobile && (loading || hasResult);

  // Lock page scroll behind the phone result sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  /* ───────── Result pieces ───────── */
  const rows = family.map((m, i) => ({ m, i, r: byDiet[m.diet] })).filter((x): x is { m: Member; i: number; r: DietResult } => !!x.r);
  const unchecked = family.filter((m) => !byDiet[m.diet]);
  const view = rows.find((x) => x.m.id === viewId) ?? rows[0];
  const single = family.length === 1;
  const overall = rows.reduce<Verdict | "error">((w, x) => (RANK[colourOf(x.r)] < RANK[w] ? colourOf(x.r) : w), "green");

  // The fixed verdict line in the chosen language. Re-worded with the same reviewed template when the
  // language changes after a photo scan (same verdict, no new OCR call).
  const lineFor = (d: Diet, r: DietResult) =>
    !r.data ? (r.error?.message ?? "Something went wrong. Please try again.")
      : r.lang === lang ? r.data.verdictLine : verdictLine(r.data.verdict, dietLabel(d), lang);

  const headline = !view ? "" : single || rows.length === 1
    ? lineFor(view.m.diet, view.r)
    : familySummary(rows.map((x) => ({ verdict: colourOf(x.r), reasons: x.r.data?.reasons })), lang);
  const headColour: Verdict | "error" = single || rows.length === 1 ? (view ? colourOf(view.r) : "green") : overall;
  const H = STATUS[headColour];

  // The "why": the template from the scan, swapped for explain() when it arrives (red/amber, saved scans).
  const viewDiet = view?.m.diet;
  const viewData = view?.r.data;
  useEffect(() => {
    if (!viewDiet || !viewData?.scanId) return;
    const r = byDiet[viewDiet];
    if (!r || r.why?.lang === lang) return;
    const wanted = viewData.verdict === "red" || viewData.verdict === "amber" || r.lang !== lang;
    if (!wanted) return;
    let live = true;
    client.explain(viewData.scanId, lang).then((e: { ok: boolean; why?: string; source?: string }) => {
      if (!live || !e.ok || !e.why) return;
      setByDiet((all) => (all[viewDiet]?.data?.scanId === viewData.scanId ? { ...all, [viewDiet]: { ...all[viewDiet]!, why: { text: e.why!, lang, source: e.source ?? "template" } } } : all));
    });
    return () => { live = false; };
  }, [client, viewDiet, viewData, lang, byDiet]);

  function whyFor(r: DietResult) {
    if (!r.data) return null;
    if (r.why?.lang === lang) return r.why.text;
    return r.data.why; // the scan's own language until a translated "why" arrives (unsaved photo scans keep it)
  }

  async function feedback(scanId: string, kind: Feedback) {
    const r = await client.sendFeedback(scanId, kind);
    if (r.ok) setSent((s) => ({ ...s, [scanId]: kind }));
  }

  const loadingView = (
    <div className="relative flex min-h-[220px] items-center justify-center gap-3 overflow-hidden text-sumi-500 lg:min-h-[420px]">
      <span className="absolute inset-x-6 h-0.5 animate-scan bg-shu/70 shadow-[0_0_14px_3px_rgba(194,67,47,.45)]" aria-hidden />
      <Loader2 className="animate-spin" /> Reading the label…
    </div>
  );

  const viewItems: Item[] = viewData
    ? [...viewData.items, ...viewData.unknown.map((u) => ({ ...u, colour: "amber" as Verdict, meaning: { en: "Not in our rulebook yet" } }))]
        .sort((a, b) => RANK[a.colour] - RANK[b.colour])
    : [];
  const shown = viewItems.filter((f) => showAll || f.colour !== "green");
  const scanId = viewData?.scanId ?? null;
  // No saved scan (sign-in failed or unavailable, or saving failed): no explanation or feedback.
  const explainUnavailable = !!viewData && (!scanId || status === "failed" || status === "unavailable");

  const resultView = hasResult && view && (
    <motion.div key={(source?.kind === "text" ? source.text : "photo") + dietKey + lang} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>

      <div className="space-y-5 p-4 sm:p-6">
        {/* 1. The answer: the fixed verdict line (or the family summary) */}
        <motion.div
          initial={{ scale: 1.2, opacity: 0, rotate: -2 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-xl font-semibold text-white ${H.cls} ${headColour === "red" ? "animate-[shake_.45s_ease-in-out_.25s]" : ""}`}>
          <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.15 }}>
            <H.Icon size={24} />
          </motion.span>
          {headline}
        </motion.div>

        {/* 2. Who — grouped by verdict (family mode) */}
        {!single && (
          <div className="space-y-3">
            {GROUPS.map((g) => {
              const people = rows.filter((x) => colourOf(x.r) === g.key);
              if (!people.length) return null;
              return (
                <div key={g.key}>
                  <p className={`text-sm font-semibold ${g.cls}`}>{g.dot} {g.en}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {people.map(({ m, i }) => (
                      <button key={m.id} onClick={() => { setViewId(m.id); setShowAll(false); }} aria-pressed={view.m.id === m.id}
                        className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[15px] font-medium transition ${view.m.id === m.id ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 bg-white text-ai-600 hover:border-ai-400"}`}>
                        <Avatar m={m} i={i} />
                        {m.name || `Person ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {unchecked.length > 0 && (
              <div className="rounded-xl border border-dashed border-ai-400/60 p-3">
                <p className="text-sm text-sumi-500">Not checked yet: {unchecked.map((m) => m.name || "Person").join(", ")}</p>
                <button onClick={checkEveryone} disabled={loading} className="btn-ghost mt-2 py-2 text-sm disabled:opacity-50">
                  <Users size={15} /> Check for everyone
                </button>
              </div>
            )}
            <p className="text-xs text-sumi-400">Tap a name to see why.</p>
          </div>
        )}

        {/* 3. Why — the person's verdict line and the server's "why", then the flagged ingredients */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-washi-300 sm:p-5">
          {!single && <p className="text-sm font-semibold text-ai-600">{view.m.name || "Person"} · {lineFor(view.m.diet, view.r)}</p>}
          <p className="text-base leading-relaxed text-sumi sm:text-[17px]">{whyFor(view.r) ?? "Please try again in a moment."}</p>
          {explainUnavailable && <p className="mt-1 text-xs text-sumi-400">Explain is unavailable right now.</p>}

          {shown.length > 0 && (
            <ul className="mt-3 space-y-2">
              {shown.map((f, i) => (
                <motion.li key={view.m.id + (f.original ?? f.text) + i + showAll} className="flex items-center justify-between gap-3 rounded-xl bg-washi-100 px-3 py-2.5"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.03 }}>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-sumi">{f.meaning?.[lang] ?? f.meaning?.en ?? f.original ?? f.text}</p>
                    <p className="font-jp text-xs text-sumi-400">{f.original ?? f.text}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${PILL[f.colour]}`}>{PILL_LABEL[f.colour]}</span>
                </motion.li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {viewItems.length > 0 ? (
              <button onClick={() => setShowAll(!showAll)} className="text-sm font-semibold text-ai-600 underline-offset-4 hover:underline">
                {showAll ? "Show only problems" : `See all ${viewItems.length} ingredients`}
              </button>
            ) : <span />}
            <div className="flex rounded-full bg-washi-200 p-0.5 text-xs font-semibold">
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => changeLang(l.id)} className={`rounded-full px-3 py-1 ${lang === l.id ? "bg-white text-ai-600 shadow-sm" : "text-sumi-400"}`}>{l.label}</button>
              ))}
            </div>
          </div>

          {/* Feedback on this person's scan (saved scans only) */}
          {scanId && (
            <div className="mt-4 border-t border-washi-200 pt-3">
              {sent[scanId] ? (
                <p className="text-xs text-moss">Thanks, we got your feedback.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {FEEDBACK.map((f) => (
                    <button key={f.kind} onClick={() => feedback(scanId, f.kind)} className="rounded-full border border-washi-300 bg-white px-3 py-1 text-xs text-sumi-500 transition hover:border-ai-400">{f.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {headColour !== "green" && <Link href="/chef-card" className="btn-primary"><MessageSquareText size={16} /> Show the Chef</Link>}
          <button onClick={reset} className="btn-ghost"><RotateCcw size={15} /> Scan another</button>
        </div>
      </div>
    </motion.div>
  );

  /* ───────── Layout ───────── */
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
      {/* ── Input panel ─────────────────────────── */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sumi-400">1 · Who’s eating?</p>
          <p className="text-[11px] text-sumi-400">{family.length} {family.length === 1 ? "person" : "people"}</p>
        </div>

        {/* Family members */}
        <motion.div layout className="mt-2 flex flex-wrap gap-1.5 sm:mt-3" role="tablist" aria-label="Family members">
          <AnimatePresence initial={false}>
            {family.map((m, i) => (
              <motion.button key={m.id} layout role="tab" aria-selected={editing.id === m.id} onClick={() => setEditingId(m.id)}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition-colors ${editing.id === m.id ? "border-ai-600 bg-ai-50" : "border-washi-300 bg-white hover:border-ai-400/50"}`}>
                <Avatar m={m} i={i} />
                <span className="min-w-0 leading-tight">
                  <span className="block max-w-[110px] truncate text-[13px] font-semibold text-ai-600">{m.name || `Person ${i + 1}`}</span>
                  <span className="block text-[10px] text-sumi-400">{DIET_PROFILES[m.diet].short}</span>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
          {family.length < MAX_MEMBERS && (
            <motion.button layout onClick={addMember}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-ai-400/60 px-3 py-2 text-[13px] font-medium text-ai-600 transition hover:border-ai-600 hover:bg-ai-50 active:scale-95">
              <Plus size={15} /> Add person
            </motion.button>
          )}
        </motion.div>

        {/* Editor for the selected person */}
        <AnimatePresence mode="wait">
          <motion.div key={editing.id} className="mt-3 rounded-xl bg-washi-100 p-3"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="member-name">Name</label>
              <input id="member-name" value={editing.name} maxLength={20}
                onChange={(e) => updateMember(editing.id, { name: e.target.value })}
                placeholder="Name, e.g. Dadi"
                className="min-w-0 flex-1 rounded-lg border border-washi-300 bg-white px-3 py-2 text-sm font-medium text-ai-600 focus:border-ai-400 focus:outline-none" />
              {family[0].id !== editing.id && (
                <button onClick={() => { removeMember(editing.id); setEditingId(family[0].id); }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-washi-300 bg-white text-sumi-400 transition hover:border-shu hover:text-shu" aria-label={`Remove ${editing.name}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Diet for ${editing.name}`}>
              {DIET_ORDER.map((d) => (
                <button key={d} role="radio" aria-checked={editing.diet === d} onClick={() => updateMember(editing.id, { diet: d })} title={DIET_PROFILES[d].label}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition active:scale-95 ${editing.diet === d ? "border-ai-600 bg-ai-600 text-white" : "border-washi-300 bg-white text-sumi-500 hover:border-ai-400"}`}>
                  {DIET_PROFILES[d].short}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-sumi-400">{DIET_PROFILES[editing.diet].note}</p>
          </motion.div>
        </AnimatePresence>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-sumi-400 sm:mt-7">2 · Add a label</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-washi-200 p-1 text-[13px] font-medium sm:mt-3 sm:text-sm" role="tablist">
          {([["upload", "Photo", Camera], ["samples", "Samples", Sparkles], ["paste", "Paste", ClipboardType]] as const).map(([m, label, Icon]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`relative flex items-center justify-center gap-1.5 rounded-full py-2 transition-colors ${mode === m ? "text-ai-600" : "text-sumi-500"}`}>
              {mode === m && <motion.span layoutId="scan-tab" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <Icon size={14} className="relative" /> <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === "samples" && (
            <div className="grid grid-cols-2 gap-2">
              {SAMPLES.map((s) => (
                <button key={s.name} onClick={() => scanText(s.text)}
                  className={`rounded-xl border p-2.5 text-left transition hover:border-shu/60 active:scale-[.97] sm:p-3 ${lastText === s.text ? "border-shu bg-shu-50" : "border-washi-300 bg-white"}`}>
                  <p className="font-jp text-sm text-ai-600">{s.jp}</p>
                  <p className="text-[11px] text-sumi-400">{s.name}</p>
                </button>
              ))}
            </div>
          )}

          {mode === "upload" && (
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { if (image) URL.revokeObjectURL(image.url); setImage({ file: f, url: URL.createObjectURL(f) }); } }} />
              {image ? (
                <div className="relative overflow-hidden rounded-xl border border-washi-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="Uploaded label" className="max-h-56 w-full object-cover" />
                  <button onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-sumi" aria-label="Remove photo"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-washi-300 bg-white px-4 py-7 text-sumi-500 transition hover:border-shu hover:text-shu sm:py-10">
                  <ImageUp size={26} />
                  <span className="text-sm font-medium">Take or upload a photo</span>
                  <span className="text-xs text-sumi-400">of the ingredient list (原材料名)</span>
                </button>
              )}
              <button disabled={!image || loading} onClick={scanImage} className="btn-primary mt-3 w-full disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />} Check this label
              </button>
              {family.length > 1 && <p className="mt-2 text-xs text-sumi-400">Photos are checked for {family[0].name || "Person 1"} first; then tap “Check for everyone”.</p>}
            </div>
          )}

          {mode === "paste" && (
            <div>
              <label htmlFor="label-text" className="sr-only">Ingredient text</label>
              <textarea id="label-text" value={text} onChange={(e) => setText(e.target.value)} rows={4}
                placeholder="原材料名：野菜(キャベツ、人参)、しょうゆ、かつお節エキス…"
                className="w-full rounded-xl border border-washi-300 bg-white p-3 font-jp text-sm leading-relaxed focus:border-ai-400 focus:outline-none sm:p-4" />
              <button disabled={!text.trim() || loading} onClick={() => scanText(text)} className="btn-primary mt-3 w-full disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Check ingredients
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Laptop: result panel on the right ───── */}
      <div className="card hidden min-h-[420px] overflow-hidden lg:block" aria-live="polite">
        {!isMobile && (
          <>
            {!hasResult && !loading && (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-10 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-shu font-jp text-2xl text-shu">信</div>
                <p className="mt-5 font-serif text-2xl text-ai-600">Your verdict appears here</p>
                <p className="mt-2 max-w-sm text-sm text-sumi-500">
                  {family.length > 1 ? `One scan checks all ${family.length} people. ` : "Add family members to check for everyone at once. "}
                  Pick a sample, upload a photo or paste a label.
                </p>
              </div>
            )}
            {loading && loadingView}
            <AnimatePresence mode="wait">{!loading && resultView}</AnimatePresence>
          </>
        )}
      </div>

      {/* ── Phone: result slides up as a bottom sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-[70] bg-sumi/40 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={reset} aria-hidden />
            <motion.div key="sheet" role="dialog" aria-label="Scan result" aria-live="polite"
              className="fixed inset-x-0 bottom-0 z-[71] max-h-[80vh] overflow-y-auto rounded-t-3xl bg-washi-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_50px_-20px_rgba(13,26,44,.4)] lg:hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) reset(); }}>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-washi-50/95 px-4 pb-2 pt-3 backdrop-blur">
                <span className="w-8" />
                <span className="h-1.5 w-12 rounded-full bg-washi-300" aria-hidden />
                <button onClick={reset} className="grid h-8 w-8 place-items-center rounded-full bg-washi-200 text-sumi-500" aria-label="Close result"><X size={16} /></button>
              </div>
              {loading ? loadingView : resultView}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
