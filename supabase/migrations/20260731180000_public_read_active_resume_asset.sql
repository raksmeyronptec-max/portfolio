-- ═══════════════════════════════════════════════════════════════════════════
--  0020 — Let the public read the media row behind the ACTIVE resume
--
--  The bug
--    The admin showed "Active — publicly downloadable" while /en/resume showed
--    "No resume has been published yet." Both were telling the truth about what
--    they could see.
--
--    `resume_versions` already has a public-read policy for the active,
--    non-archived row, and storage.objects already has one for the file behind
--    it (see migration 0010, `resumes_active_public_read`). What was missing was
--    the row in between: `media_assets`.
--
--    `media_assets_public_read` allows only `visibility = 'public'`, and a
--    resume is deliberately private. So the resume page's embedded join
--    returned `asset: null`, and the loader treats a version with no asset as no
--    version at all — it cannot render a file size or a type for a file it
--    cannot see. The result was a published resume that was invisible to
--    everyone except its author.
--
--  The fix
--    Grant read on exactly the metadata row for the active resume, mirroring the
--    storage policy that already governs the bytes. The predicates are the same
--    on purpose: whatever makes the object readable makes its row readable, so
--    the two cannot drift apart and archiving a version still revokes both in
--    one step.
--
--  Scope
--    This exposes a filename, a size and a MIME type for a document that is
--    already publicly downloadable through /api/resume/download. It does not
--    make the bucket public, does not grant a permanent URL — `publicStorageUrl`
--    still refuses to build one for a private bucket — and does not touch
--    certificate originals, which stay unreadable to anon in every layer.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists media_assets_active_resume_read on public.media_assets;

create policy media_assets_active_resume_read on public.media_assets
  for select to anon, authenticated
  using (
    bucket_id = 'resumes'
    and deleted_at is null
    and exists (
      select 1
        from public.resume_versions rv
       where rv.media_id = media_assets.id
         and rv.is_active
         and not rv.is_archived
         and rv.deleted_at is null
    )
  );

comment on policy media_assets_active_resume_read on public.media_assets is
  'The active resume is publicly downloadable, so its metadata row must be publicly readable too. Mirrors resumes_active_public_read on storage.objects; archiving the version revokes both.';
