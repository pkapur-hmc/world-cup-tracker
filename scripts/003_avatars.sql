-- ============================================================
-- World Cup Tracker - avatars
--
-- Adds avatar_url to memberships so each user can have a profile photo
-- per-group (lets you wear different masks in different brackets).
-- Also creates the public storage bucket + policies for uploads.
-- ============================================================

-- 1. Membership column ------------------------------------------------
alter table public.wc_memberships
  add column if not exists avatar_url text;

-- 2. Storage bucket (public read, authenticated writes) --------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,                                      -- 2MB cap
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. RLS policies on storage.objects --------------------------------
-- Each file is keyed under "<user_id>/<filename>" so a user can only
-- write to their own folder.

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload to their own avatar folder" on storage.objects;
create policy "users upload to their own avatar folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update their own avatars" on storage.objects;
create policy "users update their own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own avatars" on storage.objects;
create policy "users delete their own avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
