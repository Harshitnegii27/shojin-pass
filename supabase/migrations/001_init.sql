-- supabase/migrations/001_init.sql
-- Shojin Pass, stage 2: profiles, scans, scan_feedback (spec 14).
--
-- Written for a project where "Automatically expose new tables" is OFF and automatic RLS is ON:
-- nothing is granted by default, so every privilege below is granted explicitly, and row level
-- security is enabled explicitly on every table (harmless if it is already on).
--
-- Who may do what:
--   anon           (no session)            nothing on these tables
--   authenticated  (incl. anonymous users) read own profile, create/update own profile
--                                          (diet_preset, options, language only); read own scans
--                                          and own feedback. Never writes scans or feedback, so a
--                                          stored verdict always comes from the server's engine.
--   service_role   (server only)           read/write all three tables; bypasses RLS by design.
-- Deleting the auth user (DELETE /api/profile) removes the profile, scans and feedback by cascade.
-- No photos are stored, so there is no storage bucket.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  diet_preset  text not null default 'vegetarian'
               check (diet_preset in ('vegetarian','vegetarian_egg','no_onion_garlic',
                                      'jain_flexible','jain_strict')),
  options      text[] not null default '{}'
               check (options <@ array['avoid_fungus','avoid_alcohol','avoid_root_possible',
                                       'avoid_shared_line','no_food_after_sunset']::text[]),
  language     text not null default 'en' check (language in ('en','hi','gu')),
  role         text not null default 'traveller'
               check (role in ('traveller','venue','reviewer','admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.scans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles(id) on delete cascade,
  source               text not null check (source in ('photo','text','barcode')),
  diet_preset          text not null,
  options              text[] not null default '{}',
  language             text not null default 'en',
  verdict              text not null check (verdict in ('green','amber','red','retake')),
  reasons              text[] not null default '{}',
  items                jsonb not null default '[]'::jsonb,   -- matched ingredients, no label text
  unknown_terms        text[] not null default '{}',
  low_confidence_terms text[] not null default '{}',
  completeness         text check (completeness in ('complete','incomplete')),
  ocr_confidence       numeric(4,3),
  rulebook_version     text not null,
  latency_ms           integer,
  created_at           timestamptz not null default now()
);

create table public.scan_feedback (
  id         uuid primary key default gen_random_uuid(),
  scan_id    uuid not null references public.scans(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('wrong_verdict','unreadable','helpful')),
  note       text check (char_length(note) <= 500),
  priority   boolean not null default false,       -- wrong_verdict on a green scan: possible false safe
  created_at timestamptz not null default now()
);

create index scans_user_time   on public.scans (user_id, created_at desc);
create index scans_time        on public.scans (created_at);
create index feedback_scan     on public.scan_feedback (scan_id);
create index feedback_user     on public.scan_feedback (user_id);
create index feedback_priority on public.scan_feedback (priority, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 2. Functions and triggers
-- ---------------------------------------------------------------------------------------------

-- New auth user (anonymous sign-in included) -> profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role can never be changed from a browser session (column grants below also block it).
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user in ('anon','authenticated') then
    raise exception 'profiles.role can only be changed by the server';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Retention (spec 16.2): unlink scans and feedback from the user after scan_days.
-- Called by the server with the service role (stage 6 cron).
create or replace function public.apply_retention(scan_days integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.scans set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
  update public.scan_feedback set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
end $$;

-- Functions are executable by PUBLIC by default in Postgres; close that.
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.protect_profile_role()   from public, anon, authenticated;
revoke execute on function public.apply_retention(integer) from public, anon, authenticated;
grant  execute on function public.apply_retention(integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Privileges (explicit, because new tables are not exposed automatically)
-- ---------------------------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles, public.scans, public.scan_feedback from public, anon, authenticated;

-- authenticated: own profile (only the diet columns are writable), read own scans and feedback.
grant select                                     on public.profiles      to authenticated;
grant insert (id, diet_preset, options, language) on public.profiles      to authenticated;
grant update (diet_preset, options, language)     on public.profiles      to authenticated;
grant select                                     on public.scans         to authenticated;
grant select                                     on public.scan_feedback to authenticated;

-- service_role: the server writes scans and feedback, deletes users, runs retention.
grant select, insert, update, delete on public.profiles, public.scans, public.scan_feedback to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Row level security: every user sees and changes only their own rows
-- ---------------------------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.scans         enable row level security;
alter table public.scan_feedback enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy scans_select_own on public.scans for select to authenticated
  using (user_id = (select auth.uid()));

create policy feedback_select_own on public.scan_feedback for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies on scans or scan_feedback, and no delete policy on profiles:
-- those writes go through the server (service role) only.

commit;
