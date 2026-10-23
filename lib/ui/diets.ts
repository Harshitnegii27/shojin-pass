// The diet presets the screens offer. Ids and names come from our rulebook (rulebook/diets.json);
// what each one forbids is decided only by the engine on the server. This file never judges food.
import diets from "@/rulebook/diets.json";

export type Lang = "en" | "hi" | "gu";
export type Diet = "vegetarian_egg" | "vegetarian" | "no_onion_garlic" | "jain_flexible" | "jain_strict";
export type Verdict = "green" | "amber" | "red" | "retake";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "gu", label: "ગુજરાતી" },
];

export const DIET_ORDER: Diet[] = ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"];

// Short notes for the pickers, in plain words. They summarise rulebook/diets.json; keep them in step.
const NOTES: Record<Diet, { short: string; note: string }> = {
  vegetarian_egg: { short: "Veg + egg", note: "No meat, fish or gelatin; eats egg" },
  vegetarian: { short: "Vegetarian", note: "No meat, fish, gelatin or egg" },
  no_onion_garlic: { short: "No onion/garlic", note: "Vegetarian, no egg, onion or garlic" },
  jain_flexible: { short: "Jain · flexible", note: "No egg, onion, garlic or honey; asks about roots, mushrooms and alcohol" },
  jain_strict: { short: "Jain · strict", note: "No egg, onion, garlic, honey, root vegetables, mushrooms or alcohol" },
};

type Profile = { label: string; hi: string; gu: string; short: string; note: string; jain: boolean };

export const DIET_PROFILES = Object.fromEntries(
  DIET_ORDER.map((d) => {
    const r = (diets as Record<string, { label: Record<Lang, string>; chefIdentity: string }>)[d];
    return [d, { label: r.label.en, hi: r.label.hi, gu: r.label.gu, ...NOTES[d], jain: r.chefIdentity === "jain" }];
  }),
) as Record<Diet, Profile>;

export const dietName = (d: Diet, lang: Lang) => (lang === "en" ? DIET_PROFILES[d].label : DIET_PROFILES[d][lang]);
export const isDiet = (v: unknown): v is Diet => typeof v === "string" && (DIET_ORDER as string[]).includes(v);

// The ids the first frontend used, for prefs saved in a browser before the merge.
export const LEGACY_DIETS: Record<string, Diet> = {
  vegetarian: "vegetarian_egg", eggless: "vegetarian", noog: "no_onion_garlic", jain_flex: "jain_flexible", jain: "jain_strict",
};
