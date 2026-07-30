-- ═══════════════════════════════════════════════════════════════════════════
--  0008 — Privacy-conscious analytics, audit log and content revisions
--
--  Analytics design: no cookies, no cross-site identifier, no raw IP address.
--  A visitor is represented by `visitor_hash` = SHA-256(ip + user-agent + daily
--  rotating salt), which supports a "unique visitors today" figure while being
--  unlinkable across days and irreversible.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.analytics_events (
  id            bigint generated always as identity primary key,
  event_name    text not null,
  occurred_at   timestamptz not null default now(),

  locale        public.content_locale,
  path          text,
  -- Loose references: an event must survive the deletion of its subject.
  entity_type   text,
  entity_id     uuid,
  entity_slug   text,

  -- Coarse, non-identifying context only.
  device_type   text,
  browser_name  text,
  os_name       text,
  referrer_host text,
  country_code  char(2),

  visitor_hash  text,
  -- Extra event-specific fields (e.g. the outbound destination host).
  properties    jsonb not null default '{}'::jsonb,

  constraint analytics_events_name_allowed check (
    event_name in (
      'page_view',
      'project_view',
      'project_live_link_click',
      'project_repository_click',
      'certificate_view',
      'certificate_verify_click',
      'resume_view',
      'resume_download',
      'contact_submit',
      'email_click',
      'telegram_click',
      'social_link_click',
      'language_change',
      'theme_change',
      'outbound_link_click'
    )
  ),
  constraint analytics_events_entity_type_allowed check (
    entity_type is null or entity_type in (
      'project', 'certificate', 'resume', 'page', 'social_link'
    )
  ),
  constraint analytics_events_device_allowed check (
    device_type is null or device_type in ('mobile', 'tablet', 'desktop', 'bot', 'unknown')
  ),
  constraint analytics_events_properties_is_object check (
    jsonb_typeof(properties) = 'object'
  ),
  constraint analytics_events_path_length check (path is null or length(path) <= 512)
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists analytics_events_time_idx
  on public.analytics_events (occurred_at desc);

create index if not exists analytics_events_entity_idx
  on public.analytics_events (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;

create index if not exists analytics_events_visitor_day_idx
  on public.analytics_events (visitor_hash, occurred_at desc)
  where visitor_hash is not null;

comment on column public.analytics_events.visitor_hash is
  'SHA-256(ip + user-agent + daily salt). Irreversible and unlinkable across days.';

-- Narrow, indexed projections of the event stream. They exist because the
-- dashboard queries them constantly and the generic table would need a filter
-- scan for every card.
create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null,
  locale       public.content_locale not null default 'en',
  entity_type  text,
  entity_id    uuid,
  device_type  text,
  referrer_host text,
  visitor_hash text,
  occurred_at  timestamptz not null default now(),
  constraint page_views_path_length check (length(path) between 1 and 512)
);

create index if not exists page_views_path_time_idx
  on public.page_views (path, occurred_at desc);
create index if not exists page_views_time_idx
  on public.page_views (occurred_at desc);
create index if not exists page_views_locale_idx
  on public.page_views (locale, occurred_at desc);
create index if not exists page_views_entity_idx
  on public.page_views (entity_type, entity_id)
  where entity_id is not null;

create table if not exists public.download_events (
  id           bigint generated always as identity primary key,
  -- resume | certificate
  resource_type text not null,
  resource_id  uuid,
  resource_label text,
  locale       public.content_locale,
  visitor_hash text,
  occurred_at  timestamptz not null default now(),
  constraint download_events_type_allowed check (
    resource_type in ('resume', 'certificate')
  )
);

create index if not exists download_events_time_idx
  on public.download_events (occurred_at desc);
create index if not exists download_events_resource_idx
  on public.download_events (resource_type, resource_id, occurred_at desc);

create table if not exists public.outbound_clicks (
  id            bigint generated always as identity primary key,
  destination_url text not null,
  destination_host text,
  -- project_live | project_repo | certificate_verify | social | other
  context       text not null default 'other',
  entity_type   text,
  entity_id     uuid,
  locale        public.content_locale,
  visitor_hash  text,
  occurred_at   timestamptz not null default now(),
  constraint outbound_clicks_context_allowed check (
    context in ('project_live', 'project_repo', 'certificate_verify',
                'social', 'email', 'telegram', 'other')
  ),
  constraint outbound_clicks_url_absolute check (
    destination_url ~* '^(https?://|mailto:|tel:)'
  )
);

create index if not exists outbound_clicks_time_idx
  on public.outbound_clicks (occurred_at desc);
create index if not exists outbound_clicks_entity_idx
  on public.outbound_clicks (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;
create index if not exists outbound_clicks_host_idx
  on public.outbound_clicks (destination_host, occurred_at desc);

-- ── audit_logs ──────────────────────────────────════════════════════════════
-- Append-only. There is no UPDATE or DELETE policy for anyone, including
-- owners, so the trail cannot be quietly rewritten from the application.
create table if not exists public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_email  text,
  actor_role   public.admin_role,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  entity_label text,
  -- Human-readable summary of what changed. Must never contain secrets.
  summary      text,
  -- Structured diff, keys only for anything sensitive.
  changes      jsonb not null default '{}'::jsonb,
  ip_hash      text,
  user_agent   text,
  occurred_at  timestamptz not null default now(),
  constraint audit_logs_action_allowed check (
    action in (
      'admin.login', 'admin.login_failed', 'admin.logout',
      'admin.unauthorized', 'admin.role_changed',
      'project.created', 'project.updated', 'project.published',
      'project.unpublished', 'project.archived', 'project.restored',
      'project.deleted', 'project.duplicated',
      'certificate.created', 'certificate.updated', 'certificate.published',
      'certificate.unpublished', 'certificate.archived', 'certificate.restored',
      'certificate.deleted', 'certificate.original_viewed',
      'certificate.original_downloaded', 'certificate.privacy_reviewed',
      'media.uploaded', 'media.replaced', 'media.deleted',
      'resume.uploaded', 'resume.activated', 'resume.archived',
      'education.updated', 'experience.updated', 'skill.updated',
      'testimonial.updated', 'message.updated', 'message.deleted',
      'seo.updated', 'settings.updated'
    )
  ),
  constraint audit_logs_changes_is_object check (jsonb_typeof(changes) = 'object')
);

create index if not exists audit_logs_time_idx
  on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, occurred_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, occurred_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;

comment on table public.audit_logs is
  'Append-only admin action trail. No UPDATE/DELETE policy exists for any role.';

-- ── content_revisions ───────────────────────────════════════════════════════
-- A snapshot per save, so a bad edit is recoverable and "who changed what when"
-- is answerable.
create table if not exists public.content_revisions (
  id           bigint generated always as identity primary key,
  entity_type  text not null,
  entity_id    uuid not null,
  revision_no  integer not null,
  status_at_revision public.publication_status,
  snapshot     jsonb not null,
  change_summary text,
  author_id    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint content_revisions_unique unique (entity_type, entity_id, revision_no),
  constraint content_revisions_entity_type_allowed check (
    entity_type in ('project', 'certificate', 'education', 'experience',
                    'testimonial', 'skill', 'site_settings', 'seo_override')
  ),
  constraint content_revisions_snapshot_is_object check (
    jsonb_typeof(snapshot) = 'object'
  ),
  constraint content_revisions_revision_no_positive check (revision_no > 0)
);

create index if not exists content_revisions_entity_idx
  on public.content_revisions (entity_type, entity_id, revision_no desc);

-- Allocates the next revision number for an entity without a race.
create or replace function public.next_revision_no(p_entity_type text, p_entity_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(max(revision_no), 0) + 1
    from public.content_revisions
   where entity_type = p_entity_type
     and entity_id = p_entity_id;
$$;
