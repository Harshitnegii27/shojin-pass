'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { createBrowserClient } from '@supabase/ssr';
import { createShojinClient } from '@/lib/client/shojinClient';

const box = { border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: '12px 0' };

export default function DevConsole({ supabaseUrl, supabaseAnonKey, turnstileSiteKey, presets, options }) {
  const supabase = useMemo(
    () => (supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null),
    [supabaseUrl, supabaseAnonKey],
  );
  const client = useMemo(() => createShojinClient({ supabase }), [supabase]);
  const widget = useRef(null);
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [diet, setDiet] = useState({ preset: 'vegetarian', options: [], lang: 'en' });
  const [text, setText] = useState('原材料名：小麦粉、砂糖、ラード\n内容量：100g');
  const [out, setOut] = useState(null);

  useEffect(() => {
    client.syncDiet().then((r) => r.diet && setDiet(r.diet));
    supabase?.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, [client, supabase]);

  const renderWidget = () => {
    if (!turnstileSiteKey || !window.turnstile || !widget.current || widget.current.childElementCount) return;
    window.turnstile.render(widget.current, { sitekey: turnstileSiteKey, callback: setToken, 'expired-callback': () => setToken(null) });
  };

  const show = (label, value) => setOut({ label, value });
  const toggle = (o) => setDiet((d) => ({ ...d, options: d.options.includes(o) ? d.options.filter((x) => x !== o) : [...d.options, o] }));

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Shojin Pass — backend test console</h1>
      <p>Supabase: {supabase ? 'configured' : 'not configured'} · Turnstile: {turnstileSiteKey ? 'configured' : 'not configured'} · Session: {userId ?? 'none'}</p>

      <section style={box}>
        <h2 style={{ fontSize: 17 }}>1. Anonymous login</h2>
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderWidget} />
        <div ref={widget} />
        <button disabled={!token && !userId} onClick={async () => {
          const r = await client.signIn(token);
          if (r.ok) setUserId(r.userId);
          setToken(null);
          window.turnstile?.reset(widget.current);
          show('signIn', r);
        }}>Sign in anonymously</button>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17 }}>2. Diet profile</h2>
        <label>Preset{' '}
          <select value={diet.preset} onChange={(e) => setDiet({ ...diet, preset: e.target.value })}>
            {presets.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>{' '}
        <label>Language{' '}
          <select value={diet.lang} onChange={(e) => setDiet({ ...diet, lang: e.target.value })}>
            {['en', 'hi', 'gu'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <div>{options.map((o) => (
          <label key={o} style={{ marginRight: 12 }}><input type="checkbox" checked={diet.options.includes(o)} onChange={() => toggle(o)} /> {o}</label>
        ))}</div>
        <button onClick={async () => show('saveDiet', await client.saveDiet(diet))}>Save diet</button>{' '}
        <button onClick={async () => show('GET /api/profile', await (await fetch('/api/profile')).json())}>Load saved profile</button>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17 }}>3. Text scan</h2>
        <textarea rows={4} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={async () => show('scanText', await client.scanText(text))}>Scan</button>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17 }}>4. Delete my data</h2>
        <button onClick={async () => {
          const r = await client.deleteMyData();
          if (r.deletedOnServer) setUserId(null);
          show('deleteMyData', r);
        }}>Delete everything</button>
      </section>

      {out && (
        <section style={box}>
          <h2 style={{ fontSize: 17 }}>{out.label}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(out.value, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
