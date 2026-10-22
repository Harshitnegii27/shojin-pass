# Shojin Pass — Backend Architecture v2.1 (Engine Built and Tested)

Team Kakehashi · Thapar Japan Hackathon · Hakuhodo HAK-PS-01 · Prepared by Butterscotch · 21 October 2026

Replaces v2 (same day) and v1 (20 October 2026). Same content as the Word file *Shojin_Pass_Backend_Architecture_v2.1.docx*.

**The one promise this system must keep:** nothing uncertain is ever shown as green.

## Contents

- 1. How to use this document
- 2. What changed
- 3. Overview and stack
- 4. Golden rules
- 5. Architecture and request lifecycle
- 6. Folder structure
- 7. Environment variables and secrets
- 8. Rulebook
- 9. Scan pipeline
- 10. Verdict rules, reason codes and messages
- 11. Explanation (LLM) design
- 12. Module contracts (lib/)
- 13. API reference
- 14. Database schema (Supabase Postgres)
- 15. Chef card, Shojin Routes and venues
- 16. Security and privacy
- 17. Latency, errors and logging
- 18. Testing and evaluation
- 19. Deployment and operations
- 20. Build plan
- 21. Pilot upgrades
- 22. Open decisions for the team
- 23. Glossary
- 24. Edge-case catalogue

# 1. How to use this document

This is **version 2.1** of the Shojin Pass backend design. Version 2 was the build specification written after the v1 review. Version 2.1 is the same design after the verdict and rulebook engine was **actually built and tested**: every rule in sections 8–11 now exists as running code, and every edge case found while building it is written down here with the test that proves it (section 24).

Nothing in v2.1 weakens a v2 rule. All changes either make the engine more cautious, more precise, or more exact about something v2 left vague. Section 2.1 lists every change with its reason; section 2.2 keeps the v1 → v2 list for history.

**How to read it:**

- Section 2.1 first, if you read v2: it is the complete list of what changed and why.
- Sections 3–5 give the big picture.
- Sections 8–11 are the heart of the product: the rulebook, the scan pipeline, how the verdict is decided, and how explanations are written. In v2.1 these describe code that exists in `shojin-pass/lib/`.
- Sections 12–14 are the coding reference: module contracts, API endpoints and the database migration.
- Sections 18 and 24 are the proof: test results and the full edge-case catalogue.
- Section 22 lists decisions the team still has to make. Each has a safe default already in the code.

**Words used precisely in this document:**

| Word | Meaning here |
|---|---|
| MUST | Required. Code that does not do this is a bug. |
| SHOULD | Strongly recommended. Skip only with a written reason in the pull request. |
| Hackathon | Built for the 24-hour event starting 24 October 2026. |
| Pilot | Built after the hackathon, for real travellers. |
| Verdict | One of `green`, `amber`, `red`, `retake`. |
| False safe | A `green` verdict on a product that should have been `amber` or `red`. The single worst failure this system can have. |
| Spelling / alias | One way of writing an ingredient (かつお節, 鰹節, カツオブシ …). The rulebook stores every spelling. |

# 2. What changed

## 2.0 Build-plan changes (22 October 2026)

Decided while building the backend in stages (see `CLAUDE.md`). Where this table and an older section disagree, this table wins until that section is rewritten in the stage that builds it.

| # | Change | Why | Where | Stage |
|---|---|---|---|---|
| B1 | **Keys optional at startup**; `requireEnv()` where needed; all required on the production deploy | Endpoints that need no keys run on a laptop with none | 7 | 1 |
| B2 | **`avoid_root_possible`** allowed in `profiles.options` | v2 migration omitted it, so saving it would fail | 14 | 2 |
| B3 | **Scanning never depends on Supabase.** Session optional for scans; login, Turnstile, profile load or save failures still return the verdict (`scanId: null`), logged | A database outage must not cost a traveller the verdict | 13.1, 14.4 | 2 |
| B4 | **Diet kept in localStorage** and sent with every scan; no diet and no saved profile → strictest diet (`jain_strict` + `avoid_shared_line`), `dietSource` in the result | A lost diet must never produce a false safe | 13.5, 14.4 | 2 |
| B5 | **Explicit grants and RLS**; users read/change only their own rows; scans and feedback written only by the server | Project has “Automatically expose new tables” off; users must not forge verdicts | 14 | 2 |
| B6 | **No photos stored**: no bucket, no `store_photos`, `STORE_SCAN_IMAGES` and `IMAGE_RETENTION_DAYS` removed; scans keep matched ingredients, not label text | Less personal data | 14, 16.2 | 2 |
| B7 | **OCR is Azure AI Vision Read 3.2** (language `ja`): Image Analysis 4.0 was planned but is not offered in Central India, the resource's region. Each character gets its word's confidence; keys `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY` | Replaces Google Cloud Vision | 3.2, 9.3 | 3 |
| B8 | **LLM is the Google Gemini API**, `gemini-3.5-flash-lite`, minimal thinking (key from Google AI Studio). 3–5 sentences, red/amber only, cached per scan and language, per-user limit; no key, disabled, slow, 429 or rejected → template “why”. Feedback adds `unclear` (migration 002) | Free tier; the explanation never decides or changes a verdict | 3.2, 11, 13.6, 13.7, 14 | 4 |
| B9 | **Venues and routes from JSON files**, not tables | Small, hand-checked data; fewer moving parts | 14.6, 15 | 5 |
| B10 | **`GET /api/insights`**: verdict-colour counts and the top 10 red ingredients, no user ids | Partner KPIs without personal data | 13.3 | 5 |
| B11 | **Daily Vercel Cron hits the deep health check**, which queries Supabase (the free project never pauses) and runs retention; simple rate limits; deployment | Free Supabase projects pause when idle | 13.12, 19 | 6 |
| B12 | Every JSON reply says `charset=utf-8` | Windows PowerShell 5.1 misread Japanese and Hindi | 13.1 | 1 |

## 2.1 Version 2 → 2.1 (engine built and tested)

Each row is a change made while building the engine. “Why” is the problem it fixes; “Where” is the section that now specifies it; “Test” names the edge cases in section 24 that prove it.

| # | Change | Why | Where | Test |
|---|---|---|---|---|
| 1 | **Spaces are word breaks**, kept like line breaks during field-finding and removed only for matching. | Labels space out field names (原 材 料 名) and OCR inserts spaces; without this, “原材料 トマト” hid the first item. | 9.5 | L16, L17 |
| 2 | **Look-alike kanji fixed by “katakana runs”** instead of single neighbours. | 夕一キー and 卜ラウト were not fixed when the neighbour was another look-alike or the heading. | 9.5 | N04–N09, M57, M58 |
| 3 | **Second reading for look-alikes** that touch a real kanji (生八ム). Used only if it explains more text and hides no flagged word. | Kanji neighbours must block conversion (人工, 八角), so mixed words needed another way. | 9.8 | M57, M58, M61 |
| 4 | **Astral characters** (emoji, rare kanji) kept as two units so text and map stay aligned. | A single emoji shifted every later confidence lookup. | 9.5 | unit tests |
| 5 | **Stand-alone voiced marks ゛゜** joined to the previous kana. | NFKC turns them into “space + mark”, which lost the mark. | 9.5 | unit tests |
| 6 | **Whole-section matching** instead of splitting first; separators only break unknown text. | Spellings such as 調味料(アミノ酸等) and リン酸塩(Na、K) contain brackets and commas. | 9.8 | M33, M34 |
| 7 | **Short kana words need a word boundary** (いか, たこ, らっく …, 3 kana or fewer). | いか inside ハイカカオ, ラック inside ブラック, ラム inside グラム, ます inside 含みます. | 9.8 | M07b, M16, M17, M51 |
| 8 | **Hidden-term check**: any flagged spelling not fully inside one recognised word makes the result at least amber. | Longest match could otherwise consume half of a flagged word (えびせん) and nothing would report it. | 9.10 | M16, M53 |
| 9 | **Annotations file** (annotations.json): words that describe the list (一部に, を含む, 国産, 遺伝子組換えでない, place names, units). | Without them almost every real label was amber. | 8.9 | C03, L07, M13a, A06, A07 |
| 10 | **Origin rule**: X(Y由来) takes Y’s tags when X is unclear. | 乳化剤(大豆由来) is plant; 酵素(卵由来) is egg. | 9.10 | M03, M36a–c |
| 11 | **Composite rule**: a composite item followed by its listed components is decided by the components, unless the bracket is an allergen statement or says その他/等. | 野菜(キャベツ、にんじん), 香辛料(こしょう), でん粉(とうもろこし) were amber for no reason; マーガリン(一部に乳成分を含む) must stay amber. | 9.10 | M33–M35, M37, M41b, M46b, M49a |
| 12 | **Allergen statements are matched like ingredients** (in the list, in brackets, or in a separate allergen field). ALLERGEN_* reason codes merged into the normal ones. | Individual notes like マヨネーズ(卵を含む) and fields like アレルギー物質：卵 must count. | 9.7 | A01, A02, M39 |
| 13 | **Every ingredient list on the label is read**, not just the first. | Multi-pack labels (めん / スープ) hid pork in the second list. | 9.6 | L08 |
| 14 | **Heading with one misread character** (原材科名) accepted. | Common OCR misread; otherwise the label had no list. | 9.6 | L05 |
| 15 | **Headless fallback**: no heading but a comma list is still checked; red still wins, otherwise amber. | Better to say “contains pork” than only “couldn’t find the list”. | 9.6 | L01, L02 |
| 16 | **Field-name rules**: a field name at a line start always ends the list; inside a bracket or after a separator it does not, unless written as a heading like 【内容量】. | (原産国：タイ) inside the list ended it early; 【内容量】 was not recognised. | 9.6 | N11, L11, O04 |
| 17 | **List ending in a separator is incomplete**, even before a field name. | A sign that OCR dropped or interleaved part of the list. | 9.6 | C04, O04 |
| 18 | **Outside sweep**: a forbidden word elsewhere on the label (not addresses, not shared-line notes) makes the result at least amber. | Tables read column by column put ingredients after the next field name. | 9.10 | L09, L10, O01–O04 |
| 19 | **Shared-line sentence boundaries** start at an opener (本品, ※ …) or at the marker, never earlier on a line that has list separators. | A greedy sentence start could remove real ingredients on the same line. | 9.7 | A03a, A03b, A04 |
| 20 | **Low confidence applies to every character in the list**, including separators and digits, and to the end-of-list field name. | A misread 豚 could appear as “1” or “、” and be skipped as noise. | 9.9 | Q01–Q06 |
| 21 | **STRUCTURE_UNCLEAR** reason for unbalanced brackets. | Missing brackets mean part of the list was misread. | 10.2 | C05 |
| 22 | **Four new tags**: `onion_family_possible`, `root_vegetable_possible`, `dried_rhizome`, `jain_sometimes_avoided`. | Spice mixes, sauces, starch and unspecified vegetables often contain onion, garlic or potato; dried turmeric and ginger are accepted by many Jains; eggplant, sprouts and figs are avoided by some. | 8.1, 8.2 | M40–M46 |
| 23 | **New option** `avoid_root_possible`. | Lets non-Jain users who avoid root vegetables question starch. | 8.3 | P03 |
| 24 | **Ambiguous words decided in data**: 野菜ブイヨン, でん粉, 香辛料, ソース etc. now carry the “possible” tags; ラム alone is “rum or lamb”. | v2 marked 野菜ブイヨン plain, which was wrong for no-onion and Jain diets. | 8.4 | M18a, M18b, M45 |
| 25 | **Unreviewed entries are never trusted** in production. Without review every label is amber. | The draft rulebook (125 entries, about 1,800 spellings) was written by Claude and must be checked by people. | 8.5, 8.6 | rulebook tests |
| 26 | **Outside sweep uses forbidden words only**, not “ask” words. | たんぱく質 appears in every nutrition table and made every label amber. | 9.10 | L14, O03 |
| 27 | **Negation is never trusted**: 卵不使用 stays red. | Reading “not used” correctly is hard and getting it wrong is a false safe. | 11.1 | M38 |
| 28 | **Validator reports** hidden words, overlaps, one-character spellings and boundary-sensitive spellings for human review. | These are exactly where silent mistakes come from. | 8.6 | rulebook tests |
| 29 | **Text cap of 20,000 characters**; longer text is cut and reported as incomplete. | Protects speed and never pretends the rest was read. | 9.5 | robustness tests |
| 30 | **Confidence values** that are missing, NaN or shorter than the text count as unreadable. | A short or broken OCR result must not look clean. | 9.9 | robustness tests |

## 2.2 Version 1 → 2 (review fixes)

Every change below came from the v1 review. The “Section” column shows where it is specified.

| # | Change | Why | Section |
|---|---|---|---|
| 1 | **Completeness check:** a list with no end marker (and no allergen line) is amber “make sure the whole list is in the photo”. | A half-photographed list could come back green. | 9.6 |
| 2 | **Per-character OCR confidence:** any ingredient read below the word threshold becomes amber, even if the page average is high. | A 0.94 average can hide one misread 豚 (pork). | 9.4, 9.9 |
| 3 | **New tag `insect_derived`** (cochineal, carmine, lac, shellac), forbidden by every preset. | Common in Japanese sweets and drinks; avoided by Indian vegetarians and Jains. | 8.1 |
| 4 | **New tag `animal_rennet_possible`** on cheese, “ask” for every preset. | Many Indian vegetarians avoid animal rennet. | 8.1 |
| 5 | **Ambiguous-words table** decided up front with reasons. | Words like 香料 and 調味料（アミノ酸等）appear on most labels and decide the accuracy score. | 8.4 |
| 6 | **Verdict line never written by the LLM.** It always comes from a reviewed template in English, Hindi and Gujarati. The LLM only writes the “why” sentence. | The v1 safety check only worked in English. | 10.3, 11 |
| 7 | **LLM never sees raw label text**, only ingredient meanings; output is validated in all three languages and for amber too. | Prevents a label from injecting instructions; closes the amber gap. | 11 |
| 8 | **OCR look-alike characters fixed** in normalisation (一→ー, 工→エ, 力→カ …). | Misreads turn known words into unknowns and hurt accuracy. | 9.5 |
| 9 | **Rulebook validator** reports forbidden aliases hidden inside longer words (牛 in 牛乳) and checks preset strictness order. | Prevents silent over- and under-flagging. | 8.6 |
| 10 | **Profiles `role` column locked** with column privileges and a trigger. | Row security cannot protect a single column; a user could make themselves admin. | 14 |
| 11 | **Two-layer rate limiting** (per user and per IP) plus CAPTCHA on anonymous sign-in and a Vercel firewall rule. | Unlimited anonymous accounts bypassed the per-user limit. | 16.1 |
| 12 | **Photos re-encoded on the server**, which removes GPS and other metadata and fixes rotation. | Phone photos can carry location data. | 9.2 |
| 13 | **Scan row saved before the reply.** | Feedback could arrive before the scan existed. | 9.12 |
| 14 | **Explanation moved off the critical path:** the scan replies with a template explanation; the app fetches the LLM version from a new endpoint. | Brings the verdict to about 2 seconds, matching the deck. | 11.5, 13 |
| 15 | **Green wording:** “No avoided ingredients found on this label”. | Honest about what the check can prove. | 10.3 |
| 16 | **Scan retention:** user link removed from scans after 90 days. | Scan history reveals religion over time. | 16.2 |
| 17 | **DPDP statement corrected.** | The DPDP Act 2023 has no separate “sensitive data” category. | 16.2 |
| 18 | **Deep health check** that calls OCR and the LLM before the demo. | Catches expired keys or quota problems in advance. | 13 |
| 19 | **“Delete my data” endpoint** specified. | v1 promised the button but had no endpoint. | 13 |
| 20 | **Shared production line notice** detected and shown; optional setting to treat it as amber. | Strict Jain families may care about cross-contact. | 9.7 |
| 21 | **Test set split** into tuning and hold-out labels; generated adversarial text tests; preset monotonicity tests; CI from day one. | 30 labels alone cannot prove zero false safes. | 18 |
| 22 | **Katakana→hiragana by code-point shift** instead of the wanakana library. | Removes a dependency and avoids accidental romaji conversion (e.g. “pH”). | 9.5 |
| 23 | **Routes get coordinates**; sunset rule fully specified (meal must start 45 minutes before sunset). | v1 had no coordinates to compute sunset from. | 15.2 |
| 24 | **Session required for scans** (the app signs in anonymously and silently). | Makes per-user limits and CAPTCHA meaningful. | 13.1 |

# 3. Overview and stack

The backend is one Next.js project written in JavaScript and deployed on Vercel in Tokyo. Supabase (also Tokyo) provides the database and login; no photos are stored. Azure AI Vision Read reads the Japanese label. A small Google Gemini model only writes a short “why” sentence. Everything that decides a verdict is plain local JavaScript that runs in milliseconds.

## 3.1 The five jobs

1. Turn a label photo (or typed label text) into a verdict for the user’s diet: `green`, `amber`, `red` or `retake`.
2. Hold the rulebook: Japanese ingredient terms, their tags, the diet presets and the chef-card phrases.
3. Serve Shojin Routes, certified venues and the chef card.
4. Remember diet profiles, scans, feedback, chef replies and bookings, and forget them on request or after the retention period.
5. Log funnel events so the team can measure the deck’s KPIs.

## 3.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | JavaScript (ES modules) on Node.js 20 or newer | One language for the whole team |
| Framework | Next.js, App Router, Route Handlers (`runtime = 'nodejs'`) | Screens and API in one project, one deploy |
| Database | Supabase Postgres, region Tokyo (`ap-northeast-1`) | Relational data, row security, hosted |
| Login | Supabase Auth, anonymous sign-in, CAPTCHA (Cloudflare Turnstile) | No account needed; bots blocked |
| Image handling | `sharp` (re-encode, rotate, strip metadata), `file-type` (real file type), `heic-decode` (iPhone HEIC) | Safe, small, correctly rotated images for OCR |
| OCR | Azure AI Vision Read (Image Analysis 4.0 REST, feature `read`, language `ja`) | Word confidence (applied to each character of the word) and positions |
| LLM | Google Gemini API, small fast model (`LLM_MODEL`), key from Google AI Studio | Writes the “why” sentence only; optional |
| Validation | `zod` | Rejects bad input before any work |
| Sunset | `suncalc` | Sunset time for the strict Jain route rule |
| Tests | `vitest` | Unit, invariant and evaluation tests |
| Hosting | Vercel, function region `hnd1` (Tokyo); Vercel Firewall; Vercel Cron | Close to the database; IP rate limit; daily clean-up |

## 3.3 npm packages

```
npm install next react react-dom @supabase/supabase-js @supabase/ssr zod sharp file-type suncalc server-only
npm install -D vitest @electric-sql/pglite
# Gemini SDK added in stage 4
```

> **Note:** `server-only` is imported at the top of every file that touches a secret. If a screen ever imports one of those files by mistake, the build fails instead of leaking the key.

# 4. Golden rules

Every teammate follows these. A pull request that breaks one is not merged.

1. **The rulebook decides the verdict.** OCR only reads. The LLM only writes the “why” sentence.
2. **Uncertainty is never green.** Unknown word, low confidence, cut-off list, missing list, failed service: `amber` or `retake`.
3. **The worst colour wins.** One red ingredient makes the product red, even if the list is incomplete.
4. **The verdict line is fixed text.** It comes from a reviewed template in the user’s language, never from the LLM.
5. **Green means “no avoided ingredient found on this label”**, never “safe”.
6. **Secrets live only on the server**: never in the browser, never in Git, never in chat.
7. **Route files stay thin.** All logic lives in `lib/` and is testable without a server.
8. **No rulebook entry reaches users without two reviewers.**
9. **A flagged word can never be silently swallowed.** If a forbidden or asked spelling appears anywhere in the list and is not fully inside one recognised word, the result is at least amber (v2.1).
10. **Negation is never trusted.** 卵不使用 (“no egg used”) is still read as egg (v2.1).

# 5. Architecture and request lifecycle

Three layers: two apps on the outside (the traveller web app now, an admin screen in the pilot), one Next.js backend in the middle, and three outside services underneath (Supabase, Azure AI Vision, the Gemini LLM).

```
 Traveller app (phone browser)              Admin screen (pilot)
            |                                       |
            v                                       v
 +--------------------------------------------------------------+
 |  Next.js on Vercel (Tokyo)                                   |
 |                                                              |
 |  app/api/*/route.js   thin: auth, rate limit, Zod, call lib  |
 |            |                                                 |
 |            v                                                 |
 |  lib/scan/scanService.js  (the conductor)                    |
 |     image -> OCR -> normalise -> locate -> split -> match    |
 |     -> confidence -> VERDICT ENGINE -> template text -> save |
 |                                                              |
 |  Rulebook in memory (loaded once per server instance)        |
 +--------------------------------------------------------------+
        |                    |                     |
        v                    v                     v
   Supabase (Tokyo)     Azure AI Vision       Gemini (LLM)
   DB, Auth, Storage    (reads text only)     (explains only)
```

## 5.1 The life of every request

1. The app calls an `/api/...` address with the Supabase session cookie.
2. The route handler finds the user, applies rate limits, and validates input with Zod.
3. It calls exactly one function in `lib/`.
4. That function uses the in-memory rulebook and, only when needed, Supabase, Azure AI Vision or the LLM.
5. The handler returns JSON in the standard shape (section 13.1). Non-essential work (event logging) runs after the reply with `after()`.

## 5.2 The life of a scan, in one line each

1. Phone shrinks the photo and uploads it.
2. Server checks session, limits, file type and size, then re-encodes the image (metadata removed, rotation fixed).
3. Azure AI Vision Read returns text plus a confidence per word (given to each of its characters) and positions.
4. Page-level confidence too low → `retake`.
5. Text is normalised (width, spaces, brackets, look-alike characters, katakana→hiragana) while remembering where each character came from.
6. The ingredient list is located; the list is marked complete or incomplete.
7. The list is split into ingredients (with bracket children), the allergen line and any shared-line notice are pulled out.
8. Each ingredient is matched against the rulebook by longest match; anything left over is “unknown”.
9. Each ingredient gets the lowest OCR confidence of its characters; low ones are flagged.
10. The verdict engine combines tags, the diet profile, unknowns, low confidence and completeness.
11. Template text is attached (verdict line + template “why”).
12. The scan row is saved, then the reply is sent. The app separately asks for the LLM “why”.

# 6. Folder structure

Route files in `app/api` only receive a request, call one function in `lib`, and send the answer. Files marked **NEW** did not exist in v1.

```
shojin-pass/
├── app/
│   ├── (screens)/                          # Karmanjot's pages
│   └── api/
│       ├── health/route.js                 # GET  liveness + rulebook version
│       ├── health/deep/route.js            # GET  NEW: calls OCR + LLM once (secret header)
│       ├── scan/route.js                   # POST photo -> verdict
│       ├── scan/text/route.js              # POST typed text -> verdict
│       ├── scan/[id]/explain/route.js      # POST NEW: LLM "why" sentence for a saved scan
│       ├── scan/[id]/feedback/route.js     # POST wrong verdict / unreadable / helpful
│       ├── scan/barcode/route.js           # POST pilot
│       ├── rulebook/route.js               # GET  pilot (offline mode)
│       ├── profile/route.js                # GET / PUT / DELETE (NEW: delete my data)
│       ├── routes/route.js                 # GET  list routes
│       ├── routes/[slug]/route.js          # GET  one route, adjusted for diet + sunset
│       ├── venues/route.js                 # GET  venues near a point
│       ├── venues/[id]/route.js            # GET  pilot
│       ├── chef-card/route.js              # POST build the Japanese card
│       ├── chef-replies/route.js           # POST pilot
│       ├── bookings/route.js               # POST pilot (demo: logs interest)
│       ├── events/route.js                 # POST pilot
│       ├── cron/maintenance/route.js       # GET  NEW: daily retention job (Vercel Cron)
│       └── admin/...                       # pilot: review-queue, rulebook/terms,
│                                           #        venues/[id]/certification, stats
├── lib/
│   ├── config/env.js                       # reads + validates every setting at startup
│   ├── config/rulebook.js                  # serverRulebook(): rulebook + RULEBOOK_ALLOW_UNREVIEWED
│   ├── db/supabaseServer.js                # client acting as the signed-in user
│   ├── db/supabaseAdmin.js                 # service-role client (server only)
│   ├── db/profiles.js                      # profile read/write with the user's client (RLS)
│   ├── auth/getUser.js                     # { id, isAnonymous, client } or null; never throws
│   ├── client/shojinClient.js              # browser: diet in localStorage, sign-in, scans (B3, B4)
│   ├── http/log.js  http/timeout.js        # one-line error logs; withTimeout, timedFetch
│   ├── validation/diet.js                  # preset/option names checked against the rulebook
│   ├── http/respond.js                     # ok(), fail(), handleError()
│   ├── http/errors.js                      # AppError + error code table
│   ├── http/rateLimit.js                   # per-user + per-IP sliding window
│   ├── http/clientIp.js                    # NEW: caller IP from Vercel headers
│   ├── validation/schemas.js               # every Zod schema
│   ├── image/prepareImage.js               # NEW: type check, size check, re-encode
│   ├── diet/resolveProfile.js              # NEW: preset + options -> forbid/ask sets
│   ├── rulebook/chars.js                   # BUILT: character classes, noise, boundary rule
│   ├── rulebook/confusables.js             # BUILT: look-alike, variant, bracket tables
│   ├── rulebook/normalize.js               # BUILT: text + index map; word breaks; look-alikes
│   ├── rulebook/loader.js                  # BUILT: loads JSON, checks clashes, builds the trie
│   ├── rulebook/trie.js                    # BUILT: longest-match dictionary
│   ├── rulebook/sections.js                # BUILT: lists, completeness, shared lines, outside text
│   ├── rulebook/matcher.js                 # BUILT: matching, boundary rule, second reading
│   ├── rulebook/verdict.js                 # BUILT: THE verdict engine
│   ├── ocr/index.js                        # readLabel(): provider-neutral
│   ├── ocr/azureRead.js                    # Azure Read 3.2 REST call (upload + poll)
│   ├── ocr/layout.js                       # line order (vertical Japanese), per-character confidence
│   ├── text/ocrNotices.js                  # fixed "busy" text (en/hi/gu) the templates do not cover
│   ├── client/shrinkPhoto.js               # browser: 1600 px JPEG before upload
│   ├── scan/analyze.js                     # BUILT: the whole pure pipeline for one label
│   ├── scan/scanText.js                    # BUILT: profile + analysis + fixed text
│   ├── scan/scanService.js                 # the conductor for photo scans
│   ├── scan/scanRepo.js                    # save / load scan rows
│   ├── text/templates.js                   # BUILT: verdict lines + template "why" (en/hi/gu)
│   ├── llm/explain.js                      # prompt input from the saved scan, cache, limit, fallback
│   ├── llm/gemini.js                       # Gemini generateContent over REST
│   ├── llm/guard.js                        # NEW: banned phrases, length, language checks (en/hi/gu)
│   ├── scan/savedScan.js                   # template "why" rebuilt from a saved row
│   ├── scan/scanActions.js                 # explain / feedback for your own scan
│   ├── db/scans.js                         # own scan (RLS), explanation cache, LLM log, feedback
│   ├── chef/cardBuilder.js
│   ├── chef/replies.js                     # pilot
│   ├── routes/routeService.js
│   ├── routes/sunset.js                    # NEW: sunset rule
│   ├── venues/venueService.js
│   ├── venues/geo.js                       # NEW: haversine distance
│   ├── privacy/deleteUser.js               # NEW
│   └── events/track.js
├── rulebook/
│   ├── meta.json  tags.json  diets.json  options.json
│   ├── ingredients.json  annotations.json  markers.json   (v2.1)
│   ├── phrases.ja.json  CHANGELOG.md
├── supabase/
│   ├── migrations/001_init.sql
├── tests/
│   ├── unit/                               # BUILT: one test file per lib file
│   ├── invariants/                         # BUILT: edge cases, properties, generated labels
│   ├── fixtures/edge-cases.json            # BUILT: the 138-case catalogue (section 24)
│   └── fixtures/labels/
│       ├── tuning/      (20 photos + expected.json)
│       └── holdout/     (10 photos + expected.json, never used for tuning)
├── scripts/
│   ├── validateRulebook.js
│   ├── evalLabels.js                       # --mode photo | text, --set tuning | holdout
│   ├── evalText.js                         # BUILT: runs the edge-case catalogue
│   └── genSynthetic.js                     # BUILT: generated adversarial label texts
├── .github/workflows/ci.yml                # NEW: tests + text-mode eval on every push
├── .env.example   .env.local (never committed)
├── vercel.json                             # region hnd1 + cron schedule
├── vitest.config.js   jsconfig.json (path alias @/ -> ./)
└── package.json
```

> **Note:** `scanService.js` is the only file that knows the order of the pipeline. Every other `lib/` file does one small job and has no idea it is part of a scan.

# 7. Environment variables and secrets

Every key and tunable number lives in an environment variable. Real values go in `.env.local` (each laptop) and the Vercel dashboard. `.env.example` lists names only (plus `RULEBOOK_ALLOW_UNREVIEWED=true`, marked as local development only). `lib/config/env.js` validates all of them with Zod at startup and stops with a message listing every invalid name.

**Missing keys (build stage 1 onwards):** tunables always have defaults. Keys and secrets are optional at startup so that endpoints that do not need them (`/api/health`, `/api/scan/text`) run on a laptop with no keys. Code that needs a key calls `requireEnv('NAME', …)` first, which throws listing every missing name. On a Vercel production deploy (`VERCEL_ENV=production`) every name in `REQUIRED_FOR_DEPLOY` is required at startup, and `RULEBOOK_ALLOW_UNREVIEWED=true` stops the server. An empty value (`NAME=`) counts as not set.

| Name | Secret? | What it is | Default / hackathon value |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project address | From Supabase settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Public key; limited by row security | From Supabase settings |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | CAPTCHA widget key for anonymous sign-in | From Cloudflare Turnstile |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Full-rights key; server only | From Supabase settings |
| `SUPABASE_TIMEOUT_MS` | No | Every Supabase call gives up after this; scans still return their verdict | `1500` |
| `AZURE_VISION_ENDPOINT` | **Yes** | Azure AI Vision resource endpoint (`https://<name>.cognitiveservices.azure.com/`) | From Azure portal |
| `AZURE_VISION_KEY` | **Yes** | Azure AI Vision key | From Azure portal |
| `LLM_API_KEY` | **Yes** | Google Gemini API key; only checked to be non-empty (new keys start `AQ.`). Without it the template “why” is used | From Google AI Studio |
| `LLM_MODEL` | No | Gemini model id | `gemini-3.5-flash-lite` |
| `LLM_THINKING_LEVEL` | No | `minimal` (lowest for this model); `none` omits it | `minimal` |
| `LLM_ENABLED` | No | Master switch for the LLM | `true` |
| `LLM_TIMEOUT_MS` | No | Give up and keep the template (explanations are off the critical path) | `5000` |
| `LLM_USER_PER_MIN` / `LLM_USER_PER_DAY` | No | Gemini calls per user (cache hits are free) | `5` / `50` |
| `OCR_TIMEOUT_MS` | No | Total time for the Read upload and all polls; then `retake` | `4000` |
| `OCR_MIN_PAGE_CONFIDENCE` | No | Below this average → `retake` | `0.80` (tune on tuning set only) |
| `OCR_MIN_CHAR_CONFIDENCE` | No | Any ingredient containing a character below this → amber | `0.70` (tune on tuning set only) |
| `SCAN_RATE_LIMIT_PER_MIN` | No | Scans per user per minute | `20` |
| `SCAN_RATE_LIMIT_PER_DAY` | No | Scans per user per day | `300` |
| `IP_RATE_LIMIT_PER_MIN` | No | Scan requests per IP per minute | `60` |
| `SCAN_RETENTION_DAYS` | No | Remove user link from scans after | `90` |
| `CRON_SECRET` | **Yes** | Vercel Cron sends it; maintenance route checks it | Random 32+ characters |
| `HEALTH_SECRET` | **Yes** | Header needed for `/api/health/deep` | Random 32+ characters |
| `RULEBOOK_ALLOW_UNREVIEWED` | No | Development only: trust entries with fewer than two reviewers (v2.1) | `false` in production |

### lib/config/env.js

`lib/config/env.js` is the source of truth (not copied here, so it cannot drift). Its rules:

- Zod schema over `process.env`; empty values count as not set; tunables have the defaults in the table above.
- Keys and secrets are optional at startup; `requireEnv(...names)` throws listing every missing name.
- `REQUIRED_FOR_DEPLOY`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`, `CRON_SECRET`, `HEALTH_SECRET` — all required when `VERCEL_ENV=production`, where `RULEBOOK_ALLOW_UNREVIEWED=true` also stops the server.
- `LLM_API_KEY` and `LLM_MODEL` are deliberately not required: without them (or with `LLM_ENABLED=false`) the explanation endpoint returns the template “why” (11.5). Scans never need the LLM.
- `isProduction` is exported for code that must behave differently on the production deploy (e.g. `/dev` is hidden).

The server loads the rulebook through `lib/config/rulebook.js` (`serverRulebook()`), which reads `<project>/rulebook` and passes `env.RULEBOOK_ALLOW_UNREVIEWED` to `buildRulebook()`. The engine's own `getRulebook()` is kept for scripts and tests. `next.config.mjs` includes `rulebook/**/*.json` in every API function's file trace.

**Three rules beginners get wrong:**

1. Anything starting with `NEXT_PUBLIC_` is sent to the browser. Never give a secret that prefix.
2. `.env.local` MUST be in `.gitignore`. If a secret is ever pushed, create a new key immediately; deleting the commit is not enough.
3. Share keys through a password manager or Vercel’s team settings, never in WhatsApp or Slack.

Set a monthly spending cap (Azure budget alert; Gemini usage limits in Google AI Studio) before the first deploy.

# 8. Rulebook

The rulebook describes what each ingredient **is** (its tags). Each diet is a list of tags it forbids (red) or asks about (amber). The engine combines the two, so adding a diet never means editing ingredients. All files are JSON in `rulebook/`, loaded into memory once per server instance.

| File | Holds | Size (draft 1.1.0) |
|---|---|---|
| `tags.json` | 22 tags with labels in en/hi/gu | 22 |
| `diets.json` | 5 presets: forbid list, ask list, chef identity, strictness rank | 5 |
| `options.json` | 5 user options | 5 |
| `ingredients.json` | Entries with every spelling | 125 entries, ~1,800 spellings |
| `annotations.json` **NEW** | Words that describe the list, place names, units | ~150 phrases, 101 places × 11 suffixes |
| `markers.json` **NEW** | Label field names and shared-line words | ~70 words |
| `phrases.ja.json` | Fixed chef-card phrases | 19 tags |
| `meta.json`, `CHANGELOG.md` | Version and history |  |

## 8.1 Tags

| Tag | Meaning | Examples |
|---|---|---|
| `meat` | Pork, beef, other meat, blood, bone | 豚肉, 牛, ハム, ベーコン, ヘム鉄, 骨粉 |
| `poultry` | Chicken, duck, turkey | 鶏肉, チキン, 鶏ガラ, 鴨 |
| `fish_seafood` | Fish, shellfish, fish products | かつお節, えび, いか, 魚醤, かまぼこ, しらこたん白, キトサン |
| `likely_fish_stock` | Stocks and mixes usually made with bonito | 和風だし, めんつゆ, ポン酢, たこ焼き粉 |
| `egg` | Egg in any form | 卵, 鶏卵, 卵白, マヨネーズ, リゾチーム, 卵殻カルシウム |
| `dairy` | Milk products (fine for Indian vegetarians) | 牛乳, バター, 乳糖, カゼインNa, チョコレート |
| `animal_rennet_possible` | Cheese or rennet whose source is not stated | チーズ, レンネット |
| `animal_gelatin` | Gelatin and collagen | ゼラチン, コラーゲン |
| `animal_fat` | Lard, tallow, animal fats | ラード, 牛脂, 動物性油脂 |
| `animal_extract` | Meat, chicken, bone extracts | チキンエキス, 豚骨, コンドロイチン |
| `insect_derived` | Insect colours and glazes | コチニール色素, カルミン酸, シェラック, ラック |
| `onion_family` | Onion, garlic, leek, chives | 玉ねぎ, にんにく, ねぎ, にら, らっきょう |
| `onion_family_possible` **NEW** | Often contains onion or garlic | 香辛料, ソース, ケチャップ, コンソメ, 野菜エキス |
| `root_vegetable` | Fresh root vegetables | じゃがいも, 人参, 大根, しょうが, わさび, こんにゃく, タピオカ |
| `root_vegetable_possible` **NEW** | May come from a root vegetable | でん粉, デキストリン, てんさい糖, カロテン, 野菜 |
| `dried_rhizome` **NEW** | Dried turmeric or ginger | ターメリック, ウコン, ジンジャーパウダー |
| `jain_sometimes_avoided` **NEW** | Avoided by some Jains | なす, もやし, いちじく, カリフラワー |
| `fungus` | Mushrooms, yeast, koji | しいたけ, きくらげ, 酵母エキス, 麹, 紅麹色素, パン |
| `honey` | Honey and bee products | はちみつ, ローヤルゼリー, 蜜蝋 |
| `alcohol` | Alcohol incl. cooking alcohol and ethanol | 酒精, みりん, 料理酒, ワイン, 甘酒, バニラエキス |
| `source_unclear` | Plant or animal; must ask | 乳化剤, 香料, エキス, ショートニング, 光沢剤, たんぱく質 |
| `plain_safe` | No concern for any preset | 砂糖, 塩, 小麦粉, しょうゆ, 植物油脂, 昆布 |

## 8.2 Diet presets

| Preset | Forbids (red) | Asks (amber) |
|---|---|---|
| `vegetarian_egg` (rank 1) | meat, poultry, fish_seafood, likely_fish_stock, animal_gelatin, animal_fat, animal_extract, insect_derived | source_unclear, animal_rennet_possible |
| `vegetarian` (rank 2) | the above + egg | source_unclear, animal_rennet_possible |
| `no_onion_garlic` (rank 3) | the above + onion_family | + onion_family_possible |
| `jain_flexible` (rank 4) | the above + honey | + root_vegetable, root_vegetable_possible, dried_rhizome, jain_sometimes_avoided, fungus, alcohol |
| `jain_strict` (rank 5) | the above + root_vegetable, fungus, alcohol | source_unclear, animal_rennet_possible, onion_family_possible, root_vegetable_possible, dried_rhizome, jain_sometimes_avoided |

**Strictness order** (validator and tests): along rank 1 → 5, no tag ever becomes milder. A tag is never both forbidden and asked in the same preset. Ranks are unique.

## 8.3 Options

| Option | Effect |
|---|---|
| `avoid_fungus` | Adds fungus to forbid |
| `avoid_alcohol` | Adds alcohol to forbid |
| `avoid_root_possible` **NEW** | Adds root_vegetable_possible to ask |
| `avoid_shared_line` | Shared-production-line notices make the result at least amber |
| `no_food_after_sunset` | Routes only: flags meals too close to sunset |

Options only ever add restrictions. If a tag ends up in both lists, forbid wins. Unknown presets or options are rejected (`400`), never silently replaced.

## 8.4 Ambiguous everyday words (decided in data, still to be reviewed)

| Term | Tags in 1.1.0 | Reason |
|---|---|---|
| 調味料（アミノ酸）, 調味料（有機酸） | plain_safe | Fermentation products |
| 調味料（アミノ酸等）, 調味料（核酸等）, イノシン酸Na | source_unclear | Nucleotides can come from fish or meat |
| 調味料 (alone) | source_unclear, composite | Decided by its parts if they are listed |
| 香料 | source_unclear | Origin not stated; 香料(乳由来) becomes dairy |
| 乳化剤, レシチン, グリセリン脂肪酸エステル | source_unclear | Plant or animal; (大豆由来) makes them plain |
| 油脂, ショートニング, マーガリン | source_unclear, composite | Could contain animal fat |
| 光沢剤, ガムベース | source_unclear | Often shellac or beeswax |
| L-システイン, ビタミンD, ビタミンA, カルシウム, 焼成カルシウム | source_unclear | Sometimes from feathers, lanolin, fish, shells or bones |
| でん粉, 加工でん粉, デキストリン | root_vegetable_possible, composite | Often potato; でん粉(とうもろこし) becomes plain |
| 香辛料, スパイス, カレー粉, 七味, チリパウダー | onion_family_possible, root_vegetable_possible, composite | Blends often contain garlic, onion or ginger |
| ソース, たれ, ドレッシング, ウスターソース | + source_unclear | Onion, garlic, sometimes anchovy |
| 野菜, 野菜エキス, 野菜ブイヨン | onion_family_possible, root_vegetable_possible, composite | v2 had 野菜ブイヨン as plain; corrected |
| ブイヨン, コンソメ | source_unclear, onion_family_possible | Usually meat, sometimes vegetable |
| ラム (alone) | alcohol, source_unclear | Could be rum or lamb; ラム肉 is meat, ラム酒 is alcohol |
| チーズ | dairy, animal_rennet_possible | Rennet source unknown |
| 酒精, 醸造用アルコール, みりん, 甘酒 | alcohol | Very common on Japanese labels |
| 紅麹色素, 麹, 酵母エキス, パン | fungus | Koji and yeast are fungi |
| ターメリック, ウコン, ジンジャーパウダー | dried_rhizome | Many Jains accept dried forms |
| しょうが, わさび | root_vegetable | Fresh rhizomes |
| てんさい糖, カロテン | root_vegetable_possible | From beet or carrot |

## 8.5 Ingredients file

```json
{ "id": "starch", "canonical": "でん粉",
  "aliases": ["でん粉","澱粉","でんぷん","デンプン","加工でん粉","加工澱粉","化工でん粉","デキストリン", ...],
  "meaning": { "en": "Starch (source not stated; may be potato)" },
  "tags": ["root_vegetable_possible"],
  "composite": true,
  "reviewedBy": [], "addedIn": "1.1.0" }
```

| Field | Rule |
|---|---|
| `id` | Lowercase letters, digits, underscores; unique; never changed |
| `aliases` | Every spelling, must include `canonical`. After normalisation (9.5) every spelling must be unique across ALL entries and annotations; a clash stops the build |
| `tags` | From tags.json; `plain_safe` must be alone |
| `composite` | **NEW.** true for items that a label may follow with their components in brackets (9.10) |
| `meaning` | English required; Hindi/Gujarati optional (fallback English) |
| `reviewedBy` | Two different people. Entries with fewer are skipped unless `RULEBOOK_ALLOW_UNREVIEWED=true` (development only). **All 125 draft entries are currently unreviewed.** |

## 8.6 Validator (scripts/validateRulebook.js)

Fails (exit 1) on: spelling clashes after normalisation, unknown tags, plain_safe with another tag, missing English meaning, bad ids, strictness order broken, a tag both forbidden and asked, duplicate strictness ranks, a preset or option using an unknown tag, a forbidden/asked tag without a chef phrase, a marker that is empty after normalisation, a bad version string, and — with `--strict` — any entry with fewer than two reviewers.

With `--report` it prints, for human review:

- **One-character flagged spellings** (37 in 1.1.0: 豚, 牛, 肉, 鶏, 魚, 卵, 酒 …). Each will also match inside longer unknown kanji words; that is deliberate.
- **Hidden words**: a flagged spelling inside a longer spelling of another entry (468 pairs, e.g. 牛 inside 牛乳). Reviewers confirm each longer word really is different.
- **Annotations containing flagged spellings** (鳥 in 鳥取, らむ in グラム, がり in ハンガリー).
- **Overlaps** of two or more characters between the end of a safe spelling and the start of a flagged one. The runtime hidden-term check turns these into amber.
- **Boundary-sensitive spellings** (214 short kana spellings that only match at a word boundary).

## 8.7 Version and changelog

`meta.json` is `1.1.0` (draft). Patch for new spellings, minor for new tags or preset changes. Every scan stores the version.

## 8.8 Chef phrases

One fixed phrase per tag, including the four new tags (e.g. `onion_family_possible` → 玉ねぎ・にんにくを含む香辛料やエキス; `dried_rhizome` → ウコン・乾燥しょうが). A native Japanese speaker MUST check every phrase.

## 8.9 Annotations (annotations.json) — NEW

Words that describe the list rather than being ingredients. They are matched like spellings (so they are never “unknown”) and then dropped from the verdict.

| Kind | Examples | Special effect |
|---|---|---|
| statement | 一部に, を含む, 含みます, 由来, 不使用, アレルギー物質, なし, 品目中 | Blocks the composite rule; 由来 triggers the origin rule |
| more | その他, 等, など, ほか | Blocks the composite rule (list not complete) |
| connector | 及び, または |  |
| gmo | 遺伝子組換えでない, 分別生産流通管理済み |  |
| origin | 国産, 国内製造, 輸入, 有機, 添加物 |  |
| unit | グラム, 未満, 換算, 相当, 約 |  |
| place | Countries and all 47 prefectures, each with 産/製造/加工/県/県産 … | 鳥取 is a place, not chicken |

> **Important:** Annotations never remove a flagged word next to them: 卵不使用 is 卵 + 不使用, so egg is still found (golden rule: negation is not trusted).

## 8.10 Field markers (markers.json) — NEW

| List | Words |
|---|---|
| start | 原材料名, 原材料, ingredients (+ one-character-misread match of 原材料名) |
| startExcludeNext | の, に, は, を, と, も, 由来, 表示, 原産, 一部, 欄 — only for the bare word 原材料, only directly after it |
| allergenStart | アレルギー物質, アレルギー表示, アレルゲン, アレルギー, 特定原材料 |
| end | 内容量, 正味量, 賞味期限, 消費期限, 保存方法, 製造者, 販売者, 製造所, 加工者, 輸入者, 販売元, 製造元, 輸入元, 発売元, 原産国名, 原産国, 原料原産地名, 栄養成分表示, 栄養成分, 使用上の注意, 調理方法, お召し上がり方, 名称, 品名, 開封後, 製造所固有記号, エネルギー, 熱量 |
| address | 製造者, 販売者, 製造所, 加工者, 輸入者, 販売元, 製造元, 輸入元, 発売元 (their values are not searched) |
| sharedLine | 同じ製造ライン, 同一ライン, 同じ工場, 同一工場, 同じ設備, 共通の設備, 製造工場では, 混ざる漁法, 混入, コンタミネーション … |
| sharedLineOpeners | 本品, 本製品, 当社, 当工場, この商品, 製造工場, ※, 注意 |
| allergenTail | を含む, 含む, を含みます, 含みます |

# 9. Scan pipeline

Steps 1–4 are the photo path (route handler, image check, OCR, page gate). Steps 5–11 are the pure function `analyzeLabel({ raw, confidence }, profile, rulebook)` in `lib/scan/analyze.js`, used by photo scans, text scans and every test. Step 12 saves and replies.

## 9.1 Step 1 — Prepare the photo (on the phone)

Longest side 1600 px, JPEG 0.8 (`lib/client/shrinkPhoto.js`), user guidance including **include the whole ingredient list**. Redrawing applies the EXIF rotation and drops metadata before upload. If the browser cannot decode the file (HEIC in Chrome), the original is sent.

## 9.2 Step 2 — Receive and check

Session optional (B3), Zod on the form fields, then `resolveProfile()` **before** any OCR call (an unknown preset never uses OCR quota), then `prepareImage()` (`lib/image/prepareImage.js`), entirely in memory:

| Check | Rule | Failure |
|---|---|---|
| Size | ≤ 4 MB (also checked from `Content-Length` before reading the form) | 413 `IMAGE_TOO_LARGE` |
| Real type | From the bytes (`file-type`), never the name or header: JPEG, PNG, WebP, HEIC/HEIF only | 415 `UNSUPPORTED_IMAGE` |
| Decode | `sharp` (pixel limit 50 MP); HEIC via `heic-decode` (WebAssembly, because sharp's prebuilt binaries have no HEVC decoder) | 415 (corrupt), 413 (pixel limit) |
| Rotation | EXIF orientation applied (HEIC: the HEIF rotation boxes) | — |
| Metadata | All removed: EXIF (incl. GPS), ICC, XMP | — |
| Size for OCR | Longest side ≤ 2048 px, never enlarged; transparency flattened to white; JPEG quality 90 | 422 `IMAGE_TOO_SMALL` if the longest side < 600 px |

The photo is never stored or logged: it goes to OCR and is dropped.

## 9.3 Step 3 — Read the label (OCR)

**Provider: Azure AI Vision Read 3.2** (`lib/ocr/azureRead.js`). Image Analysis 4.0 is not offered in Central India (the hackathon resource's region), so the asynchronous Read 3.2 API is used: `POST {endpoint}/vision/v3.2/read/analyze?language=ja` with the JPEG, then `GET` the `Operation-Location` every 1 s until `succeeded`, within `OCR_TIMEOUT_MS` in total. On the free tier (F0: 20 calls/minute, 5,000/month) every call counts, including each poll. Moving to Image Analysis 4.0 needs a resource in a supported region (e.g. Japan East) and a new adapter; note that 4.0 itself retires on 25 September 2028.

`readLabel()` (`lib/ocr/index.js`) never throws and returns either `{ ok: true, raw, confidence, pageConfidence, ms }` or `{ ok: false, status: 'busy' | 'unavailable', detail, retryAfterSec? }`. The exact contract:

- `confidence` has **one number per UTF-16 unit of raw**. Azure gives a confidence per **word**; each character gets its word's confidence. Spaces and the line breaks between lines get 1. A non-space character that no word accounts for gets 0 (unreadable). Missing values or NaN count as 0.
- **Lines** are joined with line breaks (`lib/ocr/layout.js`). Horizontal lines keep Azure's order. A line at least 1.5× taller than wide (2+ characters, after undoing the page tilt Azure reports) is a **vertical column**; columns are read right to left, each top to bottom, and lines overlapping horizontally form one column. Whichever group has more characters comes first. Getting this order wrong can only produce unknown text or an incomplete list (amber), never a green.
- `pageConfidence` is the mean over non-space characters (`null` when there are none).

| Azure outcome | `detail` | Result |
|---|---|---|
| Key or endpoint not set | `not_configured` (Azure not called) | retake `OCR_UNAVAILABLE` |
| 429 on upload or poll | `busy`, `retryAfterSec` from `Retry-After` (default 60, max 300) | retake `OCR_UNAVAILABLE` + `OCR_BUSY`, friendly “busy, try again in a minute” text |
| 401 / 403 | `auth` | retake `OCR_UNAVAILABLE` |
| 404 | `not_found` (wrong endpoint or region) | retake `OCR_UNAVAILABLE` |
| 400 / 415 | `rejected_image` | retake `OCR_UNAVAILABLE` |
| 5xx, network error, `failed`, malformed reply | `service_error`, `network`, `failed`, `bad_response` | retake `OCR_UNAVAILABLE` |
| Over `OCR_TIMEOUT_MS` | `timeout` | retake `OCR_UNAVAILABLE` |

Every failure is logged as one line (`op: "ocr"`, detail, HTTP status, ms), never with label text.

## 9.4 Step 4 — Page quality gate

No characters (`ocr.status: "no_text"`), or `pageConfidence` below `OCR_MIN_PAGE_CONFIDENCE` (`"low_confidence"`) → `retake` `OCR_LOW_PAGE_CONFIDENCE`. OCR failure → `retake` as in 9.3. Never an error status. Retake results are saved like any scan (no items, no text).

The result gains `ocr: { status: 'ok' | 'busy' | 'unavailable' | 'no_text' | 'low_confidence', detail?, pageConfidence?, ms }` and, when busy, `retryAfterSec`. **Outside production only**, `ocr.text` returns what OCR read, to help test photos; it is never stored or logged. `scans.ocr_confidence` stores `pageConfidence`.

## 9.5 Step 5 — Normalise (normalize.js, confusables.js)

`normalize(raw)` returns `{ text, map }`: text with **word breaks kept as \n** (line breaks AND spaces, collapsed), and for each character the index of the raw character it came from. `compact()` removes the breaks for matching. `normalizeAlias()` applies the same rules to rulebook spellings and marker words, so both sides always match.

1. **Per character:** stand-alone ゛゜ are mapped to combining marks; then NFKC (full-width → normal, half-width katakana → full-width, ㍉ → ミリ with both characters mapped to the same source).
2. **Voiced marks** left after NFKC (ｶﾞ) are joined to the previous kana.
3. **Whitespace** (spaces, tabs, ideographic space, all line-break characters) becomes one \n. Invisible characters (zero-width, soft hyphen, BOM) are removed.
4. **Case and variants:** A–Z lower-cased; 鷄→鶏, 麵→麺, 醬→醤, 鹽→塩, 黃→黄.
5. **Brackets** of every style → ( ); **separators** ，, ､ → 、; ･ · → ・; dash-like characters → -.
6. **Emoji and rare kanji** are kept as two UTF-16 units, each mapped to the source, so indices never drift.
7. **'-' after kana becomes ー** (ら-めん, ラ－ド); after Latin it stays (L-システイン).
8. **Katakana runs:** a stretch of katakana and look-alike kanji (工力口二夕卜八才, and 一), line breaks allowed inside, that contains at least one real katakana letter. Look-alikes inside a run become katakana (一 becomes ー except at the start). A look-alike at the edge of a run that directly touches a real kanji stays kanji (人工, 加工, 八角, 二酸化). Cases this cannot decide are handled by the second reading in 9.8.
9. **Katakana → hiragana** by code point (ァ–ヶ minus 0x60). No romaji conversion, so pH調整剤 stays as it is.

Text longer than 20,000 characters is cut; the result is marked `truncated` and can never be green.

## 9.6 Step 6 — Find the lists and check completeness (sections.js)

- **Field names** are searched with an optional break between every character (原 材 料 名). At each position the longest field name wins; overlapping ones are dropped.
- **Start:** 原材料名, 原材料, ingredients. Not valid after 、 or /. The bare word 原材料 is not a heading when directly followed by の, に, は … (原材料の一部に…). If no heading is found, a 4-character window matching 原材料名 with one misread kanji (原材科名) is accepted.
- **Every list is read.** Each start runs to the next field name of any kind, so multi-pack labels give several lists. A separate allergen field (アレルギー物質：…) is its own list, matched the same way.
- **End field names** (内容量, 賞味期限 …) count when at the start of a line (after a line break or space); elsewhere they do not count after ( 、 / ・ — so (原産国：タイ) stays inside the list — unless written as a heading (内容量) / 【内容量】, whose opening bracket is excluded from the list.
- **Complete** if the list ended at a field name, or (no field name) if it ends with an allergen statement (…を含む). **Incomplete** otherwise, and also if the list ends in a separator or an open bracket (、・/( ), even before a field name.
- **No heading at all:** if the text has two or more 、, the whole text is checked as one “headless” list (marked incomplete). Otherwise there is no list.
- **Outside text** = everything not in a list, not a field name, not a shared-line sentence, and not an address value (up to 120 characters after 製造者 etc.).

## 9.7 Step 7 — Shared-line notices and allergen statements

- **Shared-line sentence:** starts at the closest opener (本品, ※ …) within 40 characters before the marker and not across a 。. Without an opener it starts at the line start only if the text between contains no 、 or /; otherwise at the marker itself, so list items on the same line stay in the list. It ends at 。, a break, or 80 characters. These sentences are removed from lists and from the outside sweep and returned as notes listing the flagged words they mention.
- **Allergen statements** are not parsed separately any more: 一部に, を含む, 含みます are annotations and the foods inside are matched like any ingredient. This covers the end-of-list statement, individual notes like マヨネーズ(卵を含む), and allergen fields. Fish is not a mandatory allergen in Japan, so allergen wording can only add flags, never clear them.

## 9.8 Step 8 — Match (trie.js, matcher.js)

- Matching runs over the **whole compact list**, not pre-split pieces, so spellings that contain brackets or commas (調味料(アミノ酸等), リン酸塩(Na、K)) work.
- At each position take the **longest** spelling. Separators, brackets and punctuation (、/・:()。※ …) are skipped and end any unknown text.
- **Short kana spellings** (only hiragana/ー, 3 characters or fewer, 214 of them) need a **word boundary**: the character before is not kana or a recognised word just ended; the character after is not kana or a recognised word starts there. Otherwise the characters become part of unknown text.
- Unknown text that is only amounts, units or percentages (10%, 1.5g, 2個) is dropped as noise.
- **Second reading for look-alikes:** if a separator-delimited piece still has unknown text containing a look-alike kanji, the piece is matched again with those characters read as kana. The new reading is kept only if it leaves fewer unknown characters AND every word recognised the first time is still there or sits inside a longer word that is not plain_safe. So 生八ム → 生ハム (meat), but a reading can never hide a flagged word.

## 9.9 Step 9 — Per-character confidence (photo scans)

- Every character of every list is checked, including separators, brackets and digits. A character below `OCR_MIN_CHAR_CONFIDENCE` in a recognised green item makes that item amber; in unknown text it is reported as unclear; anywhere else (a 、 or a digit that might really be a letter) it makes the result amber on its own.
- Low confidence never softens anything: a red item stays red.
- If any character of the field name that ended the list is unclear, the list is treated as **incomplete** (we cannot trust where it stopped).
- Text outside the lists is not checked for confidence.

## 9.10 Step 10 — Second-look rules, then the verdict

| Rule | What it does | Example |
|---|---|---|
| Origin | An unclear item followed by (Y由来) takes Y’s tags (plain_safe dropped if Y has others). Applies only if the bracket has no unknown text. | 乳化剤(大豆由来) → plain; 香料(乳由来) → dairy; 酵素(卵由来) → egg |
| Composite | A composite item followed by a bracket with at least one ingredient and no statement/“more” annotation is replaced by its components. | 野菜(キャベツ、にんじん) → judged by にんじん; マーガリン(一部に乳成分を含む) stays amber; 調味料(しょうゆ、その他) stays amber |
| Hidden term | Every place a flagged spelling (for this diet) occurs, including inside other words, must lie fully inside ONE recognised spelling. Otherwise HIDDEN_TERM (amber). | えびせん → amber; はいかかお → amber; 牛乳 is fine (inside a recognised word) |
| Outside sweep | A forbidden (red-for-this-diet) spelling of 2+ characters in the outside text → OUTSIDE_SECTION_TERM (amber). Ask-words are ignored here. | 名称：ポークカレー → amber; たんぱく質 in nutrition → ignored |
| Structure | Unbalanced brackets in a list → STRUCTURE_UNCLEAR (amber). | 小麦粉(国産、砂糖 |

Then `decideVerdict()` (section 10) combines everything.

## 9.11 Step 11 — Attach text

`templates.js` adds the fixed verdict line and template “why” (section 10.3–10.4).

## 9.12 Step 12 — Save, then reply

The scan row is saved before replying (service role, `SUPABASE_TIMEOUT_MS`); a failed or slow save returns the verdict with `scanId: null` (14.4). No photos are ever stored.

## 9.13 Result object

```json
{
  "verdict": "red",
  "reasons": ["FORBIDDEN_INGREDIENT", "INCOMPLETE_LIST"],
  "verdictLine": "Not suitable for your Jain (strict) diet",
  "why": "Contains Bonito fish flakes or stock.",
  "whySource": "template",
  "items": [ { "text": "かつお節", "original": "カツオ節", "ingredientId": "katsuobushi",
               "meaning": { "en": "Bonito fish flakes or stock" }, "tags": ["fish_seafood"],
               "baseTags": ["fish_seafood"], "resolvedBy": null, "confidence": 0.97,
               "lowConfidence": false, "fromAllergenField": false,
               "colour": "red", "reason": "FORBIDDEN_INGREDIENT" } ],
  "unknown":  [ { "text": "はいかかお", "original": "ハイカカオ", "confidence": 1, "lowConfidence": false } ],
  "hidden":   [ { "text": "いか", "original": "イカ", "ingredientId": "mollusc", "meaning": {...} } ],
  "outside":  [ { "text": "ぽーく", "original": "ポーク", "ingredientId": "pork", "meaning": {...} } ],
  "lowConfidence": [ { "text": "砂糖", "confidence": 0.31 } ],
  "completeness": "incomplete",
  "notes": [ { "code": "SHARED_LINE", "original": "本品製造工場では…", "mentions": ["Shrimp, prawn or crab"] } ],
  "sections": [ { "kind": "ingredients", "completeness": "incomplete", "fuzzyStart": false, "headless": false } ],
  "truncated": false,
  "profile": { "preset": "jain_strict", "options": [] },
  "rulebookVersion": "1.1.0"
}
```

The app shows `original` (what is printed on the label), never the normalised `text`. The scan route adds `scanId` and `latencyMs`.

# 10. Verdict rules, reason codes and messages

## 10.1 The algorithm (lib/rulebook/verdict.js)

```js
export function decideVerdict({ items, unknown, hidden, outside, lowConfidenceOther,
    completeness, noList, headless, structureUnclear, sharedLine, realCount, truncated, profile }) {
  // colour per item: any forbid tag -> red, any ask tag -> amber, else green;
  //                  a green item with an unclear character -> amber (LOW_CONFIDENCE)
  // unknown text            -> amber UNKNOWN_TERM (or LOW_CONFIDENCE if unclear)
  // hidden flagged spelling -> amber HIDDEN_TERM
  // forbidden word outside  -> amber OUTSIDE_SECTION_TERM
  // unclear separator/digit -> amber LOW_CONFIDENCE
  // unbalanced brackets     -> amber STRUCTURE_UNCLEAR
  // no list / headless list -> amber NO_INGREDIENT_LIST
  // else incomplete or cut  -> amber INCOMPLETE_LIST
  // list found but empty    -> amber NO_INGREDIENTS_FOUND
  // shared line + option    -> amber SHARED_LINE
  // verdict = worst colour; reasons in the fixed order of 10.2
}
```

> **Important:** Every rule can only move the colour towards caution. There is no code path that turns amber or red into green. Section 18.3 proves this over every spelling in the rulebook.

## 10.2 Reason codes (in display order)

| Code | Effect | Meaning |
|---|---|---|
| `FORBIDDEN_INGREDIENT` | red | An ingredient (or allergen statement) has a tag the diet forbids |
| `INCOMPLETE_LIST` | amber | No end of list, list ends in a separator, unclear end field, or text cut at 20,000 characters |
| `NO_INGREDIENT_LIST` | amber | No heading found (headless list or nothing) |
| `NO_INGREDIENTS_FOUND` | amber | Heading found but nothing (only annotations) after it |
| `STRUCTURE_UNCLEAR` **NEW** | amber | Unbalanced brackets |
| `LOW_CONFIDENCE` | amber | An unclear character in the list (renamed from LOW_CONFIDENCE_TERM) |
| `UNKNOWN_TERM` | amber | Text not in the rulebook |
| `HIDDEN_TERM` **NEW** | amber | A flagged spelling inside unrecognised text |
| `OUTSIDE_SECTION_TERM` **NEW** | amber | A forbidden word elsewhere on the label |
| `SHARED_LINE` | amber (option) | Shared production line notice |
| `ASK_INGREDIENT` | amber | An ingredient has a tag the diet asks about |
| `OCR_LOW_PAGE_CONFIDENCE`, `OCR_UNAVAILABLE` | retake | Set by the photo path before analysis |
| `OCR_BUSY` | retake | Added to `OCR_UNAVAILABLE` when Azure answers 429; the “why” is the fixed busy text from `lib/text/ocrNotices.js` |

`ALLERGEN_LINE_FORBIDDEN` and `ALLERGEN_LINE_ASK` from v2 are gone: allergen words are ordinary items (with `fromAllergenField` when they come from a separate field).

## 10.3 Verdict lines (fixed text)

| Verdict | English | Hindi | Gujarati |
|---|---|---|---|
| red | Not suitable for your {diet} diet | आपके {diet} आहार के लिए उपयुक्त नहीं | તમારા {diet} આહાર માટે યોગ્ય નથી |
| amber | Check with staff before eating | खाने से पहले स्टाफ़ से पूछें | ખાતા પહેલાં સ્ટાફને પૂછો |
| green | No avoided ingredients found on this label | इस लेबल पर कोई वर्जित सामग्री नहीं मिली | આ લેબલ પર કોઈ વર્જિત ઘટક મળ્યો નથી |
| retake | Please retake the photo | कृपया फ़ोटो दोबारा लें | કૃપા કરીને ફોટો ફરીથી લો |

## 10.4 Template “why” sentences

Red: “Contains {up to 3 different meanings}.” Green: “None of the ingredients we read are avoided in your diet.” Amber: the first reason in this order is explained:

| Reason | English template |
|---|---|
| INCOMPLETE_LIST | Make sure the whole ingredient list is in the photo. |
| NO_INGREDIENT_LIST | Couldn't find the ingredient list. Scan the back of the pack or ask staff. |
| NO_INGREDIENTS_FOUND | The ingredient list looks empty. Scan it again or ask staff. |
| STRUCTURE_UNCLEAR | Part of the list couldn't be read in order. Check the label or ask staff. |
| LOW_CONFIDENCE | Couldn't read "{text}" clearly. Check the label or ask staff. |
| UNKNOWN_TERM | We don't know "{text}" yet. Show the chef card to ask. |
| HIDDEN_TERM | "{text}" may contain {meaning}. Show the chef card to ask. |
| OUTSIDE_SECTION_TERM | We also saw "{text}" elsewhere on the label. Check with staff. |
| SHARED_LINE | Made on a line or in a factory that also handles {list}. |
| ASK_INGREDIENT | {meaning} may be avoided in your diet. Show the chef card to ask. |

All templates exist in English, Hindi and Gujarati in `lib/text/templates.js`; Hindi and Gujarati MUST be checked by native speakers. Long words are shortened to 14 characters.

# 11. Explanation (LLM) design

Built in stage 4 (`lib/llm/`). The LLM is **Google Gemini**, model `gemini-3.5-flash-lite` (stable Flash-Lite; `LLM_MODEL`), called over REST (`generateContent`) with the key in the `x-goog-api-key` header, JSON output, temperature 0.2 and `thinkingConfig.thinkingLevel: "minimal"` (the lowest level this model accepts; `LLM_THINKING_LEVEL`, `none` omits the setting). Keys from Google AI Studio now start with `AQ.`; any non-empty key is accepted. Some accounts report `401 ACCESS_TOKEN_TYPE_UNSUPPORTED` for such keys; that is logged with its reason and the template is shown.

## 11.1 What the LLM may and may not do

- It writes **3–5 short sentences** (at most 700 characters) in the user's language. This replaces v2's “one or two sentences, 200 characters”.
  - **Definitely avoided** (red items in the list): said plainly, why they are avoided, each with its **Japanese word** in brackets so the traveller learns to spot it, e.g. “alcohol (酒精)”, “shrimp or crab (えび, かに)”.
  - **Unclear source** (ask items such as flavouring, enzyme, seasoning, and flagged words seen outside the list or inside unknown words): in a separate sentence, always hedged (“may”, “might”), never presented as definite.
  - **One tip that fits the context**: for a packaged product (every label scan), what to look for on other packs; the chef card only for restaurant food.
- It never states, repeats or changes the verdict. The verdict line above it is fixed text.
- It never receives photos, user ids, scan ids or free label text. The only Japanese it receives is the spelling of each red item, and only a spelling the rulebook itself lists for that ingredient (else the rulebook's canonical spelling).
- It is only called for **red and amber** scans. Green and retake scans get the template “why” without a call.
- It is optional: if disabled, without a key, slow, failing, rate-limited or rejected, the template “why” stays.

## 11.2 Input sent to the model

Built only from the saved scan and the rulebook (`buildInput()` in `lib/llm/explain.js`):

```json
{
  "language": "hi",
  "diet": "शाकाहारी",
  "result": "red",
  "context": "packaged_product",
  "definitelyAvoided": [
    { "meaning": "Lard (pork fat)", "japanese": ["ラード"], "avoidedBecause": ["मांस", "पशु वसा"] }
  ],
  "unclearSource": [
    { "meaning": "Pork", "found": "mentioned elsewhere on the label, not in the ingredient list", "mayBe": ["मांस"] }
  ],
  "reasons": ["contains an ingredient this diet avoids", "an avoided ingredient is mentioned elsewhere on the label"],
  "unknownWordCount": 0,
  "unclearWordCount": 0
}
```

`definitelyAvoided` comes from items with `FORBIDDEN_INGREDIENT`; `japanese` is the label's spelling only when `normalizeAlias(spelling)` belongs to that same ingredient in the rulebook (NFKC, so ｴﾋﾞ becomes エビ), else the canonical spelling. `unclearSource` comes from `ASK_INGREDIENT` items and from `scans.details` (hidden and outside words) and never carries Japanese. At most 5 per group. Unknown words are sent as a count only. `context` is `packaged_product` for every label scan; `restaurant_food` is reserved for dishes (chef card).

## 11.3 System prompt

`SYSTEM_PROMPT` in `lib/llm/explain.js` is the source of truth (`PROMPT_VERSION` 2). It asks for 3–5 sentences in the given language and script: the definitely avoided items with their Japanese words, the unclear items separately and hedged, and a tip for the context (no chef card for packaged products); only the listed ingredients; never any word about the food being safe, suitable, fine, okay, allowed or edible (not even negated); “could not be fully checked” for amber; no Japanese except the words given; no numbers with units, links or brands; JSON only: `{"why": "..."}`.

## 11.4 Validation (llm/guard.js)

The reply is thrown away (template kept, `fallbackReason: "rejected_<reason>"`) if ANY of these is true:

- Not JSON (a ```json fence is tolerated), no `why` string, or empty after trimming.
- Longer than 700 characters, or more than 6 sentences.
- It contains a banned phrase in any of the three languages — for **every** verdict. English phrases match whole words (so “look for” is fine), except **safe**, which matches anywhere (“unsafe” is rejected too).
- A digit followed by %, or a link.
- Japanese first: every Japanese word (hiragana, katakana, kanji, ー, 々) that is one of the red items' given words, in any spelling the engine's `normalizeAlias()` treats as the same (エビ = えび, half-width = full-width), is ignored. Japanese punctuation (・、。「」（）) separates words and is not a letter. Any other Japanese word → `unexpected_japanese` (it would make an unclear item look as if it were printed on the label).
- Wrong language: numbers, punctuation, symbols and spaces are ignored; of the remaining letters (vowel signs count with their script), at least 80 % must be Latin for `en`, 60 % Devanagari for `hi`, 60 % Gujarati for `gu`. A few English food words in Hindi or Gujarati are fine.
- English, with flagged items: no key word (4+ letters) of any flagged meaning appears.
- Outside production, a rejected answer is logged with its text (`op: "llm_rejected"`, `answer`) to tune the prompt and guard; production logs never hold it.
- Unclear items present but no hedge word (en: may, might, could, possibly, unclear, not stated …; hi: सकता/सकती/सकते, शायद, स्पष्ट नहीं …; gu: શકે, કદાચ, સ્પષ્ટ નથી …) → `unclear_not_hedged`.
- English: a sentence that names an unclear item and says definitely / certainly / surely / clearly → `unclear_stated_as_definite`.
- Packaged product (every label scan) and the reply mentions the chef card, a restaurant or kitchen staff (en/hi/gu) → `chef_card_for_product`.

| Language | Banned phrases (extend in guard.js) |
|---|---|
| English | safe, suitable, fine to eat, fine for you, okay, ok to eat, ok for you, can eat, can have, allowed, permitted, no problem, no issue, acceptable, go ahead, enjoy, vegetarian-friendly, jain-friendly, verdict |
| Hindi | सुरक्षित, उपयुक्त, खा सकते, खा सकती, खा सकता, ठीक है, कोई समस्या नहीं, अनुमति, चिंता न करें, चिंता की कोई बात नहीं |
| Gujarati | સુરક્ષિત, યોગ્ય, ખાઈ શકો, ખાઈ શકાય, બરાબર છે, કોઈ વાંધો નથી, મંજૂરી, ચિંતા ન કરો |

> **Note:** “उपयुक्त” and “યોગ્ય” are banned even though the fixed red line uses them in the negative. The LLM is not allowed to talk about suitability at all, so a blunt ban is correct here.

## 11.5 When the explanation is fetched

1. `POST /api/scan` (or `/scan/text`) replies with the template `why`.
2. The app calls `POST /api/scan/{id}/explain` (optional body `{ "lang" }`; default: the scan's language).
3. The server loads the scan **with the user's client**, so row security hides other users' scans (→ 404, same as a missing scan).
4. Green or retake → template, no call. LLM off or no key → template.
5. **Cache:** `scan_explanations` (scan + language). A cached answer is returned without calling Gemini or counting quota, but only if it was written by the current model and prompt (`model` column holds `<model>|prompt-<PROMPT_VERSION>`); older answers are regenerated and overwritten.
6. **Per-user limit:** `LLM_USER_PER_MIN` (5) and `LLM_USER_PER_DAY` (50) Gemini calls per user, counted in `llm_calls` **before** calling, so parallel requests count too. Over the limit → template. If the limit cannot be checked (database trouble) → template, no call.
7. Gemini with `LLM_TIMEOUT_MS` (5 s; off the critical path). Timeout, 429, 4xx/5xx, blocked prompt, a cut-off answer (`finishReason` not `STOP`) → template.
8. Guard (11.4) → template if rejected. Accepted text is cached and returned with `source: "llm"`.
9. **Never an error for an LLM problem:** status 200 with `source: "template"` and a `fallbackReason` (e.g. `llm_busy`, `llm_timeout`, `user_limit`, `rejected_banned_phrase`).
10. The app swaps the sentence in place when it arrives. The verdict and colours never change.

The template “why” for a saved scan is rebuilt in any language from the row (`lib/scan/savedScan.js`): matched items, unknown and unclear terms, and `scans.details` (hidden and outside words, shared-line mentions). A test checks it equals the template the engine produced at scan time.

# 12. Module contracts (lib/)

Files marked **built** exist and are tested in the `shojin-pass` repository. The others are as specified in v2 and are still to be written.

| File | Exports | Status |
|---|---|---|
| rulebook/chars.js | isHiragana, isKatakana, isKana, isKanji, isIgnorable, isNoiseSpan, isBoundarySensitive | **built** |
| rulebook/confusables.js | KANJI_TO_KATAKANA, KANJI_VARIANTS, bracket/separator/dash tables | **built** |
| rulebook/normalize.js | normalize(raw) → {text,map}; compact(norm, from, to, skip); normalizeAlias(s) | **built** |
| rulebook/trie.js | buildTrie(pairs); matchesAt(trie,text,pos); longestMatch() | **built** |
| rulebook/loader.js | readRulebookFiles(dir); buildRulebook(data,{allowUnreviewed,lenient}); getRulebook(); reviewerCount(e) | **built** |
| rulebook/sections.js | locateSections(norm, markers) → {sections, sharedLines, outside, fuzzyStart, headless, markers} | **built** |
| rulebook/matcher.js | matchText(S, rb) → {matches, unknown}; closingParen; bracketsBalanced; allOccurrences | **built** |
| rulebook/verdict.js | decideVerdict(input); colourForTags(tags, profile); RANK; REASONS | **built** |
| diet/resolveProfile.js | resolveProfile({preset, options}, rb) → {forbid, ask, relevant, askSharedLine, label, chefIdentity}; ProfileError | **built** |
| scan/analyze.js | analyzeLabel({raw, confidence, minCharConfidence}, profile, rb) → result (9.13); MAX_TEXT | **built** |
| scan/scanText.js | scanLabel({raw, confidence, preset, options, lang}, rb); retakeResult(code, profile, lang, rb) | **built** |
| text/templates.js | verdictLine(verdict, dietLabel, lang); templateWhy(result, lang); attachText(); LANGS; AMBER_ORDER | **built** |
| config, db, auth, http, validation, image, ocr, llm, chef, routes, venues, privacy, events | As section 12 of v2 | to do |
| scan/scanService.js | runScan(): text and photo paths (9.2–9.4) then scanLabel(), save, reply | **built** (stages 1–3) |

**Removed from v2:** `rulebook/parser.js`, `rulebook/allergens.js`, `rulebook/sharedLine.js` (merged into sections.js and the matcher), `scan/confidence.js` (inside analyze.js), and the wanakana dependency.

# 13. API reference

## 13.1 Rules shared by every endpoint

- All paths start with `/api/`. All handlers export `runtime = 'nodejs'`.
- **Session:** Supabase session in cookies. The app calls `signInAnonymously({ options: { captchaToken } })` on first open, with a Turnstile token. Endpoints marked “Session” return `401 UNAUTHENTICATED` without one. Scans are marked “Session optional”: they work without a session and are then not saved (B3).
- **Success:** `{ "data": { … }, "meta": { "requestId": "…", "rulebookVersion": "1.1.0" } }`.
- **Error:** `{ "error": { "code": "IMAGE_TOO_LARGE", "message": "Photo must be under 4 MB." }, "meta": { "requestId": "…" } }`.
- **A verdict is never an error.** `retake` and `amber` return status 200.
- `requestId` comes from Vercel’s `x-vercel-id` header if present, otherwise `crypto.randomUUID()`.
- Every JSON reply is sent as `application/json; charset=utf-8` (some clients misread Japanese and Hindi without the charset).

## 13.2 Error codes (http/errors.js)

| Code | Status | Message shown |
|---|---|---|
| `INVALID_REQUEST` | 400 | Something in the request wasn’t right. |
| `UNAUTHENTICATED` | 401 | Please reopen the app. |
| `FORBIDDEN` | 403 | You don’t have access to this. |
| `NOT_FOUND` | 404 | We couldn’t find that. |
| `IMAGE_TOO_LARGE` | 413 | Photo must be under 4 MB. |
| `UNSUPPORTED_IMAGE` | 415 | Please use a JPEG, PNG, WebP or HEIC photo. |
| `IMAGE_TOO_SMALL` | 422 | The photo is too small to read. Move closer. |
| `RATE_LIMITED` | 429 | Slow down a little — try again in a minute. |
| `INTERNAL_ERROR` | 500 | Something went wrong on our side. |

## 13.3 All endpoints

| Method | Path | Who | What | When |
|---|---|---|---|---|
| GET | `/api/health` | Anyone | `{ ok, rulebookVersion }` | Hackathon |
| GET | `/api/health/deep` | Header `x-health-secret` | Calls OCR on a built-in tiny label and the LLM once; reports each | Hackathon |
| POST | `/api/scan` | Session optional | Photo → result | Hackathon |
| POST | `/api/scan/text` | Session optional | Typed text → result | Hackathon |
| POST | `/api/scan/{id}/explain` | Session, owner | LLM “why” or template | Hackathon |
| POST | `/api/scan/{id}/feedback` | Session, owner | Record feedback | Hackathon |
| GET | `/api/profile` | Session | Saved profile | Hackathon |
| PUT | `/api/profile` | Session | Save preset, options, language, photo consent | Hackathon |
| DELETE | `/api/profile` | Session | Delete all my data | Hackathon |
| GET | `/api/routes` | Anyone | Published routes, flagged for diet | Hackathon |
| GET | `/api/routes/{slug}` | Anyone | One route with stops, diet + sunset flags | Hackathon |
| GET | `/api/venues` | Anyone | Certified venues near a point | Hackathon |
| POST | `/api/chef-card` | Anyone | Japanese + English card | Hackathon |
| GET | `/api/insights` | Anyone | Verdict-colour counts, top 10 red ingredients; no user ids (B10) | Hackathon |
| GET | `/api/cron/maintenance` | Vercel Cron (`CRON_SECRET`) | Retention clean-up | Hackathon |
| POST | `/api/scan/barcode` | Session | JAN barcode → result | Pilot |
| GET | `/api/rulebook` | Anyone | Rulebook snapshot for offline mode | Pilot |
| GET | `/api/venues/{id}` | Anyone | Venue with menu verdicts | Pilot |
| POST | `/api/chef-replies` | Session | Save chef’s button (with consent) | Pilot |
| POST | `/api/bookings` | Session | Request booking (demo logs interest) | Pilot |
| POST | `/api/events` | Session | Funnel event from the app | Pilot |
| — | `/api/admin/*` | Reviewer / admin role | Review queue, terms, certification, stats | Pilot |

## 13.4 POST /api/scan

**Request:** `multipart/form-data` with `image` (required), `preset`, `options` (repeat the field for each), `lang` (all optional; the app sends the diet from localStorage). Session optional (B3). **Response:** the result object (section 9.13) in `data`, plus `ocr` (9.4). OCR problems, including Azure 429, are `retake` with status 200. **Errors:** 400, 413, 415, 422, 500 (429 from our own rate limit arrives in stage 6). The code block below is the v2 sketch; `app/api/scan/route.js` is the source of truth.

```js
// app/api/scan/route.js
import { after } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { clientIp } from '@/lib/http/clientIp';
import { checkRateLimit } from '@/lib/http/rateLimit';
import { ok, fail, handleError } from '@/lib/http/respond';
import { ScanFieldsSchema } from '@/lib/validation/schemas';
import { runScan } from '@/lib/scan/scanService';
import { track } from '@/lib/events/track';

export const runtime = 'nodejs';
export const maxDuration = 15;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req) {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');

    const limit = checkRateLimit({ bucket: 'scan', userId: user.id, ip: clientIp(req) });
    if (!limit.allowed) return fail('RATE_LIMITED', { retryAfterSec: limit.retryAfterSec });

    const form = await req.formData();
    const image = form.get('image');
    if (!image || typeof image === 'string') return fail('INVALID_REQUEST');
    if (image.size > MAX_BYTES) return fail('IMAGE_TOO_LARGE');

    const fields = ScanFieldsSchema.safeParse({
      preset: form.get('preset') || undefined,
      lang: form.get('lang') || undefined,
    });
    if (!fields.success) return fail('INVALID_REQUEST');

    const buffer = Buffer.from(await image.arrayBuffer());
    const result = await runScan({ input: { kind: 'photo', buffer }, user, ...fields.data });

    after(() => track('scan_done', { verdict: result.verdict, source: 'photo' }, user.id));
    return ok(result, { rulebookVersion: result.rulebookVersion });
  } catch (err) {
    return handleError(err);
  }
}
```

## 13.5 POST /api/scan/text

JSON body `{ "text": "原材料名：…", "preset": "vegetarian", "options": [], "lang": "en" }` (`options` read only with `preset`); `text` 1–4000 characters. Skips image and OCR steps; confidence is 1.0. Uses the `scan` rate-limit bucket. Uses: building the pipeline before OCR works, the text-mode evaluation, and a stage backup if the camera fails.

> **Session optional (B3):** with a session the scan is saved; without one (or if Supabase fails) the verdict is still returned with `scanId: null`. The diet comes from the request, else the saved profile, else the strictest fallback (14.4). Rate limits arrive in stage 6.

## 13.6 POST /api/scan/{id}/explain

Session required (401). Optional body `{ "lang": "en" | "hi" | "gu" }` (default: the scan's language). Owner only: `404 NOT_FOUND` for someone else’s scan or a malformed id, so ids cannot be probed. Response: `{ "scanId", "lang", "why", "source": "llm" | "template", "cached"?, "fallbackReason"? }`. LLM problems are never errors (11.5).

## 13.7 POST /api/scan/{id}/feedback

Body `{ "kind": "wrong_verdict" | "unclear" | "unreadable" | "helpful", "note": "…" }` (note optional, max 500 characters; control characters removed). Session required; owner only (404 otherwise). Stored by the server in `scan_feedback`, one row per scan, user and kind (sending the same kind again replaces the note). `wrong_verdict` on a green scan is stored with `priority = true` (possible false safe, reviewed first). Response `{ "scanId", "kind", "saved": true, "priority" }`. The note is never sent to the LLM.

## 13.8 GET, PUT, DELETE /api/profile

```
// PUT body (all fields optional; unknown fields rejected)
{ "preset": "jain_strict", "options": ["no_food_after_sunset"], "lang": "gu" }
```

GET returns `{ preset, options, lang }`. PUT returns the saved profile. Unknown preset or option → `400`. All three need a session (`401` otherwise) and use the user’s own Supabase client, so row security applies. The app saves the diet to localStorage first, so a failed PUT never blocks scanning. DELETE deletes the auth user (no photos are stored); all user rows are removed by cascade. It returns `{ "deleted": true }` and the app clears its session and signs in anonymously again.

## 13.9 GET /api/routes and /api/routes/{slug}

`/api/routes?preset=jain_strict` lists published routes; each has `fitsDiet` (true if the preset is in `diet_presets`). `/api/routes/{slug}?preset=jain_strict&date=2026-10-28&options=no_food_after_sunset` returns the route with stops. If `fitsDiet` is false the route is still returned with `note: "needs a custom menu — book to arrange"`. Sunset flags are added when `no_food_after_sunset` is set (section 15.2). `date` defaults to today in Japan.

## 13.10 GET /api/venues

`?lat=35.01&lng=135.68&radius=2000&preset=jain_strict`. `radius` 100–20000 metres, default 2000. Returns certified venues whose `supports` includes the preset, nearest first: `{ id, nameEn, nameJa, type, distanceM, certifiedAt, servesBeforeSunset }`.

## 13.11 POST /api/chef-card

Body `{ "preset": "jain_strict", "options": [], "dishNameJa": "野菜の天ぷら" }` (`dishNameJa` optional, max 40 characters, Japanese text only). Response `{ "ja": "…", "en": "…", "buttons": [ { "id": "contains", "ja": "…", "en": "…" }, … ] }`. Section 15.1.

## 13.12 GET /api/health/deep and /api/cron/maintenance

- `/api/health/deep` requires header `x-health-secret: HEALTH_SECRET`. It OCRs a small label image bundled in the repo (expects 原材料), asks the LLM for a fixed short reply, and checks the database. Returns `{ ocr: 'ok'|'fail', llm: 'ok'|'fail', db: 'ok'|'fail', ms: {...} }`. Run it 5 minutes before the pitch.
- `/api/cron/maintenance` requires `Authorization: Bearer CRON_SECRET` (Vercel Cron sends this automatically). It calls the `apply_retention` database function. Scheduled daily in `vercel.json`. **Stage 6 (B11):** the daily cron hits the deep health check, which queries Supabase so the free project never pauses, and runs retention.

```
// vercel.json
{
  "regions": ["hnd1"],
  "crons": [ { "path": "/api/cron/maintenance", "schedule": "0 18 * * *" } ]
}
// 18:00 UTC = 03:00 in Japan
```

# 14. Database schema (Supabase Postgres)

`supabase/migrations/001_init.sql` is the source of truth (not copied here, so it cannot drift). It is run once in the Supabase SQL editor. It is written for a project where **“Automatically expose new tables” is off** and **automatic RLS is on**, so it grants every privilege explicitly and enables row level security explicitly on every table. `tests/db/migration.test.js` runs it in PGlite (real Postgres in memory) and checks every rule below as the browser roles would meet them.

## 14.1 Tables

| Table | One row per | Holds |
|---|---|---|
| `profiles` | User (created by a trigger on every new auth user, anonymous included) | `diet_preset`, `options`, `language`, `role`, timestamps |
| `scans` | Scan | Source, diet used, verdict, reasons, matched ingredients (`items`), `details` (hidden/outside words and shared-line mentions, 002), unknown and low-confidence terms, completeness, OCR confidence, rulebook version, latency. **No label text and no photo.** |
| `scan_feedback` | Feedback tap | Scan, user, kind (`wrong_verdict`, `unclear` (002), `unreadable`, `helpful`), note (≤ 500), `priority` (wrong verdict on a green scan); unique per scan, user and kind (002) |
| `scan_explanations` (002) | Scan + language | Cached LLM “why” and the model that wrote it |
| `llm_calls` (002) | Gemini call | User and time, for the per-user limit; deleted after 2 days by `apply_retention` |

Migrations run in order: `001_init.sql`, then `002_explain_feedback.sql` (stage 4). `tests/db/` runs both in PGlite.

Venues, routes and route stops are **JSON files** in the repo (stage 5), not tables. Events, products, unknown terms, chef replies and bookings are pilot tables and are not created yet. `/api/insights` (stage 5) reads verdict counts and red ingredients from `scans` with the service role and returns no user ids.

The `profiles` check constraints list exactly the presets in `rulebook/diets.json` and the options in `rulebook/options.json` (including `avoid_root_possible`); a test fails if they drift apart.

## 14.2 Who may do what

| Role | Who | profiles | scans | scan_feedback |
|---|---|---|---|---|
| `anon` | No session | nothing | nothing | nothing |
| `authenticated` | Signed-in user, anonymous included | read own; insert own (id + diet columns); update own diet columns only (`diet_preset`, `options`, `language`) | read own | read own |
| `service_role` | The server only | all | all | all |

`scan_explanations`: users read the rows of their own scans; only the server writes. `llm_calls`: no browser access at all (no policies), server only.

- **Users never write scans or feedback.** Otherwise anyone could insert a scan with a forged verdict using the public key. The server writes both with the service role, after the engine has decided.
- **`role` is protected twice:** no column grant, and a trigger that refuses a role change from `anon` / `authenticated`.
- **Deletion:** `DELETE /api/profile` deletes the auth user; profiles, scans and feedback go by cascade.
- **Functions:** `handle_new_user` (security definer, sign-up trigger), `protect_profile_role`, `apply_retention(scan_days)` (unlinks scans and feedback from users after `SCAN_RETENTION_DAYS`; executable by `service_role` only). Execute is revoked from `public`, `anon` and `authenticated` on all three.
- Policies use `(select auth.uid())` so it is evaluated once per query.

## 14.3 How the server talks to Supabase

- **As the user** (`lib/db/supabaseServer.js`, public key + session cookie): `getUser()` and every `/api/profile` read and write. Row security and the column grants do the enforcing.
- **As the user**, also: loading a scan to explain or rate it (`getOwnScan` in `lib/db/scans.js`); row security is the ownership check.
- **As the server** (`lib/db/supabaseAdmin.js`, service-role key): saving scans (`lib/scan/scanRepo.js`), feedback, the explanation cache and LLM call log (`lib/db/scans.js`), deleting users, retention, insights. Every call names the user id explicitly.
- Every Supabase call uses a fetch that gives up after `SUPABASE_TIMEOUT_MS` (1.5 s), and the scan path also races each call against the same limit.

## 14.4 Scanning never depends on Supabase (from stage 2)

| Failure | What the scan does |
|---|---|
| No session, Turnstile failed, sign-in failed | Verdict returned, not saved (`scanId: null`) |
| Supabase keys missing, Supabase down or slow | Verdict returned, not saved, one error log line (`op: get_user` / `save_scan`) |
| Saving the scan fails or times out | Verdict returned, `scanId: null`, logged |
| No diet in the request and no readable saved profile | Strictest diet: `jain_strict` + `avoid_shared_line`, `dietSource: "fallback"` |

The app keeps the diet in localStorage (`lib/client/shojinClient.js`, key `shojin.diet.v1`) and sends it with every scan, so a normal scan never needs Supabase to know the diet. Diet source order: the request → the saved profile → the strictest fallback. The result carries `dietSource: "request" | "saved" | "fallback"`.

## 14.5 Rulebook tables (pilot)

| Table | Holds |
|---|---|
| `tags` | Tag list (section 8.1) |
| `diet_presets`, `diet_preset_rules` | Presets; preset + tag + action (`forbid` / `ask`) |
| `ingredients`, `ingredient_aliases`, `ingredient_tags` | Entries, unique normalised aliases, tags |
| `ingredient_reviews` | Who reviewed which entry, when (two-person rule) |
| `rulebook_versions` | Version, publish date, publisher, notes, full JSON snapshot |

Scans never read these tables. Publishing writes a snapshot; each server instance loads the newest snapshot on start and checks for a newer version every 5 minutes.

## 14.6 Seed data

Venues and routes are JSON files in the repo (stage 5), not database rows. Use real names only for venues the team has verified; use clearly fake names (“Demo Shojin Kitchen”) otherwise. Every route MUST have `lat`/`lng`, and every meal stop MUST have `isMeal: true`.

# 15. Chef card, Shojin Routes and venues

All three use fixed rules and reviewed data. None uses the LLM: a chef or a strict Jain family must get exactly the same correct wording every time.

## 15.1 Chef card (chef/cardBuilder.js)

1. **Opening** from `chefIdentity`: Jain → 申し訳ありませんが、私はジャイナ教の菜食主義者です。 Vegetarian → 申し訳ありませんが、私は菜食主義者です。
2. **What I can’t eat:** one phrase per forbidden tag in the resolved profile (in the order of `tags.json`), joined with ・, ending in は食べられません。 Tags without a phrase are skipped.
3. **Ask line** (only if the profile asks about root vegetables, fungus or alcohol): the phrases joined with ・, ending in も、できれば避けたいです。
4. **Question:** この料理に入っていますか？ with 「{dishNameJa}」 in front if given.
5. **Three fixed buttons:** かつおだしなどが入っています (contains) · 抜いて作れます (can make without) · この料理は大丈夫です (this dish is fine).

The response includes the English translation of every line, so the traveller knows exactly what they are showing. The profile screen offers a printable version for elders without smartphones.

**Pilot — chef replies:** after the traveller consents, the tapped button is sent to `/api/chef-replies`. `contains` marks that dish red for that preset at that venue; `fine` marks it green. One reply is shown as “a chef said”; it becomes a venue fact only after a second matching reply or a venue confirmation. Replies expire after 120 days.

## 15.2 Shojin Routes (routes/routeService.js, routes/sunset.js)

- **Diet check:** if the route’s `diet_presets` doesn’t include the user’s preset, it is still shown, with “needs a custom menu — book to arrange”.
- **Venue status:** each stop linked to a venue carries its certification badge.
- **Sunset rule** (only with `no_food_after_sunset`): a meal stop conflicts if it starts later than **45 minutes before sunset** on the travel date at the route’s coordinates. If the venue has `serves_before_sunset`, suggest an early slot that starts 75 minutes before sunset, rounded down to the quarter hour.

```js
// lib/routes/sunset.js
import SunCalc from 'suncalc';
export const SUNSET_BUFFER_MIN = 45;
export const EARLY_SLOT_BEFORE_MIN = 75;

export function flagSunsetMeals(stops, { lat, lng, date }) {        // date: 'YYYY-MM-DD'
  const noonJst = new Date(date + 'T12:00:00+09:00');
  const sunset = SunCalc.getTimes(noonJst, lat, lng).sunset;          // a Date (absolute time)
  const latestStart = new Date(sunset.getTime() - SUNSET_BUFFER_MIN * 60000);
  return stops.map((s) => {
    if (!s.is_meal) return s;
    const start = new Date(date + 'T' + s.start_time.slice(0, 5) + ':00+09:00');
    if (start <= latestStart) return { ...s, sunsetConflict: false };
    const early = new Date(sunset.getTime() - EARLY_SLOT_BEFORE_MIN * 60000);
    early.setUTCMinutes(Math.floor(early.getUTCMinutes() / 15) * 15, 0, 0);
    return { ...s, sunsetConflict: true,
             suggestEarly: s.venue && s.venue.serves_before_sunset ? formatJst(early) : null };
  });
}
```

Example: in late October, Kyoto’s sunset is a little after 17:00. A 19:00 dinner conflicts; the suggested early slot is about 15:45–16:00, which ends before sunset.

## 15.3 Venues near me (venues/venueService.js)

- **Hackathon:** load certified venues (small list, cached for 60 seconds), compute haversine distance in JavaScript, keep those within the radius whose `supports` includes the preset, sort nearest first.
- **Pilot:** PostGIS `geography` column with a GiST index and `ST_DWithin`, same response shape.

## 15.4 The 10-point venue checklist

Stored in `venues.checklist` as `[{ id, answer: true|false, verifiedBy, verifiedAt }]`. The ten points are for the team and Hakuhodo to agree. Certification requires all ten answered true and an admin approval through `PATCH /api/admin/venues/{id}/certification` (pilot).

# 16. Security and privacy

## 16.1 Security

| Threat | Protection |
|---|---|
| Secret key leaks to the browser | Secrets read only in `lib/` files that import `server-only`; never `NEXT_PUBLIC_`. |
| User reads someone else’s data | Row security on every table (14.2); owner checks in explain/feedback return 404. |
| User makes themselves admin | `role` column not updatable by browsers (column grant) + trigger (14.2); admin routes check `role` on the server. |
| Bot creates endless anonymous users | Turnstile CAPTCHA on anonymous sign-in (Supabase Auth → Bot protection). |
| Abuse runs up OCR/LLM bills | Per-user minute and day limits + per-IP limit in code; Vercel Firewall rate-limit rule on `/api/scan*` (e.g. 100 requests/minute per IP); spending caps on both accounts. |
| Malicious or fake image files | Real type from bytes (`file-type`), size and dimension limits, re-encode with `sharp`. |
| Bad input | Zod `.strict()` schemas on every body and query. |
| Label text tries to steer the LLM | LLM never receives raw OCR text; output validated (11.4). |
| Bad rulebook entry | Two-reviewer rule; validator in CI; evaluation blocks merges with any false safe. |
| Cron or deep-health endpoint abused | Secret header checks; constant-time comparison (`crypto.timingSafeEqual`). |

## 16.2 Privacy

A diet profile like “Jain (strict)” reveals religion. India’s Digital Personal Data Protection Act 2023 applies to all personal data without a separate “sensitive” category, so consent, purpose limits and deletion rights apply to everything we hold. Japan’s APPI treats creed (religion) as special-care-required personal information. The design therefore stores as little as possible:

- **Anonymous by default.** No name, email or phone needed.
- **Photos never kept.** They are re-encoded in memory, sent to OCR and dropped. Scans store matched ingredients, not label text.
- **Scan history unlinked** from the user after 90 days (`apply_retention`).
- **Clear consent** before a chef reply is saved; a short privacy notice on the profile screen says what is stored, why, and for how long.
- **Partners see totals only**, such as scans per product category; never a person’s profile or history.
- **Delete on request:** `DELETE /api/profile` removes everything linked to the user.
- **Logs** never contain photos, OCR text, profiles or keys; only requestId, route, status, timings and verdict.

> **Note:** This is engineering guidance, not legal advice. Before the pilot, have the privacy notice and consent wording checked by someone qualified.

# 17. Latency, errors and logging

## 17.1 Latency budget

| Step | Target | Hard limit | If slow or failing |
|---|---|---|---|
| Shrink photo on phone | 300 ms | — | Send original if under 4 MB |
| Upload to Tokyo | 300–600 ms | — | App shows “Check your connection” |
| Session + rate limit | 30–80 ms | — | — |
| Image check + re-encode | 50–150 ms | — | 415 / 422 |
| OCR | 500–900 ms | 4 s | `retake` |
| Normalise → verdict | under 20 ms | — | Code error → 500 |
| Save scan row | 30–60 ms | — | Reply anyway, `scanId: null` |
| **Verdict on screen** | **about 1.3–2.1 s** |  |  |
| LLM “why” (separate call) | +0.6–1.2 s | 2 s | Template stays |

These are targets to measure, not promises. `latency_ms` stores the server time; the app also logs the full tap-to-verdict time as a `scan_done` property.

## 17.2 What the user sees

| Situation | Verdict / status | Message |
|---|---|---|
| Blurry photo | `retake` | Please retake: hold the label flat and closer. |
| List cut off | `amber` | Make sure the whole ingredient list is in the photo. |
| No 原材料 found | `amber` | Couldn’t find the ingredient list — scan the back, or ask staff. |
| One word unclear | `amber` | Couldn’t read “{text}” clearly — check the label or ask staff. |
| Unknown ingredient | `amber` | We don’t know “{text}” yet — ask staff. [chef card button] |
| OCR down | `retake` | Couldn’t read the label right now — try again. |
| LLM down | same verdict | Template explanation |
| Too many scans | 429 | Slow down a little — try again in a minute. |
| Bug | 500 | Something went wrong on our side. |

## 17.3 Logging

One structured JSON log line per request: `{ requestId, route, status, ms, verdict?, reasons?, ocrMs?, rulebookVersion }`. Unknown errors log the stack trace with the requestId. Vercel’s log viewer is enough for the hackathon.

# 18. Testing and evaluation

**Pass mark (from the deck):** at least 95% correct verdicts and **zero** false safes on the hold-out photo labels. Before photos exist, the engine is held to a stricter standard on text.

## 18.1 Results today (21 October 2026)

| Test | What it covers | Result |
|---|---|---|
| Unit tests (tests/unit) | Normalisation, field finding, matching, profiles, verdict rules, templates, rulebook loading and validation, robustness and speed | **66 pass** |
| Edge-case catalogue (section 24) | 138 hand-written labels, each one edge case | **138 / 138 pass** |
| Property tests | Every relevant spelling (571 for vegetarian, more for Jain presets) × 7 written forms × 3 positions × 5 presets is never green and never milder than its tag; strictness order; unknown text, cut-offs and any single unclear character are never green; determinism; order independence | **all pass** (up to 73,600 label checks) |
| Generated adversarial labels (fixed seed, in CI) | 600 noisy labels with a forbidden word inserted | **600 / 600 red** |
| Extended fuzz (8 seeds, run once) | 12,000 noisy labels with a forbidden word | **12,000 red, 0 green** |
| Over-caution fuzz (4 seeds, run once) | 4,000 noisy labels with only safe ingredients | **4,000 green (100%)** |
| Validator | Rulebook structure and reports | **0 errors**, 1 warning: 125 entries unreviewed |

> **Important:** These results are on text the team wrote or generated. They show the engine does what the rules say. They do not yet show the rules are right for real labels: that needs the 30 real photos (18.4) and human review of the rulebook (8.5).

## 18.2 Unit tests

One file per module: normalize (15 tests incl. look-alikes, emoji alignment, voiced marks), sections (12), matcher (4 groups covering ~40 spellings), profile (5), verdict (6), templates (8), rulebook (9 incl. clash detection and strictness breaks), robustness (7 incl. worst-case speed under 3 s for 20,000-character inputs).

## 18.3 Property tests (tests/invariants/properties.test.js)

- **Strictness:** for every tag and every label in a set, colour never decreases from vegetarian_egg to jain_strict.
- **Never green with a flagged spelling:** for every preset, every non-composite entry that is red or amber for it, every spelling, in 7 forms (as written, katakana, hiragana, half-width, split across a line, padded with spaces, NFKC) and 3 positions (between separators, glued between words, alone): never green, and never milder than the tag when written between separators. Composite entries without listed parts keep their own colour.
- **Uncertainty:** inserting unknown text anywhere, cutting the label anywhere before the end field, or lowering any one character’s confidence turns a green label amber.
- **Determinism and order:** same input → same output; shuffling ingredients does not change the verdict.

## 18.4 Real-photo evaluation (still to do)

- 30 real label photos: 20 tuning, 10 hold-out (never used for tuning). At least 6 vertical, 4 deliberately cut off, 4 with insect colours, 酒精 or cheese.
- `expected.json` filled in by two teammates reading the labels by hand before running anything.
- Run `evalLabels.js --mode photo` and `--mode text` (hand-typed) to separate OCR mistakes from rulebook mistakes.

## 18.5 Continuous integration

`.github/workflows/ci.yml` runs the validator, all vitest suites and `evalText.js` on every push. Use `validateRulebook.js --strict` on the release branch so unreviewed entries cannot ship.

# 19. Deployment and operations

## 19.1 One-time setup (do before 24 October)

1. **GitHub:** repository `shojin-pass`, all teammates added, `main` protected (pull requests + passing CI).
2. **Supabase:** project in Tokyo (`ap-northeast-1`). Run `001_init.sql` (no storage bucket, no seed: venues and routes are JSON). Turn on anonymous sign-ins. Turn on Bot protection with Cloudflare Turnstile (secret key goes in Supabase; site key goes in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
3. **Azure:** Azure AI Vision resource (Computer Vision), endpoint and key, budget alert. **Google AI Studio:** Gemini API key.
4. **LLM provider:** API key and monthly spending limit; copy the exact model id into `LLM_MODEL`.
5. **Vercel:** import the repo, add every variable from section 7, commit `vercel.json` (region `hnd1`, cron). Add a Firewall rate-limit rule for `/api/scan`.
6. **Check:** `/api/health` returns ok and the rulebook version; `/api/health/deep` returns ok for OCR, LLM and DB.

## 19.2 Everyday flow

- Work on a branch, open a pull request; CI must pass.
- Vercel builds a preview link for each pull request; test it on a phone.
- Merge to `main` → live in about a minute.
- Rulebook changes: edit JSON, run the validator, bump `meta.json`, add a `CHANGELOG.md` line, get the second reviewer’s approval on the pull request.

## 19.3 Demo-day checklist

- Rulebook version frozen and noted in `CHANGELOG.md`.
- Photo-mode evaluation run the night before: false safe = 0; hold-out accuracy recorded for the pitch.
- `/api/health/deep` all ok, and one real scan done, 5 minutes before the pitch (warms the server).
- Judges’ sample labels ready as text for `/api/scan/text`.
- Backup video of the full flow in case the venue Wi-Fi fails.
- Two phones charged, app open on the live link, profile set to the demo persona.
- Spending caps and the Vercel Firewall rule confirmed.

# 20. Build plan

> **Note:** v2.1: the verdict and rulebook engine (normalise, lists, matching, verdict, templates, validator, tests) is already built in the shojin-pass repository. Harshit’s hours 0–6 become: wire it into the route handlers, then go straight to OCR. Shubham’s rulebook hours become: review the 125 draft entries and the validator reports.

Build the pipeline on typed text first, then add OCR, then the LLM. A working demo exists from hour 6; every later hour only adds to it. Feature freeze at hour 20.

## 20.1 Before the hackathon (21–23 October)

- All accounts, keys, Turnstile and Firewall rule from 19.1; keys shared safely.
- Empty Next.js project deployed; `/api/health` working; CI running.
- `001_init.sql` applied.
- Rulebook: at least 100 of 150 terms, two reviewers each, and every row of the ambiguous-words table (8.4) decided.
- 30 label photos taken (with the vertical, cut-off and tricky-ingredient mix from 18.4) and `expected.json` filled in by hand.
- Chef-card phrases and the Hindi/Gujarati verdict lines checked by native speakers.

## 20.2 The 24 hours

| Hours | Harshit (scanner backend) | Karmanjot (app + data endpoints) | Shubham (rulebook, tests, pitch) |
|---|---|---|---|
| 0–2 | env, respond/errors, loader, normalize (+ look-alikes), trie | Anonymous sign-in with Turnstile; profile screen; `/api/profile` GET/PUT | Finish rulebook to 150 terms; validator green |
| 2–6 | parser (+ completeness), matcher, allergens, verdict, templates; `/api/scan/text` | Scanner screen on `/api/scan/text`; result screen with verdict line, items, reasons | Unit + invariant tests; genSynthetic in CI |
| 6–10 | prepareImage, Vision with character list, confidence, `/api/scan`, scan row save, rate limits | Camera capture + shrinking; connect `/api/scan`; feedback buttons | Photo evaluation on tuning set; tune two thresholds; fix rulebook gaps |
| 10–14 | explain + guard + `/api/scan/{id}/explain`; cardBuilder + `/api/chef-card` | Explain swap-in; chef card screen; routes and venues screens from seed | Pitch deck; survey results |
| 14–18 | Speed check; error handling (17.2); deep health; cron route | Sunset flags on the route; DELETE profile button + privacy notice | Hold-out evaluation; record backup video |
| 18–20 | Fix bugs found in testing | Polish; Hindi and Gujarati screens | Rehearse the pitch with the live app |
| 20–24 | **Freeze.** Demo-breaking bugs only | **Freeze.** Test on two phones | Final evaluation; demo-day checklist (19.3) |

## 20.3 Deliberately left out of the 24 hours

Barcode lookup, chef-reply saving, bookings, the admin portal, offline mode, a shared cache, rulebook database tables and the PostGIS search. The deck presents them as the pilot plan.

# 21. Pilot upgrades

| Upgrade | What changes | Why |
|---|---|---|
| Rulebook in the database | Tables in 14.5, reviewer screen, two-person publish, snapshots | Grows to 500 terms with community reviewers |
| Review queue | Unknown terms from real scans counted and ranked | Rulebook learns from real labels |
| Shared rate limit | Upstash Redis (or similar) instead of in-memory | Limits hold across all server instances |
| Barcode products | `/api/scan/barcode` + `products` | Instant, human-checked answers for popular items |
| Cache | Key: hash(normalised text) + preset + options + rulebook version | Repeat scans instant and cheaper |
| “由来” upgrades | 乳化剤（大豆由来）recognised as plant source | Fewer needless ambers |
| Offline mode | Rulebook on the phone; on-device Japanese OCR | Works in basements and at Koyasan |
| Venue platform | Admin portal, certification workflow, chef-reply loop, PostGIS | Scales beyond Kyoto |
| OCR managed identity | Azure managed identity / Entra ID instead of an API key | Stronger key handling |

If the pipeline ever needs more power than Vercel functions give, `lib/` can move into its own server unchanged. That is why it is kept separate from `app/api/`.

# 22. Open decisions for the team

Each has a safe default already in this spec, so coding can start now.

| # | Decision | Default in this spec | Who decides |
|---|---|---|---|
| 1 | Final classification of every word in 8.4 | As proposed (cautious) | Shubham + one more reviewer |
| 2 | Cheese / animal rennet: ask, forbid or allow per preset | Ask (amber) for all presets | Community reviewers |
| 3 | Should a shared-production-line notice affect strict Jain by default? | No; opt-in setting | Community reviewers |
| 4 | OCR thresholds (page 0.80, character 0.70) | Tune on tuning set only | Harshit |
| 5 | Exact ten checklist points for venues | Shape only (15.4) | Team + Hakuhodo |
| 6 | Resolve the open comment on the vegetarian preset in v1 | Preset as in 8.2 | Team |
| 7 | Wording of privacy notice and consent screens | Section 16.2 bullets | Team, then a qualified reviewer before pilot |

| # | Decision (new in v2.1) | Default in the code | Who decides |
|---|---|---|---|
| 8 | Should fermented foods (醤油, 味噌, 納豆, 酢) be questioned for strict Jain? Many avoid them. | Not flagged (plain) | Community reviewers |
| 9 | Dried turmeric and dried ginger: accept or ask for each Jain preset? | Ask (amber) for both Jain presets | Community reviewers |
| 10 | Eggplant, sprouts, figs, cauliflower: which presets? | Ask for both Jain presets | Community reviewers |
| 11 | Starch and other “possible root” items: is amber too strict for jain_flexible? | Ask for both Jain presets | Community reviewers |
| 12 | Keep the look-alike second reading (9.8)? | On; it can only add matches and cannot hide flagged words | Harshit |
| 13 | Review all 125 draft entries and ~1,800 spellings | Unreviewed = not trusted in production | Shubham + one more reviewer |

# 23. Glossary

| Term | Plain meaning |
|---|---|
| API / endpoint | The list of things the app can ask the backend to do; one item with its own address, e.g. `/api/scan` |
| Route Handler | A Next.js `route.js` file that answers one endpoint |
| JSON | The labelled text format messages are written in |
| Environment variable | A setting or secret kept outside the code |
| Supabase | Hosted Postgres database with login and file storage |
| Row security (RLS) | Database rules about who may read or change which rows |
| Column grant | Database rule about which columns a role may change |
| Migration / seed | File that creates tables / starter data for demos |
| Service role | The full-rights database key used only by the server |
| OCR | Turning a photo of text into text |
| Confidence | OCR’s own 0–1 estimate of how sure it is about each character |
| LLM | The AI model that writes the “why” sentence |
| Normalisation | Cleaning text into one standard form before matching |
| Trie / longest match | A tree-shaped dictionary; always prefers the longest known word |
| Tag / preset / option | What an ingredient is / a ready-made diet / an extra restriction |
| Completeness | Whether the photo contains the whole ingredient list |
| False safe | Green when it should have been amber or red |
| Hold-out set | Test labels never used for tuning, so the score is honest |
| Invariant test | A test of a rule that must hold for every input |
| Rate limit | A cap on how often someone can call an endpoint |
| CAPTCHA (Turnstile) | A check that the caller is a person, not a bot |
| Cron | A job that runs on a schedule |
| JAN code | The barcode number on Japanese products |
| PostGIS | A Postgres add-on for map and distance searches |
| Cold start | The slower first request after a server has been idle |
| Annotation | A word that describes the list (一部に, 国産, その他) rather than being an ingredient |
| Composite item | An item a label may follow with its components in brackets, e.g. 野菜(キャベツ、にんじん) |
| Hidden term | A flagged spelling found inside text that was not recognised as one word |
| Katakana run | A stretch of katakana and look-alike kanji treated as one katakana word when fixing OCR mistakes |
| Word boundary | The edge of a word; short kana spellings only count there |

# 24. Edge-case catalogue

Every row is a test in `tests/fixtures/edge-cases.json`, run by `npx vitest run` and `node scripts/evalText.js`. All 138 pass. The label text shown is shortened; the file has the full text.

## Normalisation

| ID | Edge case | Diet | Result |
|---|---|---|---|
| N01 | Half-width katakana is read as normal katakana | veg | red |
| N02 | A word split across two lines is joined | veg | red |
| N03 | Spaced-out field names and full-width spaces | veg | red |
| N04 | OCR reads the long-vowel mark ー as kanji 一 | veg | red |
| N05 | OCR reads エ as kanji 工 | veg | red |
| N06 | OCR reads カ as kanji 力 | veg | green |
| N07 | Real kanji next to kanji is not changed (八角 stays star anise) | veg | green |
| N08 | Real kanji 工 inside 加工 is not changed | veg | green |
| N09 | Kanji 二 in 二酸化ケイ素 is not changed | veg | green |
| N10 | Old kanji form 鷄 is read as 鶏 | veg | red |
| N11 | Every bracket style; heading-style end field 【内容量】 | veg | red |
| N12 | Full-width and ASCII commas both separate items | veg | green |
| N13 | Invisible zero-width character inside a word | veg | red |
| N14 | Half-width katakana with voiced marks (ﾍﾞｰｺﾝ) | veg | red |
| N15 | Full-width Latin letters (ＤＨＡ) | veg | amber — ASK_INGREDIENT |
| N16 | pH調整剤 is not mangled by kana conversion | veg | green |
| N17 | L-システイン keeps its hyphen | veg | amber — ASK_INGREDIENT |
| N18 | ASCII hyphen after kana becomes a long vowel (ラ-ド) | veg | red |

## Finding the list

| ID | Edge case | Diet | Result |
|---|---|---|---|
| L01 | No heading but a pork list: red wins, and the missing heading is reported | veg | red — FORBIDDEN_INGREDIENT, NO_INGREDIENT_LIST |
| L02 | No heading and a safe-looking list is never green | veg | amber — NO_INGREDIENT_LIST |
| L03 | Empty text | veg | amber — NO_INGREDIENT_LIST |
| L04 | 原材料の一部に… is not mistaken for the heading | veg | amber — NO_INGREDIENT_LIST |
| L05 | OCR misreads the heading (原材科名) | veg | red |
| L06 | Heading with nothing after it | veg | amber — NO_INGREDIENTS_FOUND |
| L07 | Heading followed only by an origin note | veg | amber — NO_INGREDIENTS_FOUND |
| L08 | Two ingredient lists on one label; the second has pork | veg | red |
| L09 | Table read column by column (field names first, values later) | veg | amber — NO_INGREDIENTS_FOUND |
| L10 | Column-by-column table hiding lard in the values | veg | amber — OUTSIDE_SECTION_TERM |
| L11 | 原産国 inside a bracket does not end the list | veg | red |
| L12 | English heading on an import: found, but English words are unknown | veg | amber — UNKNOWN_TERM |
| L13 | Separate 添加物 field is part of the list | veg | red |
| L14 | Nutrition table after the list is not read as ingredients | veg | green |
| L15 | List printed elsewhere (枠外に記載) is never green | veg | amber — UNKNOWN_TERM |
| L16 | Spaces between heading and list do not hide the first item | veg | green |
| L17 | Bare heading 原材料 followed by a line break | veg | green |

## Completeness

| ID | Edge case | Diet | Result |
|---|---|---|---|
| C01 | List cut off by the photo edge | veg | amber — INCOMPLETE_LIST |
| C02 | Cut-off list that already shows pork stays red | veg | red — FORBIDDEN_INGREDIENT, INCOMPLETE_LIST |
| C03 | List ending with the allergen statement counts as complete | veg | green |
| C04 | List ending in a separator before the next field is incomplete | veg | amber — INCOMPLETE_LIST |
| C05 | Unbalanced bracket | veg | amber — STRUCTURE_UNCLEAR |

## Matching

| ID | Edge case | Diet | Result |
|---|---|---|---|
| M01 | Longest spelling wins (かつお節エキス is one item) | veg | red |
| M02 | 牛乳 is milk, not beef | veg | green |
| M03 | 乳酸菌 and 乳化剤(大豆由来) are not dairy problems | veg | green |
| M04a | 鶏卵 is egg (red for vegetarian) | veg | red |
| M04b | 鶏卵 is egg, not chicken (green for vegetarian_egg) | veg+egg | green |
| M05 | ビーフン (rice noodles) is not beef | veg | green |
| M06 | Cocoa butter and peanut butter are not dairy problems | veg | green |
| M07a | ブラックタイガー is a prawn | veg | red |
| M07b | ブラックペッパー is pepper, not lac (ラック) | veg | green |
| M08 | とろろ昆布 is kelp, not yam (strict Jain) | Jain strict | green |
| M09a | きくらげ is a fungus (strict Jain red) | Jain strict | red |
| M09b | きくらげ is not jellyfish (vegetarian green) | veg | green |
| M10 | ちくわぶ is wheat, not fish cake | veg | green |
| M11 | 酒石酸 is tartaric acid, not alcohol | Jain strict | green |
| M12 | 大豆ミート is soy, not meat | veg | green |
| M13a | Place name 鳥取 is not chicken | veg | green |
| M13b | …but rakkyo is still onion family | no onion | red |
| M14 | たこ焼き粉 usually contains bonito stock | veg | red |
| M15 | タコス is not octopus | veg | amber |
| M16 | Unknown word containing いか is flagged, not silently passed | veg | amber — UNKNOWN_TERM, HIDDEN_TERM |
| M17 | グラム (gram) does not contain lamb or rum | veg | green |
| M18a | ラム alone is unclear (rum or lamb): amber for vegetarian | veg | amber |
| M18b | ラム alone: red for strict Jain (could be rum) | Jain strict | red |
| M19 | 甘酒 contains alcohol | Jain strict | red |
| M20a | みりん: ask for flexible Jain | Jain flex | amber |
| M20b | みりん: red for strict Jain | Jain strict | red |
| M21 | 酒精 (ethanol preservative) is alcohol | Jain strict | red |
| M22 | かき氷 is shaved ice, not oyster | veg | green |
| M23 | くらげ is jellyfish | veg | red |
| M24 | しらこたん白 (preservative from fish milt) | veg | red |
| M25a | 紅麹色素 is a koji fungus colour (strict Jain) | Jain strict | red |
| M25b | 紅麹色素 is fine for vegetarians | veg | green |
| M26 | ヘム鉄 comes from blood | veg | red |
| M27 | Cochineal and carmine are insect-derived | veg+egg | red |
| M28 | 光沢剤 may be shellac | veg | amber — ASK_INGREDIENT |
| M29 | Gelatin | veg | red |
| M30 | Cheese may use animal rennet | veg | amber — ASK_INGREDIENT |
| M31 | Microbial rennet is fine | veg | green |
| M32 | Amounts and percentages are not unknown words | veg | green |
| M33 | Composite with その他 keeps its own doubt | veg | amber |
| M34 | Composite with listed parts is decided by the parts | veg | green |
| M35 | Composite with a forbidden part | veg | red |
| M36a | Origin bracket: 香料(乳由来) is dairy | veg | green |
| M36b | Origin bracket: 酵素(卵由来) is egg | veg | red |
| M36c | Origin bracket: ゼラチン(豚由来) | veg | red |
| M37 | An allergen bracket does not resolve a composite (マーガリン) | veg | amber — ASK_INGREDIENT |
| M38 | Negation is never trusted: 卵不使用 stays red | veg | red |
| M39 | Individual allergen note (卵を含む) inside an item | veg | red |
| M40a | Eggplant: ask for strict Jain | Jain strict | amber |
| M40b | Eggplant: fine for vegetarians | veg | green |
| M41a | Unspecified starch: ask for strict Jain | Jain strict | amber |
| M41b | Starch from corn stated: fine for strict Jain | Jain strict | green |
| M42 | Cornstarch | Jain strict | green |
| M43a | Dried turmeric: ask for strict Jain | Jain strict | amber |
| M43b | Dried turmeric: fine for vegetarians | veg | green |
| M44a | Fresh ginger: red for strict Jain | Jain strict | red |
| M44b | Fresh ginger: ask for flexible Jain | Jain flex | amber |
| M45 | 野菜エキス may include onion (no-onion diet) | no onion | amber |
| M46a | Spice mix may include garlic | no onion | amber |
| M46b | Spice mix with its parts listed | no onion | green |
| M47 | Honey: red for Jains, fine for vegetarians | Jain flex | red |
| M48 | エキス alone is unclear | veg | amber |
| M49a | だし(昆布) is kelp stock | veg | green |
| M49b | だし(かつお) is fish stock | veg | red |
| M50 | ポン酢 usually contains bonito stock | veg | red |
| M51 | 含みます is a phrase, not trout (ます) | veg | green |
| M52 | かに風味かまぼこ is fish | veg | red |
| M53 | えびせん: a prawn word inside an unknown word is flagged | veg | amber — HIDDEN_TERM |
| M54 | スモークサーモン: salmon found inside a longer word | veg | red |
| M55 | Milk, butter and cream are fine for vegetarians | veg | green |
| M56 | Egg is fine for vegetarian_egg | veg+egg | green |
| M57 | OCR look-alike next to a real kanji (生八ム) | veg | red |
| M58 | OCR look-alike right after the heading once spaces are gone (夕ーキー) | veg | red |
| M59 | Dropped long-vowel mark (ソセージ) is unknown, never green | veg | amber — UNKNOWN_TERM |
| M60 | Dropped voiced mark (セラチン for ゼラチン) is unknown, never green | veg | amber — UNKNOWN_TERM |
| M61 | Royal jelly misread with 口 | Jain flex | red |

## Allergen lines and shared lines

| ID | Edge case | Diet | Result |
|---|---|---|---|
| A01 | Allergen statement adds egg | veg | red |
| A02 | Separate allergen field is read | veg | red |
| A03a | Shared-line notice is a note by default | veg | green |
| A03b | Shared-line notice is amber with avoid_shared_line | veg + avoid_shared_line | amber — SHARED_LINE |
| A04 | Shared-line words on the same line as the list stay in the list | veg | amber |
| A05 | Allergen line cannot clear fish stock | veg | red |
| A06 | Allergen field saying none (なし) | veg | green |
| A07 | Allergen table wording (28品目中) | veg | green |
| A08 | Egg given as a conversion note (全卵換算) still counts | veg | red |

## OCR confidence

| ID | Edge case | Diet | Result |
|---|---|---|---|
| Q01 | Unclear character in a safe ingredient | veg (unclear: 砂糖) | amber — LOW_CONFIDENCE |
| Q02 | Unclear character in a red ingredient stays red | veg (unclear: ラード) | red |
| Q03 | Unclear separator could be a hidden letter | veg (unclear: 、) | amber — LOW_CONFIDENCE |
| Q04 | Unclear digits inside the list | veg (unclear: 10) | amber — LOW_CONFIDENCE |
| Q05 | Unclear text outside the list is ignored | veg (unclear: 株式会社) | green |
| Q06 | Misread end field: cannot trust where the list stops | veg (unclear: 内容量) | amber — INCOMPLETE_LIST |

## Outside the list

| ID | Edge case | Diet | Result |
|---|---|---|---|
| O01 | Product name mentions pork | veg | amber — OUTSIDE_SECTION_TERM |
| O02 | Company address is not searched | veg | green |
| O03 | Nutrition words (たんぱく質) do not trigger warnings | veg | green |
| O04 | Interleaved columns: list ends early and lard appears after | veg | amber — INCOMPLETE_LIST, OUTSIDE_SECTION_TERM |

## Options

| ID | Edge case | Diet | Result |
|---|---|---|---|
| P01 | avoid_fungus makes mushrooms red | veg + avoid_fungus | red |
| P02 | avoid_alcohol makes mirin red | veg + avoid_alcohol | red |
| P03 | avoid_root_possible questions starch | veg + avoid_root_possible | amber |

## Known limits (not solved by text rules)

- **Vertical text read in the wrong order** by OCR cannot be fixed from text alone; it shows up as unknown words or an incomplete list (amber). The photo evaluation must include vertical labels.
- **A word the rulebook does not know and that contains no known flagged spelling** is amber (UNKNOWN_TERM), never green — but the app cannot say what it is.
- **A missing ingredient** (the manufacturer left it off the label) cannot be detected by any label reader. Green therefore says “no avoided ingredients found on this label”.
- **English, Chinese or Korean ingredient lists** on imports are found (English heading) or treated as headless, but their words are unknown, so they are amber.
