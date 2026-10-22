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
2. **`npx vitest run` must keep passing after every stage** (220 engine tests plus the tests added
   since). If a change breaks a test, fix your change, never the test.
3. Use `scanLabel()` from `lib/scan/scanText.js` for every verdict. Never decide a verdict anywhere else,
   and never let the LLM write or change a verdict (spec sections 4 and 11).
4. Uncertainty is never green. Any new failure path (OCR error, timeout, bad input) must end in
   `amber`, `retake` or an error response — never `green`.

## How to work

Build in stages. Finish one stage, run the tests, show me how to try it locally, then stop and wait.
Commit at the end of a stage only if every test passes. The test count may grow; it must never shrink.

1. Done. Next.js project around the existing code; `/api/health` and `/api/scan/text` (spec 13.1–13.5).
2. Done (migration applied to the real project; sign-in, saving the diet and a saved scan tested on
   the laptop, 22 October 2026). Supabase: `supabase/migrations/001_init.sql` (profiles, scans,
   scan_feedback), anonymous login with Turnstile, `/api/profile` GET/PUT/DELETE (spec 13.8, 14).
3. Built, waiting for my test with real photos. Photo scans: `prepareImage`, Azure AI Vision in
   `readLabel`, `/api/scan`, saving scans (spec 9.1–9.4, 9.12, 13.4). **Uses Read 3.2** (language `ja`):
   Image Analysis 4.0 is not available in Central India, my resource's region (Free F0: 20 calls/minute,
   5,000/month; every poll counts). Every character gets its word's confidence.
   Keys: `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`. Automated tests never call Azure
   (`tests/setup/noNetwork.js` blocks the network).
4. `/api/scan/{id}/explain` with the LLM as in spec 11, using the **Google Gemini API** (free key from
   Google AI Studio; `LLM_API_KEY`, `LLM_MODEL`), plus `/api/scan/{id}/feedback` (spec 11, 13.6, 13.7).
   The LLM only writes the "why" sentence; it never decides or changes a verdict. If it is disabled,
   has no key, times out or fails, the scan still works and shows the template "why".
5. Chef card, routes (with sunset rule), venues **from JSON files** (spec 15, 13.9–13.11), and
   `/api/insights`: verdict-colour counts and the top 10 red ingredients, no user IDs.
6. A daily Vercel Cron job hitting a deep health check that queries Supabase (so the free project
   never pauses), simple rate limits, deployment (spec 13.12, 16, 19).

## Supabase rules (from stage 2)

- **Scanning never depends on Supabase.** If login, Turnstile, loading the profile or saving fails or
  times out, the scan still returns its verdict (`scanId: null`) and the error is logged. The app keeps
  the diet in localStorage and sends it with every scan.
- A scan with no diet in the request and no readable saved profile uses the strictest diet
  (`jain_strict` + `avoid_shared_line`), reported as `dietSource: "fallback"`.
- Users read and change only their own rows (RLS). Scans and feedback are written only by the server
  (service role), so users cannot forge verdicts. New tables need explicit grants and RLS policies:
  "Automatically expose new tables" is off in the project.
- No photos are stored.
- Never run anything against the real Supabase project without my approval.
- Deployment is part of stage 6; don't deploy earlier unless I ask.

## Secrets

Never write real keys into code, tests or chat. Read them only through `lib/config/env.js` (spec 7).
I will put real values in `.env.local` myself. Keep `.env.local` in `.gitignore`.

## Rulebook status

All 125 rulebook entries are a draft with `reviewedBy: []`. In development set
`RULEBOOK_ALLOW_UNREVIEWED=true`. Without it every label is amber — that is intended, not a bug.
