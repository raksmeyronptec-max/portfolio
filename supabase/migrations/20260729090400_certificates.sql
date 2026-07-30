-- ═══════════════════════════════════════════════════════════════════════════
--  0005 — Certificate and credential library
--
--  Privacy model: `preview_media_id` is a redacted, public-safe image.
--  `original_media_id` points at a PRIVATE object that is only ever reachable
--  through a short-lived signed URL issued to an owner. The public policy never
--  selects the original, and a CHECK constraint plus the media_assets
--  invariant make it impossible to attach a public asset as an "original".
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.certificate_categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name_en     text not null,
  name_km     text,
  description_en text,
  description_km text,
  icon        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint certificate_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create trigger certificate_categories_set_updated_at
  before update on public.certificate_categories
  for each row execute function public.set_updated_at();

-- ── certificates ────────────────────────────────────────────────────────────

create table if not exists public.certificates (
  id                uuid primary key default extensions.gen_random_uuid(),
  slug              text not null,
  -- Short human-facing reference used in the admin list; not a secret.
  internal_ref      text,
  category_id       uuid references public.certificate_categories (id) on delete set null,

  status            public.publication_status not null default 'draft',
  credential_status public.credential_status not null default 'unverified',
  featured          boolean not null default false,
  sort_order        integer not null default 0,

  issuer_en         text not null,
  issuer_km         text,
  issuer_url        text,

  issued_on         date,
  expires_on        date,
  credential_id     text,
  verification_url  text,

  preview_media_id  uuid references public.media_assets (id) on delete set null,
  original_media_id uuid references public.media_assets (id) on delete set null,
  og_image_media_id uuid references public.media_assets (id) on delete set null,

  -- Whether the *original* may ever be offered as a download to the public.
  -- Defaults to false: a scan is private until a human decides otherwise.
  allow_public_download boolean not null default false,

  -- Privacy review workflow. `privacy_reviewed_at` must be set before the row
  -- can be published (enforced by a trigger below).
  privacy_reviewed_at   timestamptz,
  privacy_reviewed_by   uuid references auth.users (id) on delete set null,
  privacy_review_note   text,
  contains_sensitive_data boolean not null default true,

  needs_review      boolean not null default false,

  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,

  constraint certificates_slug_format check (slug ~ '^[a-z0-9-]+$' and length(slug) between 2 and 90),
  constraint certificates_issuer_not_blank check (btrim(issuer_en) <> ''),
  constraint certificates_dates_ordered check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  ),
  constraint certificates_verification_url_absolute check (
    verification_url is null or verification_url ~* '^https?://'
  ),
  constraint certificates_issuer_url_absolute check (
    issuer_url is null or issuer_url ~* '^https?://'
  ),
  constraint certificates_preview_and_original_differ check (
    preview_media_id is null
    or original_media_id is null
    or preview_media_id <> original_media_id
  )
);

create unique index if not exists certificates_slug_unique_live
  on public.certificates (slug)
  where deleted_at is null;

create unique index if not exists certificates_internal_ref_unique
  on public.certificates (internal_ref)
  where internal_ref is not null and deleted_at is null;

create index if not exists certificates_public_listing_idx
  on public.certificates (issued_on desc nulls last, sort_order)
  where status = 'published' and deleted_at is null;

create index if not exists certificates_featured_idx
  on public.certificates (sort_order)
  where featured and status = 'published' and deleted_at is null;

create index if not exists certificates_category_idx
  on public.certificates (category_id)
  where deleted_at is null;

create index if not exists certificates_privacy_pending_idx
  on public.certificates (updated_at desc)
  where privacy_reviewed_at is null and deleted_at is null;

create index if not exists certificates_issued_year_idx
  on public.certificates ((extract(year from issued_on)))
  where deleted_at is null;

create trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

create trigger certificates_sync_published_at
  before insert or update of status on public.certificates
  for each row execute function public.sync_published_at();

-- ── Publish gate: privacy review is mandatory ───────────────────────────────
-- A credential scan can leak a national ID, a date of birth, a signature or a
-- private QR code. Publishing is therefore blocked at the database level until
-- someone has explicitly recorded a privacy review.
create or replace function public.enforce_certificate_privacy_review()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' then
    if new.privacy_reviewed_at is null then
      raise exception
        'Certificate % cannot be published before a privacy review is recorded.',
        new.slug
        using errcode = 'check_violation',
              hint = 'Complete the privacy checklist in the admin UI first.';
    end if;

    if new.preview_media_id is null then
      raise exception
        'Certificate % cannot be published without a redacted public preview image.',
        new.slug
        using errcode = 'check_violation';
    end if;

    if new.allow_public_download and new.contains_sensitive_data then
      raise exception
        'Certificate % cannot offer a public download while it is still flagged as containing sensitive data.',
        new.slug
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger certificates_enforce_privacy_review
  before insert or update on public.certificates
  for each row execute function public.enforce_certificate_privacy_review();

-- ── Invariant: an "original" must reference a private asset ─────────────────
create or replace function public.enforce_certificate_original_is_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibility public.file_visibility;
begin
  if new.original_media_id is null then
    return new;
  end if;

  select m.visibility into v_visibility
    from public.media_assets m
   where m.id = new.original_media_id;

  if v_visibility is distinct from 'private' then
    raise exception
      'original_media_id must reference a media asset stored privately (got %).',
      coalesce(v_visibility::text, 'missing asset')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger certificates_original_must_be_private
  before insert or update of original_media_id on public.certificates
  for each row execute function public.enforce_certificate_original_is_private();

-- ── certificate_translations ────────────────────────────────────────────────
create table if not exists public.certificate_translations (
  id              uuid primary key default extensions.gen_random_uuid(),
  certificate_id  uuid not null references public.certificates (id) on delete cascade,
  locale          public.content_locale not null,

  title           text not null,
  description     text,
  -- Plain-language description of what the document shows, for screen-reader
  -- users and for anyone who cannot read the scanned image.
  image_summary   text,
  seo_title       text,
  seo_description text,

  translation_state public.translation_state not null default 'partial',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint certificate_translations_unique_locale unique (certificate_id, locale),
  constraint certificate_translations_title_not_blank check (btrim(title) <> ''),
  constraint certificate_translations_seo_title_length check (
    seo_title is null or length(seo_title) <= 70
  ),
  constraint certificate_translations_seo_description_length check (
    seo_description is null or length(seo_description) between 50 and 160
  )
);

create index if not exists certificate_translations_locale_idx
  on public.certificate_translations (locale);

create index if not exists certificate_translations_search_idx
  on public.certificate_translations
  using gin ((coalesce(title, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops);

create trigger certificate_translations_set_updated_at
  before update on public.certificate_translations
  for each row execute function public.set_updated_at();

-- ── certificate_skills ──────────────────────────────────────────────────────
create table if not exists public.certificate_skills (
  id             uuid primary key default extensions.gen_random_uuid(),
  certificate_id uuid not null references public.certificates (id) on delete cascade,
  label_en       text not null,
  label_km       text,
  sort_order     integer not null default 0,
  constraint certificate_skills_unique unique (certificate_id, label_en)
);

create index if not exists certificate_skills_certificate_idx
  on public.certificate_skills (certificate_id, sort_order);

-- ── Links from a credential to the education / project it evidences ─────────
create table if not exists public.certificate_project_links (
  certificate_id uuid not null references public.certificates (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  primary key (certificate_id, project_id)
);
