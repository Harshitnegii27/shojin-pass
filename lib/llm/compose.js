// Structured explanation (prompt v3): Gemini fills short fields, the server writes the text.
// Red items are stated plainly with their Japanese word (added here, never written by Gemini);
// unclear items only ever appear inside a fixed hedged sentence. Pure; no I/O.

export const MAX_FIELD = 160;
export const MAX_RED_DESCRIBED = 3; // more red items are listed in one "also avoided" sentence

// The response format Gemini must follow (generationConfig.responseSchema, OpenAPI subset).
export function responseSchema(redKeys) {
  const key = { type: 'STRING', ...(redKeys.length ? { enum: redKeys } : {}) };
  return {
    type: 'OBJECT',
    properties: {
      red: {
        type: 'ARRAY',
        maxItems: Math.max(redKeys.length, 1),
        items: {
          type: 'OBJECT',
          properties: { key, name: { type: 'STRING' }, why: { type: 'STRING' } },
          required: ['key', 'name', 'why'],
          propertyOrdering: ['key', 'name', 'why'],
        },
      },
      unclear: {
        type: 'OBJECT',
        properties: { names: { type: 'STRING' }, mayContain: { type: 'STRING' } },
        required: ['names', 'mayContain'],
        propertyOrdering: ['names', 'mayContain'],
      },
      tip: { type: 'STRING' },
    },
    required: ['red', 'unclear', 'tip'],
    propertyOrdering: ['red', 'unclear', 'tip'],
  };
}

// Fixed sentences around Gemini's fields. Hindi and Gujarati MUST be checked by a native speaker.
const FRAME = {
  en: {
    red: (name, ja, why) => `${name} (${ja}): ${why}`,
    also: (list) => `Also avoided: ${list}`,
    unclear: (names, may) => `Not clear from the label: ${names} may contain ${may}`,
    end: '.',
  },
  hi: {
    red: (name, ja, why) => `${name} (${ja}): ${why}`,
    also: (list) => `ये भी वर्जित हैं: ${list}`,
    unclear: (names, may) => `लेबल से साफ़ नहीं है: ${names} में ${may} हो सकता है`,
    end: '।',
  },
  gu: {
    red: (name, ja, why) => `${name} (${ja}): ${why}`,
    also: (list) => `આ પણ વર્જિત છે: ${list}`,
    unclear: (names, may) => `લેબલ પરથી સ્પષ્ટ નથી: ${names} માં ${may} હોઈ શકે`,
    end: '.',
  },
};

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー・]/u;
const fail = (reason) => ({ ok: false, reason });

// One short, single-sentence field: trimmed, no Japanese (the server adds it), no line breaks,
// at most one sentence end, which is removed so the frame can add its own.
function field(v, { required }) {
  if (typeof v !== 'string') return { error: 'bad_shape' };
  const s = v.replace(/\s+/g, ' ').trim().replace(/[.!?।]+$/u, '').trim();
  if (!s) return required ? { error: 'empty_field' } : { value: '' };
  if (s.length > MAX_FIELD) return { error: 'field_too_long' };
  if (JAPANESE.test(s)) return { error: 'field_has_japanese' };
  if (/[.!?।]\s/u.test(s)) return { error: 'field_not_one_sentence' };
  return { value: s };
}

// reply: Gemini's JSON text. plan: { lang, red: [{ key, japanese: [] }], hasUnclear }.
// Returns { ok: true, why, checkText } or { ok: false, reason }.
//   why        the text the user sees, with the server-added Japanese words.
//   checkText  the same sentences without the server-added Japanese, for the guard: the guard
//              judges only what Gemini wrote (plus the fixed frame), never the server's Japanese.
export function composeExplanation(reply, plan) {
  let data;
  try {
    data = JSON.parse(String(reply).trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return fail('not_json');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.red) || typeof data.unclear !== 'object' || !data.unclear) return fail('bad_shape');
  const f = FRAME[plan.lang];
  if (!f) return fail('bad_language');

  // Every red item exactly once, nothing else.
  const byKey = new Map();
  for (const r of data.red) {
    if (!r || typeof r !== 'object' || !plan.red.some((p) => p.key === r.key) || byKey.has(r.key)) return fail('unexpected_red');
    byKey.set(r.key, r);
  }
  if (byKey.size !== plan.red.length) return fail('missing_red');

  const shown = [];   // sentences the user sees
  const checked = []; // the same, without the server-added Japanese
  const both = (s, c = s) => { shown.push(s); checked.push(c); };
  const also = [];
  for (const [i, p] of plan.red.entries()) {
    const name = field(byKey.get(p.key).name, { required: true });
    const why = field(byKey.get(p.key).why, { required: true });
    if (name.error || why.error) return fail(name.error || why.error);
    const ja = p.japanese.join(', ');
    if (i < MAX_RED_DESCRIBED) both(f.red(name.value, ja, why.value), `${name.value}: ${why.value}`);
    else also.push({ shown: `${name.value} (${ja})`, checked: name.value });
  }
  if (also.length) both(f.also(also.map((a) => a.shown).join(', ')), f.also(also.map((a) => a.checked).join(', ')));

  if (plan.hasUnclear) {
    const names = field(data.unclear.names, { required: true });
    const may = field(data.unclear.mayContain, { required: true });
    if (names.error || may.error) return fail(names.error || may.error);
    both(f.unclear(names.value, may.value));
  }

  const tip = field(data.tip, { required: true });
  if (tip.error) return fail(tip.error);
  both(tip.value);

  const join = (xs) => xs.map((s) => s + f.end).join(' ');
  return { ok: true, why: join(shown), checkText: join(checked) };
}
