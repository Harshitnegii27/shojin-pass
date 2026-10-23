// Fixed wording for OCR situations the engine's templates do not cover. Never written by an LLM.
// Hindi and Gujarati MUST be checked by a native speaker before release (as templates.js).

import { LANGS } from './templates.js';

const NOTICES = {
  // Azure free tier: 20 calls per minute.
  OCR_BUSY: {
    en: 'The label reader is busy right now. Please try again in a minute.',
    hi: 'लेबल पढ़ने की सेवा अभी व्यस्त है। कृपया एक मिनट बाद फिर कोशिश करें।',
    gu: 'લેબલ વાંચવાની સેવા હમણાં વ્યસ્ત છે. કૃપા કરીને એક મિનિટ પછી ફરી પ્રયત્ન કરો.',
  },
  // Our own global OCR budget is full for this 15-second slice (many photo scans at once).
  OCR_BUSY_SHORT: {
    en: 'Busy right now — please try again in a few seconds.',
    hi: 'अभी व्यस्त है — कृपया कुछ सेकंड बाद फिर कोशिश करें।',
    gu: 'હમણાં વ્યસ્ત છે — કૃપા કરીને થોડી સેકન્ડ પછી ફરી પ્રયત્ન કરો.',
  },
};

export function ocrNotice(code, lang) {
  const n = NOTICES[code];
  return n ? n[LANGS.includes(lang) ? lang : 'en'] : null;
}
