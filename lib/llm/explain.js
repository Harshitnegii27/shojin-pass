// The LLM "why" for a saved scan (spec 11, stage 4). The LLM only explains: the verdict, reasons
// and verdict line never change. It never sees photos, ids or free label text; the only Japanese
// it gets is the spelling of each red ingredient, and only when that spelling is one the rulebook
// itself knows for that ingredient. Every failure returns the fixed template "why" (source
// 'template'); this function never throws.

import 'server-only';
import { env, isProduction } from '../config/env.js';
import { resolveProfile } from '../diet/resolveProfile.js';
import { normalizeAlias } from '../rulebook/normalize.js';
import { countLlmCalls, getExplanation, recordLlmCall, saveExplanation } from '../db/scans.js';
import { logError } from '../http/log.js';
import { templateWhyForRow } from '../scan/savedScan.js';
import { geminiGenerate } from './gemini.js';
import { checkExplanation } from './guard.js';

export const SYSTEM_PROMPT = `You explain the result of a food-label check to an Indian traveller in Japan.
The result was already decided by a fixed rulebook and is shown to the user separately. You never decide, state, repeat or change it.

The input is JSON with:
- language, diet, result ("red" = contains something this diet avoids, "amber" = could not be confirmed)
- context: "packaged_product" (a packet bought in a shop) or "restaurant_food" (a dish in a restaurant)
- definitelyAvoided: ingredients this diet avoids for certain, each with its meaning, why it is avoided, and "japanese": how it is written on the label
- unclearSource: ingredients whose source is not stated, so they may or may not be a problem (for example flavouring, enzyme, seasoning, or a word seen elsewhere on the label)
- reasons (what the check found, in plain words), unknownWordCount, unclearWordCount

Write 3 to 5 short sentences, at most 600 characters in total, only in the language given by "language":
"en" = English, "hi" = Hindi in Devanagari script, "gu" = Gujarati in Gujarati script.
1. If definitelyAvoided is not empty: say plainly that these are avoided in this diet and why. Write each one as its meaning followed by its Japanese word in brackets, copied exactly from "japanese", for example: alcohol (酒精).
2. If unclearSource is not empty: in a separate sentence, say these may be animal-based or otherwise avoided because their source is not stated. Always use "may" or "might" for them. Never present them as definite, and never put them in the same sentence as the definitely avoided items.
3. Give one practical tip that fits the context:
   - packaged_product: what to look for on other packs, for example avoiding packs whose ingredient list shows the Japanese words above, or for unclear items, choosing packs that state a plant source. Do not mention a chef card, a restaurant or kitchen staff.
   - restaurant_food: suggest showing the chef card to the staff.
If both lists are empty, explain the reasons in plain words, then give the tip.

Rules:
- Mention only ingredients from definitelyAvoided and unclearSource. Never add other ingredients.
- Never say or imply that the food is safe, suitable, fine, okay, allowed or permitted, or that the user can eat it.
  Do not use those words at all, not even negated.
- If the result is "amber", say that the label could not be fully checked.
- The only Japanese you may write is the "japanese" words given, copied exactly. No other Japanese, no romaji.
- No percentages, no numbers with units, no links, no brand names, no lists or headings.
- Reply with JSON only: {"why": "..."}`;

// Plain words for each reason (sent instead of codes the model might misread).
const REASON_TEXT = {
  FORBIDDEN_INGREDIENT: 'contains an ingredient this diet avoids',
  ASK_INGREDIENT: 'contains an ingredient whose source is not stated',
  INCOMPLETE_LIST: 'the ingredient list may be cut off or incomplete',
  NO_INGREDIENT_LIST: 'no ingredient list was found on the label',
  NO_INGREDIENTS_FOUND: 'the ingredient list looked empty',
  STRUCTURE_UNCLEAR: 'part of the list could not be read in order',
  LOW_CONFIDENCE: 'some words could not be read clearly',
  UNKNOWN_TERM: 'some words are not in our ingredient list yet',
  HIDDEN_TERM: 'a word on the label may contain an avoided ingredient',
  OUTSIDE_SECTION_TERM: 'an avoided ingredient is mentioned elsewhere on the label',
  SHARED_LINE: 'it is made where foods this diet avoids are also made',
};
// Bump when the prompt changes: cached answers written under another version are regenerated.
export const PROMPT_VERSION = 2;
const cacheTag = (model) => `${model}|prompt-${PROMPT_VERSION}`;
const MAX_PER_GROUP = 5;
const MAX_SPELLINGS = 3;

// How a red ingredient is written: the label's spellings, but only those the rulebook itself
// knows for this ingredient (so nothing unrecognised is ever sent); else the rulebook's own.
function japaneseFor(id, printed, entry, rb) {
  const known = [...new Set(printed.map((p) => String(p || '').normalize('NFKC').trim()))]
    .filter((p) => p && rb.aliasOwner.get(normalizeAlias(p)) === id);
  return (known.length ? known : [entry.canonical]).slice(0, MAX_SPELLINGS);
}

// Everything Gemini sees, built only from the saved scan and the rulebook.
// context: 'packaged_product' for label scans (all scans today); 'restaurant_food' later for dishes.
export function buildInput(scan, rb, lang, context = 'packaged_product') {
  const profile = resolveProfile({ preset: scan.diet_preset, options: scan.options || [] }, rb);
  const pick = (obj) => (obj && (obj[lang] || obj.en)) || '';
  const tagsIn = (e, set) => e.tags.filter((t) => set.has(t)).map((t) => pick(rb.tags[t]?.label) || t);
  const local = (e) => (lang !== 'en' && e.meaning[lang] ? { meaningLocal: e.meaning[lang] } : {});

  // Definitely avoided: red items in the ingredient list (or a separate allergen field).
  const red = new Map();
  for (const i of scan.items || []) {
    if (i.reason !== 'FORBIDDEN_INGREDIENT') continue;
    const e = rb.entries.get(i.ingredientId);
    if (!e || e.kind !== 'ingredient') continue;
    if (!red.has(e.id)) red.set(e.id, { e, printed: [] });
    red.get(e.id).printed.push(i.original);
  }
  const definitelyAvoided = [...red.values()].slice(0, MAX_PER_GROUP).map(({ e, printed }) => ({
    meaning: e.meaning.en, ...local(e), japanese: japaneseFor(e.id, printed, e, rb), avoidedBecause: tagsIn(e, profile.forbid),
  }));

  // Unclear: source not stated, or a flagged word seen outside the list or inside an unknown word.
  // Never presented as definite. No Japanese is sent for these.
  const unclear = new Map();
  const addUnclear = (id, found) => {
    const e = rb.entries.get(id);
    if (!e || e.kind !== 'ingredient' || red.has(id) || unclear.has(id)) return;
    unclear.set(id, { meaning: e.meaning.en, ...local(e), found, mayBe: [...tagsIn(e, profile.ask), ...tagsIn(e, profile.forbid)] });
  };
  for (const i of scan.items || []) if (i.reason === 'ASK_INGREDIENT') addUnclear(i.ingredientId, 'in the ingredient list, source not stated');
  for (const h of scan.details?.hidden || []) addUnclear(h.ingredientId, 'possibly inside a word we could not recognise');
  for (const o of scan.details?.outside || []) addUnclear(o.ingredientId, 'mentioned elsewhere on the label, not in the ingredient list');

  return {
    language: lang,
    diet: pick(profile.label),
    result: scan.verdict,
    context,
    definitelyAvoided,
    unclearSource: [...unclear.values()].slice(0, MAX_PER_GROUP),
    reasons: (scan.reasons || []).map((c) => REASON_TEXT[c]).filter(Boolean),
    unknownWordCount: (scan.unknown_terms || []).length,
    unclearWordCount: (scan.low_confidence_terms || []).length,
  };
}

const defaultDeps = { geminiGenerate, getExplanation, saveExplanation, countLlmCalls, recordLlmCall };

// scan: a row the caller has already checked belongs to `user`. Returns
// { why, source: 'llm' | 'template', cached?, fallbackReason? }.
// deps (tests): { rulebook, settings, geminiGenerate, getExplanation, saveExplanation, countLlmCalls, recordLlmCall, fetchFn }
export async function explainScan({ scan, user, lang, rulebook }, deps = {}) {
  const d = { ...defaultDeps, ...deps };
  const s = {
    enabled: env.LLM_ENABLED, key: env.LLM_API_KEY, model: env.LLM_MODEL, thinkingLevel: env.LLM_THINKING_LEVEL,
    timeoutMs: env.LLM_TIMEOUT_MS, perMin: env.LLM_USER_PER_MIN, perDay: env.LLM_USER_PER_DAY, ...deps.settings,
  };
  let templateText;
  const template = (fallbackReason) => {
    templateText ??= templateWhyForRow(scan, rulebook, lang);
    return { why: templateText, source: 'template', fallbackReason };
  };

  try {
    if (scan.verdict !== 'red' && scan.verdict !== 'amber') return template('not_needed');
    if (!s.enabled) return template('disabled');
    if (!s.key) {
      logError('llm', 'not_configured');
      return template('not_configured');
    }

    const cached = await d.getExplanation(scan.id, lang);
    if (cached?.text && cached.model === cacheTag(s.model)) return { why: cached.text, source: 'llm', cached: true };

    const used = await d.countLlmCalls(user.id);
    if (used.minute >= s.perMin || used.day >= s.perDay) return template('user_limit');
    await d.recordLlmCall(user.id); // counted before calling, so parallel requests are counted too

    const input = buildInput(scan, rulebook, lang);
    const r = await d.geminiGenerate({
      key: s.key, model: s.model, thinkingLevel: s.thinkingLevel, timeoutMs: s.timeoutMs,
      system: SYSTEM_PROMPT, input, fetchFn: deps.fetchFn,
    });
    if (!r.ok) {
      logError('llm', r.detail, { status: r.status, httpStatus: r.httpStatus, reason: r.reason });
      return template(r.status === 'busy' ? 'llm_busy' : 'llm_' + r.detail);
    }

    const g = checkExplanation(r.text, {
      lang,
      context: input.context,
      flaggedMeaningsEn: [...input.definitelyAvoided, ...input.unclearSource].map((f) => f.meaning),
      unclearMeaningsEn: input.unclearSource.map((f) => f.meaning),
      allowedJapanese: input.definitelyAvoided.flatMap((f) => f.japanese),
    });
    if (!g.ok) {
      // Outside production the rejected answer is logged too, to tune the prompt and guard. It holds
      // no label text beyond the red items' Japanese words, and never reaches production logs.
      logError('llm_rejected', g.reason, { verdict: scan.verdict, lang, ...(isProduction ? {} : { answer: String(r.text).slice(0, 1000) }) });
      return template('rejected_' + g.reason);
    }

    try {
      await d.saveExplanation(scan.id, lang, g.why, cacheTag(s.model));
    } catch (err) {
      logError('save_explanation', err);
    }
    return { why: g.why, source: 'llm', cached: false };
  } catch (err) {
    // Database trouble (cache or limit) or anything unexpected: never call the LLM blind, never fail.
    logError('explain', err);
    return template('error');
  }
}
