-- ============================================================
-- World Cup Tracker - schema
-- All tables prefixed wc_ to namespace cleanly within Supabase.
-- Auth identity comes from auth.users (Supabase magic link).
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type wc_role as enum ('host', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wc_stage as enum (
    'group',
    'r32',          -- expanded knockout (round of 32)
    'r16',
    'qf',
    'sf',
    'third_place',
    'final'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type wc_match_status as enum ('scheduled', 'live', 'final', 'postponed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wc_drink_type as enum (
    'beer',         -- pint / can - 1 WCC
    'cocktail',     -- mixed drink - 0.75 WCC
    'shot',         -- shot - 0.25 WCC
    'wine',         -- glass - 1 WCC
    'other'         -- catch-all - 1 WCC
  );
exception when duplicate_object then null; end $$;

-- ---------- Groups (watch parties) ----------
create table if not exists public.wc_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Memberships ----------
create table if not exists public.wc_memberships (
  group_id uuid not null references public.wc_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role wc_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_wc_memberships_user on public.wc_memberships(user_id);

-- ---------- Teams (reference data, shared across groups) ----------
create table if not exists public.wc_teams (
  code text primary key,           -- ISO 3-letter
  name text not null,
  flag_emoji text,
  group_letter text                -- 'A'..'L' (null for non-host knockout-only seeds)
);

-- ---------- Matches (reference data, scores updated by cron) ----------
create table if not exists public.wc_matches (
  id int primary key,                                          -- match number 1..104
  stage wc_stage not null,
  group_letter text,
  team_a_code text references public.wc_teams(code),
  team_b_code text references public.wc_teams(code),
  kickoff_at timestamptz not null,
  venue text,
  status wc_match_status not null default 'scheduled',
  score_a int,
  score_b int,
  winner_code text references public.wc_teams(code),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wc_matches_kickoff on public.wc_matches(kickoff_at);
create index if not exists idx_wc_matches_status on public.wc_matches(status);

-- ---------- Drinks (per-drink rows; aggregates derived) ----------
create table if not exists public.wc_drinks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.wc_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id int references public.wc_matches(id) on delete set null,
  drink_type wc_drink_type not null default 'beer',
  created_at timestamptz not null default now()
);
create index if not exists idx_wc_drinks_group_created on public.wc_drinks(group_id, created_at desc);
create index if not exists idx_wc_drinks_user on public.wc_drinks(user_id);
create index if not exists idx_wc_drinks_match on public.wc_drinks(match_id);

-- ---------- Events (forward-compat: predictions, photos, rule fires, etc.) ----------
create table if not exists public.wc_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.wc_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id int references public.wc_matches(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_wc_events_group_kind on public.wc_events(group_id, kind);

-- ============================================================
-- Helper predicates (used by RLS policies)
-- security definer = bypass RLS when checking membership;
-- safe because they only read wc_memberships filtered by auth.uid().
-- ============================================================
create or replace function public.is_group_member(group_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1 from public.wc_memberships
    where group_id = group_uuid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_host(group_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1 from public.wc_memberships
    where group_id = group_uuid and user_id = auth.uid() and role = 'host'
  );
$$;

-- ============================================================
-- RPC: create a group (caller becomes host)
-- ============================================================
create or replace function public.create_group(group_name text, host_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.wc_groups (name, created_by)
  values (group_name, auth.uid())
  returning id into new_group_id;

  insert into public.wc_memberships (group_id, user_id, display_name, role)
  values (new_group_id, auth.uid(), host_display_name, 'host');

  return new_group_id;
end;
$$;

-- ============================================================
-- RPC: accept an invite code (caller becomes member)
-- ============================================================
create or replace function public.accept_invite(invite text, member_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into target_group_id
  from public.wc_groups
  where invite_code = invite
  limit 1;

  if target_group_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.wc_memberships (group_id, user_id, display_name, role)
  values (target_group_id, auth.uid(), member_display_name, 'member')
  on conflict (group_id, user_id) do update set display_name = excluded.display_name;

  return target_group_id;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.wc_groups enable row level security;
alter table public.wc_memberships enable row level security;
alter table public.wc_teams enable row level security;
alter table public.wc_matches enable row level security;
alter table public.wc_drinks enable row level security;
alter table public.wc_events enable row level security;

-- ---- wc_teams: public reference data (any authenticated reader) ----
drop policy if exists "teams readable" on public.wc_teams;
create policy "teams readable"
  on public.wc_teams for select to authenticated using (true);

-- ---- wc_matches: public reference data ----
drop policy if exists "matches readable" on public.wc_matches;
create policy "matches readable"
  on public.wc_matches for select to authenticated using (true);

-- ---- wc_groups ----
drop policy if exists "groups readable by members" on public.wc_groups;
create policy "groups readable by members"
  on public.wc_groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists "hosts can update group" on public.wc_groups;
create policy "hosts can update group"
  on public.wc_groups for update to authenticated
  using (public.is_group_host(id))
  with check (public.is_group_host(id));

-- (no direct INSERT policy on wc_groups: use create_group() RPC)

-- ---- wc_memberships ----
drop policy if exists "memberships readable by group members" on public.wc_memberships;
create policy "memberships readable by group members"
  on public.wc_memberships for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "users update own membership; hosts update any" on public.wc_memberships;
create policy "users update own membership; hosts update any"
  on public.wc_memberships for update to authenticated
  using (user_id = auth.uid() or public.is_group_host(group_id))
  with check (user_id = auth.uid() or public.is_group_host(group_id));

drop policy if exists "users leave; hosts remove any" on public.wc_memberships;
create policy "users leave; hosts remove any"
  on public.wc_memberships for delete to authenticated
  using (user_id = auth.uid() or public.is_group_host(group_id));

-- (no direct INSERT policy: use create_group() / accept_invite() RPCs)

-- ---- wc_drinks ----
drop policy if exists "drinks readable by group members" on public.wc_drinks;
create policy "drinks readable by group members"
  on public.wc_drinks for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "users insert own drinks" on public.wc_drinks;
create policy "users insert own drinks"
  on public.wc_drinks for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "users update own drinks" on public.wc_drinks;
create policy "users update own drinks"
  on public.wc_drinks for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users delete own; hosts delete any" on public.wc_drinks;
create policy "users delete own; hosts delete any"
  on public.wc_drinks for delete to authenticated
  using (user_id = auth.uid() or public.is_group_host(group_id));

-- ---- wc_events ----
drop policy if exists "events readable by group members" on public.wc_events;
create policy "events readable by group members"
  on public.wc_events for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "users insert own events" on public.wc_events;
create policy "users insert own events"
  on public.wc_events for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "users delete own events; hosts delete any" on public.wc_events;
create policy "users delete own events; hosts delete any"
  on public.wc_events for delete to authenticated
  using (user_id = auth.uid() or public.is_group_host(group_id));
