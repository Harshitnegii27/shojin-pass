// 001 + 002 + 003_rate_limits.sql in PGlite: shared counters, server-only access, retention.

import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';

const SUPABASE_STANDIN = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

let db;
async function as(role, sub, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub || ''}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const rows = async (sql) => (await db.query(sql)).rows;
const denied = async (sql) => {
  try {
    await db.query(sql);
    return false;
  } catch (e) {
    return /permission denied|row-level security/.test(e.message);
  }
};
const hit = (buckets, keys, windows, costs) =>
  `select * from public.hit_rate_limits(array[${buckets.map((b) => `'${b}'`)}]::text[], array[${keys.map((k) => `'${k}'`)}]::text[], array[${windows}]::int[], array[${costs}]::int[])`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(read('001_init.sql'));
  await db.exec(read('002_explain_feedback.sql'));
  await db.exec(read('003_rate_limits.sql'));
  await db.exec(`insert into auth.users values ('${A}');`);
}, 60000);
afterAll(async () => { await db?.close(); });

describe('003_rate_limits.sql', () => {
  it('counts per bucket and key, several counters in one call, in input order', async () => {
    const r1 = await as('service_role', null, () => rows(hit(['scan_user_min', 'scan_ip_min'], ['k1', 'ip1'], [60, 60], [1, 1])));
    expect(r1.map((r) => [r.bucket, r.count])).toEqual([['scan_user_min', 1], ['scan_ip_min', 1]]);
    const r2 = await as('service_role', null, () => rows(hit(['scan_user_min', 'scan_ip_min'], ['k1', 'ip1'], [60, 60], [1, 1])));
    expect(r2.map((r) => r.count)).toEqual([2, 2]);
    const other = await as('service_role', null, () => rows(hit(['scan_user_min'], ['k2'], [60], [1])));
    expect(other[0].count).toBe(1);
  });

  it('adds the cost (global OCR budget) and returns when the window ends', async () => {
    const [r] = await as('service_role', null, () => rows(hit(['ocr_global'], ['global'], [15], [2])));
    expect(r.count).toBe(2);
    const end = new Date(r.reset_at).getTime();
    expect(end % 15000).toBe(0);
    expect(end - Date.now()).toBeGreaterThan(0);
    expect(end - Date.now()).toBeLessThanOrEqual(15000);
  });

  it('parallel calls are all counted (atomic upsert)', async () => {
    await as('service_role', null, () => Promise.all(Array.from({ length: 10 }, () => db.query(hit(['par'], ['k'], [3600], [1])))));
    const [r] = await as('service_role', null, () => rows(hit(['par'], ['k'], [3600], [0])));
    expect(r.count).toBe(10);
  });

  it('rejects bad arguments', async () => {
    await db.exec('set role service_role');
    try {
      await expect(db.query(hit(['a', 'b'], ['k'], [60], [1]))).rejects.toThrow(/same length/);
      await expect(db.query(hit(['a'], ['k'], [0], [1]))).rejects.toThrow(/window/);
      await expect(db.query(hit(['a'], ['k'], [60], [101]))).rejects.toThrow(/cost/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('browsers (anon, authenticated) cannot read, write or call it', async () => {
    for (const [role, sub] of [['anon', null], ['authenticated', A]]) {
      await as(role, sub, async () => {
        expect(await denied('select * from public.rate_limits')).toBe(true);
        expect(await denied(`insert into public.rate_limits (bucket, key, window_start, count) values ('b', 'k', now(), 0)`)).toBe(true);
        expect(await denied(`delete from public.rate_limits`)).toBe(true);
        expect(await denied(hit(['scan_user_min'], ['k1'], [60], [0]))).toBe(true);
      });
    }
  });

  it('apply_retention drops counters older than 2 days and keeps recent ones', async () => {
    await db.exec(`
      insert into public.rate_limits (bucket, key, window_start, count) values
        ('old', 'k', now() - interval '3 days', 5), ('new', 'k', now() - interval '1 hour', 5);
    `);
    await as('service_role', null, () => db.query('select public.apply_retention(90)'));
    const left = (await rows(`select bucket from public.rate_limits where bucket in ('old', 'new')`)).map((r) => r.bucket);
    expect(left).toEqual(['new']);
  });

  it('apply_retention still unlinks old scans and drops old LLM calls (002 behaviour kept)', async () => {
    await db.exec(`
      insert into public.scans (id, user_id, source, diet_preset, verdict, rulebook_version, created_at)
        values ('aaaaaaaa-0000-0000-0000-000000000009', '${A}', 'text', 'vegetarian', 'red', '1.1.0', now() - interval '100 days');
      insert into public.llm_calls (user_id, created_at) values ('${A}', now() - interval '3 days');
    `);
    await as('service_role', null, () => db.query('select public.apply_retention(90)'));
    expect((await rows(`select user_id from public.scans where id = 'aaaaaaaa-0000-0000-0000-000000000009'`))[0].user_id).toBeNull();
    expect((await rows(`select count(*)::int as n from public.llm_calls where created_at < now() - interval '2 days'`))[0].n).toBe(0);
  });

  it('only service_role may run apply_retention', async () => {
    await as('authenticated', A, async () => expect(await denied('select public.apply_retention(90)')).toBe(true));
  });
});
