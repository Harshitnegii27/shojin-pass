// 001_init.sql + 002_explain_feedback.sql in PGlite: explanation cache, LLM call log, feedback kinds.

import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const SA = 'aaaaaaaa-0000-0000-0000-000000000001';
const SB = 'bbbbbbbb-0000-0000-0000-000000000001';

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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(read('001_init.sql'));
  await db.exec(read('002_explain_feedback.sql'));
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    insert into public.scans (id, user_id, source, diet_preset, verdict, rulebook_version)
      values ('${SA}', '${A}', 'text', 'vegetarian', 'red', '1.1.0'), ('${SB}', '${B}', 'text', 'vegetarian', 'green', '1.1.0');
    insert into public.scan_explanations (scan_id, language, text, model)
      values ('${SA}', 'en', 'A''s explanation', 'm'), ('${SB}', 'en', 'B''s explanation', 'm');
  `);
}, 60000);
afterAll(async () => { await db?.close(); });

describe('002_explain_feedback.sql', () => {
  it('adds scans.details with an empty default', async () => {
    expect((await rows(`select details from public.scans where id = '${SA}'`))[0].details).toEqual({});
  });

  it('enables row level security on both new tables', async () => {
    const r = await rows(`select relname, relrowsecurity from pg_class where relname in ('scan_explanations', 'llm_calls')`);
    expect(r.every((x) => x.relrowsecurity)).toBe(true);
    expect(r).toHaveLength(2);
  });

  it('a user reads only the cached explanations of their own scans, and never writes them', async () => {
    await as('authenticated', A, async () => {
      expect((await rows('select text from public.scan_explanations')).map((r) => r.text)).toEqual(["A's explanation"]);
      expect(await denied(`insert into public.scan_explanations (scan_id, language, text, model) values ('${SA}', 'hi', 'x', 'm')`)).toBe(true);
      expect(await denied(`update public.scan_explanations set text = 'safe to eat'`)).toBe(true);
    });
    await as('anon', null, async () => {
      expect(await denied('select * from public.scan_explanations')).toBe(true);
    });
  });

  it('browsers can never see or write the LLM call log; the server can', async () => {
    for (const [role, sub] of [['anon', null], ['authenticated', A]]) {
      await as(role, sub, async () => {
        expect(await denied('select * from public.llm_calls')).toBe(true);
        expect(await denied(`insert into public.llm_calls (user_id) values ('${A}')`)).toBe(true);
      });
    }
    await as('service_role', null, async () => {
      expect(await rows(`insert into public.llm_calls (user_id) values ('${A}') returning id`)).toHaveLength(1);
      expect((await rows(`select count(*)::int as n from public.llm_calls where user_id = '${A}'`))[0].n).toBe(1);
    });
  });

  it("feedback accepts 'unclear', rejects unknown kinds, and keeps one row per scan, user and kind", async () => {
    await as('service_role', null, async () => {
      await db.query(`insert into public.scan_feedback (scan_id, user_id, kind, note) values ('${SA}', '${A}', 'unclear', 'first')`);
      await db.query(`insert into public.scan_feedback (scan_id, user_id, kind) values ('${SA}', '${A}', 'wrong_verdict')`);
      await expect(db.query(`insert into public.scan_feedback (scan_id, user_id, kind) values ('${SA}', '${A}', 'unclear')`)).rejects.toThrow(/scan_feedback_one_per_kind/);
      await expect(db.query(`insert into public.scan_feedback (scan_id, user_id, kind) values ('${SA}', '${A}', 'boring')`)).rejects.toThrow(/check constraint/);
      await db.query(`insert into public.scan_feedback (scan_id, user_id, kind, note) values ('${SA}', '${A}', 'unclear', 'second')
                      on conflict (scan_id, user_id, kind) do update set note = excluded.note`);
    });
    expect(await rows(`select kind, note from public.scan_feedback where scan_id = '${SA}' order by kind`))
      .toEqual([{ kind: 'unclear', note: 'second' }, { kind: 'wrong_verdict', note: null }]);
    await as('authenticated', A, async () => {
      expect(await denied(`insert into public.scan_feedback (scan_id, user_id, kind) values ('${SA}', '${A}', 'helpful')`)).toBe(true);
    });
  });

  it('retention drops LLM call records older than 2 days and nothing newer', async () => {
    await db.exec(`insert into public.llm_calls (user_id, created_at) values ('${B}', now() - interval '3 days'), ('${B}', now() - interval '1 hour')`);
    await as('service_role', null, async () => { await db.query('select public.apply_retention(90)'); });
    expect((await rows(`select count(*)::int as n from public.llm_calls where user_id = '${B}'`))[0].n).toBe(1);
    await as('authenticated', B, async () => { expect(await denied('select public.apply_retention(0)')).toBe(true); });
  });

  it('deleting the user removes their explanations, feedback and LLM call log', async () => {
    await db.exec(`delete from auth.users where id = '${A}'`);
    expect(await rows(`select 1 from public.scan_explanations where scan_id = '${SA}'`)).toHaveLength(0);
    expect(await rows(`select 1 from public.scan_feedback where scan_id = '${SA}'`)).toHaveLength(0);
    expect(await rows(`select 1 from public.llm_calls where user_id = '${A}'`)).toHaveLength(0);
    expect(await rows(`select 1 from public.scan_explanations where scan_id = '${SB}'`)).toHaveLength(1);
  });
});
