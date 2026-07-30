-- ═══════════════════════════════════════════════════════════════════════════
--  0003 — Media library
--
--  Every uploaded file is registered here exactly once. Content tables point at
--  media_assets rows rather than storing raw paths, so alt text, dimensions and
--  visibility have a single source of truth and "is this file still in use?"
--  is answerable.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.media_assets (
  id             uuid primary key default extensions.gen_random_uuid(),
  bucket_id      text not null,
  storage_path   text not null,
  kind           public.media_kind not null default 'other',
  visibility     public.file_visibility not null default 'public',

  original_filename text not null,
  mime_type      text not null,
  file_size_bytes bigint not null,
  checksum_sha256 text,

  -- Images only; NULL for PDFs.
  width          integer,
  height         integer,
  blur_data_url  text,

  -- Derivative paths generated on upload. Kept nullable so a PDF or an
  -- unprocessable image is still a valid asset.
  thumbnail_path text,
  card_path      text,
  preview_path   text,

  alt_text_en    text,
  alt_text_km    text,
  caption_en     text,
  caption_km     text,
  credit         text,

  -- Set when a certificate original may still contain unredacted personal data.
  requires_privacy_review boolean not null default false,

  uploaded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint media_assets_unique_object unique (bucket_id, storage_path),
  constraint media_assets_size_positive check (file_size_bytes > 0),
  constraint media_assets_size_limit check (file_size_bytes <= 26214400),
  constraint media_assets_dimensions_pair check (
    (width is null and height is null)
    or (width > 0 and height > 0)
  ),
  constraint media_assets_mime_allowlist check (
    mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/avif',
      'image/gif', 'image/svg+xml', 'application/pdf'
    )
  ),
  -- Certificate originals are private by construction. This makes the rule a
  -- database invariant rather than something the application must remember.
  constraint media_assets_originals_are_private check (
    kind <> 'certificate_original' or visibility = 'private'
  )
);

create index if not exists media_assets_kind_idx
  on public.media_assets (kind)
  where deleted_at is null;

create index if not exists media_assets_visibility_idx
  on public.media_assets (visibility)
  where deleted_at is null;

create index if not exists media_assets_created_at_idx
  on public.media_assets (created_at desc);

-- Duplicate detection on re-upload.
create index if not exists media_assets_checksum_idx
  on public.media_assets (checksum_sha256)
  where checksum_sha256 is not null and deleted_at is null;

-- Content-health query: public images missing alt text in either language.
create index if not exists media_assets_missing_alt_idx
  on public.media_assets (id)
  where deleted_at is null
    and visibility = 'public'
    and mime_type <> 'application/pdf'
    and (alt_text_en is null or alt_text_km is null);

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

comment on table public.media_assets is
  'Registry of every uploaded file. Content tables reference these rows by id.';
comment on column public.media_assets.visibility is
  'public = servable from a public bucket URL. private = signed URLs only.';

-- Deferred FKs from migration 0002 now that media_assets exists.
alter table public.profiles
  drop constraint if exists profiles_avatar_media_fk;
alter table public.profiles
  add constraint profiles_avatar_media_fk
  foreign key (avatar_media_id) references public.media_assets (id) on delete set null;

alter table public.site_settings
  drop constraint if exists site_settings_og_image_fk;
alter table public.site_settings
  add constraint site_settings_og_image_fk
  foreign key (default_og_image_media_id) references public.media_assets (id) on delete set null;
