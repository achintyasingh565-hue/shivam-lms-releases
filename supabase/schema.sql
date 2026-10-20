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

-- Shared settings, keyed by name. The app stores the staff user list here and
-- polls it so a change on one device reaches the other.
-- NOTE the column is `data`, not `value` — 20-cloud-sync.js asks for
-- `/app_settings?select=data,updated_at,updated_by&key=eq...`, so renaming it
-- would break the user-list sync.
create table if not exists public.app_settings (
  key         text primary key,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- LEGACY, UNUSED. This was in the original setup script, but the app never
-- adopted it — it holds 0 rows in the live database and the string "app_kv"
-- appears nowhere in src/. app_settings above replaced it. Kept only so that
-- rebuilding this schema matches the live database exactly; safe to delete
-- from this file and drop from the database whenever you want.
create table if not exists public.app_kv (
  key         text primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Day-to-day business expenses, one row per entry.
-- Deliberately a TABLE and not a key in app_settings: a settings key holds one
-- blob that is rewritten whole, so an expense added on the office machine and
-- another added on the second device in the same sync window would silently
-- overwrite each other. One row per expense merges instead, exactly like loans.
--   data    : the expense as the app models it {id, date, cat, note, amount}
--   deleted : soft delete, so a removal on one device reaches the other
create table if not exists public.expenses (
  id          text primary key,
  data        jsonb       not null,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
create index if not exists expenses_updated_at_idx on public.expenses (updated_at);

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
alter table public.loans         enable row level security;
alter table public.app_settings  enable row level security;
alter table public.app_kv        enable row level security;
alter table public.expenses      enable row level security;
alter table public.snapshots     enable row level security;

-- Full access for any authenticated (logged-in) user; nothing for anonymous.
drop policy if exists "loans_authenticated_all" on public.loans;
create policy "loans_authenticated_all"
  on public.loans for all
  to authenticated
  using (true) with check (true);

-- app_settings mirrors the live database: read, insert and update for signed-in
-- staff, and deliberately NO delete policy — settings are overwritten, never
-- removed, so there is no way to wipe the shared user list by accident.
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read"
  on public.app_settings for select
  to authenticated using (true);

drop policy if exists "app_settings_insert" on public.app_settings;
create policy "app_settings_insert"
  on public.app_settings for insert
  to authenticated with check (true);

drop policy if exists "app_settings_update" on public.app_settings;
create policy "app_settings_update"
  on public.app_settings for update
  to authenticated using (true) with check (true);

drop policy if exists "kv_authenticated_all" on public.app_kv;
create policy "kv_authenticated_all"
  on public.app_kv for all
  to authenticated
  using (true) with check (true);

drop policy if exists "expenses_authenticated_all" on public.expenses;
create policy "expenses_authenticated_all"
  on public.expenses for all
  to authenticated
  using (true) with check (true);

drop policy if exists "snap_authenticated_all" on public.snapshots;
create policy "snap_authenticated_all"
  on public.snapshots for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Data API grants.
--
-- Until 30 October 2026 Supabase granted these automatically to every new
-- table in "public", so this file never needed them. From that date it does
-- not: a table created without an explicit GRANT is invisible to PostgREST,
-- and the app's calls come back "permission denied". Existing tables in an
-- existing project keep the grants they already have, so the live database is
-- unaffected — but this file is the rebuild script, and re-running it on a new
-- project, a preview branch or after `supabase db reset` would otherwise
-- produce tables the app cannot reach.
--
-- `authenticated` only, deliberately. These grants say which roles may ask;
-- the RLS policies above still decide what each row lets them do. `anon` is
-- given nothing, matching the policies: someone holding the publishable key
-- but not signed in must get nothing. `service_role` bypasses RLS entirely
-- and is not used by this app, so it is not granted either.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.loans        to authenticated;
grant select, insert, update         on public.app_settings to authenticated;  -- no delete, matching the policies
grant select, insert, update, delete on public.app_kv       to authenticated;  -- legacy, unused
grant select, insert, update, delete on public.expenses     to authenticated;
grant select, insert, update, delete on public.snapshots    to authenticated;

-- snapshots.id is an identity column; inserts need its sequence.
grant usage, select on all sequences in schema public to authenticated;

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

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before insert or update on public.app_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch before insert or update on public.expenses
  for each row execute function public.touch_updated_at();

drop trigger if exists kv_touch on public.app_kv;
create trigger kv_touch before insert or update on public.app_kv
  for each row execute function public.touch_updated_at();
