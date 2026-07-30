-- ═══════════════════════════════════════════════════════════════════════════
--  0009 — Row Level Security
--
--  Model
--  ─────
--  anon           : may read published content only; may INSERT a contact
--                   message and an analytics event; may read nothing else.
--  authenticated  : same as anon unless the user has an active admin_roles row.
--  viewer         : read-only access to every admin table.
--  editor         : viewer + create/update content, media and messages.
--  owner          : editor + delete/restore, role management, private originals.
--
--  Every table below has RLS enabled. A role with no permissive policy for an
--  action is denied that action — deny by default.
--
--  Note on FORCE ROW LEVEL SECURITY: deliberately NOT used. The tables are owned
--  by `postgres`, which is also the role that applies migrations and the seed.
--  Forcing RLS on the owner would make the seed fail closed, and it would add no
--  protection against the two client roles, which never own anything. RLS is
--  enabled, so anon/authenticated are fully constrained; `service_role` bypasses
--  by design and is only ever used server-side.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Baseline privileges ─────────────────────────────────────────────────────
-- Start the two client roles from "no table access" and grant back deliberately.
-- Table privileges act as a second, independent gate in front of RLS.

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Lifecycle content tables (publish workflow + soft delete)
--
--  Generated in a loop rather than written out by hand so the rules cannot drift
--  between tables.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  lifecycle_tables text[] := array[
    'projects', 'certificates', 'education', 'experiences', 'testimonials'
  ];
begin
  foreach t in array lifecycle_tables loop
    execute format('alter table public.%I enable row level security', t);

    -- Public: published, not future-dated, not soft-deleted.
    execute format($f$
      drop policy if exists %1$s_public_read on public.%1$I;
      create policy %1$s_public_read on public.%1$I
        for select to anon, authenticated
        using (public.is_publicly_visible(status, published_at, deleted_at));
    $f$, t);

    -- Any active admin may read everything, including drafts and soft-deleted.
    execute format($f$
      drop policy if exists %1$s_admin_read on public.%1$I;
      create policy %1$s_admin_read on public.%1$I
        for select to authenticated
        using (public.can_view_admin());
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_editor_insert on public.%1$I;
      create policy %1$s_editor_insert on public.%1$I
        for insert to authenticated
        with check (public.can_edit_content());
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_editor_update on public.%1$I;
      create policy %1$s_editor_update on public.%1$I
        for update to authenticated
        using (public.can_edit_content())
        with check (public.can_edit_content());
    $f$, t);

    -- Hard delete is owner-only. Everyday "delete" in the UI is a soft delete,
    -- which is an UPDATE.
    execute format($f$
      drop policy if exists %1$s_owner_delete on public.%1$I;
      create policy %1$s_owner_delete on public.%1$I
        for delete to authenticated
        using (public.is_owner());
    $f$, t);

    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Translation and child tables
--
--  Visibility is inherited from the parent row: a draft project's translation is
--  unreadable, and so are its screenshots, features and metrics.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('project_translations',      'projects',     'project_id'),
      ('project_media',             'projects',     'project_id'),
      ('project_features',          'projects',     'project_id'),
      ('project_metrics',           'projects',     'project_id'),
      ('project_technologies',      'projects',     'project_id'),
      ('project_category_links',    'projects',     'project_id'),
      ('certificate_translations',  'certificates', 'certificate_id'),
      ('certificate_skills',        'certificates', 'certificate_id'),
      ('certificate_project_links', 'certificates', 'certificate_id'),
      ('education_translations',    'education',    'education_id'),
      ('experience_translations',   'experiences',  'experience_id'),
      ('experience_tags',           'experiences',  'experience_id'),
      ('testimonial_translations',  'testimonials', 'testimonial_id')
    ) as v(child, parent, fk)
  loop
    execute format('alter table public.%I enable row level security', spec.child);

    execute format($f$
      drop policy if exists %1$s_public_read on public.%1$I;
      create policy %1$s_public_read on public.%1$I
        for select to anon, authenticated
        using (exists (
          select 1 from public.%2$I parent_row
           where parent_row.id = %1$I.%3$I
             and public.is_publicly_visible(
                   parent_row.status, parent_row.published_at, parent_row.deleted_at
                 )
        ));
    $f$, spec.child, spec.parent, spec.fk);

    execute format($f$
      drop policy if exists %1$s_admin_read on public.%1$I;
      create policy %1$s_admin_read on public.%1$I
        for select to authenticated using (public.can_view_admin());
    $f$, spec.child);

    execute format($f$
      drop policy if exists %1$s_editor_write on public.%1$I;
      create policy %1$s_editor_write on public.%1$I
        for all to authenticated
        using (public.can_edit_content())
        with check (public.can_edit_content());
    $f$, spec.child);

    execute format('grant select on public.%I to anon, authenticated', spec.child);
    execute format('grant insert, update, delete on public.%I to authenticated', spec.child);
  end loop;
end $$;

-- project_metrics carries an extra rule: unverified numbers are not public.
-- This is the database-level guarantee behind "no fabricated analytics".
drop policy if exists project_metrics_public_read on public.project_metrics;
create policy project_metrics_public_read on public.project_metrics
  for select to anon, authenticated
  using (
    is_verified
    and exists (
      select 1 from public.projects p
       where p.id = project_metrics.project_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
--  Reference / taxonomy tables — world-readable, editor-writable.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  ref_tables text[] := array[
    'project_categories', 'technologies', 'certificate_categories',
    'skill_project_links', 'skill_certificate_links'
  ];
begin
  foreach t in array ref_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists %1$s_public_read on public.%1$I;
      create policy %1$s_public_read on public.%1$I
        for select to anon, authenticated using (true);
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_editor_write on public.%1$I;
      create policy %1$s_editor_write on public.%1$I
        for all to authenticated
        using (public.can_edit_content())
        with check (public.can_edit_content());
    $f$, t);

    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Tables with their own publish flag honour it for anonymous readers.
do $$
declare
  t text;
  flagged_tables text[] := array['skill_categories', 'skills', 'social_links'];
begin
  foreach t in array flagged_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists %1$s_public_read on public.%1$I;
      create policy %1$s_public_read on public.%1$I
        for select to anon, authenticated
        using (is_published or public.can_view_admin());
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_editor_write on public.%1$I;
      create policy %1$s_editor_write on public.%1$I
        for all to authenticated
        using (public.can_edit_content())
        with check (public.can_edit_content());
    $f$, t);

    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  media_assets
--
--  Row-level (not merely column-level) protection for private files: the row for
--  a private certificate original is invisible to anonymous readers, so its
--  storage path is never disclosed even though `certificates.original_media_id`
--  exists. Fetching the object additionally requires the storage policy in
--  migration 0010, which is owner-only.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.media_assets enable row level security;

drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets
  for select to anon, authenticated
  using (visibility = 'public' and deleted_at is null);

drop policy if exists media_assets_admin_read on public.media_assets;
create policy media_assets_admin_read on public.media_assets
  for select to authenticated
  using (public.can_view_admin());

drop policy if exists media_assets_editor_insert on public.media_assets;
create policy media_assets_editor_insert on public.media_assets
  for insert to authenticated
  with check (public.can_edit_content());

drop policy if exists media_assets_editor_update on public.media_assets;
create policy media_assets_editor_update on public.media_assets
  for update to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

drop policy if exists media_assets_owner_delete on public.media_assets;
create policy media_assets_owner_delete on public.media_assets
  for delete to authenticated
  using (public.is_owner());

grant select on public.media_assets to anon, authenticated;
grant insert, update, delete on public.media_assets to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  profiles — no anonymous table access at all. The public site reads the
--  column-restricted `public_profile` view instead.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_view_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_owner() or id = auth.uid());

drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles
  for delete to authenticated
  using (public.is_owner());

grant select, insert, update, delete on public.profiles to authenticated;
-- Intentionally no grant to anon.

-- security_invoker = false: the view runs with its owner's privileges, so anon
-- never needs SELECT on public.profiles. The WHERE clause and the column list
-- are the entire public surface.
create or replace view public.public_profile
with (security_invoker = false) as
  select
    p.id,
    p.display_name,
    p.public_headline_en,
    p.public_headline_km,
    p.public_bio_en,
    p.public_bio_km,
    p.public_location,
    p.public_avatar_url
  from public.profiles p
 where p.is_site_owner;

comment on view public.public_profile is
  'Column-restricted public projection of the site-owner profile.';

grant select on public.public_profile to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  admin_roles — owner-managed, never public.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.admin_roles enable row level security;

drop policy if exists admin_roles_self_read on public.admin_roles;
create policy admin_roles_self_read on public.admin_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy if exists admin_roles_owner_write on public.admin_roles;
create policy admin_roles_owner_write on public.admin_roles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

grant select, insert, update, delete on public.admin_roles to authenticated;
-- Intentionally no grant to anon.

-- ═══════════════════════════════════════════════════════════════════════════
--  site_settings
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists site_settings_editor_write on public.site_settings;
create policy site_settings_editor_write on public.site_settings
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  resume_versions — the public sees the ACTIVE, non-archived version only.
--  Archived and draft resume files stay invisible.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.resume_versions enable row level security;

drop policy if exists resume_versions_public_read on public.resume_versions;
create policy resume_versions_public_read on public.resume_versions
  for select to anon, authenticated
  using (is_active and not is_archived and deleted_at is null);

drop policy if exists resume_versions_admin_read on public.resume_versions;
create policy resume_versions_admin_read on public.resume_versions
  for select to authenticated using (public.can_view_admin());

drop policy if exists resume_versions_editor_insert on public.resume_versions;
create policy resume_versions_editor_insert on public.resume_versions
  for insert to authenticated with check (public.can_edit_content());

drop policy if exists resume_versions_editor_update on public.resume_versions;
create policy resume_versions_editor_update on public.resume_versions
  for update to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

drop policy if exists resume_versions_owner_delete on public.resume_versions;
create policy resume_versions_owner_delete on public.resume_versions
  for delete to authenticated using (public.is_owner());

grant select on public.resume_versions to anon, authenticated;
grant insert, update, delete on public.resume_versions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  seo_overrides — metadata is public by nature; editors write.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.seo_overrides enable row level security;

drop policy if exists seo_overrides_public_read on public.seo_overrides;
create policy seo_overrides_public_read on public.seo_overrides
  for select to anon, authenticated using (true);

drop policy if exists seo_overrides_editor_write on public.seo_overrides;
create policy seo_overrides_editor_write on public.seo_overrides
  for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

grant select on public.seo_overrides to anon, authenticated;
grant insert, update, delete on public.seo_overrides to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  contact_messages — anonymous INSERT only. No anonymous SELECT, ever.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.contact_messages enable row level security;

-- The insert policy pins the columns a visitor is allowed to influence. Triage
-- columns must keep their defaults, so a submitter cannot pre-mark their own
-- message as read, starred, or already notified, and cannot inject an ip_hash.
drop policy if exists contact_messages_anon_insert on public.contact_messages;
create policy contact_messages_anon_insert on public.contact_messages
  for insert to anon, authenticated
  with check (
    state = 'unread'
    and is_starred = false
    and spam_score = 0
    and notification_sent = false
    and notification_error is null
    and read_at is null
    and replied_at is null
    and deleted_at is null
    and ip_hash is null
    and length(btrim(message)) between 10 and 2000
    and length(btrim(name)) between 1 and 100
  );

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated using (public.can_view_admin());

drop policy if exists contact_messages_editor_update on public.contact_messages;
create policy contact_messages_editor_update on public.contact_messages
  for update to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

drop policy if exists contact_messages_owner_delete on public.contact_messages;
create policy contact_messages_owner_delete on public.contact_messages
  for delete to authenticated using (public.is_owner());

-- INSERT only for anon. Deliberately no SELECT grant, so even a future policy
-- mistake cannot expose the inbox.
grant insert on public.contact_messages to anon;
grant select, insert, update, delete on public.contact_messages to authenticated;

-- ── contact_message_notes — internal only ───────────────────────────────────
alter table public.contact_message_notes enable row level security;

drop policy if exists contact_message_notes_admin_read on public.contact_message_notes;
create policy contact_message_notes_admin_read on public.contact_message_notes
  for select to authenticated using (public.can_view_admin());

drop policy if exists contact_message_notes_editor_write on public.contact_message_notes;
create policy contact_message_notes_editor_write on public.contact_message_notes
  for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

grant select, insert, update, delete on public.contact_message_notes to authenticated;
-- Intentionally no grant to anon.

-- ═══════════════════════════════════════════════════════════════════════════
--  Analytics — append-only for visitors, read-only for admins.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  analytics_tables text[] := array[
    'analytics_events', 'page_views', 'download_events', 'outbound_clicks'
  ];
begin
  foreach t in array analytics_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists %1$s_anon_insert on public.%1$I;
      create policy %1$s_anon_insert on public.%1$I
        for insert to anon, authenticated with check (true);
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_admin_read on public.%1$I;
      create policy %1$s_admin_read on public.%1$I
        for select to authenticated using (public.can_view_admin());
    $f$, t);

    execute format($f$
      drop policy if exists %1$s_owner_delete on public.%1$I;
      create policy %1$s_owner_delete on public.%1$I
        for delete to authenticated using (public.is_owner());
    $f$, t);

    -- Visitors may append but never read back.
    execute format('grant insert on public.%I to anon', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  audit_logs — append-only, admin-readable, never updatable or deletable.
--
--  Rows are written with the service-role client so an editor cannot forge an
--  entry attributed to someone else. No UPDATE or DELETE policy exists for any
--  role, which is what makes the trail genuinely append-only from the app's
--  point of view.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.can_view_admin());

grant select on public.audit_logs to authenticated;
-- Intentionally no grant to anon, and no insert/update/delete grant to anyone.

-- ── content_revisions ───────────────────────────────────────────────────────
alter table public.content_revisions enable row level security;

drop policy if exists content_revisions_admin_read on public.content_revisions;
create policy content_revisions_admin_read on public.content_revisions
  for select to authenticated using (public.can_view_admin());

drop policy if exists content_revisions_editor_insert on public.content_revisions;
create policy content_revisions_editor_insert on public.content_revisions
  for insert to authenticated with check (public.can_edit_content());

grant select, insert on public.content_revisions to authenticated;
-- Intentionally no grant to anon.

-- ═══════════════════════════════════════════════════════════════════════════
--  Public read projection for certificates.
--
--  RLS already restricts anonymous readers to published rows. This view adds
--  column-level discipline on top: `original_media_id`, the privacy-review
--  fields and the audit columns are simply not part of the public surface, so a
--  careless `select *` in application code cannot widen it later.
--  security_invoker = true keeps the base-table RLS in force; the view only
--  narrows columns.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.public_certificates
with (security_invoker = true) as
  select
    c.id,
    c.slug,
    c.category_id,
    c.credential_status,
    c.featured,
    c.sort_order,
    c.issuer_en,
    c.issuer_km,
    c.issuer_url,
    c.issued_on,
    c.expires_on,
    c.credential_id,
    c.verification_url,
    c.preview_media_id,
    c.og_image_media_id,
    c.allow_public_download,
    c.published_at
  from public.certificates c
 where public.is_publicly_visible(c.status, c.published_at, c.deleted_at);

comment on view public.public_certificates is
  'Public certificate surface. Excludes original_media_id and privacy internals.';

grant select on public.public_certificates to anon, authenticated;

-- Identity columns do not require sequence privileges, but PostgREST inspects
-- them; granting keeps introspection clean.
grant usage, select on all sequences in schema public to anon, authenticated;
