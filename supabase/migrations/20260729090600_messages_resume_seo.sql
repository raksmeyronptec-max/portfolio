-- ═══════════════════════════════════════════════════════════════════════════
--  0007 — Contact messages, resume versions and SEO overrides
-- ═══════════════════════════════════════════════════════════════════════════

-- ── contact_messages ────────────────────────────────────────────────────────
-- Anonymous visitors may INSERT (see the RLS policy in 0010) and may never
-- SELECT. No column here is ever rendered on a public page.
create table if not exists public.contact_messages (
  id            uuid primary key default extensions.gen_random_uuid(),
  name          text not null,
  email         text not null,
  organization  text,
  subject       text,
  message       text not null,
  -- teaching | tutoring | collaboration | development | speaking | other
  project_type  text,
  preferred_contact text,
  locale        public.content_locale not null default 'en',

  state         public.message_state not null default 'unread',
  is_starred    boolean not null default false,

  -- Abuse triage. The raw IP is never stored; only a salted hash, so rate
  -- limiting and duplicate detection stay possible without retaining PII.
  ip_hash       text,
  user_agent    text,
  referer       text,
  spam_score    integer not null default 0,

  -- Whether the Telegram notification actually succeeded. The UI must not claim
  -- delivery unless this is true.
  notification_sent boolean not null default false,
  notification_error text,

  consent_given boolean not null default false,

  read_at       timestamptz,
  replied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint contact_messages_name_length check (length(btrim(name)) between 1 and 100),
  constraint contact_messages_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint contact_messages_message_length check (length(btrim(message)) between 10 and 2000),
  constraint contact_messages_subject_length check (subject is null or length(subject) <= 150),
  constraint contact_messages_org_length check (organization is null or length(organization) <= 150),
  constraint contact_messages_spam_score_range check (spam_score between 0 and 100),
  constraint contact_messages_project_type_allowed check (
    project_type is null or project_type in (
      'teaching', 'tutoring', 'collaboration', 'development',
      'speaking', 'academic', 'other'
    )
  ),
  constraint contact_messages_preferred_contact_allowed check (
    preferred_contact is null or preferred_contact in ('email', 'telegram', 'either')
  )
);

create index if not exists contact_messages_inbox_idx
  on public.contact_messages (created_at desc)
  where deleted_at is null;

create index if not exists contact_messages_unread_idx
  on public.contact_messages (created_at desc)
  where state = 'unread' and deleted_at is null;

create index if not exists contact_messages_starred_idx
  on public.contact_messages (created_at desc)
  where is_starred and deleted_at is null;

-- Supports the server-side rate-limit window lookup.
create index if not exists contact_messages_ip_window_idx
  on public.contact_messages (ip_hash, created_at desc)
  where ip_hash is not null;

create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

comment on column public.contact_messages.ip_hash is
  'Salted SHA-256 of the client IP. The raw address is never persisted.';

-- ── contact_message_notes ───────────────────────────────────────────────────
-- Internal only. Never exposed publicly under any circumstances.
create table if not exists public.contact_message_notes (
  id         uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null references public.contact_messages (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_message_notes_body_not_blank check (btrim(body) <> '')
);

create index if not exists contact_message_notes_message_idx
  on public.contact_message_notes (message_id, created_at desc);

create trigger contact_message_notes_set_updated_at
  before update on public.contact_message_notes
  for each row execute function public.set_updated_at();

-- ── resume_versions ─────────────────────────────────────────────────────────
create table if not exists public.resume_versions (
  id            uuid primary key default extensions.gen_random_uuid(),
  version_label text not null,
  locale        public.content_locale not null default 'en',
  media_id      uuid not null references public.media_assets (id) on delete restrict,
  is_active     boolean not null default false,
  is_archived   boolean not null default false,
  notes         text,
  -- Denormalised download counter maintained by the download endpoint, so the
  -- dashboard does not have to aggregate the whole events table on every load.
  download_count integer not null default 0,
  effective_from timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint resume_versions_label_not_blank check (btrim(version_label) <> ''),
  constraint resume_versions_download_count_positive check (download_count >= 0),
  constraint resume_versions_active_not_archived check (not (is_active and is_archived))
);

-- At most one active resume per locale — the public "current version" can never
-- be ambiguous.
create unique index if not exists resume_versions_one_active_per_locale
  on public.resume_versions (locale)
  where is_active and deleted_at is null;

create index if not exists resume_versions_locale_idx
  on public.resume_versions (locale, effective_from desc)
  where deleted_at is null;

create trigger resume_versions_set_updated_at
  before update on public.resume_versions
  for each row execute function public.set_updated_at();

-- Activating a resume deactivates the previous one for that locale, atomically.
create or replace function public.activate_resume_version(p_id uuid)
returns public.resume_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.resume_versions;
begin
  if not public.can_edit_content() then
    raise exception 'Not authorised to change the active resume.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.resume_versions where id = p_id and deleted_at is null;
  if v_row is null then
    raise exception 'Resume version % not found.', p_id using errcode = 'no_data_found';
  end if;

  update public.resume_versions
     set is_active = false
   where locale = v_row.locale
     and id <> p_id
     and is_active;

  update public.resume_versions
     set is_active = true, is_archived = false, effective_from = now()
   where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.activate_resume_version(uuid) from public, anon;
grant execute on function public.activate_resume_version(uuid) to authenticated;

-- ── seo_overrides ───────────────────────────────────────────────────────────
-- Per-route metadata overrides for the static pages that have no content row of
-- their own (home, about, contact …). Project and certificate pages take their
-- SEO from their own translation rows.
create table if not exists public.seo_overrides (
  id              uuid primary key default extensions.gen_random_uuid(),
  -- Locale-agnostic route key, e.g. 'home', 'about', 'projects', 'contact'.
  route_key       text not null,
  locale          public.content_locale not null,
  title           text,
  description     text,
  canonical_url   text,
  og_image_media_id uuid references public.media_assets (id) on delete set null,
  is_indexable    boolean not null default true,
  include_in_sitemap boolean not null default true,
  sitemap_priority numeric(2,1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint seo_overrides_unique unique (route_key, locale),
  constraint seo_overrides_route_key_format check (route_key ~ '^[a-z0-9-]+$'),
  constraint seo_overrides_title_length check (title is null or length(title) between 15 and 70),
  constraint seo_overrides_description_length check (
    description is null or length(description) between 50 and 160
  ),
  constraint seo_overrides_canonical_absolute check (
    canonical_url is null or canonical_url ~* '^https://'
  ),
  constraint seo_overrides_priority_range check (
    sitemap_priority is null or sitemap_priority between 0.0 and 1.0
  )
);

create trigger seo_overrides_set_updated_at
  before update on public.seo_overrides
  for each row execute function public.set_updated_at();
