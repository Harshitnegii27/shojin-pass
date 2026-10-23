// The banner for a family scan: one fixed line summarising everyone's verdicts. Fixed text only, never
// "safe" or "can eat" (spec golden rule 5); a count is only shown when it is meaningful (at least one
// person in it and at least one outside it). Hindi and Gujarati need a native speaker's check.
import type { Lang, Verdict } from "./diets";

export type Outcome = { verdict: Verdict | "error"; reasons?: string[] };

const T = {
  allGreen: { en: "No avoided ingredients found for anyone", hi: "किसी के लिए कोई वर्जित सामग्री नहीं मिली", gu: "કોઈના માટે કોઈ વર્જિત ઘટક મળ્યો નથી" },
  someGreen: { en: "No avoided ingredients found for {g} of {n}", hi: "{n} में से {g} के लिए कोई वर्जित सामग्री नहीं मिली", gu: "{n} માંથી {g} માટે કોઈ વર્જિત ઘટક મળ્યો નથી" },
  allRed: { en: "Not suitable for anyone", hi: "किसी के लिए उपयुक्त नहीं", gu: "કોઈના માટે યોગ્ય નથી" },
  someRed: { en: "Not suitable for {r} of {n}", hi: "{n} में से {r} के लिए उपयुक्त नहीं", gu: "{n} માંથી {r} માટે યોગ્ય નથી" },
  someRedCheck: { en: "Not suitable for {r} of {n}. Check with staff for the others", hi: "{n} में से {r} के लिए उपयुक्त नहीं। बाकी के लिए स्टाफ़ से पूछें", gu: "{n} માંથી {r} માટે યોગ્ય નથી. બાકીના માટે સ્ટાફને પૂછો" },
  noList: { en: "Couldn’t find an ingredient list. Check with staff", hi: "सामग्री सूची नहीं मिली। स्टाफ़ से पूछें", gu: "ઘટક યાદી મળી નથી. સ્ટાફને પૂછો" },
  checkAll: { en: "Check with staff before eating", hi: "खाने से पहले स्टाफ़ से पूछें", gu: "ખાતા પહેલાં સ્ટાફને પૂછો" },
  retakeAll: { en: "Please retake the photo", hi: "कृपया फ़ोटो दोबारा लें", gu: "કૃપા કરીને ફોટો ફરીથી લો" },
  errorAll: { en: "Couldn’t check this label. Please try again", hi: "यह लेबल जाँचा नहीं जा सका। कृपया फिर कोशिश करें", gu: "આ લેબલ તપાસી શકાયું નહીં. કૃપા કરીને ફરી પ્રયત્ન કરો" },
} as const;

export type SummaryKey = keyof typeof T;

const NO_LIST = new Set(["NO_INGREDIENT_LIST", "NO_INGREDIENTS_FOUND"]);

// Which banner fits, worst news first. Order matters: a green count is only shown next to other
// greens, and "for 0 of n" can never come out.
export function summaryKey(outcomes: Outcome[]): SummaryKey | null {
  const n = outcomes.length;
  if (!n) return null;
  const count = (v: Outcome["verdict"]) => outcomes.filter((o) => o.verdict === v).length;
  const g = count("green");
  const r = count("red");
  if (g === n) return "allGreen";
  if (r === n) return "allRed";
  if (count("error") === n) return "errorAll";
  if (count("retake") === n) return "retakeAll";
  if (outcomes.every((o) => o.verdict === "amber" && (o.reasons ?? []).some((x) => NO_LIST.has(x)))) return "noList";
  if (r > 0) return r + g === n ? "someRed" : "someRedCheck"; // the rest all green, or some unclear
  if (g > 0) return "someGreen"; // some green, the rest amber / retake / error (no red)
  return "checkAll"; // nobody green or red: amber, retake or errors
}

export function familySummary(outcomes: Outcome[], lang: Lang): string {
  const key = summaryKey(outcomes);
  if (!key) return "";
  const n = String(outcomes.length);
  const g = String(outcomes.filter((o) => o.verdict === "green").length);
  const r = String(outcomes.filter((o) => o.verdict === "red").length);
  return T[key][lang].replace("{n}", n).replace("{g}", g).replace("{r}", r);
}
