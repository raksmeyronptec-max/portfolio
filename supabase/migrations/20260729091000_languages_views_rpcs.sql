-- ═══════════════════════════════════════════════════════════════════════════
--  0011 — Languages, public aggregate views and admin RPCs
-- ═══════════════════════════════════════════════════════════════════════════

-- ── languages ───────────────────────────────────────────────────────────────
-- Proficiency is a label (native / C1 / B2 / A1 …), never a percentage. v1
-- rendered "French A1" alongside numeric bars; the redesign keeps the honest
-- label and drops the number.
create table if not exists public.languages (
  id             uuid primary key default extensions.gen_random_uuid(),
  code           text not null,
  name_en        text not null,
  name_km        text,
  proficiency_label_en text not null,
  proficiency_label_km text,
  -- CEFR level when one applies; NULL for a native language.
  cefr_level     text,
  is_native      boolean not null default false,
  sort_order     integer not null default 0,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint languages_code_unique unique (code),
  constraint languages_code_format check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint languages_cefr_allowed check (
    cefr_level is null or cefr_level in ('A1','A2','B1','B2','C1','C2')
  ),
  constraint languages_native_has_no_cefr check (not is_native or cefr_level is null)
);

create trigger languages_set_updated_at
  before update on public.languages
  for each row execute function public.set_updated_at();

alter table public.languages enable row level security;

drop policy if exists languages_public_read on public.languages;
create policy languages_public_read on public.languages
  for select to anon, authenticated
  using (is_published or public.can_view_admin());

drop policy if exists languages_editor_write on public.languages;
create policy languages_editor_write on public.languages
  for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

grant select on public.languages to anon, authenticated;
grant insert, update, delete on public.languages to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Public aggregates for the homepage credibility strip.
--
--  security_invoker = true, so these counts are computed under the caller's RLS.
--  An anonymous visitor therefore counts published rows only — the strip cannot
--  accidentally advertise drafts, and no number is hardcoded anywhere in the UI.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.public_site_counts
with (security_invoker = true) as
  select
    (select count(*) from public.projects)                      as published_projects,
    (select count(*) from public.projects where featured)       as featured_projects,
    (select count(*) from public.certificates)                  as published_certificates,
    (select count(*) from public.education)                     as published_education,
    (select count(*) from public.experiences)                   as published_experiences,
    (select count(*) from public.languages)                     as languages,
    (select count(*) from public.testimonials)                  as published_testimonials,
    -- Earliest recorded start across published experience and education, which
    -- is what "years of relevant experience" is actually derived from.
    (
      select min(d)
        from (
          select min(started_on) as d from public.experiences
          union all
          select min(started_on) as d from public.education
        ) s
    )                                                            as journey_started_on;

comment on view public.public_site_counts is
  'Homepage credibility strip. Every value is counted from published CMS rows '
  'under the caller''s RLS, so nothing here can be a hardcoded claim.';

grant select on public.public_site_counts to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Translation completeness — used by both the public fallback logic and the
--  admin "missing translations" panel.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.translation_coverage
with (security_invoker = true) as
  select 'project'::text as entity_type, p.id as entity_id, p.slug,
         count(*) filter (where t.locale = 'en') > 0 as has_en,
         count(*) filter (where t.locale = 'km') > 0 as has_km,
         max(t.updated_at) as translations_updated_at
    from public.projects p
    left join public.project_translations t on t.project_id = p.id
   where p.deleted_at is null
   group by p.id, p.slug
  union all
  select 'certificate'::text, c.id, c.slug,
         count(*) filter (where t.locale = 'en') > 0,
         count(*) filter (where t.locale = 'km') > 0,
         max(t.updated_at)
    from public.certificates c
    left join public.certificate_translations t on t.certificate_id = c.id
   where c.deleted_at is null
   group by c.id, c.slug
  union all
  select 'education'::text, e.id, e.slug,
         count(*) filter (where t.locale = 'en') > 0,
         count(*) filter (where t.locale = 'km') > 0,
         max(t.updated_at)
    from public.education e
    left join public.education_translations t on t.education_id = e.id
   where e.deleted_at is null
   group by e.id, e.slug
  union all
  select 'experience'::text, x.id, x.slug,
         count(*) filter (where t.locale = 'en') > 0,
         count(*) filter (where t.locale = 'km') > 0,
         max(t.updated_at)
    from public.experiences x
    left join public.experience_translations t on t.experience_id = x.id
   where x.deleted_at is null
   group by x.id, x.slug
  union all
  select 'testimonial'::text, ts.id, ts.slug,
         count(*) filter (where t.locale = 'en') > 0,
         count(*) filter (where t.locale = 'km') > 0,
         max(t.updated_at)
    from public.testimonials ts
    left join public.testimonial_translations t on t.testimonial_id = ts.id
   where ts.deleted_at is null
   group by ts.id, ts.slug;

grant select on public.translation_coverage to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Admin dashboard summary.
--
--  SECURITY DEFINER because it aggregates across drafts, messages and storage —
--  data an anonymous caller must never see. The first statement is therefore an
--  explicit authorisation check, not an assumption.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_view_admin() then
    raise exception 'Not authorised.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'projects', jsonb_build_object(
      'published', (select count(*) from public.projects
                     where status = 'published' and deleted_at is null),
      'draft',     (select count(*) from public.projects
                     where status = 'draft' and deleted_at is null),
      'in_review', (select count(*) from public.projects
                     where status = 'in_review' and deleted_at is null),
      'archived',  (select count(*) from public.projects
                     where status = 'archived' and deleted_at is null),
      'deleted',   (select count(*) from public.projects where deleted_at is not null)
    ),
    'certificates', jsonb_build_object(
      'published', (select count(*) from public.certificates
                     where status = 'published' and deleted_at is null),
      'draft',     (select count(*) from public.certificates
                     where status = 'draft' and deleted_at is null),
      'in_review', (select count(*) from public.certificates
                     where status = 'in_review' and deleted_at is null),
      'archived',  (select count(*) from public.certificates
                     where status = 'archived' and deleted_at is null),
      'awaiting_privacy_review', (select count(*) from public.certificates
                     where privacy_reviewed_at is null and deleted_at is null)
    ),
    'messages', jsonb_build_object(
      'unread',   (select count(*) from public.contact_messages
                    where state = 'unread' and deleted_at is null),
      'total',    (select count(*) from public.contact_messages where deleted_at is null),
      'starred',  (select count(*) from public.contact_messages
                    where is_starred and deleted_at is null),
      'spam',     (select count(*) from public.contact_messages
                    where state = 'spam' and deleted_at is null)
    ),
    'resume', jsonb_build_object(
      'downloads_total', (select coalesce(sum(download_count), 0)
                            from public.resume_versions where deleted_at is null),
      'downloads_30d',   (select count(*) from public.download_events
                           where resource_type = 'resume'
                             and occurred_at > now() - interval '30 days'),
      'versions',        (select count(*) from public.resume_versions where deleted_at is null),
      'active_locales',  (select coalesce(jsonb_agg(locale order by locale), '[]'::jsonb)
                            from public.resume_versions
                           where is_active and not is_archived and deleted_at is null)
    ),
    'traffic', jsonb_build_object(
      'page_views_total', (select count(*) from public.page_views),
      'page_views_30d',   (select count(*) from public.page_views
                            where occurred_at > now() - interval '30 days'),
      'page_views_7d',    (select count(*) from public.page_views
                            where occurred_at > now() - interval '7 days'),
      'unique_visitors_30d', (select count(distinct visitor_hash)
                                from public.page_views
                               where visitor_hash is not null
                                 and occurred_at > now() - interval '30 days')
    ),
    'storage', jsonb_build_object(
      'assets',      (select count(*) from public.media_assets where deleted_at is null),
      'bytes_total', (select coalesce(sum(file_size_bytes), 0)
                        from public.media_assets where deleted_at is null),
      'bytes_public',(select coalesce(sum(file_size_bytes), 0)
                        from public.media_assets
                       where deleted_at is null and visibility = 'public'),
      'bytes_private',(select coalesce(sum(file_size_bytes), 0)
                        from public.media_assets
                       where deleted_at is null and visibility = 'private')
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.admin_dashboard_summary() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Content health — the actionable "what is wrong right now" list.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_content_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_view_admin() then
    raise exception 'Not authorised.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'missing_translations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'entity_type', entity_type, 'entity_id', entity_id,
               'slug', slug, 'has_en', has_en, 'has_km', has_km
             ) order by entity_type, slug), '[]'::jsonb)
        from public.translation_coverage
       where not has_en or not has_km
    ),
    'media_missing_alt_text', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'filename', original_filename, 'kind', kind
             ) order by created_at desc), '[]'::jsonb)
        from public.media_assets
       where deleted_at is null
         and visibility = 'public'
         and mime_type <> 'application/pdf'
         and (alt_text_en is null or btrim(alt_text_en) = ''
              or alt_text_km is null or btrim(alt_text_km) = '')
    ),
    'missing_seo_description', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'entity_type', 'project', 'entity_id', p.id,
               'slug', p.slug, 'locale', t.locale
             ) order by p.slug, t.locale), '[]'::jsonb)
        from public.projects p
        join public.project_translations t on t.project_id = p.id
       where p.deleted_at is null
         and p.status = 'published'
         and (t.seo_description is null or btrim(t.seo_description) = '')
    ),
    'projects_without_case_study', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'slug', p.slug, 'status', p.status
             ) order by p.slug), '[]'::jsonb)
        from public.projects p
       where p.deleted_at is null
         and not exists (
           select 1 from public.project_translations t
            where t.project_id = p.id
              and coalesce(btrim(t.overview), '') <> ''
              and coalesce(btrim(t.problem), '') <> ''
              and coalesce(btrim(t.solution), '') <> ''
         )
    ),
    'certificates_awaiting_privacy_review', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'slug', slug, 'issuer', issuer_en, 'status', status
             ) order by updated_at desc), '[]'::jsonb)
        from public.certificates
       where deleted_at is null and privacy_reviewed_at is null
    ),
    'certificates_missing_verification', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'slug', slug, 'issuer', issuer_en
             ) order by slug), '[]'::jsonb)
        from public.certificates
       where deleted_at is null
         and status = 'published'
         and verification_url is null
         and credential_id is null
    ),
    'content_needing_review', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'entity_type', entity_type, 'id', id, 'slug', slug
             ) order by entity_type, slug), '[]'::jsonb)
        from (
          select 'project'::text as entity_type, id, slug from public.projects
           where needs_review and deleted_at is null
          union all
          select 'certificate'::text, id, slug from public.certificates
           where needs_review and deleted_at is null
          union all
          select 'education'::text, id, slug from public.education
           where needs_review and deleted_at is null
          union all
          select 'experience'::text, id, slug from public.experiences
           where needs_review and deleted_at is null
        ) s
    ),
    'stale_drafts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'entity_type', entity_type, 'id', id, 'slug', slug,
               'updated_at', updated_at
             ) order by updated_at), '[]'::jsonb)
        from (
          select 'project'::text as entity_type, id, slug, updated_at
            from public.projects
           where status in ('draft', 'in_review') and deleted_at is null
             and updated_at < now() - interval '30 days'
          union all
          select 'certificate'::text, id, slug, updated_at
            from public.certificates
           where status in ('draft', 'in_review') and deleted_at is null
             and updated_at < now() - interval '30 days'
        ) s
    ),
    'oversized_media', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'filename', original_filename,
               'bytes', file_size_bytes, 'kind', kind
             ) order by file_size_bytes desc), '[]'::jsonb)
        from public.media_assets
       where deleted_at is null
         and visibility = 'public'
         and file_size_bytes > 1048576
    ),
    'unverified_metrics', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'project_slug', p.slug, 'label', m.label_en, 'value', m.value
             ) order by p.slug), '[]'::jsonb)
        from public.project_metrics m
        join public.projects p on p.id = m.project_id
       where not m.is_verified and p.deleted_at is null
    ),
    'external_links', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'entity_type', entity_type, 'slug', slug, 'url', url
             ) order by slug), '[]'::jsonb)
        from (
          select 'project'::text as entity_type, slug, live_url as url
            from public.projects
           where live_url is not null and deleted_at is null
          union all
          select 'project'::text, slug, repository_url
            from public.projects
           where repository_url is not null and deleted_at is null
          union all
          select 'certificate'::text, slug, verification_url
            from public.certificates
           where verification_url is not null and deleted_at is null
        ) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_content_health() from public, anon;
grant execute on function public.admin_content_health() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Dashboard insights — "what is performing", derived from the event tables.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_insights(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  since  timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
begin
  if not public.can_view_admin() then
    raise exception 'Not authorised.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'window_days', greatest(coalesce(p_days, 30), 1),
    'most_viewed_projects', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
        from (
          select jsonb_build_object('slug', p.slug, 'views', count(*)) as x,
                 count(*) as cnt
            from public.page_views pv
            join public.projects p on p.id = pv.entity_id
           where pv.entity_type = 'project' and pv.occurred_at > since
           group by p.slug
           order by cnt desc
           limit 10
        ) s
    ),
    'most_viewed_certificates', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
        from (
          select jsonb_build_object('slug', c.slug, 'views', count(*)) as x, count(*) as cnt
            from public.page_views pv
            join public.certificates c on c.id = pv.entity_id
           where pv.entity_type = 'certificate' and pv.occurred_at > since
           group by c.slug
           order by cnt desc
           limit 10
        ) s
    ),
    'most_clicked_outbound', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
        from (
          select jsonb_build_object(
                   'host', destination_host, 'context', context, 'clicks', count(*)
                 ) as x, count(*) as cnt
            from public.outbound_clicks
           where occurred_at > since and destination_host is not null
           group by destination_host, context
           order by cnt desc
           limit 10
        ) s
    ),
    'traffic_by_locale', (
      select coalesce(jsonb_object_agg(locale, cnt), '{}'::jsonb)
        from (
          select locale::text as locale, count(*) as cnt
            from public.page_views
           where occurred_at > since
           group by locale
        ) s
    ),
    'traffic_by_device', (
      select coalesce(jsonb_object_agg(coalesce(device_type, 'unknown'), cnt), '{}'::jsonb)
        from (
          select device_type, count(*) as cnt
            from public.page_views
           where occurred_at > since
           group by device_type
        ) s
    ),
    'top_referrers', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
        from (
          select jsonb_build_object('host', referrer_host, 'views', count(*)) as x,
                 count(*) as cnt
            from public.page_views
           where occurred_at > since
             and referrer_host is not null
             and referrer_host <> ''
           group by referrer_host
           order by cnt desc
           limit 10
        ) s
    ),
    'daily_page_views', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', cnt) order by d), '[]'::jsonb)
        from (
          select date_trunc('day', occurred_at)::date as d, count(*) as cnt
            from public.page_views
           where occurred_at > since
           group by 1
        ) s
    ),
    'recent_resume_downloads', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'label', resource_label, 'locale', locale, 'at', occurred_at
             ) order by occurred_at desc), '[]'::jsonb)
        from (
          select resource_label, locale, occurred_at
            from public.download_events
           where resource_type = 'resume' and occurred_at > since
           order by occurred_at desc
           limit 20
        ) s
    ),
    -- Contact conversion: submissions per 100 contact-page views in the window.
    'contact_conversion', (
      select jsonb_build_object(
        'submissions', (select count(*) from public.analytics_events
                         where event_name = 'contact_submit' and occurred_at > since),
        'contact_page_views', (select count(*) from public.page_views
                                where path like '%/contact' and occurred_at > since)
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_insights(integer) from public, anon;
grant execute on function public.admin_insights(integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Contact-form rate limiting, evaluated in the database.
--
--  v1 rate-limited with an in-memory object inside a serverless function, which
--  reset on every cold start and was not shared across concurrent instances.
--  Moving the window query next to the data makes the limit actually hold.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.check_contact_rate_limit(
  p_ip_hash text,
  p_cooldown_seconds integer default 120,
  p_max_per_hour integer default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last     timestamptz;
  v_count    integer;
  v_oldest   timestamptz;
  v_wait     integer;
begin
  if p_ip_hash is null or btrim(p_ip_hash) = '' then
    return jsonb_build_object('blocked', false);
  end if;

  select max(created_at), count(*), min(created_at)
    into v_last, v_count, v_oldest
    from public.contact_messages
   where ip_hash = p_ip_hash
     and created_at > now() - interval '1 hour';

  if v_count = 0 then
    return jsonb_build_object('blocked', false);
  end if;

  v_wait := ceil(p_cooldown_seconds - extract(epoch from (now() - v_last)));
  if v_wait > 0 then
    return jsonb_build_object(
      'blocked', true, 'reason', 'cooldown', 'seconds_left', v_wait
    );
  end if;

  if v_count >= p_max_per_hour then
    v_wait := ceil(3600 - extract(epoch from (now() - v_oldest)));
    return jsonb_build_object(
      'blocked', true, 'reason', 'hourly', 'seconds_left', greatest(v_wait, 1)
    );
  end if;

  return jsonb_build_object('blocked', false);
end;
$$;

-- Callable by anonymous visitors: it returns only a boolean plus a wait time and
-- never discloses any message content.
grant execute on function public.check_contact_rate_limit(text, integer, integer)
  to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Resume download counter. SECURITY DEFINER so an anonymous download can
--  increment the counter without granting anon UPDATE on resume_versions.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.record_resume_download(
  p_resume_id uuid,
  p_visitor_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.content_locale;
  v_label  text;
begin
  update public.resume_versions
     set download_count = download_count + 1
   where id = p_resume_id
     and is_active
     and not is_archived
     and deleted_at is null
  returning locale, version_label into v_locale, v_label;

  -- Only the active resume can be downloaded publicly, so an unmatched id is
  -- silently ignored rather than leaking whether the row exists.
  if v_locale is null then
    return;
  end if;

  insert into public.download_events
    (resource_type, resource_id, resource_label, locale, visitor_hash)
  values ('resume', p_resume_id, v_label, v_locale, p_visitor_hash);
end;
$$;

grant execute on function public.record_resume_download(uuid, text) to anon, authenticated;
