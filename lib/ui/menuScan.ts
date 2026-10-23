// A scan with no ingredient list (a restaurant menu, the front of a pack): the engine reads the whole
// page as one headless list, so almost every line comes back as "unknown". The screen then shows one
// fixed line instead of every OCR line (and no separate "why"), lists only ingredients the rulebook
// matched, and leads with the chef card. It never changes the verdict: the line is only used when the
// engine's verdict is already amber.
// Hindi and Gujarati need a native speaker's check.
import type { Lang, Verdict } from "./diets";

export type ScanShape = { verdict: Verdict; reasons?: string[] };

export const MENU_LINE: Record<Lang, string> = {
  en: "No ingredient list found. At a restaurant? Show the chef card. On a pack? Scan the back.",
  hi: "सामग्री सूची नहीं मिली। रेस्टोरेंट में हैं? शेफ़ कार्ड दिखाएँ। पैक पर? पीछे का हिस्सा स्कैन करें।",
  gu: "ઘટક યાદી મળી નથી. રેસ્ટોરન્ટમાં છો? શેફ કાર્ડ બતાવો. પેક પર? પાછળની બાજુ સ્કેન કરો.",
};

/** The engine found no ingredient list (any verdict). */
export const noIngredientList = (d?: ScanShape | null) => !!d?.reasons?.includes("NO_INGREDIENT_LIST");

/** The "menu" line replaces the verdict line only for amber; a red verdict keeps its own line. */
export const menuLine = (d: ScanShape | null | undefined, lang: Lang): string | null =>
  d && d.verdict === "amber" && noIngredientList(d) ? MENU_LINE[lang] : null;

/** Ingredients to list: with no ingredient list, only rulebook matches, never the unknown OCR lines. */
export function listedItems<I, U>(d: ScanShape & { items: I[]; unknown: U[] }): { items: I[]; unknown: U[] } {
  return noIngredientList(d) ? { items: d.items, unknown: [] } : { items: d.items, unknown: d.unknown };
}
