// Browser-side helper for the app screens. The diet lives in localStorage first and is copied
// to Supabase when possible, so login, Turnstile or a Supabase outage never stops a scan.
// Nothing here throws for those failures: they are logged and reported in the return value.
// No secrets here: only the public Supabase client is passed in.

export const DIET_KEY = 'shojin.diet.v1';

function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // blocked storage (private mode, settings)
  }
}

// supabase: a browser Supabase client, or null when not configured.
// fetchFn / storage / log are injectable for tests.
/** @param {{ supabase?: any, fetchFn?: typeof fetch, storage?: any, log?: { error: Function } }} [deps] */
export function createShojinClient({ supabase = null, fetchFn, storage = browserStorage(), log = console } = {}) {
  const doFetch = fetchFn || ((...a) => fetch(...a));
  const report = (op, err) => log.error('[shojin]', op, String(err?.message || err));

  function loadDiet() {
    try {
      const raw = storage?.getItem(DIET_KEY);
      const d = raw ? JSON.parse(raw) : null;
      return d && typeof d.preset === 'string' ? { preset: d.preset, options: Array.isArray(d.options) ? d.options : [], lang: d.lang } : null;
    } catch (err) {
      report('load_diet', err);
      return null;
    }
  }

  function storeDiet(diet) {
    try {
      storage?.setItem(DIET_KEY, JSON.stringify(diet));
      return Boolean(storage);
    } catch (err) {
      report('store_diet', err);
      return false;
    }
  }

  async function callApi(method, path, body) {
    const res = await doFetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json; charset=utf-8' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let json = null;
    let notJson = false;
    try { json = await res.json(); } catch { notJson = true; }
    return { status: res.status, json, notJson };
  }

  // GET/POST returning { ok: true, data } or { ok: false, status, error }; logs failures, never throws.
  async function request(op, method, path, body) {
    try {
      const res = await callApi(method, path, body);
      if (res.status === 200 && res.json?.data) return { ok: true, data: res.json.data };
      report(op, failure(res));
      return { ok: false, status: res.status, error: res.json?.error };
    } catch (err) {
      report(op, err);
      return { ok: false, status: 0, error: { code: 'NETWORK', message: 'Check your connection and try again.' } };
    }
  }

  // ?a=1&options=x&options=y, skipping empty values.
  function query(params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
    }
    const s = q.toString();
    return s ? '?' + s : '';
  }

  // What to log for a failed call. A reply that is not JSON is not from our routes (they always
  // answer JSON): usually the framework's own error page, e.g. a crashed dev server.
  const failure = ({ status, json, notJson }) =>
    json?.error?.code || `HTTP ${status}${notJson ? ' (not JSON: server error page, not our API)' : ''}`;

  /** @type {Promise<{ ok: boolean, userId: string | null, existing?: boolean, error?: string }> | null} */
  let signingIn = null; // one sign-in shared by calls made while it runs
  let pendingProfile = null; // a diet saved while signed out; sent to the profile after sign-in

  async function putProfile(clean) {
    try {
      const res = await callApi('PUT', '/api/profile', clean);
      if (res.status === 200) return true;
      report('save_profile', failure(res));
    } catch (err) {
      report('save_profile', err);
    }
    return false;
  }

  // After a sign-in, the diet saved while signed out goes to the profile.
  async function flushPendingProfile() {
    const d = pendingProfile;
    if (!d) return;
    pendingProfile = null;
    if (!(await putProfile(d))) pendingProfile ??= d; // keep it for the next sign-in
  }

  // The diet to send: an explicit one (family mode scans each member's diet) or the local one.
  function dietFor(diet) {
    const d = diet && typeof diet.preset === 'string' ? diet : loadDiet();
    return d ? { preset: d.preset, options: Array.isArray(d.options) ? d.options : [], ...(d.lang ? { lang: d.lang } : {}) } : null;
  }

  return {
    loadDiet,

    // The existing session, if any. Never signs in, so the app only asks for Turnstile (and
    // creates a new anonymous user) when there is no session at all.
    async currentSession() {
      try {
        if (!supabase) return { ok: false, userId: null, configured: false };
        const { data } = await supabase.auth.getSession();
        return { ok: true, userId: data?.session?.user?.id ?? null, configured: true };
      } catch (err) {
        report('get_session', err);
        return { ok: false, userId: null, configured: true };
      }
    },

    // The app's sign-in (spec 13.1), as /dev does it: an existing session is reused; only without
    // one is a Turnstile token requested (getCaptchaToken: async () => token) and a new anonymous
    // user created. Calls made while a sign-in runs share it, so there is never a second user.
    // Never throws; on failure scanning goes on unsaved.
    ensureSession(getCaptchaToken) {
      if (signingIn) return signingIn;
      const signInOnce = async () => {
        try {
          if (!supabase) return { ok: false, userId: null, error: 'Supabase is not configured' };
          const { data } = await supabase.auth.getSession();
          if (data?.session) return { ok: true, userId: data.session.user.id, existing: true };
          if (!getCaptchaToken) throw new Error('Turnstile is not configured');
          const captchaToken = await getCaptchaToken();
          if (!captchaToken) throw new Error('No Turnstile token');
          const { data: d, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
          if (error) throw error;
          return { ok: true, userId: d.user?.id ?? null, existing: false };
        } catch (err) {
          report('sign_in', err);
          return { ok: false, userId: null, error: String(err?.message || err) };
        }
      };
      const run = (async () => {
        const r = await signInOnce();
        if (r.ok) await flushPendingProfile();
        return r;
      })();
      signingIn = run;
      // Once settled, later calls check the session again (cheap, local). run never rejects.
      run.then(() => { if (signingIn === run) signingIn = null; });
      return run;
    },

    // Anonymous sign-in with a Turnstile token (spec 13.1). Keeps an existing session.
    async signIn(captchaToken) {
      try {
        if (!supabase) throw new Error('Supabase is not configured');
        const { data } = await supabase.auth.getSession();
        if (data?.session) return { ok: true, userId: data.session.user.id, existing: true };
        const { data: d, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
        if (error) throw error;
        return { ok: true, userId: d.user?.id ?? null, existing: false };
      } catch (err) {
        report('sign_in', err);
        return { ok: false, error: String(err?.message || err) };
      }
    },

    // Saves locally first, then tries the server. opts.waitFor: e.g. the app's whenReady(), so a
    // sign-in still running finishes first. Signed out (Supabase set up, no session): the diet stays
    // local only, silently, and goes to the profile once ensureSession() signs in.
    async saveDiet(diet, { waitFor } = {}) {
      const clean = { preset: diet.preset, options: [...new Set(diet.options || [])].sort(), lang: diet.lang || 'en' };
      const savedLocally = storeDiet(clean);
      if (waitFor) {
        try { await waitFor(); } catch { /* waiting is best effort */ }
      }
      if (supabase) {
        let signedIn = false;
        try { signedIn = Boolean((await supabase.auth.getSession()).data?.session); } catch { /* treated as signed out */ }
        if (!signedIn) {
          pendingProfile = clean;
          return { diet: clean, savedLocally, savedOnServer: false, pending: true };
        }
      }
      pendingProfile = null;
      const savedOnServer = await putProfile(clean);
      return { diet: clean, savedLocally, savedOnServer };
    },

    // Local diet wins. With none stored, copy the saved profile down (if reachable).
    async syncDiet() {
      const local = loadDiet();
      if (local) return { diet: local, source: 'local' };
      try {
        const { status, json } = await callApi('GET', '/api/profile');
        if (status === 200 && json?.data?.preset) {
          storeDiet(json.data);
          return { diet: json.data, source: 'server' };
        }
      } catch (err) {
        report('load_profile', err);
      }
      return { diet: null, source: 'none' };
    },

    // Always sends a diet (the given one, else the local one), so the server never needs Supabase
    // to know it. opts.diet: { preset, options, lang } for one family member.
    async scanText(text, { diet: given } = {}) {
      const diet = dietFor(given);
      const body = diet ? { text, ...diet } : { text };
      try {
        const { status, json } = await callApi('POST', '/api/scan/text', body);
        return { status, ...(json || {}) };
      } catch (err) {
        report('scan_text', err);
        return { status: 0, error: { code: 'NETWORK', message: 'Check your connection and try again.' } };
      }
    },

    // Photo scan: the photo (a Blob/File, ideally from shrinkPhoto) plus the diet (as scanText).
    async scanPhoto(photo, filename = 'label.jpg', { diet: given } = {}) {
      const diet = dietFor(given);
      const form = new FormData();
      form.append('image', photo, filename);
      if (diet) {
        form.append('preset', diet.preset);
        for (const o of diet.options) form.append('options', o);
        if (diet.lang) form.append('lang', diet.lang);
      }
      try {
        const res = await doFetch('/api/scan', { method: 'POST', body: form, credentials: 'same-origin' });
        const json = await res.json().catch(() => null);
        return { status: res.status, ...(json || {}) };
      } catch (err) {
        report('scan_photo', err);
        return { status: 0, error: { code: 'NETWORK', message: 'Check your connection and try again.' } };
      }
    },

    // The LLM "why" for a saved scan. On any problem returns { ok: false } and the app keeps the
    // template "why" it already shows; the verdict and colours never change (spec 11.5).
    async explain(scanId, lang) {
      try {
        const res = await callApi('POST', `/api/scan/${encodeURIComponent(scanId)}/explain`, lang ? { lang } : undefined);
        const { status, json } = res;
        if (status === 200 && json?.data?.why) return { ok: true, ...json.data };
        report('explain', failure(res));
        return { ok: false, status, error: json?.error };
      } catch (err) {
        report('explain', err);
        return { ok: false, status: 0 };
      }
    },

    // kind: 'wrong_verdict' | 'unclear' | 'unreadable' | 'helpful'; note optional (max 500).
    async sendFeedback(scanId, kind, note) {
      try {
        const body = note ? { kind, note } : { kind };
        const res = await callApi('POST', `/api/scan/${encodeURIComponent(scanId)}/feedback`, body);
        const { status, json } = res;
        if (status !== 200) report('feedback', failure(res));
        return { ok: status === 200, status, ...(json || {}) };
      } catch (err) {
        report('feedback', err);
        return { ok: false, status: 0 };
      }
    },

    // ── Stage 5: chef card, routes, venues, insights. Each returns { ok: true, data } or
    // { ok: false, status, error }; never throws.

    // body: { preset, options?, dishNameJa? } or { members: [{ preset, options? }], dishNameJa? }.
    chefCard(body) {
      return request('chef_card', 'POST', '/api/chef-card', body);
    },

    routes({ preset } = {}) {
      return request('routes', 'GET', '/api/routes' + query({ preset }));
    },

    // date: YYYY-MM-DD (day 1, Japan); options with no_food_after_sunset turn on the sunset rule.
    route(slug, { preset, options, date } = {}) {
      return request('route', 'GET', `/api/routes/${encodeURIComponent(slug)}` + query({ preset, options, date }));
    },

    venues({ lat, lng, radius, preset } = {}) {
      return request('venues', 'GET', '/api/venues' + query({ lat, lng, radius, preset }));
    },

    insights() {
      return request('insights', 'GET', '/api/insights');
    },

    // Deletes server data, then the local diet and session. The app then signs in again.
    async deleteMyData() {
      let deletedOnServer = false;
      try {
        const res = await callApi('DELETE', '/api/profile');
        deletedOnServer = res.status === 200;
        if (!deletedOnServer) report('delete_profile', failure(res));
      } catch (err) {
        report('delete_profile', err);
      }
      if (deletedOnServer) {
        try { storage?.removeItem(DIET_KEY); } catch (err) { report('clear_diet', err); }
        try { await supabase?.auth.signOut({ scope: 'local' }); } catch (err) { report('sign_out', err); }
      }
      return { deletedOnServer };
    },
  };
}
