-- Shojin Pass — stage 6: shared rate limits (spec 16.1).
-- Run once in the Supabase SQL editor, AFTER 001_init.sql and 002_explain_feedback.sql.
--
-- Why a table: on Vercel every request may land on a different short-lived server instance, so
-- counters kept in memory are not shared. One row per (bucket, key, time window) holds the count.
--
--   rate_limits       counters. Server only (service role); no browser access at all. Keys are
--                     user ids or IP addresses hashed by the server, never raw IPs.
--   hit_rate_limits   adds to several counters in one call and returns the new counts.
--   apply_retention   now also drops counters older than 2 days (the daily cron calls it).
--
-- Written for "Automatically expose new tables" OFF: every privilege is granted explicitly.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------------------------

create table public.rate_limits (
  bucket       text        not null check (char_length(bucket) between 1 and 40),
  key          text        not null check (char_length(key) between 1 and 64),
  window_start timestamptz not null,
  count        integer     not null default 0 check (count >= 0),
  primary key (bucket, key, window_start)
);

create index rate_limits_window on public.rate_limits (window_start);

revoke all on public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

-- No policies: browsers can never read or write it (service_role bypasses row security).
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. hit_rate_limits: one round trip per request
-- ---------------------------------------------------------------------------------------------
-- Element i of each array describes one counter: bucket name, hashed key, window length in
-- seconds and how much to add. Windows are fixed (aligned to the Unix epoch, so days are UTC).
-- Returns the count after adding and when the window ends. The server decides allow / deny.

create or replace function public.hit_rate_limits(
  p_buckets text[], p_keys text[], p_windows integer[], p_costs integer[]
)
returns table (bucket text, count integer, reset_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  n  integer := coalesce(cardinality(p_buckets), 0);
  i  integer;
  ws timestamptz;
  c  integer;
begin
  if n = 0 or n > 10
     or coalesce(cardinality(p_keys), 0) <> n
     or coalesce(cardinality(p_windows), 0) <> n
     or coalesce(cardinality(p_costs), 0) <> n then
    raise exception 'hit_rate_limits: arrays must have the same length (1 to 10)';
  end if;

  for i in 1 .. n loop
    if p_windows[i] is null or p_windows[i] not between 1 and 86400
       or p_costs[i] is null or p_costs[i] not between 0 and 100 then
      raise exception 'hit_rate_limits: window must be 1-86400 s and cost 0-100';
    end if;
    ws := to_timestamp(floor(extract(epoch from now()) / p_windows[i]) * p_windows[i]);

    insert into public.rate_limits as r (bucket, key, window_start, count)
    values (p_buckets[i], p_keys[i], ws, p_costs[i])
    on conflict on constraint rate_limits_pkey
      do update set count = r.count + excluded.count
    returning r.count into c;

    bucket   := p_buckets[i];
    count    := c;
    reset_at := ws + make_interval(secs => p_windows[i]);
    return next;
  end loop;
end $$;

revoke execute on function public.hit_rate_limits(text[], text[], integer[], integer[]) from public, anon, authenticated;
grant  execute on function public.hit_rate_limits(text[], text[], integer[], integer[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Retention: also drop rate-limit counters older than 2 days
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_retention(scan_days integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.scans set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
  update public.scan_feedback set user_id = null
   where user_id is not null and created_at < now() - make_interval(days => scan_days);
  delete from public.llm_calls   where created_at   < now() - interval '2 days';
  delete from public.rate_limits where window_start < now() - interval '2 days';
end $$;

revoke execute on function public.apply_retention(integer) from public, anon, authenticated;
grant  execute on function public.apply_retention(integer) to service_role;

commit;
