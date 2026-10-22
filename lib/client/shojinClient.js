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
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  return {
    loadDiet,

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

    // Saves locally first, then tries the server.
    async saveDiet(diet) {
      const clean = { preset: diet.preset, options: [...new Set(diet.options || [])].sort(), lang: diet.lang || 'en' };
      const savedLocally = storeDiet(clean);
      let savedOnServer = false;
      try {
        const { status, json } = await callApi('PUT', '/api/profile', clean);
        savedOnServer = status === 200;
        if (!savedOnServer) report('save_profile', json?.error?.code || `HTTP ${status}`);
      } catch (err) {
        report('save_profile', err);
      }
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

    // Always sends the local diet, so the server never needs Supabase to know it.
    async scanText(text) {
      const diet = loadDiet();
      const body = diet ? { text, preset: diet.preset, options: diet.options, ...(diet.lang ? { lang: diet.lang } : {}) } : { text };
      const { status, json } = await callApi('POST', '/api/scan/text', body);
      return { status, ...(json || {}) };
    },

    // Photo scan: the photo (a Blob/File, ideally from shrinkPhoto) plus the local diet.
    async scanPhoto(photo, filename = 'label.jpg') {
      const diet = loadDiet();
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

    // Deletes server data, then the local diet and session. The app then signs in again.
    async deleteMyData() {
      let deletedOnServer = false;
      try {
        const { status } = await callApi('DELETE', '/api/profile');
        deletedOnServer = status === 200;
        if (!deletedOnServer) report('delete_profile', `HTTP ${status}`);
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
