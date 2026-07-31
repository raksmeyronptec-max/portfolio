-- ═══════════════════════════════════════════════════════════════════════════
--  0018 — Record which storage backend holds each media asset
--
--  Why
--    Media bytes are moving to Cloudflare R2. `bucket_id` cannot answer "where
--    are these bytes?" on its own, because the logical bucket names are
--    deliberately unchanged — `public-media` means the same thing whether the
--    object sits in Supabase storage or in an R2 bucket. Without this column a
--    row already uploaded to Supabase and a row uploaded to R2 are
--    indistinguishable, and the URL builder would have to guess.
--
--    Guessing would fail in exactly the worst way: an asset whose URL resolves
--    to the wrong backend renders as a broken image, and there is no error
--    anywhere to explain it.
--
--  Default is 'supabase' on purpose
--    Every row that exists today was uploaded to Supabase storage. The default
--    backfills them correctly with no data migration, and new uploads set 'r2'
--    explicitly when R2 is configured. Nothing has to be moved for this to be
--    correct.
--
--  This does not move any bytes. Files already in Supabase storage stay there
--  and keep working; only new uploads land in R2.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.media_assets
  add column if not exists storage_provider text not null default 'supabase';

do $$ begin
  alter table public.media_assets
    add constraint media_assets_storage_provider_allowed
    check (storage_provider in ('supabase', 'r2'));
exception when duplicate_object then null; end $$;

comment on column public.media_assets.storage_provider is
  'Which backend physically holds the bytes. Set at upload time and never inferred; bucket_id stays a logical name in both backends.';

-- The admin media library groups by backend when reporting storage use, and a
-- "which assets are still on the old backend?" query wants an index rather than
-- a sequential scan once the library grows.
create index if not exists media_assets_storage_provider_idx
  on public.media_assets (storage_provider)
  where deleted_at is null;
