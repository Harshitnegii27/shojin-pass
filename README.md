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

## Frontend (app screens)

Next.js App Router · React 19 · TypeScript for the screens (`.tsx`) next to the JavaScript backend ·
Tailwind CSS 3 · Framer Motion · lucide-react. Fonts are self-hosted with Fontsource, so the site
builds and runs without reaching Google Fonts. Built by Team Kakehashi 架け橋.

```
npm run dev        # http://localhost:3000
npm run build && npm start
```

| Route | What it is |
|---|---|
| `/` | Landing page: hero, how it works, features, shōjin ryōri insight, FAQ |
| `/scanner` | Trust Scanner: family members with their diets, samples / photo / pasted text, verdict + reason in English, हिंदी or ગુજરાતી |
| `/routes` · `/routes/[slug]` | Shojin Routes list and detail with timeline and a (demo) booking form |
| `/venues` | Partner venues on a stylised Kyoto / Koyasan map, filtered by type and your diet |
| `/chef-card` | Show the Chef: polite Japanese card for your diet, tap-to-reply answers, printable |
| `/partners` | For tourism bodies and venues: 10-point checklist self-check (demo form) |
| `/about` | Story, success metrics, team |
| `/dev` | Backend test console (not on production) |

The screens live in `app/(screens)/` with their own layout (header, footer, providers); `/dev` stays
outside it. Every verdict comes from the server through `lib/client/shojinClient.js`: the screens never
judge an ingredient and never call `fetch` themselves. Photos check Person 1's diet first ("Check for
everyone" scans the rest); text and samples check everyone at once.

Where to edit things:

- `lib/ui/content.ts`: landing-page copy, stats, FAQ.
- `lib/ui/site-data.ts`: Shojin Routes, venues (demo data until stage 5), certification checklist.
- `lib/ui/diets.ts`: the diet pickers; names come from `rulebook/diets.json`.
- `tailwind.config.ts`: design tokens from the pitch deck: `washi` cream, `ai` indigo, `shu` vermilion, `moss`, `amber`.
