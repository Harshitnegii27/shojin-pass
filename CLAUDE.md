# Instructions for Claude Code — Shojin Pass backend

Read `docs/spec.md` (the full build specification, v2.1) before writing any code. Follow it exactly.
When the spec and this file disagree, this file wins; when anything is unclear, ask instead of guessing.

## What already exists (do not rewrite)

The verdict and rulebook engine is built and tested:

- `rulebook/` — rulebook data (tags, presets, options, ingredients, annotations, markers, chef phrases)
- `lib/rulebook/`, `lib/diet/`, `lib/scan/analyze.js`, `lib/scan/scanText.js`, `lib/text/templates.js`
- `scripts/validateRulebook.js`, `scripts/evalText.js`, `scripts/genSynthetic.js`
- `tests/` — 220 tests, including 138 edge cases (`tests/fixtures/edge-cases.json`)

Rules:

1. **Do not change the engine's behaviour.** Do not edit files under `lib/rulebook/`, `lib/diet/`,
   `lib/scan/analyze.js`, `lib/text/templates.js` or `rulebook/` unless I explicitly ask. Build around them.
2. **`npx vitest run` must keep passing (220 tests) after every stage.** If a change breaks a test,
   fix your change, never the test.
3. Use `scanLabel()` from `lib/scan/scanText.js` for every verdict. Never decide a verdict anywhere else,
   and never let the LLM write or change a verdict (spec sections 4 and 11).
4. Uncertainty is never green. Any new failure path (OCR error, timeout, bad input) must end in
   `amber`, `retake` or an error response — never `green`.

## How to work

Build in stages. Finish one stage, run the tests, show me how to try it locally, then stop and wait.

1. Next.js project around the existing code; `/api/health` and `/api/scan/text` (spec 13.1–13.5).
2. Supabase: `supabase/migrations/001_init.sql`, anonymous login with Turnstile, `/api/profile` GET/PUT/DELETE (spec 13.8, 14).
3. Photo scans: `prepareImage`, Google Vision `readLabel` returning per-character confidence, `/api/scan`, saving scans (spec 9.1–9.4, 9.12, 13.4).
4. `/api/scan/{id}/explain` and `/api/scan/{id}/feedback` (spec 11, 13.6, 13.7).
5. Chef card, routes (with sunset rule), venues (spec 15, 13.9–13.11).
6. Rate limits, deep health check, cron, deployment config (spec 13.12, 16, 19).

## Secrets

Never write real keys into code, tests or chat. Read them only through `lib/config/env.js` (spec 7).
I will put real values in `.env.local` myself. Keep `.env.local` in `.gitignore`.

## Rulebook status

All 125 rulebook entries are a draft with `reviewedBy: []`. In development set
`RULEBOOK_ALLOW_UNREVIEWED=true`. Without it every label is amber — that is intended, not a bug.
