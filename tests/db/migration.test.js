// Runs supabase/migrations/001_init.sql in PGlite (real Postgres, in memory) on top of a small
// stand-in for Supabase's auth schema and roles, then checks privileges and row security as the
// browser roles would meet them. Also checks the SQL lists match the rulebook.

import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { data } from '../helpers.js';

const SQL = fs.readFileSync(new URL('../../supabase/migrations/001_init.sql', import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

// What Supabase provides before any migration runs (only the parts 001_init.sql relies on).
// service_role has BYPASSRLS on Supabase; anonymous users use the authenticated role.
const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
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
    return /permission denied|row-level security|can only be changed/.test(e.message);
  }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(SQL);
  await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
  await db.exec(`
    insert into public.scans (id, user_id, source, diet_preset, verdict, rulebook_version)
      values ('aaaaaaaa-0000-0000-0000-000000000001', '${A}', 'text', 'vegetarian', 'green', '1.1.0'),
             ('bbbbbbbb-0000-0000-0000-000000000001', '${B}', 'text', 'vegetarian', 'red', '1.1.0');
    insert into public.scan_feedback (scan_id, user_id, kind)
      values ('aaaaaaaa-0000-0000-0000-000000000001', '${A}', 'helpful'),
             ('bbbbbbbb-0000-0000-0000-000000000001', '${B}', 'helpful');
  `);
}, 60000);
afterAll(async () => { await db?.close(); });

describe('001_init.sql', () => {
  it('creates a profile for every new auth user', async () => {
    expect((await rows('select id from public.profiles order by id')).map((r) => r.id)).toEqual([A, B]);
  });

  it('enables row level security on every table it creates', async () => {
    const created = [...SQL.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    const rls = await rows(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`);
    expect(created.sort()).toEqual(['profiles', 'scan_feedback', 'scans']);
    for (const t of created) expect(rls.find((r) => r.relname === t)?.relrowsecurity, t).toBe(true);
  });

  it('anon (no session) can read or write nothing', async () => {
    await as('anon', null, async () => {
      for (const t of ['profiles', 'scans', 'scan_feedback']) expect(await denied(`select * from public.${t}`), t).toBe(true);
      expect(await denied(`insert into public.profiles (id) values ('${A}')`)).toBe(true);
    });
  });

  it('a user reads only their own profile, scans and feedback', async () => {
    await as('authenticated', A, async () => {
      expect((await rows('select id from public.profiles')).map((r) => r.id)).toEqual([A]);
      expect((await rows('select user_id from public.scans')).map((r) => r.user_id)).toEqual([A]);
      expect((await rows('select user_id from public.scan_feedback')).map((r) => r.user_id)).toEqual([A]);
    });
  });

  it('a user changes only the diet columns of their own profile', async () => {
    await as('authenticated', A, async () => {
      expect(await rows(`update public.profiles set diet_preset = 'jain_strict', options = '{avoid_root_possible}', language = 'gu' returning id`)).toHaveLength(1);
      expect(await rows(`update public.profiles set diet_preset = 'jain_strict' where id = '${B}' returning id`)).toHaveLength(0);
      expect(await denied(`update public.profiles set role = 'admin'`)).toBe(true);
      expect(await denied(`update public.profiles set id = '${B}'`)).toBe(true);
      expect(await denied(`delete from public.profiles`)).toBe(true);
    });
    const [a, b] = await rows(`select diet_preset, options, language, role from public.profiles order by id`);
    expect(a).toEqual({ diet_preset: 'jain_strict', options: ['avoid_root_possible'], language: 'gu', role: 'traveller' });
    expect(b.diet_preset).toBe('vegetarian');
  });

  it('a user can create only their own missing profile', async () => {
    await db.exec(`delete from public.profiles where id = '${A}'`); // cascades A's scans and feedback
    await as('authenticated', A, async () => {
      expect(await denied(`insert into public.profiles (id) values ('${B}')`)).toBe(true);
      expect(await rows(`insert into public.profiles (id, diet_preset) values ('${A}', 'vegetarian') returning id`)).toHaveLength(1);
      expect(await denied(`insert into public.profiles (id, role) values ('${A}', 'admin')`)).toBe(true);
    });
  });

  it('users can never write scans or feedback (verdicts come only from the server)', async () => {
    await as('authenticated', A, async () => {
      expect(await denied(`insert into public.scans (user_id, source, diet_preset, verdict, rulebook_version) values ('${A}', 'text', 'vegetarian', 'green', '1.1.0')`)).toBe(true);
      expect(await denied(`update public.scans set verdict = 'green'`)).toBe(true);
      expect(await denied(`delete from public.scans`)).toBe(true);
      expect(await denied(`insert into public.scan_feedback (scan_id, user_id, kind, priority) values ('bbbbbbbb-0000-0000-0000-000000000001', '${A}', 'helpful', true)`)).toBe(true);
    });
  });

  it('rejects options and presets the rulebook does not know', async () => {
    expect(await denied(`update public.profiles set options = '{made_up}' where id = '${B}'`)).toBe(false); // check violation, not permission
    await expect(db.query(`update public.profiles set options = '{made_up}' where id = '${B}'`)).rejects.toThrow(/check constraint/);
    await expect(db.query(`update public.profiles set diet_preset = 'vegan' where id = '${B}'`)).rejects.toThrow(/check constraint/);
  });

  it('the service role writes scans and feedback and runs retention; browsers cannot run it', async () => {
    await as('service_role', null, async () => {
      expect(await rows(`insert into public.scans (user_id, source, diet_preset, verdict, rulebook_version) values ('${B}', 'text', 'vegetarian', 'amber', '1.1.0') returning id`)).toHaveLength(1);
      await db.query('select public.apply_retention(90)');
    });
    await as('authenticated', B, async () => {
      expect(await denied('select public.apply_retention(0)')).toBe(true);
    });
  });

  it('deleting the auth user removes profile, scans and feedback', async () => {
    await db.exec(`delete from auth.users where id = '${B}'`);
    for (const t of ['profiles', 'scans', 'scan_feedback']) {
      const col = t === 'profiles' ? 'id' : 'user_id';
      expect(await rows(`select 1 from public.${t} where ${col} = '${B}'`), t).toHaveLength(0);
    }
  });
});

describe('001_init.sql matches the rulebook', () => {
  const list = (name) => {
    const m = SQL.match(new RegExp(`${name}\\s+text(?:\\[\\])?[^;]*?check \\(${name} (?:in \\(|<@ array\\[)([^)\\]]*)`, 's'));
    return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1)).sort();
  };
  it('profiles.diet_preset allows exactly the rulebook presets', () => {
    expect(list('diet_preset')).toEqual(Object.keys(data.diets).sort());
  });
  it('profiles.options allows exactly the rulebook options', () => {
    expect(list('options')).toEqual(Object.keys(data.options).sort());
  });
});
