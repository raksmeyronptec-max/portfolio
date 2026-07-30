-- ═══════════════════════════════════════════════════════════════════════════
--  0001 — Extensions, shared enums and generic helper functions
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "unaccent" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ── Shared enums ────────────────────────────────────────────────────────────

-- Editorial workflow: draft → in_review → published → archived
do $$ begin
  create type public.publication_status as enum (
    'draft', 'in_review', 'published', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_locale as enum ('en', 'km');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.translation_state as enum (
    'missing', 'partial', 'complete', 'needs_review'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credential_status as enum (
    'active', 'expired', 'revoked', 'unverified'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.file_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_state as enum ('unread', 'read', 'archived', 'spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'live', 'in_development', 'maintained', 'sunset', 'concept'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum (
    'project_cover',
    'project_screenshot',
    'certificate_preview',
    'certificate_original',
    'profile_image',
    'resume_file',
    'testimonial_image',
    'open_graph_image',
    'diagram',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ── Generic helpers ─────────────────────────────────────────────────────────

-- Keeps `updated_at` honest without trusting the client.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger: stamps updated_at server-side.';

-- Stamps published_at the first time a row transitions into `published`, and
-- clears it when the row leaves `published`. This is what the public RLS
-- policies key off, so it must not be client-controlled.
create or replace function public.sync_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and coalesce(old.status, 'draft') <> 'published' then
    new.published_at := coalesce(new.published_at, now());
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

comment on function public.sync_published_at is
  'BEFORE INSERT/UPDATE trigger: derives published_at from status transitions.';

-- URL-safe slug generation. Khmer script has no case and no ASCII
-- transliteration we can do in SQL, so Khmer-only input falls back to a stable
-- hash suffix rather than producing an empty slug.
create or replace function public.slugify(input text)
returns text
language plpgsql
immutable
as $$
declare
  base text;
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;

  base := lower(extensions.unaccent(btrim(input)));
  base := regexp_replace(base, '[^a-z0-9\s-]', '', 'g');
  base := regexp_replace(base, '[\s-]+', '-', 'g');
  base := btrim(base, '-');

  if base = '' then
    -- Non-latin input: derive a deterministic short id so the slug is stable.
    return 'c-' || substr(
      encode(extensions.digest(btrim(input), 'sha256'), 'hex'), 1, 10
    );
  end if;

  return left(base, 80);
end;
$$;

comment on function public.slugify is
  'Deterministic URL slug. Falls back to a hash suffix for non-latin input.';

-- Single definition of "the public may see this row".
create or replace function public.is_publicly_visible(
  status public.publication_status,
  published_at timestamptz,
  deleted_at timestamptz
)
returns boolean
language sql
immutable
as $$
  select status = 'published'
     and published_at is not null
     and published_at <= now()
     and deleted_at is null;
$$;

comment on function public.is_publicly_visible is
  'Canonical public-visibility predicate reused by every public RLS policy.';
