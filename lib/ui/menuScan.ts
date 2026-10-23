// A scan with no ingredient list (e.g. a restaurant menu): the engine reads the whole page as one
// headless list, so almost every line comes back as "unknown". The screen then shows one fixed line
// instead of every OCR line, lists only ingredients the rulebook matched, and leads with the chef card.
// It never changes the verdict: the line is only used when the engine's verdict is already amber.
// Hindi and Gujarati need a native speaker's check.
import type { Lang, Verdict } from "./diets";

export type ScanShape = { verdict: Verdict; reasons?: string[] };

export const MENU_LINE: Record<Lang, string> = {
  en: "This looks like a menu, not an ingredient label",
  hi: "यह मेनू लगता है, सामग्री लेबल नहीं",
  gu: "આ મેનુ લાગે છે, ઘટક લેબલ નહીં",
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
