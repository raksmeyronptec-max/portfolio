-- ═══════════════════════════════════════════════════════════════════════════
--  0010 — Storage buckets and access rules
--
--  Five buckets with deliberately different exposure:
--
--   public-media           public   project covers/screenshots, diagrams,
--                                   profile photos, Open Graph images
--   certificate-previews   public   REDACTED credential previews only
--   certificate-originals  private  raw scans — owner-only, signed URLs
--   resumes                private  every resume file; the ACTIVE version is
--                                   readable anonymously via policy, archived
--                                   versions are not
--   admin-uploads          private  staging area for in-progress admin uploads
--
--  MIME allowlists and size limits are enforced on the bucket itself, so a
--  bypass of the application-side validation still cannot store an executable.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-media', 'public-media', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
  ),
  (
    'certificate-previews', 'certificate-previews', true, 8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'certificate-originals', 'certificate-originals', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'resumes', 'resumes', false, 10485760,
    array['application/pdf']
  ),
  (
    'admin-uploads', 'admin-uploads', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS is already enabled on storage.objects by Supabase; policies are additive.

-- ── public-media : world-readable, editor-writable ──────────────────────────

drop policy if exists "public_media_read" on storage.objects;
create policy "public_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-media');

drop policy if exists "public_media_insert" on storage.objects;
create policy "public_media_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and public.can_edit_content());

drop policy if exists "public_media_update" on storage.objects;
create policy "public_media_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and public.can_edit_content())
  with check (bucket_id = 'public-media' and public.can_edit_content());

drop policy if exists "public_media_delete" on storage.objects;
create policy "public_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and public.is_owner());

-- ── certificate-previews : world-readable (redacted images only) ────────────

drop policy if exists "certificate_previews_read" on storage.objects;
create policy "certificate_previews_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'certificate-previews');

drop policy if exists "certificate_previews_insert" on storage.objects;
create policy "certificate_previews_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificate-previews' and public.can_edit_content());

drop policy if exists "certificate_previews_update" on storage.objects;
create policy "certificate_previews_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'certificate-previews' and public.can_edit_content())
  with check (bucket_id = 'certificate-previews' and public.can_edit_content());

drop policy if exists "certificate_previews_delete" on storage.objects;
create policy "certificate_previews_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificate-previews' and public.is_owner());

-- ── certificate-originals : OWNER ONLY, no anonymous access at any time ─────
-- There is deliberately no policy granting `anon` anything on this bucket.
-- Owners read it through short-lived signed URLs minted server-side, and every
-- such access is written to audit_logs by the route handler.

drop policy if exists "certificate_originals_owner_read" on storage.objects;
create policy "certificate_originals_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'certificate-originals' and public.is_owner());

drop policy if exists "certificate_originals_editor_insert" on storage.objects;
create policy "certificate_originals_editor_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificate-originals' and public.can_edit_content());

drop policy if exists "certificate_originals_owner_update" on storage.objects;
create policy "certificate_originals_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'certificate-originals' and public.is_owner())
  with check (bucket_id = 'certificate-originals' and public.is_owner());

drop policy if exists "certificate_originals_owner_delete" on storage.objects;
create policy "certificate_originals_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificate-originals' and public.is_owner());

-- ── resumes : only the object behind the ACTIVE version is publicly readable ─
-- The distinction between a public active resume and a private archived one is
-- expressed as a policy predicate rather than as two buckets, so activating a
-- new version changes its exposure atomically with no file copying.

drop policy if exists "resumes_active_public_read" on storage.objects;
create policy "resumes_active_public_read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
        from public.resume_versions rv
        join public.media_assets m on m.id = rv.media_id
       where m.bucket_id = 'resumes'
         and m.storage_path = storage.objects.name
         and rv.is_active
         and not rv.is_archived
         and rv.deleted_at is null
         and m.deleted_at is null
    )
  );

drop policy if exists "resumes_admin_read" on storage.objects;
create policy "resumes_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.can_view_admin());

drop policy if exists "resumes_editor_insert" on storage.objects;
create policy "resumes_editor_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and public.can_edit_content());

drop policy if exists "resumes_editor_update" on storage.objects;
create policy "resumes_editor_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and public.can_edit_content())
  with check (bucket_id = 'resumes' and public.can_edit_content());

drop policy if exists "resumes_owner_delete" on storage.objects;
create policy "resumes_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and public.is_owner());

-- ── admin-uploads : staging area, admins only, never public ─────────────────

drop policy if exists "admin_uploads_admin_read" on storage.objects;
create policy "admin_uploads_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'admin-uploads' and public.can_view_admin());

drop policy if exists "admin_uploads_editor_write" on storage.objects;
create policy "admin_uploads_editor_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'admin-uploads' and public.can_edit_content());

drop policy if exists "admin_uploads_editor_update" on storage.objects;
create policy "admin_uploads_editor_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'admin-uploads' and public.can_edit_content())
  with check (bucket_id = 'admin-uploads' and public.can_edit_content());

drop policy if exists "admin_uploads_editor_delete" on storage.objects;
create policy "admin_uploads_editor_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'admin-uploads' and public.can_edit_content());
