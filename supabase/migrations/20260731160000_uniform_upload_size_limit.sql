-- ═══════════════════════════════════════════════════════════════════════════
--  0019 — One upload ceiling: 10 MB
--
--  Why
--    Uploads had four different limits — 10 MB for a public image, 8 MB for a
--    certificate preview, 25 MB for an original, 10 MB for a resume. An editor
--    had no way to predict which one applied, so a rejected upload looked
--    arbitrary. One number is explainable, and now the upload form, the
--    application validator, the storage buckets and this constraint all state
--    the same one.
--
--  Enforced in three places on purpose
--    The form checks before uploading (fast feedback), the route re-checks after
--    (the form is client code and can be bypassed), and the constraint below is
--    the backstop that holds even if something writes to the table directly.
--
--  What this tightens
--    `certificate-originals` drops from 25 MB to 10 MB. That is a real
--    restriction: a 300 dpi A4 colour scan can exceed 10 MB. Scanning at 200 dpi
--    or in greyscale stays well under it and keeps the document just as readable
--    as evidence, which is what an original is for.
--
--  Existing rows are not affected. This raises no limit that was lower before
--  (certificate previews go 8 MB → 10 MB), and nothing currently stored exceeds
--  10 MB, so the constraint validates against existing data without a rewrite.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The database backstop ───────────────────────────────────────────────────
alter table public.media_assets
  drop constraint if exists media_assets_size_limit;

alter table public.media_assets
  add constraint media_assets_size_limit
  check (file_size_bytes <= 10485760);

comment on constraint media_assets_size_limit on public.media_assets is
  '10 MB ceiling for every upload kind. Mirrored by SIZE_LIMITS in lib/media/validate.ts and by the storage bucket limits.';

-- ── The Supabase storage buckets ────────────────────────────────────────────
-- Still maintained even though new uploads go to Cloudflare R2: files uploaded
-- before the move are still served from here, and a bucket whose limit
-- contradicts the application's is a trap for whoever next reads either one.
--
-- R2 has no server-side size limit to configure, which is exactly why the
-- application-side check and the constraint above carry the weight there.
update storage.buckets
   set file_size_limit = 10485760
 where id in ('public-media', 'certificate-previews', 'certificate-originals', 'resumes');
