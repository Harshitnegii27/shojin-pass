# Deploying Shojin Pass

Step by step, from this laptop to a live Vercel site. Names of settings only: **real keys never go in
this file, in code, in chat or in screenshots.** Keep them in a password manager.

Work happens on the local branch `master`. GitHub and Vercel use `main`. Every push sends `master` to
GitHub's `main`, and Vercel deploys `main`.

---

## 0. Before you start

1. On the laptop, in the project folder:
   ```
   npx vitest run
   npm run build
   ```
   Both must pass.
2. **Supabase migrations.** In the Supabase dashboard → **SQL Editor**, run each file you have not run
   yet, in order, pasting the whole file:
   - `supabase/migrations/001_init.sql` (already done)
   - `supabase/migrations/002_explain_feedback.sql` (explanation cache, LLM call log)
   - `supabase/migrations/003_rate_limits.sql` (shared rate limits; needs 002 first)

   Each one should end with "Success. No rows returned". Check in **Table Editor** that
   `rate_limits` exists. Without 003 the app still works, but each server instance counts limits on
   its own, and the logs show `"op":"rate_limit"` errors.
3. Make sure no secret file is tracked by git:
   ```
   git ls-files | findstr /i env
   ```
   The only result should be `.env.example`. If `.env.local` appears, stop and fix that first.

## 1. Push to GitHub (master → main)

The repository has no GitHub remote yet.

1. On github.com: **New repository** → name `shojin-pass` → **Private** → do **not** add a README,
   .gitignore or licence (the repository must start empty) → **Create repository**.
2. On the laptop, in the project folder (replace `<your-account>`):
   ```
   git remote add origin https://github.com/<your-account>/shojin-pass.git
   git push -u origin master:main
   ```
   `master:main` means "my local master becomes GitHub's main". All commits go up, with their history.
   The first push opens a browser window to sign in to GitHub.
3. Check: on GitHub, switch to branch `main`. The latest commit there must match the one from
   ```
   git log -1 --oneline
   ```
4. In the GitHub repository → **Settings → General → Default branch**, make sure it is `main`.
5. Add your teammates: **Settings → Collaborators**.

**Every later update:** commit on `master`, then
```
git push origin master:main
```
Vercel deploys it automatically about a minute later.

(Optional, later: if you want the local branch to be called `main` too, run `git branch -m master main`
and then `git push -u origin main`. Nothing else changes.)

## 2. Import into Vercel

1. vercel.com → **Add New… → Project** → **Import Git Repository** → pick `shojin-pass`
   (the first time, allow Vercel to access the GitHub repository).
2. **Framework Preset:** Next.js (detected). Leave the build command, output folder and root
   directory as they are.
3. **Before clicking Deploy**, open **Environment Variables** and add everything in step 3. A
   production build without the required variables stops with "Missing or invalid environment
   variables: …".
4. Click **Deploy**.
5. Afterwards, in the project's **Settings**:
   - **Git → Production Branch:** `main`.
   - **General → Node.js Version:** 20.x or newer.
   - **Functions → Function Region:** `vercel.json` already sets Tokyo (`hnd1`), next to the Supabase
     project. Nothing to change.

Your site address is shown on the project page, for example `https://shojin-pass.vercel.app`. It is
called `<your-app>` below.

## 3. Environment variables (names only)

Vercel → project → **Settings → Environment Variables**. For each name: paste the value, tick
**Production** (and **Preview** if you want pull-request previews to work), then save. Values come from
the same places as your `.env.local`. `.env.example` lists every name.

**Required.** Production refuses to start without these:

| Name | Where the value comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys (public key) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → your widget (site key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys (secret; server only) |
| `AZURE_VISION_ENDPOINT` | Azure portal → your Vision resource → Keys and Endpoint |
| `AZURE_VISION_KEY` | Same page |
| `CRON_SECRET` | Make a new random one (below) |
| `HEALTH_SECRET` | Make a different new random one (below) |

To make each secret, run this on the laptop once per secret. Copy the output straight into Vercel
and into your password manager:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
`CRON_SECRET` and `HEALTH_SECRET` must be different, and at least 32 characters each.

**Recommended** (without them the app works, and the "why" uses the fixed template text):

| Name | Note |
|---|---|
| `LLM_API_KEY` | Google AI Studio key |
| `LLM_MODEL` | `gemini-3.5-flash-lite` (this is the default anyway) |

**Optional tunables.** Leave them unset to use the defaults:
`SUPABASE_TIMEOUT_MS`, `LLM_THINKING_LEVEL`, `LLM_ENABLED`, `LLM_TIMEOUT_MS`, `LLM_USER_PER_MIN`,
`LLM_USER_PER_DAY`, `OCR_TIMEOUT_MS`, `OCR_MIN_PAGE_CONFIDENCE`, `OCR_MIN_CHAR_CONFIDENCE`,
`SCAN_RATE_LIMIT_PER_MIN`, `SCAN_RATE_LIMIT_PER_DAY`, `EXPLAIN_RATE_LIMIT_PER_MIN`,
`FEEDBACK_RATE_LIMIT_PER_MIN`, `IP_RATE_LIMIT_PER_MIN`, `INSIGHTS_IP_RATE_LIMIT_PER_MIN`,
`OCR_CALLS_PER_MIN`, `OCR_CALLS_PER_SCAN`, `RATE_LIMIT_TIMEOUT_MS`, `SCAN_RETENTION_DAYS`.

**Do not set in Production:** `RULEBOOK_ALLOW_UNREVIEWED`. With it set to `true`, production refuses
to start. Without it, while the rulebook entries are still unreviewed, **every label is amber.** That
is intended (see `docs/rulebook-review.md`). Preview deployments are not "production", so the
variable is allowed there if you need it for testing.

`VERCEL_ENV` is set by Vercel itself. Don't add it.

**After changing any variable**, redeploy so it takes effect: **Deployments** → the latest one → **⋯ →
Redeploy**. This matters most for the `NEXT_PUBLIC_…` names, which are built into the pages.

## 4. Allow the Vercel domain in Turnstile and Supabase

Without these, sign-in fails on the live site. Scans still work but aren't saved, and "Explain is
unavailable right now" is shown.

**Cloudflare Turnstile**
1. Cloudflare dashboard → **Turnstile** → your widget → **Settings** (or **Edit**).
2. Under **Hostnames**, add your Vercel domain without `https://`, e.g. `shojin-pass.vercel.app`.
   Keep `localhost` for the laptop. Add any custom domain too.
3. Save. Preview deployments have different addresses. Sign-in only works on them if you add their
   hostname too; scans work either way.

**Supabase Auth**
1. Supabase dashboard → **Authentication → URL Configuration**.
2. **Site URL:** `https://<your-app>` (your Vercel address).
3. **Redirect URLs → Add URL:** `https://<your-app>/**`. Keep `http://localhost:3000/**` for the
   laptop.
4. Save. Also check **Authentication → Sign In / Providers**: *Allow anonymous sign-ins* is on.
   Under **Attack Protection** (bot protection), Turnstile should be on with its secret key.

## 5. The daily cron job

`vercel.json` schedules `/api/cron/maintenance` once a day at 18:00 UTC (03:00 in Japan). The Hobby
plan allows one run a day and may start it any time within that hour. Vercel sends `CRON_SECRET`
with it automatically. The job runs a tiny Supabase query, which stops the free project from pausing
after a week without activity. Then it runs the retention clean-up: scans are unlinked from users after 90
days, and old LLM-call and rate-limit rows are deleted. It makes no Azure or Gemini calls.

Check it: Vercel → project → **Settings → Cron Jobs**. The job is listed there, and **Run** starts it
now. Its log line (`"op":"cron"`) appears under **Logs**. Crons only run on the production
deployment.

## 6. Test the live site

The examples are for Windows PowerShell; on a Mac use `curl` the same way. Paste secrets only into
your own terminal, never into chat or a screenshot.

1. **Health (public):** open `https://<your-app>/api/health` in a browser. Expect
   `{"data":{"ok":true,"rulebookVersion":"1.1.0"},…}`. It shows no secrets.
2. **Deep health** (OCR, LLM and database; costs 2–3 Azure calls, so not too often):
   ```
   curl.exe -H "x-health-secret: PASTE_HEALTH_SECRET" https://<your-app>/api/health/deep
   ```
   Expect `"ok":true` with `"ocr":"ok"`, `"llm":"ok"`, `"db":"ok"`. A `"skipped"` means that key
   isn't set; `"busy"` means try again in 15 seconds; `"fail"` comes with a reason under `detail`.
   Without the header the reply is 401.
3. **Cron:** `curl.exe https://<your-app>/api/cron/maintenance` must give **401**. Then press **Run**
   in Settings → Cron Jobs, or:
   ```
   curl.exe -H "Authorization: Bearer PASTE_CRON_SECRET" https://<your-app>/api/cron/maintenance
   ```
   Expect `"ok":true,"db":"ok","retention":"ok"`.
4. **/dev is hidden:** `https://<your-app>/dev` shows the "not found" page.
5. **Text scan:**
   ```
   $body = [Text.Encoding]::UTF8.GetBytes('{"text":"原材料名：小麦粉、砂糖、ラード","preset":"vegetarian"}')
   Invoke-RestMethod -Method Post -Uri https://<your-app>/api/scan/text -ContentType 'application/json; charset=utf-8' -Body $body | ConvertTo-Json -Depth 6
   ```
   While the rulebook is unreviewed, expect `amber` in production (see step 3).
6. **On a phone:** open `https://<your-app>`, pick a diet, scan a real label photo, tap Explain, send
   feedback. In Supabase → Table Editor → `scans`, a new row appears. It holds no label text and no
   photo.
7. **Rate limit (429):** limits are 20 scans per user and 180 per IP each minute. PowerShell has no
   session, so only the IP limit applies to it. With `$body` from step 5, send 181 text scans
   (no Azure calls):
   ```
   foreach ($i in 1..181) { try { Invoke-RestMethod -Method Post -Uri https://<your-app>/api/scan/text -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null; "$i ok" } catch { "$i " + [int]$_.Exception.Response.StatusCode } }
   ```
   The last line should say `181 429`. Wait a minute before scanning from this network again. The
   per-user limit is easiest to see in the app: scan a text label 21 times within a minute, and the
   21st says "Slow down a little — try again in a minute."
8. **Busy (Azure free tier):** scan photos on two phones within the same few seconds. The second one
   may say "Busy right now — please try again in a few seconds." That is the global Azure limit
   (about 8 photo scans a minute in total), not a crash.
9. **Logs:** Vercel → **Logs**. Lines are JSON with `op`, `status` and timings. There should never be
   label text, profiles or keys.

## 7. Before the demo

- [ ] Migration 003 run; `/api/health/deep` all `ok` 5 minutes before the pitch.
- [ ] Turnstile hostname and Supabase Site URL set to the live address; sign-in works on a phone.
- [ ] One real photo scan done on the live site (it also warms the server).
- [ ] Remember: at a venue, everyone on one Wi-Fi shares one IP. The limits are mainly per user, and
      the per-IP limit is 3× higher, so this is fine. Photo scans are limited by Azure's free tier for
      everyone together; text scans have no such limit (`/api/scan/text` is the backup if the camera or
      Azure has a problem).
- [ ] Spending caps: Azure F0 cannot overspend; check usage limits in Google AI Studio.
- [ ] Optional: Vercel → **Firewall**. If your plan offers rate-limit rules, keep any rule on
      `/api/scan` well above 180 requests per minute per IP, so the shared venue Wi-Fi is not
      blocked.

## 8. If something goes wrong

| What you see | What to do |
|---|---|
| Build or start fails: "Missing or invalid environment variables: X" | Add X in Vercel (step 3), then redeploy |
| "RULEBOOK_ALLOW_UNREVIEWED must not be true in production" | Delete that variable from Production, then redeploy |
| Sign-in fails on the live site (scans work, Explain unavailable) | Turnstile hostname and Supabase URL settings (step 4); then redeploy if you changed a `NEXT_PUBLIC_…` value |
| Deep health `"db":"fail"` | `SUPABASE_SERVICE_ROLE_KEY` / URL wrong, or the project is paused (Supabase dashboard → Restore) |
| Deep health `"ocr":"fail"` with `auth` / `not_found` | Azure key or endpoint wrong |
| Cron gives 401 when run from Vercel | `CRON_SECRET` missing in Production, or added after the last deploy: redeploy |
| Logs show `"op":"rate_limit"` errors | Migration 003 not run, or Supabase slow. Limits still work per server instance |
| A bad deploy | Vercel → **Deployments** → an earlier good one → **⋯ → Promote to Production** (instant rollback) |
