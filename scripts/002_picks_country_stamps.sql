-- ============================================================
-- World Cup Cup - Phase 1 schema additions
-- Picks (with stake), country-beer flag on drinks, all related RPCs.
-- ============================================================

-- ---------- Picks ----------
create table if not exists public.wc_picks (
  group_id uuid not null references public.wc_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id int not null references public.wc_matches(id),
  pick text not null check (pick in ('A','D','B')),     -- home / draw / away
  stake int not null default 0 check (stake >= 0),
  picked_at timestamptz not null default now(),
  settled_at timestamptz,
  payout_wcc int not null default 0,    -- positive on refund, 0 otherwise
  payout_wcp int not null default 0,
  primary key (group_id, user_id, match_id)
);
create index if not exists idx_wc_picks_match on public.wc_picks(match_id);
create index if not exists idx_wc_picks_unsettled
  on public.wc_picks(match_id) where settled_at is null;

alter table public.wc_picks enable row level security;

drop policy if exists "picks readable by group members" on public.wc_picks;
create policy "picks readable by group members" on public.wc_picks
  for select to authenticated
  using (public.is_group_member(group_id));

-- (no direct INSERT/UPDATE/DELETE policy: use RPCs below)

-- ---------- Country-beer columns on wc_drinks ----------
alter table public.wc_drinks
  add column if not exists country_code text references public.wc_teams(code),
  add column if not exists beer_label text;
create index if not exists idx_wc_drinks_country
  on public.wc_drinks(user_id, country_code) where country_code is not null;

-- ============================================================
-- RPC: place_pick (member only, enforces lock + stake balance)
-- ============================================================
create or replace function public.place_pick(
  target_group_id uuid,
  target_match_id int,
  pick_value text,
  stake_value int default 0
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  available_wcc int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_group_member(target_group_id) then
    raise exception 'not a member of this group';
  end if;
  if pick_value not in ('A','D','B') then raise exception 'invalid pick'; end if;
  if stake_value < 0 then raise exception 'stake must be >= 0'; end if;

  select id, stage, kickoff_at, status
    into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.stage <> 'group' and pick_value = 'D' then
    raise exception 'draw picks not allowed in knockout matches';
  end if;
  -- 30-second grace period after kickoff
  if now() > m.kickoff_at + interval '30 seconds' then
    raise exception 'picks are locked';
  end if;

  -- Available WCC excludes any existing stake on THIS match (so user can
  -- raise/lower it without double-counting), but counts every other stake
  -- plus refunds from settled refunded picks.
  select
    (select count(*) from public.wc_drinks
       where user_id = auth.uid() and group_id = target_group_id)
    -
    (select coalesce(sum(stake), 0) from public.wc_picks
       where user_id = auth.uid() and group_id = target_group_id
         and match_id <> target_match_id)
    +
    (select coalesce(sum(payout_wcc), 0) from public.wc_picks
       where user_id = auth.uid() and group_id = target_group_id
         and settled_at is not null)
  into available_wcc;

  if stake_value > available_wcc then
    raise exception 'stake exceeds available WCC (% available)', available_wcc;
  end if;

  insert into public.wc_picks (group_id, user_id, match_id, pick, stake, picked_at)
  values (target_group_id, auth.uid(), target_match_id, pick_value, stake_value, now())
  on conflict (group_id, user_id, match_id)
  do update set
    pick = excluded.pick,
    stake = excluded.stake,
    picked_at = now()
  where wc_picks.settled_at is null;  -- can't change after settle
end;
$$;

-- ============================================================
-- RPC: settle_match_picks (called by cron after match goes final, idempotent)
-- ============================================================
create or replace function public.settle_match_picks(target_match_id int)
returns int  -- count of picks newly settled
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  settled_count int := 0;
begin
  select id, status, team_a_code, team_b_code, winner_code
    into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'final' then raise exception 'match is not final'; end if;

  update public.wc_picks p
     set settled_at = now(),
         payout_wcp = case
           when p.pick = 'A' and m.winner_code = m.team_a_code then 1 + 2 * p.stake
           when p.pick = 'B' and m.winner_code = m.team_b_code then 1 + 2 * p.stake
           when p.pick = 'D' and m.winner_code is null then 1 + 2 * p.stake
           else 0
         end,
         payout_wcc = 0          -- spend-forever: stake doesn't return
   where p.match_id = target_match_id
     and p.settled_at is null;

  get diagnostics settled_count = row_count;
  return settled_count;
end;
$$;

-- ============================================================
-- RPC: refund_match_picks (called by cron when match is postponed)
-- ============================================================
create or replace function public.refund_match_picks(target_match_id int)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  refunded_count int := 0;
begin
  select id, status into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'postponed' then raise exception 'match is not postponed'; end if;

  update public.wc_picks
     set settled_at = now(),
         payout_wcp = 0,
         payout_wcc = stake     -- stake comes back
   where match_id = target_match_id and settled_at is null;

  get diagnostics refunded_count = row_count;
  return refunded_count;
end;
$$;

-- ============================================================
-- RPC: promote_member (host only)
-- ============================================================
create or replace function public.promote_member(
  target_group_id uuid, target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_group_host(target_group_id) then raise exception 'host only'; end if;
  update public.wc_memberships set role = 'host'
   where group_id = target_group_id and user_id = target_user_id;
end;
$$;

-- ============================================================
-- RPC: remove_member (host only, not self)
-- ============================================================
create or replace function public.remove_member(
  target_group_id uuid, target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_group_host(target_group_id) then raise exception 'host only'; end if;
  if target_user_id = auth.uid() then
    raise exception 'use leave_group to remove yourself';
  end if;
  delete from public.wc_memberships
   where group_id = target_group_id and user_id = target_user_id;
  -- drinks/picks/events for that user_id stay (no membership cascade)
end;
$$;

-- ============================================================
-- RPC: leave_group (any member; sole host is blocked)
-- ============================================================
create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  my_role public.wc_role;
  host_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select role into my_role from public.wc_memberships
   where group_id = target_group_id and user_id = auth.uid();
  if my_role is null then raise exception 'not a member'; end if;

  if my_role = 'host' then
    select count(*) into host_count from public.wc_memberships
     where group_id = target_group_id and role = 'host';
    if host_count <= 1 then
      raise exception 'promote another host or delete the group first';
    end if;
  end if;

  delete from public.wc_memberships
   where group_id = target_group_id and user_id = auth.uid();
end;
$$;

-- ============================================================
-- RPC: reset_invite_code (host only)
-- ============================================================
create or replace function public.reset_invite_code(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_code text;
begin
  if not public.is_group_host(target_group_id) then raise exception 'host only'; end if;
  new_code := substr(md5(random()::text), 1, 8);
  update public.wc_groups set invite_code = new_code where id = target_group_id;
  return new_code;
end;
$$;

-- ============================================================
-- RPC: rename_group (host only)
-- ============================================================
create or replace function public.rename_group(
  target_group_id uuid, new_name text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_group_host(target_group_id) then raise exception 'host only'; end if;
  update public.wc_groups set name = new_name where id = target_group_id;
end;
$$;

-- ============================================================
-- RPC: delete_group (host only, cascades to all group data)
-- ============================================================
create or replace function public.delete_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_group_host(target_group_id) then raise exception 'host only'; end if;
  delete from public.wc_groups where id = target_group_id;
  -- cascades to memberships, drinks, picks, events
end;
$$;

-- ============================================================
-- RPC: update_display_name (member, their own only)
-- ============================================================
create or replace function public.update_display_name(
  target_group_id uuid, new_display_name text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.wc_memberships set display_name = new_display_name
   where group_id = target_group_id and user_id = auth.uid();
end;
$$;
