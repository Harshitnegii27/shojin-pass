// Validates an LLM "why" before anyone sees it (spec 11.4, stage 4). Anything doubtful is rejected
// and the template "why" is shown instead. Checked for every verdict, in all three languages.
// Returns { ok: true, why } or { ok: false, reason }.

export const MAX_CHARS = 700;      // 3–5 short sentences; Hindi and Gujarati run longer than English
export const MAX_SENTENCES = 6;

// Blunt on purpose: the LLM must not talk about suitability at all (spec 11.4 note). Extend here.
// English phrases match whole words ("ok to eat" must not fire on "look to eat"), except "safe",
// which matches anywhere so "unsafe" and "safety" are rejected too. Hindi and Gujarati match anywhere.
export const BANNED = {
  en: ['safe', 'suitable', 'fine to eat', 'fine for you', 'okay', 'ok to eat', 'ok for you', 'can eat', 'can have',
    'allowed', 'permitted', 'no problem', 'no issue', 'acceptable', 'go ahead', 'enjoy', 'vegetarian-friendly',
    'jain-friendly', 'verdict'],
  hi: ['सुरक्षित', 'उपयुक्त', 'खा सकते', 'खा सकती', 'खा सकता', 'ठीक है', 'कोई समस्या नहीं', 'अनुमति', 'चिंता न करें', 'चिंता की कोई बात नहीं'],
  gu: ['સુરક્ષિત', 'યોગ્ય', 'ખાઈ શકો', 'ખાઈ શકાય', 'બરાબર છે', 'કોઈ વાંધો નથી', 'મંજૂરી', 'ચિંતા ન કરો'],
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED_RE = [
  /safe/i,
  ...BANNED.en.filter((p) => p !== 'safe').map((p) => new RegExp(`(^|[^a-z])${escape(p)}($|[^a-z])`, 'i')),
  ...[...BANNED.hi, ...BANNED.gu].map((p) => new RegExp(escape(p))),
];

const count = (s, re) => (s.match(re) || []).length;
const SCRIPTS = { latin: /[A-Za-z]/g, deva: /[ऀ-ॿ]/g, guj: /[઀-૿]/g, kana: /[぀-ヿ一-鿿]/g };

// The text must be written in the requested language's script.
function rightLanguage(text, lang) {
  const n = Object.fromEntries(Object.entries(SCRIPTS).map(([k, re]) => [k, count(text, re)]));
  const letters = n.latin + n.deva + n.guj + n.kana;
  if (!letters) return false;
  if (n.kana) return false; // no Japanese: it could only come from label text
  if (lang === 'en') return n.deva === 0 && n.guj === 0;
  if (lang === 'hi') return n.guj === 0 && n.deva / letters >= 0.6;
  if (lang === 'gu') return n.deva === 0 && n.guj / letters >= 0.6;
  return false;
}

// English only: at least one key word of a flagged meaning must appear (spec 11.4).
function mentionsFlagged(text, meanings) {
  const words = meanings.flatMap((m) => String(m).toLowerCase().match(/[a-z]{4,}/g) || []);
  if (!words.length) return true;
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

// reply: raw model text (expected JSON {"why": "..."}); ctx: { lang, flaggedMeaningsEn: [] }
export function checkExplanation(reply, ctx) {
  let why;
  try {
    why = JSON.parse(String(reply).trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))?.why;
  } catch {
    return { ok: false, reason: 'not_json' };
  }
  if (typeof why !== 'string') return { ok: false, reason: 'no_why' };
  why = why.replace(/\s+/g, ' ').trim();
  if (!why) return { ok: false, reason: 'empty' };
  if (why.length > MAX_CHARS) return { ok: false, reason: 'too_long' };
  if (count(why, /[.!?।]+(\s|$)/g) > MAX_SENTENCES) return { ok: false, reason: 'too_many_sentences' };
  if (BANNED_RE.some((re) => re.test(why))) return { ok: false, reason: 'banned_phrase' };
  if (/\d\s*%|https?:\/\/|www\.|\.com\b/i.test(why)) return { ok: false, reason: 'number_or_link' };
  if (!rightLanguage(why, ctx.lang)) return { ok: false, reason: 'wrong_language' };
  if (ctx.lang === 'en' && !mentionsFlagged(why, ctx.flaggedMeaningsEn || [])) return { ok: false, reason: 'off_topic' };
  return { ok: true, why };
}
