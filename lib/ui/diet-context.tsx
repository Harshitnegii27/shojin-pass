"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DIET_ORDER, LEGACY_DIETS, isDiet, type Diet, type Lang } from "./diets";
import { useShojin } from "./shojin-context";

export type Member = { id: string; name: string; diet: Diet };

type Ctx = {
  /** Person 1's diet — used by the header selector, routes, venues and chef card. */
  diet: Diet;
  setDiet: (d: Diet) => void;
  /** Everyone travelling. Person 1 is always family[0]. */
  family: Member[];
  addMember: () => void;
  updateMember: (id: string, patch: Partial<Omit<Member, "id">>) => void;
  removeMember: (id: string) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Person 1's options (avoid_shared_line …), kept from the saved diet; not edited on these screens. */
  options: string[];
};

export const MAX_MEMBERS = 8;
const DietCtx = createContext<Ctx | null>(null);
const KEY = "shojin-pass:prefs.v2";
const OLD_KEY = "shojin-pass:prefs"; // first frontend, with its own diet ids
const newId = () => Math.random().toString(36).slice(2, 9);
const DEFAULT: Member[] = [{ id: "p1", name: "Person 1", diet: "vegetarian" }];
const LANG_IDS: Lang[] = ["en", "hi", "gu"];

function readPrefs(): { family?: Member[]; lang?: Lang } | null {
  const clean = (family: unknown, map: (d: unknown) => unknown) =>
    Array.isArray(family)
      ? family.map((m) => ({ id: String(m?.id ?? newId()), name: String(m?.name ?? ""), diet: map(m?.diet) })).filter((m): m is Member => isDiet(m.diet)).slice(0, MAX_MEMBERS)
      : [];
  const lang = (v: unknown) => (LANG_IDS.includes(v as Lang) ? (v as Lang) : undefined);
  const now = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (now) return { family: clean(now.family, (d) => d), lang: lang(now.lang) };
  const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "null");
  if (!old) return null;
  const legacy = (d: unknown) => LEGACY_DIETS[String(d)];
  const family = old.family ? clean(old.family, legacy) : old.diet && legacy(old.diet) ? [{ ...DEFAULT[0], diet: legacy(old.diet) }] : [];
  localStorage.removeItem(OLD_KEY);
  return { family, lang: lang(old.lang) };
}

// Site-wide dietary preferences, remembered per browser. Person 1's diet and the language are also
// the diet the Shojin client keeps (localStorage first, then the saved profile when signed in).
export function DietProvider({ children }: { children: ReactNode }) {
  const { client, userId } = useShojin();
  const [family, setFamily] = useState<Member[]>(DEFAULT);
  const [lang, setLang] = useState<Lang>("en");
  const [options, setOptions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      let prefs = null;
      try { prefs = readPrefs(); } catch {}
      // The shared diet (also set by /dev or a saved profile) gives Person 1's diet and the options.
      const { diet } = await client.syncDiet();
      if (!live) return;
      const fam = prefs?.family?.length ? prefs.family : DEFAULT;
      const shared = diet && isDiet(diet.preset) ? diet.preset : null;
      setFamily(shared ? fam.map((m, i) => (i === 0 ? { ...m, diet: shared } : m)) : fam);
      setLang(prefs?.lang ?? (LANG_IDS.includes(diet?.lang) ? diet.lang : "en"));
      setOptions(diet?.options ?? []);
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [client]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify({ family, lang })); } catch {}
  }, [loaded, family, lang]);

  // Keep the shared diet in step with Person 1, and save it to the profile when it changes or right
  // after a new sign-in. An unchanged diet on an ordinary visit sends nothing.
  const p1 = family[0].diet;
  const saved = useRef<{ key: string; userId: string | null } | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const key = JSON.stringify([p1, options, lang]);
    const prev = saved.current;
    saved.current = { key, userId };
    const synced = client.loadDiet();
    const sameAsStored = synced && JSON.stringify([synced.preset, synced.options, synced.lang]) === key;
    if (prev ? prev.key === key && (prev.userId === userId || !userId) : sameAsStored) return;
    client.saveDiet({ preset: p1, options, lang });
  }, [loaded, client, p1, options, lang, userId]);

  const updateMember: Ctx["updateMember"] = (id, patch) =>
    setFamily((f) => f.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const value: Ctx = {
    diet: p1,
    setDiet: (d) => setFamily((f) => f.map((m, i) => (i === 0 ? { ...m, diet: d } : m))),
    family,
    addMember: () =>
      setFamily((f) => {
        if (f.length >= MAX_MEMBERS) return f;
        // next free "Person N" number
        let n = f.length + 1;
        while (f.some((m) => m.name === `Person ${n}`)) n++;
        return [...f, { id: newId(), name: `Person ${n}`, diet: "vegetarian" }];
      }),
    updateMember,
    removeMember: (id) => setFamily((f) => (f.length <= 1 || f[0].id === id ? f : f.filter((m) => m.id !== id))),
    lang,
    setLang,
    options,
  };

  return <DietCtx.Provider value={value}>{children}</DietCtx.Provider>;
}

export function useDiet() {
  const c = useContext(DietCtx);
  if (!c) throw new Error("useDiet must be used inside <DietProvider>");
  return c;
}

export { DIET_ORDER };
