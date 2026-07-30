-- ═══════════════════════════════════════════════════════════════════════════
--  0002 — Identity, authorisation and global site settings
-- ═══════════════════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────────────────────
-- Mirrors auth.users with the small amount of profile data the CMS needs.
-- `public_*` columns are the ONLY columns exposed to anonymous readers.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  display_name      text,
  avatar_media_id   uuid,
  -- Deliberately public identity fields, used by the hero and JSON-LD.
  public_headline_en text,
  public_headline_km text,
  public_bio_en     text,
  public_bio_km     text,
  public_location   text,
  public_avatar_url text,
  is_site_owner     boolean not null default false,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Exactly one row may claim to be the site owner, so the public "Person"
-- structured data can never be ambiguous.
create unique index if not exists profiles_single_site_owner
  on public.profiles ((is_site_owner))
  where is_site_owner;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── admin_roles ─────────────────────────────────────────────────────────────
-- Authorisation source of truth. A user with no row here has no admin access
-- at all, which makes "deny by default" the natural behaviour.
create table if not exists public.admin_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.admin_role not null default 'viewer',
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists admin_roles_active_idx
  on public.admin_roles (role)
  where revoked_at is null;

create trigger admin_roles_set_updated_at
  before update on public.admin_roles
  for each row execute function public.set_updated_at();

-- ── Authorisation helpers ───────────────────────────────────────────────────
-- SECURITY DEFINER so RLS policies on admin_roles itself cannot recurse.
-- `search_path` is pinned to defeat search-path hijacking.

create or replace function public.current_admin_role()
returns public.admin_role
language sql
stable
security definer
set search_path = ''
as $$
  select ar.role
    from public.admin_roles ar
   where ar.user_id = auth.uid()
     and ar.revoked_at is null
   limit 1;
$$;

comment on function public.current_admin_role is
  'Active admin role of the caller, or NULL when the caller is not an admin.';

-- Every predicate below is wrapped in coalesce(..., false).
--
-- Without it, `current_admin_role()` returning NULL for a caller with no
-- admin_roles row makes `NULL IN ('owner', …)` evaluate to NULL, so the function
-- returns NULL rather than false. RLS treats NULL as "policy not satisfied", so
-- the policies would still be safe — but any application-side or SQL-side
-- negation (`not can_edit_content()`) would also be NULL, i.e. not true, and a
-- guard written that way would silently never fire. These functions therefore
-- return a strict boolean.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_admin_role() is not null, false);
$$;

-- Owners only: user management, security settings, private originals, hard
-- delete and restore.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_admin_role() = 'owner', false);
$$;

-- Owner or editor: may create and change portfolio content.
create or replace function public.can_edit_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_admin_role() in ('owner', 'editor'), false);
$$;

-- Any active admin, including viewer: read-only dashboard and analytics.
create or replace function public.can_view_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_admin_role() in ('owner', 'editor', 'viewer'),
    false
  );
$$;

revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;
grant execute on function public.can_edit_content() to anon, authenticated, service_role;
grant execute on function public.can_view_admin() to anon, authenticated, service_role;

-- ── site_settings ───────────────────────────────────────────────────────────
-- Single-row table (enforced by a CHECK on a constant primary key) holding the
-- values the public site needs but that do not belong to any content entity.
create table if not exists public.site_settings (
  id                        boolean primary key default true,
  site_name_en              text not null default 'Ron Raksmey',
  site_name_km              text not null default 'រុន រស្មី',
  tagline_en                text,
  tagline_km                text,
  positioning_en            text,
  positioning_km            text,
  hero_headline_en          text,
  hero_headline_km          text,
  hero_subheadline_en       text,
  hero_subheadline_km       text,
  availability_status_en    text,
  availability_status_km    text,
  is_available_for_work     boolean not null default true,
  location_en               text,
  location_km               text,
  contact_email             text,
  telegram_handle           text,
  facebook_url              text,
  github_url                text,
  linkedin_url              text,
  default_locale            public.content_locale not null default 'en',
  default_og_image_media_id uuid,
  google_site_verification  text,
  analytics_enabled         boolean not null default true,
  contact_form_enabled      boolean not null default true,
  chat_widget_enabled       boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint site_settings_singleton check (id),
  constraint site_settings_email_format check (
    contact_email is null
    or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ── social_links ────────────────────────────────────────────────────────────
create table if not exists public.social_links (
  id           uuid primary key default extensions.gen_random_uuid(),
  platform     text not null,
  label_en     text not null,
  label_km     text,
  url          text not null,
  handle       text,
  icon         text,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint social_links_platform_unique unique (platform),
  constraint social_links_url_is_absolute check (url ~* '^(https?://|mailto:|tel:)')
);

create index if not exists social_links_published_order_idx
  on public.social_links (sort_order)
  where is_published;

create trigger social_links_set_updated_at
  before update on public.social_links
  for each row execute function public.set_updated_at();
