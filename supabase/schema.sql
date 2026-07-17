-- ============================================================================
--  Shivam Enterprises LMS — Supabase database setup
--  Run this ONCE: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--  It is safe to run again; every statement is "if not exists" / idempotent.
-- ============================================================================

-- One row per loan. The whole loan (borrower, terms, payments, restructures)
-- is stored as a JSON document in `data`, mirroring how the app already models
-- a loan — so nothing about the app's data shape has to change.
--   deleted     : soft-delete flag (the app has a 30-day Recycle Bin; a delete
--                 on one device sets this true so the other device removes it too)
--   updated_at  : set on every write; the app polls for rows newer than what it has
--   updated_by  : which device made the change (so a device ignores its own echoes)
create table if not exists public.loans (
  id          text primary key,
  data        jsonb       not null,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists loans_updated_at_idx on public.loans (updated_at);

-- Small shared key/value area (app settings, audit log, etc. — optional use).
create table if not exists public.app_kv (
  key         text primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Central daily backups. The app saves one snapshot of the WHOLE loan book per
-- day here, so if a wrong edit or delete syncs to every device, you can roll the
-- whole book back to an earlier day. Old snapshots (beyond ~60) are trimmed by
-- the app. This is the safety net for shared data.
create table if not exists public.snapshots (
  id          bigint generated always as identity primary key,
  taken_at    timestamptz not null default now(),
  day         date not null,
  data        jsonb       not null,
  taken_by    text
);
create unique index if not exists snapshots_day_uidx on public.snapshots (day);

-- ---------------------------------------------------------------------------
-- Row Level Security: the database is LOCKED by default. Only a signed-in
-- staff member (your two device logins) can read or write. Anyone holding just
-- the publishable key but NOT logged in gets nothing.
-- ---------------------------------------------------------------------------
alter table public.loans     enable row level security;
alter table public.app_kv    enable row level security;
alter table public.snapshots enable row level security;

-- Full access for any authenticated (logged-in) user; nothing for anonymous.
drop policy if exists "loans_authenticated_all" on public.loans;
create policy "loans_authenticated_all"
  on public.loans for all
  to authenticated
  using (true) with check (true);

drop policy if exists "kv_authenticated_all" on public.app_kv;
create policy "kv_authenticated_all"
  on public.app_kv for all
  to authenticated
  using (true) with check (true);

drop policy if exists "snap_authenticated_all" on public.snapshots;
create policy "snap_authenticated_all"
  on public.snapshots for all
  to authenticated
  using (true) with check (true);

-- Keep updated_at honest on every write, regardless of what the client sends.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists loans_touch on public.loans;
create trigger loans_touch before insert or update on public.loans
  for each row execute function public.touch_updated_at();

drop trigger if exists kv_touch on public.app_kv;
create trigger kv_touch before insert or update on public.app_kv
  for each row execute function public.touch_updated_at();
