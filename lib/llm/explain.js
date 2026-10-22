// The LLM "why" for a saved scan (spec 11, stage 4). The LLM only explains: the verdict, reasons
// and verdict line never change. Gemini fills short structured fields (prompt v3); the server
// writes the text around them (compose.js): red items plainly with their Japanese word, unclear
// items only inside a fixed hedged sentence. Gemini never sees photos, ids, label text or any
// Japanese. The guard then checks the final text. Every failure returns the fixed template "why"
// (source 'template'); this function never throws.

import 'server-only';
import { env, isProduction } from '../config/env.js';
import { resolveProfile } from '../diet/resolveProfile.js';
import { normalizeAlias } from '../rulebook/normalize.js';
import { countLlmCalls, getExplanation, recordLlmCall, saveExplanation } from '../db/scans.js';
import { logError } from '../http/log.js';
import { templateWhyForRow } from '../scan/savedScan.js';
import { geminiGenerate } from './gemini.js';
import { checkExplanation } from './guard.js';
import { composeExplanation, responseSchema } from './compose.js';

export const SYSTEM_PROMPT = `You help explain the result of a food-label check to an Indian traveller in Japan.
The result was already decided by a fixed rulebook and is shown to the user separately. You never decide, state, repeat or change it.
You only fill in short fields; the app writes the final text around them.

The input is JSON with:
- language, diet, result ("red" = contains something this diet avoids, "amber" = could not be confirmed)
- context: "packaged_product" (a packet bought in a shop) or "restaurant_food" (a dish in a restaurant)
- definitelyAvoided: ingredients this diet avoids for certain, each with a "key", its meaning and why it is avoided
- unclearSource: ingredients that may or may not be a problem (source not stated, or seen elsewhere on the label)
- reasons, unknownWordCount, unclearWordCount

Fill the JSON fields, written only in the language given by "language"
("en" = English, "hi" = Hindi in Devanagari script, "gu" = Gujarati in Gujarati script):
- red: one entry per definitelyAvoided item, with the same "key".
    name: the ingredient's short everyday name, 1 to 4 words (for example "Alcohol", "Shrimp or crab").
    why: one short sentence, at most 15 words, saying plainly why this diet avoids it.
- unclear: if unclearSource is empty, both fields are "".
    names: the unclearSource items' short names as one list (for example "Flavouring, enzyme and seasoning").
    mayContain: only what they might be made from, as a short noun phrase (for example "fish, meat or insect products").
      No verb, no "may", no certainty words.
- tip: one short sentence, at most 25 words, that fits the context:
    packaged_product: what to look for on other packs (for example choosing packs that name a plant source).
      Do not mention a chef card, a restaurant or kitchen staff.
    restaurant_food: suggest showing the chef card to the staff.

Rules:
- Never write Japanese or romaji; the app adds the Japanese words itself.
- Mention only the ingredients given. Never add others.
- Never say or imply that the food is safe, suitable, fine, okay, allowed or permitted, or that the user can eat it.
  Do not use those words at all, not even negated.
- No percentages, no numbers with units, no links, no brand names.
- Each field is one sentence or phrase with no line breaks.`;

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
export const PROMPT_VERSION = 3;
const cacheTag = (model) => `${model}|prompt-${PROMPT_VERSION}`;
const MAX_PER_GROUP = 5;
const MAX_SPELLINGS = 3;

// How a red ingredient is written: the label's spellings, but only those the rulebook itself
// knows for this ingredient (so nothing unrecognised is ever sent); else the rulebook's own.
function japaneseFor(id, printed, entry, rb) {
  // A word printed across a line break ("酒\n精") is shown joined; Japanese words have no spaces.
  const known = [...new Set(printed.map((p) => String(p || '').normalize('NFKC').replace(/\s+/g, '')))]
    .filter((p) => p && rb.aliasOwner.get(normalizeAlias(p)) === id);
  return (known.length ? known : [entry.canonical]).slice(0, MAX_SPELLINGS);
}

// The facts for one explanation, built only from the saved scan and the rulebook. The Japanese
// words stay on the server (geminiInput() removes them); compose.js adds them to the text.
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
  const definitelyAvoided = [...red.values()].slice(0, MAX_PER_GROUP).map(({ e, printed }, i) => ({
    key: 'r' + (i + 1), meaning: e.meaning.en, ...local(e), japanese: japaneseFor(e.id, printed, e, rb), avoidedBecause: tagsIn(e, profile.forbid),
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

// What Gemini actually receives: the input without any Japanese.
export function geminiInput(input) {
  return { ...input, definitelyAvoided: input.definitelyAvoided.map(({ japanese, ...rest }) => rest) };
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
    // Nothing flagged (amber for a cut-off list, unknown words …): the template already says it.
    if (!input.definitelyAvoided.length && !input.unclearSource.length) return template('nothing_to_explain');
    const r = await d.geminiGenerate({
      key: s.key, model: s.model, thinkingLevel: s.thinkingLevel, timeoutMs: s.timeoutMs,
      system: SYSTEM_PROMPT, input: geminiInput(input), schema: responseSchema(input.definitelyAvoided.map((x) => x.key)),
      fetchFn: deps.fetchFn,
    });
    if (!r.ok) {
      logError('llm', r.detail, { status: r.status, httpStatus: r.httpStatus, reason: r.reason });
      return template(r.status === 'busy' ? 'llm_busy' : 'llm_' + r.detail);
    }

    const rejected = (reason, composed) => {
      // Outside production the rejected answer (and the text composed from it) is logged too, to
      // tune the prompt and guard. Never in production logs.
      const detail = isProduction ? {} : { answer: String(r.text).slice(0, 1000), ...(composed ? { composed: composed.slice(0, 1000) } : {}) };
      logError('llm_rejected', reason, { verdict: scan.verdict, lang, ...detail });
      return template('rejected_' + reason);
    };
    const c = composeExplanation(r.text, { lang, red: input.definitelyAvoided, hasUnclear: input.unclearSource.length > 0 });
    if (!c.ok) return rejected(c.reason);

    // Final safety check on what Gemini wrote, inside the fixed frame. The Japanese words the server
    // added are left out (checkText): they come from the rulebook, not from Gemini, so no Japanese
    // is allowed here at all.
    const g = checkExplanation(JSON.stringify({ why: c.checkText }), {
      lang,
      context: input.context,
      flaggedMeaningsEn: [...input.definitelyAvoided, ...input.unclearSource].map((f) => f.meaning),
      unclearMeaningsEn: input.unclearSource.map((f) => f.meaning),
      allowedJapanese: [],
    });
    if (!g.ok) return rejected(g.reason, c.why);

    try {
      await d.saveExplanation(scan.id, lang, c.why, cacheTag(s.model));
    } catch (err) {
      logError('save_explanation', err);
    }
    return { why: c.why, source: 'llm', cached: false };
  } catch (err) {
    // Database trouble (cache or limit) or anything unexpected: never call the LLM blind, never fail.
    logError('explain', err);
    return template('error');
  }
}
