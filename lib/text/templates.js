// Fixed, reviewed wording. The verdict line is ONLY ever produced here (never by the LLM).
// Hindi and Gujarati MUST be checked by a native speaker before release.

export const LANGS = ['en', 'hi', 'gu'];

const VERDICT_LINES = {
  red:    { en: 'Not suitable for your {diet} diet', hi: 'आपके {diet} आहार के लिए उपयुक्त नहीं', gu: 'તમારા {diet} આહાર માટે યોગ્ય નથી' },
  amber:  { en: 'Check with staff before eating', hi: 'खाने से पहले स्टाफ़ से पूछें', gu: 'ખાતા પહેલાં સ્ટાફને પૂછો' },
  green:  { en: 'No avoided ingredients found on this label', hi: 'इस लेबल पर कोई वर्जित सामग्री नहीं मिली', gu: 'આ લેબલ પર કોઈ વર્જિત ઘટક મળ્યો નથી' },
  retake: { en: 'Please retake the photo', hi: 'कृपया फ़ोटो दोबारा लें', gu: 'કૃપા કરીને ફોટો ફરીથી લો' },
};

const WHY = {
  red:                  { en: 'Contains {list}.', hi: 'इसमें {list} है।', gu: 'આમાં {list} છે.' },
  INCOMPLETE_LIST:      { en: 'Make sure the whole ingredient list is in the photo.', hi: 'पक्का करें कि पूरी सामग्री सूची फ़ोटो में आए।', gu: 'ખાતરી કરો કે આખી ઘટક યાદી ફોટામાં આવે.' },
  NO_INGREDIENT_LIST:   { en: "Couldn't find the ingredient list. Scan the back of the pack or ask staff.", hi: 'सामग्री सूची नहीं मिली। पैक का पिछला हिस्सा स्कैन करें या स्टाफ़ से पूछें।', gu: 'ઘટક યાદી મળી નથી. પેકની પાછળની બાજુ સ્કેન કરો અથવા સ્ટાફને પૂછો.' },
  NO_INGREDIENTS_FOUND: { en: 'The ingredient list looks empty. Scan it again or ask staff.', hi: 'सामग्री सूची खाली लगती है। फिर से स्कैन करें या स्टाफ़ से पूछें।', gu: 'ઘટક યાદી ખાલી લાગે છે. ફરી સ્કેન કરો અથવા સ્ટાફને પૂછો.' },
  STRUCTURE_UNCLEAR:    { en: "Part of the list couldn't be read in order. Check the label or ask staff.", hi: 'सूची का कुछ हिस्सा ठीक से नहीं पढ़ा जा सका। लेबल देखें या स्टाफ़ से पूछें।', gu: 'યાદીનો કેટલોક ભાગ બરાબર વાંચી શકાયો નથી. લેબલ જુઓ અથવા સ્ટાફને પૂછો.' },
  LOW_CONFIDENCE:       { en: 'Couldn\'t read "{text}" clearly. Check the label or ask staff.', hi: '"{text}" साफ़ नहीं पढ़ा जा सका। लेबल देखें या स्टाफ़ से पूछें।', gu: '"{text}" સ્પષ્ટ વાંચી શકાયું નથી. લેબલ જુઓ અથવા સ્ટાફને પૂછો.' },
  UNKNOWN_TERM:         { en: 'We don\'t know "{text}" yet. Show the chef card to ask.', hi: 'हम "{text}" को अभी नहीं जानते। पूछने के लिए शेफ़ कार्ड दिखाएँ।', gu: 'અમે હજી "{text}" જાણતા નથી. પૂછવા માટે શેફ કાર્ડ બતાવો.' },
  HIDDEN_TERM:          { en: '"{text}" may contain {meaning}. Show the chef card to ask.', hi: '"{text}" में {meaning} हो सकता है। पूछने के लिए शेफ़ कार्ड दिखाएँ।', gu: '"{text}" માં {meaning} હોઈ શકે. પૂછવા માટે શેફ કાર્ડ બતાવો.' },
  OUTSIDE_SECTION_TERM: { en: 'We also saw "{text}" elsewhere on the label. Check with staff.', hi: 'लेबल पर कहीं और "{text}" भी दिखा। स्टाफ़ से पूछें।', gu: 'લેબલ પર બીજે ક્યાંક "{text}" પણ દેખાયું. સ્ટાફને પૂછો.' },
  SHARED_LINE:          { en: 'Made on a line or in a factory that also handles {list}.', hi: 'ऐसी जगह बना है जहाँ {list} भी बनता है।', gu: 'એવી જગ્યાએ બનેલું છે જ્યાં {list} પણ બને છે.' },
  ASK_INGREDIENT:       { en: '{meaning} may be avoided in your diet. Show the chef card to ask.', hi: '{meaning} आपके आहार में वर्जित हो सकता है। पूछने के लिए शेफ़ कार्ड दिखाएँ।', gu: '{meaning} તમારા આહારમાં વર્જિત હોઈ શકે. પૂછવા માટે શેફ કાર્ડ બતાવો.' },
  green:                { en: 'None of the ingredients we read are avoided in your diet.', hi: 'हमने जो सामग्री पढ़ी, उनमें से कोई भी आपके आहार में वर्जित नहीं है।', gu: 'અમે વાંચેલા કોઈ પણ ઘટક તમારા આહારમાં વર્જિત નથી.' },
  OCR_LOW_PAGE_CONFIDENCE: { en: 'Hold the label flat and closer, and avoid glare.', hi: 'लेबल को सीधा और पास रखें, चमक से बचें।', gu: 'લેબલને સીધું અને નજીક રાખો, ચમકથી બચો.' },
  OCR_UNAVAILABLE:      { en: "Couldn't read the label right now. Please try again.", hi: 'अभी लेबल नहीं पढ़ा जा सका। कृपया फिर कोशिश करें।', gu: 'હમણાં લેબલ વાંચી શકાયું નથી. કૃપા કરીને ફરી પ્રયત્ન કરો.' },
};

const AND = { en: ' and ', hi: ' और ', gu: ' અને ' };
const COMMA = { en: ', ', hi: ', ', gu: ', ' };

// Amber reasons in the order they are explained (first one wins).
export const AMBER_ORDER = [
  'INCOMPLETE_LIST', 'NO_INGREDIENT_LIST', 'NO_INGREDIENTS_FOUND', 'STRUCTURE_UNCLEAR', 'LOW_CONFIDENCE',
  'UNKNOWN_TERM', 'HIDDEN_TERM', 'OUTSIDE_SECTION_TERM', 'SHARED_LINE', 'ASK_INGREDIENT',
];

const pickLang = (lang) => (LANGS.includes(lang) ? lang : 'en');
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
const short = (s, n = 14) => (s.length > n ? s.slice(0, n) + '…' : s);
const meaningIn = (m, lang) => (m && (m[lang] || m.en)) || '';

function joinList(words, lang) {
  const w = [...new Set(words)].slice(0, 3);
  if (w.length <= 1) return w.join('');
  return w.slice(0, -1).join(COMMA[lang]) + AND[lang] + w[w.length - 1];
}

export function verdictLine(verdict, dietLabel, lang) {
  const l = pickLang(lang);
  const line = VERDICT_LINES[verdict];
  if (!line) throw new Error('Unknown verdict ' + verdict);
  return fill(line[l], { diet: (dietLabel && (dietLabel[l] || dietLabel.en)) || '' });
}

export function templateWhy(result, lang) {
  const l = pickLang(lang);
  const r = new Set(result.reasons || []);
  if (result.verdict === 'retake') {
    const code = r.has('OCR_UNAVAILABLE') ? 'OCR_UNAVAILABLE' : 'OCR_LOW_PAGE_CONFIDENCE';
    return WHY[code][l];
  }
  if (result.verdict === 'red') {
    const reds = (result.items || []).filter((i) => i.colour === 'red').map((i) => meaningIn(i.meaning, l));
    return fill(WHY.red[l], { list: joinList(reds, l) });
  }
  if (result.verdict === 'green') return WHY.green[l];
  const code = AMBER_ORDER.find((c) => r.has(c));
  const vars = {};
  if (code === 'LOW_CONFIDENCE') vars.text = short((result.lowConfidence && result.lowConfidence[0] && result.lowConfidence[0].text) || '?');
  if (code === 'UNKNOWN_TERM') vars.text = short(((result.unknown || []).find((u) => !u.lowConfidence) || {}).original || '?');
  if (code === 'HIDDEN_TERM') {
    const h = (result.hidden || [])[0] || {};
    const host = (result.unknown || []).find((u) => u.text.includes(h.text));
    vars.text = short((host && host.original) || h.original || '?');
    vars.meaning = meaningIn(h.meaning, l);
  }
  if (code === 'OUTSIDE_SECTION_TERM') vars.text = short(((result.outside || [])[0] || {}).original || '?');
  if (code === 'SHARED_LINE') vars.list = joinList((result.notes || []).flatMap((n) => n.mentions || []), l) || '—';
  if (code === 'ASK_INGREDIENT') {
    const a = (result.items || []).find((i) => i.reason === 'ASK_INGREDIENT');
    vars.meaning = a ? meaningIn(a.meaning, l) : '';
  }
  return code ? fill(WHY[code][l], vars) : WHY.green[l];
}

export function attachText(result, dietLabel, lang) {
  return { ...result, verdictLine: verdictLine(result.verdict, dietLabel, lang), why: templateWhy(result, lang), whySource: 'template' };
}
