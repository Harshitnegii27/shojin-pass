# Shojin Pass — verdict and rulebook engine

The part of the backend that decides **green / amber / red** for a Japanese food label and a diet.
Pure JavaScript (Node 20+), no network. Spec: *Shojin Pass Backend Architecture v2.1*.

```
npm install
npx vitest run                         # 220 tests
node scripts/evalText.js               # 138 edge cases, one line each
node scripts/validateRulebook.js       # rulebook checks (add --strict for release, --report for details)
node scripts/genSynthetic.js 500       # generated adversarial labels (fixed seed)
```

```js
import { getRulebook } from './lib/rulebook/loader.js';
import { scanLabel } from './lib/scan/scanText.js';
const r = scanLabel({ raw: '原材料名：小麦粉、ラード\n内容量：100g', preset: 'jain_strict', lang: 'hi' }, getRulebook());
// r.verdict 'red', r.verdictLine, r.why, r.items, r.reasons ...
```

**Before release:** every rulebook entry has `reviewedBy: []`. Two people must review each one.
Until then set `RULEBOOK_ALLOW_UNREVIEWED=true` in development; without it, no ingredient is
trusted and every label is amber (by design).

| Folder | What |
|---|---|
| `rulebook/` | tags, presets, options, ingredients (125 entries, ~1,800 spellings), annotations, field markers, chef phrases |
| `lib/rulebook/` | normalise → find sections → match → verdict |
| `lib/scan/analyze.js` | the whole pure pipeline for one label |
| `lib/text/templates.js` | fixed verdict lines and "why" sentences in English, Hindi, Gujarati |
| `tests/` | unit tests, 138 edge cases, property tests over every spelling, generated adversarial labels |
