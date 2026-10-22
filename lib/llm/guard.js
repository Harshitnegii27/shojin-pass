// Validates an LLM "why" before anyone sees it (spec 11.4, stage 4). Anything doubtful is rejected
// and the template "why" is shown instead. Checked for every verdict, in all three languages.
// Returns { ok: true, why } or { ok: false, reason }.

import { normalizeAlias } from '../rulebook/normalize.js';

// The composed text: up to 3 red sentences, "also avoided", the unclear sentence and the tip.
export const MAX_CHARS = 900;      // Hindi and Gujarati run longer than English
export const MAX_SENTENCES = 7;

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

// Japanese words: hiragana, katakana (incl. half-width) and kanji, with the long-vowel mark and 々.
// The middle dot ・ and Japanese brackets/commas are punctuation, so they separate words.
const JAPANESE_RUN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々]+/gu;

// Share of letters that must be in the answer's own script, after the allowed Japanese words,
// numbers, punctuation and symbols are ignored. A few English food words in hi/gu are fine.
const MIN_SHARE = { en: 0.8, hi: 0.6, gu: 0.6 };
const SCRIPT_OF = { en: /\p{Script=Latin}/u, hi: /\p{Script=Devanagari}/u, gu: /\p{Script=Gujarati}/u };

// Unclear-source items must be hedged ("may", "might" …), never stated as definite.
const HEDGES = {
  en: /\b(may|might|could|possibly|perhaps|unclear|not stated|not clear|uncertain|unknown|depend\w*)\b/i,
  hi: /(सकता|सकती|सकते|शायद|स्पष्ट नहीं|पता नहीं|निर्भर)/,
  gu: /(શકે|કદાચ|સ્પષ્ટ નથી|ખબર નથી|આધાર)/,
};
// "clearly" is not here: "packs that clearly state a plant source" is advice, not certainty.
const DEFINITE_EN = /\b(definitely|certainly|surely|for sure|without doubt)\b/i;
// Words in the rulebook's notes that name no ingredient ("Flavouring (source not stated)").
const NOT_A_NAME = new Set(['source', 'stated', 'from', 'with', 'come', 'made', 'animal', 'plant', 'other', 'otherwise', 'possibly', 'contain', 'based']);

// The chef card is for restaurant food only (stage 4 prompt). Label scans are packaged products.
const RESTAURANT_ONLY = /chef\s*card|restaurant|kitchen staff|शेफ़? कार्ड|रेस्तरां|रेस्टोरेंट|શેફ કાર્ડ|રેસ્ટોરન્ટ|રેસ્ટોરાં/i;

// Takes out every Japanese word that is one of the allowed ones, in any spelling the engine treats
// as the same (katakana/hiragana, full/half width): エビ counts as えび. Returns the rest of the text
// and the Japanese words that were NOT allowed.
function removeAllowedJapanese(text, allowed) {
  const ok = new Set(allowed.map((w) => normalizeAlias(w)).filter(Boolean));
  const unexpected = [];
  const rest = text.replace(JAPANESE_RUN, (run) => {
    if (ok.has(normalizeAlias(run))) return ' ';
    unexpected.push(run);
    return run;
  });
  return { rest, unexpected };
}

// Most letters must be in the requested language's script. Numbers, punctuation, symbols and
// spaces are not letters; combining vowel signs (Devanagari/Gujarati) count with their script.
function rightLanguage(text, lang) {
  const script = SCRIPT_OF[lang];
  if (!script) return false;
  let letters = 0;
  let own = 0;
  for (const ch of text) {
    if (!/[\p{L}\p{M}]/u.test(ch)) continue;
    letters++;
    if (script.test(ch)) own++;
  }
  return letters > 0 && own / letters >= MIN_SHARE[lang];
}

// English only: at least one key word of a flagged meaning must appear (spec 11.4).
function mentionsFlagged(text, meanings) {
  const words = meanings.flatMap((m) => String(m).toLowerCase().match(/[a-z]{4,}/g) || []);
  if (!words.length) return true;
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

// English: no sentence may name an unclear item and call it definite.
function unclearStatedAsDefinite(text, unclearMeanings) {
  const keys = unclearMeanings.flatMap((m) => String(m).toLowerCase().match(/[a-z]{4,}/g) || []).filter((k) => !NOT_A_NAME.has(k));
  return text.split(/(?<=[.!?])\s+/).some((s) => DEFINITE_EN.test(s) && keys.some((k) => s.toLowerCase().includes(k)));
}

// reply: raw model text (expected JSON {"why": "..."}).
// ctx: { lang, context?, flaggedMeaningsEn?, unclearMeaningsEn?, allowedJapanese? }
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
  // The red items' Japanese words are the only Japanese allowed (any spelling of the same word).
  // Other Japanese is rejected on its own: it would present an unclear item as if it were on the
  // label. Then the language check runs on what is left.
  const { rest, unexpected } = removeAllowedJapanese(why, ctx.allowedJapanese || []);
  if (unexpected.length) return { ok: false, reason: 'unexpected_japanese' };
  if (!rightLanguage(rest, ctx.lang)) return { ok: false, reason: 'wrong_language' };
  if (ctx.lang === 'en' && !mentionsFlagged(why, ctx.flaggedMeaningsEn || [])) return { ok: false, reason: 'off_topic' };

  const unclear = ctx.unclearMeaningsEn || [];
  if (unclear.length && !(HEDGES[ctx.lang] || HEDGES.en).test(why)) return { ok: false, reason: 'unclear_not_hedged' };
  if (ctx.lang === 'en' && unclear.length && unclearStatedAsDefinite(why, unclear)) return { ok: false, reason: 'unclear_stated_as_definite' };
  if ((ctx.context || 'packaged_product') === 'packaged_product' && RESTAURANT_ONLY.test(why)) return { ok: false, reason: 'chef_card_for_product' };
  return { ok: true, why };
}
