// The LLM "why" for a saved scan (spec 11, stage 4). The LLM only explains: the verdict, reasons
// and verdict line never change, and it never sees label text, photos, or any id. Every failure
// returns the fixed template "why" (source 'template'); this function never throws.

import 'server-only';
import { env } from '../config/env.js';
import { resolveProfile } from '../diet/resolveProfile.js';
import { countLlmCalls, getExplanation, recordLlmCall, saveExplanation } from '../db/scans.js';
import { logError } from '../http/log.js';
import { templateWhyForRow } from '../scan/savedScan.js';
import { geminiGenerate } from './gemini.js';
import { checkExplanation } from './guard.js';

export const SYSTEM_PROMPT = `You explain the result of a food-label check to an Indian traveller in Japan.
The result was already decided by a fixed rulebook and is shown to the user separately. You never decide, state, repeat or change it.

The input is JSON with: language, diet, result ("red" = contains something this diet avoids, "amber" = could not be confirmed),
reasons (what the check found, in plain words), flagged (ingredients with their meaning and why they concern this diet),
unknownWordCount and unclearWordCount.

Write 3 to 5 short sentences, at most 600 characters in total, only in the language given by "language":
"en" = English, "hi" = Hindi in Devanagari script, "gu" = Gujarati in Gujarati script.
1. Say what the flagged ingredients are, using only their meanings from the input.
2. Say why they matter for this diet.
3. Give one practical tip: what to look for on other products, or what to ask the staff (suggest showing the chef card).
If nothing is flagged, explain the reasons in plain words instead, and suggest asking the staff with the chef card.

Rules:
- Mention only ingredients listed in "flagged". Never add other ingredients.
- Never say or imply that the food is safe, suitable, fine, okay, allowed or permitted, or that the user can eat it.
  Do not use those words at all, not even negated.
- If the result is "amber", say that the label could not be fully checked.
- No percentages, no numbers with units, no links, no brand names, no Japanese text, no lists or headings.
- Reply with JSON only: {"why": "..."}`;

// Plain words for each reason (sent instead of codes the model might misread).
const REASON_TEXT = {
  FORBIDDEN_INGREDIENT: 'contains an ingredient this diet avoids',
  ASK_INGREDIENT: 'contains an ingredient that may be avoided in this diet, depending on its source',
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
const MAX_FLAGGED = 6;

// Everything Gemini sees. Built only from the saved scan and the rulebook.
export function buildInput(scan, rb, lang) {
  const profile = resolveProfile({ preset: scan.diet_preset, options: scan.options || [] }, rb);
  const pick = (obj) => (obj && (obj[lang] || obj.en)) || '';
  const flagged = [];
  const add = (id, why) => {
    const e = rb.entries.get(id);
    if (!e || e.kind !== 'ingredient' || flagged.some((f) => f.id === id) || flagged.length >= MAX_FLAGGED) return;
    const concern = e.tags.filter((t) => profile.forbid.has(t) || profile.ask.has(t)).map((t) => ({
      tag: pick(rb.tags[t]?.label) || t, level: profile.forbid.has(t) ? 'avoided by this diet' : 'avoided by some, depends on source',
    }));
    flagged.push({ id, meaning: e.meaning.en, ...(lang !== 'en' && e.meaning[lang] ? { meaningLocal: e.meaning[lang] } : {}), found: why, concern });
  };
  for (const i of scan.items || []) {
    if (i.reason === 'FORBIDDEN_INGREDIENT' || i.reason === 'ASK_INGREDIENT') add(i.ingredientId, i.reason === 'FORBIDDEN_INGREDIENT' ? 'in the ingredient list' : 'in the ingredient list (source not stated)');
  }
  for (const h of scan.details?.hidden || []) add(h.ingredientId, 'possibly inside an unrecognised word');
  for (const o of scan.details?.outside || []) add(o.ingredientId, 'elsewhere on the label');

  return {
    language: lang,
    diet: pick(profile.label),
    result: scan.verdict,
    reasons: (scan.reasons || []).map((c) => REASON_TEXT[c]).filter(Boolean),
    flagged: flagged.map(({ id, ...f }) => f), // ingredient ids stay on the server
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
    if (cached) return { why: cached, source: 'llm', cached: true };

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

    const g = checkExplanation(r.text, { lang, flaggedMeaningsEn: input.flagged.map((f) => f.meaning) });
    if (!g.ok) {
      logError('llm_rejected', g.reason, { verdict: scan.verdict, lang });
      return template('rejected_' + g.reason);
    }

    try {
      await d.saveExplanation(scan.id, lang, g.why, s.model);
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
