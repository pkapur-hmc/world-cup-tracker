-- ============================================================
-- World Cup Cup - peek_invite RPC
--
-- The /join/[code] preview page needs to look up a group by its invite code
-- BEFORE the user is a member. The default SELECT policy on wc_groups gates
-- reads to existing members, so the lookup was returning null and the UI
-- showed "doesn't ring a bell" even for valid codes.
--
-- This RPC bypasses RLS and returns only the group's display name (no IDs,
-- no member list, no other metadata) so it's safe to expose to anonymous
-- callers.
-- ============================================================

create or replace function public.peek_invite(invite text)
returns table(name text)
language sql
security definer
stable
set search_path = public
as $$
  select g.name
    from public.wc_groups g
   where g.invite_code = invite
   limit 1;
$$;

grant execute on function public.peek_invite(text) to anon, authenticated;
