// The Japanese chef card (spec 15.1), built from fixed phrases only: rulebook/phrases.ja.json for the
// Japanese, rulebook/tags.json labels and the frames below for the translations. No LLM: a chef must
// see exactly the same wording every time. Pure; no network.
//
// The Japanese phrases, and the Hindi and Gujarati frames below, MUST be checked by a native speaker
// before release (reviewNeeded is sent with every card so the app keeps saying so).

import { resolveProfile } from '../diet/resolveProfile.js';
import { formatJst } from '../time/jst.js';

export const LANGS = ['en', 'hi', 'gu'];

// Tags the ask line may mention (spec 15.1: root vegetables, fungus, alcohol, and their close kin).
export const ASK_LINE_TAGS = new Set(['root_vegetable', 'root_vegetable_possible', 'dried_rhizome', 'fungus', 'alcohol']);

const FRAMES = {
  identity: {
    jain: { en: 'I’m sorry, I am a Jain vegetarian.', hi: 'क्षमा करें, मैं जैन शाकाहारी हूँ।', gu: 'માફ કરશો, હું જૈન શાકાહારી છું.' },
    vegetarian: { en: 'I’m sorry, I am a vegetarian.', hi: 'क्षमा करें, मैं शाकाहारी हूँ।', gu: 'માફ કરશો, હું શાકાહારી છું.' },
  },
  forbid: { en: 'I cannot eat: {list}.', hi: 'ये चीज़ें मेरे लिए वर्जित हैं: {list}।', gu: 'આ વસ્તુઓ મારા માટે વર્જિત છે: {list}.' },
  ask: { en: 'If possible, I would also like to avoid: {list}.', hi: 'हो सके तो इनसे भी बचना है: {list}।', gu: 'શક્ય હોય તો આ પણ ટાળવું છે: {list}.' },
  question: { en: 'Does this dish contain any of these?', hi: 'क्या इस व्यंजन में इनमें से कुछ है?', gu: 'શું આ વાનગીમાં આમાંથી કંઈ છે?' },
  questionDish: { en: 'Does “{dish}” contain any of these?', hi: 'क्या “{dish}” में इनमें से कुछ है?', gu: 'શું “{dish}” માં આમાંથી કંઈ છે?' },
};

// Button translations; English comes from phrases.ja.json.
const BUTTONS = {
  contains: { hi: 'इसमें इनमें से कुछ है', gu: 'આમાં આમાંથી કંઈક છે' },
  can_make_without: { hi: 'हम इनके बिना बना सकते हैं', gu: 'અમે આ વગર બનાવી શકીએ' },
  fine: { hi: 'यह व्यंजन ठीक है', gu: 'આ વાનગી બરાબર છે' },
};

export const REVIEW_NOTE = 'Japanese, Hindi and Gujarati wording awaiting a native speaker’s check.';

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const LIST_SEP = { en: ', ', hi: ', ', gu: ', ' };

// One phrase per tag, in tags.json order; tags without a phrase are skipped and identical phrases
// appear once (fish_seafood and likely_fish_stock share one). Each group keeps its tags' labels.
function phraseGroups(tags, rb) {
  const groups = [];
  for (const tag of Object.keys(rb.tags)) {
    if (!tags.has(tag)) continue;
    const ja = rb.phrases.tags[tag];
    if (!ja) continue;
    const g = groups.find((x) => x.ja === ja);
    if (g) g.tags.push(tag);
    else groups.push({ ja, tags: [tag] });
  }
  return groups;
}

function translate(groups, lang, rb) {
  return groups
    .map((g) => [...new Set(g.tags.map((t) => rb.tags[t].label[lang] || rb.tags[t].label.en))].join(' / '))
    .join(LIST_SEP[lang]);
}

// members: [{ preset, options }] — one person, or everyone at the table (forbidden tags merged; Jain
// opening if anyone is Jain). dishNameJa: optional, already validated. now: for tests.
export function buildChefCard({ members, dishNameJa = null, now = new Date() }, rb) {
  if (!Array.isArray(members) || members.length === 0) throw new Error('At least one member is needed');
  const profiles = members.map((m) => resolveProfile({ preset: m.preset, options: m.options || [] }, rb));
  const forbid = new Set(profiles.flatMap((p) => [...p.forbid]));
  const ask = new Set(profiles.flatMap((p) => [...p.ask]).filter((t) => !forbid.has(t) && ASK_LINE_TAGS.has(t)));
  const identity = profiles.some((p) => p.chefIdentity === 'jain') ? 'jain' : 'vegetarian';
  const ph = rb.phrases;

  const lines = [{ kind: 'identity', ja: ph.identity[identity], ...FRAMES.identity[identity] }];
  const forbidGroups = phraseGroups(forbid, rb);
  if (forbidGroups.length) {
    lines.push({
      kind: 'forbid',
      ja: forbidGroups.map((g) => g.ja).join('・') + ph.endings.forbid,
      ...Object.fromEntries(LANGS.map((l) => [l, fill(FRAMES.forbid[l], { list: translate(forbidGroups, l, rb) })])),
    });
  }
  const askGroups = phraseGroups(ask, rb);
  if (askGroups.length) {
    lines.push({
      kind: 'ask',
      ja: askGroups.map((g) => g.ja).join('・') + ph.endings.ask,
      ...Object.fromEntries(LANGS.map((l) => [l, fill(FRAMES.ask[l], { list: translate(askGroups, l, rb) })])),
    });
  }
  lines.push({
    kind: 'question',
    ja: (dishNameJa ? `「${dishNameJa}」` : '') + ph.endings.question,
    ...Object.fromEntries(LANGS.map((l) => [l, dishNameJa ? fill(FRAMES.questionDish[l], { dish: dishNameJa }) : FRAMES.question[l]])),
  });

  const joined = (key, sep) => lines.map((x) => x[key]).join(sep);
  return {
    identity,
    profiles: profiles.map((p) => ({ preset: p.preset, options: p.options, label: p.label })),
    lines,
    ja: joined('ja', ''),
    en: joined('en', ' '),
    hi: joined('hi', ' '),
    gu: joined('gu', ' '),
    buttons: Object.entries(ph.buttons).map(([id, b]) => ({ id, ja: b.ja, en: b.en, ...BUTTONS[id] })),
    issuedAt: now.toISOString(),
    issuedAtJst: formatJst(now, { withDate: true }),
    reviewNeeded: { ja: true, hi: true, gu: true, note: REVIEW_NOTE },
  };
}
