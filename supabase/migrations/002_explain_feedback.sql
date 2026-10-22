-- supabase/migrations/002_explain_feedback.sql
-- Shojin Pass, stage 4: explanation cache, per-user LLM limit, feedback kinds (spec 11, 13.6, 13.7).
-- Run once, after 001_init.sql. Same rules as 001: nothing is exposed automatically, so every
-- privilege is granted explicitly and every new table has row level security.
--
--   scans.details        flagged words found hidden in unknown text, outside the list, or in a
--                        shared-line notice (rulebook meanings and matched spellings only), so the
--                        template "why" can be rebuilt for any language later. No label text.
--   scan_explanations    cached LLM "why" per scan and language. Users may read their own;
--                        only the server writes.
--   llm_calls            one row per LLM call, for the per-user limit. Server only; kept 2 days.
--   scan_feedback        kind 'unclear' added; one row per scan, user and kind (a repeat updates it).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Changes to existing tables
-- ---------------------------------------------------------------------------------------------

alter table public.scans add column details jsonb not null default '{}'::jsonb;

alter table public.scan_feedback drop constraint if exists scan_feedback_kind_check;
alter table public.scan_feedback add constraint scan_feedback_kind_check
  check (kind in ('wrong_verdict','unclear','unreadable','helpful'));
alter table public.scan_feedback add constraint scan_feedback_one_per_kind unique (scan_id, user_id, kind);

-- ---------------------------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------------------------

create table public.scan_explanations (
  scan_id    uuid not null references public.scans(id) on delete cascade,
  language   text not null check (language in ('en','hi','gu')),
  text       text not null check (char_length(text) between 1 and 1000),
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (scan_id, language)
);

create table public.llm_calls (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index llm_calls_user_time on public.llm_calls (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 3. Privileges
-- ---------------------------------------------------------------------------------------------

revoke all on public.scan_explanations, public.llm_calls from public, anon, authenticated;

grant select on public.scan_explanations to authenticated;
grant select, insert, update, delete on public.scan_explanations to service_role;
grant select, insert, delete on public.llm_calls to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------------------------

alter table public.scan_explanations enable row level security;
alter table public.llm_calls         enable row level security;

create policy explanations_select_own on public.scan_explanations for select to authenticated
  using (exists (select 1 from public.scans s where s.id = scan_id and s.user_id = (select auth.uid())));

-- llm_calls: no policies at all, so browsers can never read or write it.

-- ---------------------------------------------------------------------------------------------
-- 5. Retention: also drop LLM call records older than 2 days
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_retention(scan_days integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.scans set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
  update public.scan_feedback set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
  delete from public.llm_calls where created_at < now() - interval '2 days';
end $$;

revoke execute on function public.apply_retention(integer) from public, anon, authenticated;
grant  execute on function public.apply_retention(integer) to service_role;

commit;
