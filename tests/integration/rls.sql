-- ═══════════════════════════════════════════════════════════════════════════
--  RLS verification suite
--
--  Run against the local stack:
--    docker exec -i $(docker ps -q -f name=supabase_db_ron-raksmey-portfolio-cms) \
--      psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < tests/integration/rls.sql
--
--  Or via npm: `npm run test:rls`
--
--  Every assertion below is a claim the acceptance criteria make about
--  security. Each one runs as the real `anon` / `authenticated` role with a
--  simulated JWT, not as a superuser, so a passing run is actual evidence.
--
--  The suite raises on the first failure, so a clean run means all pass.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\timing off

create or replace function pg_temp.assert(
  condition boolean,
  description text
) returns void language plpgsql as $$
begin
  if condition then
    raise notice '  PASS  %', description;
  else
    raise exception 'FAIL  %', description;
  end if;
end;
$$;

-- Impersonate `anon` exactly as PostgREST does.
create or replace function pg_temp.become_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

create or replace function pg_temp.become_user(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.become_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Fixtures — one published and one draft project, plus a non-admin user and a
--  viewer-role user, so every boundary has both sides represented.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_owner_id    uuid := '00000000-0000-4000-8000-000000000001';
  v_nonadmin_id uuid := '00000000-0000-4000-8000-0000000000ff';
  v_viewer_id   uuid := '00000000-0000-4000-8000-0000000000fe';
  v_media_id    uuid;
begin
  -- A logged-in user with NO admin_roles row. This is the case that catches
  -- policies which check `auth.uid() is not null` instead of a real role.
  if not exists (select 1 from auth.users where id = v_nonadmin_id) then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (v_nonadmin_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'nonadmin@localhost.test',
            extensions.crypt('test-password', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
  end if;

  if not exists (select 1 from auth.users where id = v_viewer_id) then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (v_viewer_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'viewer@localhost.test',
            extensions.crypt('test-password', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
  end if;

  insert into public.admin_roles (user_id, role, note)
  values (v_viewer_id, 'viewer', 'RLS suite fixture')
  on conflict (user_id) do update set role = 'viewer', revoked_at = null;

  -- A published project to prove the public read path works at all.
  insert into public.projects (slug, status, published_at, featured, needs_review)
  values ('rls-fixture-published', 'published', now() - interval '1 day', false, false)
  on conflict (slug) where deleted_at is null do nothing;

  insert into public.project_translations (project_id, locale, title, summary)
  select id, 'en', 'RLS fixture (published)', 'Visible to anonymous readers.'
    from public.projects where slug = 'rls-fixture-published'
  on conflict (project_id, locale) do nothing;

  -- A draft that anonymous readers must never see.
  insert into public.projects (slug, status, needs_review)
  values ('rls-fixture-draft', 'draft', false)
  on conflict (slug) where deleted_at is null do nothing;

  insert into public.project_translations (project_id, locale, title, summary)
  select id, 'en', 'RLS fixture (draft)', 'Must be invisible to anonymous readers.'
    from public.projects where slug = 'rls-fixture-draft'
  on conflict (project_id, locale) do nothing;

  -- A future-dated "published" row: status alone must not be enough.
  insert into public.projects (slug, status, needs_review)
  values ('rls-fixture-scheduled', 'published', false)
  on conflict (slug) where deleted_at is null do nothing;
  update public.projects set published_at = now() + interval '10 days'
   where slug = 'rls-fixture-scheduled';

  -- A soft-deleted published row.
  insert into public.projects (slug, status, needs_review)
  values ('rls-fixture-soft-deleted', 'published', false)
  on conflict (slug) where deleted_at is null do nothing;
  update public.projects
     set published_at = now() - interval '1 day', deleted_at = now()
   where slug = 'rls-fixture-soft-deleted';

  -- Verified and unverified metrics on the published project.
  insert into public.project_metrics
    (project_id, label_en, value, metric_type, source_note, is_verified)
  select id, 'Verified metric', '42', 'scale', 'Counted in the admin dashboard.', true
    from public.projects where slug = 'rls-fixture-published'
  on conflict do nothing;

  insert into public.project_metrics
    (project_id, label_en, value, metric_type, is_verified)
  select id, 'Unverified metric', '9000', 'scale', false
    from public.projects where slug = 'rls-fixture-published'
  on conflict do nothing;

  -- A private certificate original + a public preview, then a published
  -- certificate wired to both.
  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes, alt_text_en, alt_text_km)
  values ('certificate-originals', 'rls-fixture/original.pdf', 'certificate_original',
          'private', 'original.pdf', 'application/pdf', 12345, null, null)
  on conflict (bucket_id, storage_path) do nothing;

  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes, width, height, alt_text_en, alt_text_km)
  values ('certificate-previews', 'rls-fixture/preview.webp', 'certificate_preview',
          'public', 'preview.webp', 'image/webp', 2345, 1200, 850,
          'Redacted preview', 'ការបង្ហាញដែលបានលាក់ព័ត៌មាន')
  on conflict (bucket_id, storage_path) do nothing;

  insert into public.certificates
    (slug, issuer_en, status, contains_sensitive_data, privacy_reviewed_at,
     privacy_reviewed_by, preview_media_id, original_media_id)
  select 'rls-fixture-certificate', 'RLS Fixture Issuer', 'published', false, now(),
         v_owner_id,
         (select id from public.media_assets where storage_path = 'rls-fixture/preview.webp'),
         (select id from public.media_assets where storage_path = 'rls-fixture/original.pdf')
  on conflict (slug) where deleted_at is null do nothing;

  insert into public.certificate_translations (certificate_id, locale, title)
  select id, 'en', 'RLS fixture certificate'
    from public.certificates where slug = 'rls-fixture-certificate'
  on conflict (certificate_id, locale) do nothing;

  -- A contact message, so we can prove anon cannot read the inbox.
  insert into public.contact_messages (name, email, message)
  values ('RLS Fixture', 'fixture@example.com',
          'This message must never be readable by an anonymous client.')
  on conflict do nothing;

  raise notice 'Fixtures ready.';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  1. Anonymous read boundaries
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int;
begin
  raise notice '';
  raise notice '── 1. Anonymous reads ──────────────────────────────────';
  perform pg_temp.become_anon();

  select count(*) into n from public.projects where slug = 'rls-fixture-published';
  perform pg_temp.assert(n = 1, 'anon CAN read a published project');

  select count(*) into n from public.projects where slug = 'rls-fixture-draft';
  perform pg_temp.assert(n = 0, 'anon CANNOT read a draft project');

  select count(*) into n from public.projects where slug = 'rls-fixture-scheduled';
  perform pg_temp.assert(n = 0, 'anon CANNOT read a future-dated published project');

  select count(*) into n from public.projects where slug = 'rls-fixture-soft-deleted';
  perform pg_temp.assert(n = 0, 'anon CANNOT read a soft-deleted project');

  /*
   * The three real platforms are published on purpose (migration 0015), so the
   * assertion here is the opposite of what it was when they were seeded as
   * drafts: all three must be readable by anon, or the public Projects page is
   * empty again. Draft-hiding is still covered — by the fixtures above, which
   * is where it belongs, because a fixture cannot be accidentally published by
   * a content migration.
   */
  select count(*) into n from public.projects
   where slug in ('krusmart', 'ptec-digital-library', 'ptec-storage');
  perform pg_temp.assert(n = 3, 'anon CAN read the three published platform projects');

  -- Their case studies and structured content must come with them, in both
  -- languages: a visible project whose prose is hidden renders as a bare title.
  select count(*) into n from public.project_translations t
    join public.projects p on p.id = t.project_id
   where p.slug in ('krusmart', 'ptec-digital-library', 'ptec-storage');
  perform pg_temp.assert(n = 6, 'anon CAN read both translations of each platform project');

  select count(*) into n from public.project_features f
    join public.projects p on p.id = f.project_id
   where p.slug in ('krusmart', 'ptec-digital-library', 'ptec-storage');
  perform pg_temp.assert(n > 0, 'anon CAN read the platform projects'' features');

  -- Every imported metric states its source, so all of them are verified and
  -- all of them are public. An unsourced one could not have been marked
  -- verified in the first place — the CHECK constraint refuses it.
  select count(*) into n from public.project_metrics m
    join public.projects p on p.id = m.project_id
   where p.slug in ('krusmart', 'ptec-digital-library', 'ptec-storage')
     and (m.source_note is null or btrim(m.source_note) = '');
  perform pg_temp.assert(n = 0, 'no public platform metric is missing its source');

  select count(*) into n from public.project_translations t
    join public.projects p on p.id = t.project_id
   where p.slug = 'rls-fixture-draft';
  perform pg_temp.assert(n = 0, 'anon CANNOT read a draft project''s translations');

  select count(*) into n from public.project_metrics where label_en = 'Verified metric';
  perform pg_temp.assert(n = 1, 'anon CAN read a verified metric on a published project');

  select count(*) into n from public.project_metrics where label_en = 'Unverified metric';
  perform pg_temp.assert(n = 0, 'anon CANNOT read an unverified metric');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  2. Private files and the certificate original
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int;
begin
  raise notice '';
  raise notice '── 2. Private media ────────────────────────────────────';
  perform pg_temp.become_anon();

  select count(*) into n from public.media_assets
   where storage_path = 'rls-fixture/preview.webp';
  perform pg_temp.assert(n = 1, 'anon CAN read a public media asset row');

  select count(*) into n from public.media_assets
   where storage_path = 'rls-fixture/original.pdf';
  perform pg_temp.assert(n = 0,
    'anon CANNOT read the private certificate-original media row (its storage path stays secret)');

  select count(*) into n from public.media_assets where visibility = 'private';
  perform pg_temp.assert(n = 0, 'anon sees ZERO private media assets in total');

  -- The public projection must not even expose the column.
  perform pg_temp.assert(
    not exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'public_certificates'
         and column_name = 'original_media_id'
    ),
    'public_certificates view does NOT expose original_media_id'
  );

  select count(*) into n from public.public_certificates
   where slug = 'rls-fixture-certificate';
  perform pg_temp.assert(n = 1, 'anon CAN read the published certificate through the public view');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  3. Contact messages, audit logs, notes and profiles
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int; ok boolean;
begin
  raise notice '';
  raise notice '── 3. Never-public tables ──────────────────────────────';
  perform pg_temp.become_anon();

  -- No SELECT privilege at all: the failure is a hard privilege error, which is
  -- a stronger guarantee than an empty result set.
  begin
    execute 'select count(*) from public.contact_messages';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon has NO SELECT privilege on contact_messages');

  begin
    execute 'select count(*) from public.audit_logs';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon has NO SELECT privilege on audit_logs');

  begin
    execute 'select count(*) from public.contact_message_notes';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon has NO SELECT privilege on contact_message_notes');

  begin
    execute 'select count(*) from public.admin_roles';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon has NO SELECT privilege on admin_roles');

  begin
    execute 'select count(*) from public.profiles';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon has NO SELECT privilege on the profiles table');

  select count(*) into n from public.public_profile;
  perform pg_temp.assert(n = 1, 'anon CAN read the owner profile through public_profile');

  perform pg_temp.assert(
    not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'public_profile'
         and column_name in ('email', 'last_login_at')
    ),
    'public_profile does NOT expose email or last_login_at'
  );

  -- Analytics is append-only for visitors.
  begin
    execute 'select count(*) from public.page_views';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT read back analytics page_views');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  4. Anonymous writes
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare ok boolean; n int;
begin
  raise notice '';
  raise notice '── 4. Anonymous writes ─────────────────────────────────';
  perform pg_temp.become_anon();

  -- Permitted: submitting the contact form.
  insert into public.contact_messages (name, email, message)
  values ('Anon Visitor', 'anon@example.com',
          'A legitimate enquiry submitted by an anonymous visitor.');
  perform pg_temp.assert(true, 'anon CAN insert a valid contact message');

  -- Permitted: recording an analytics event.
  insert into public.page_views (path, locale) values ('/en', 'en');
  perform pg_temp.assert(true, 'anon CAN insert a page_view');

  -- Rejected: pre-setting triage columns.
  begin
    insert into public.contact_messages (name, email, message, state)
    values ('Sneaky', 'sneaky@example.com',
            'Trying to insert this already marked as read.', 'read');
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT insert a message pre-marked as read');

  begin
    insert into public.contact_messages (name, email, message, notification_sent)
    values ('Sneaky', 'sneaky@example.com',
            'Trying to claim a notification was already sent.', true);
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT insert a message claiming it was already notified');

  begin
    insert into public.contact_messages (name, email, message, ip_hash)
    values ('Sneaky', 'sneaky@example.com',
            'Trying to forge the rate-limit key.', 'forged-hash');
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT forge ip_hash to evade rate limiting');

  -- Rejected: any CMS write.
  begin
    insert into public.projects (slug, status) values ('anon-injected', 'published');
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT insert a project');

  begin
    execute $q$update public.projects set status = 'published' where slug = 'rls-fixture-draft'$q$;
    get diagnostics n = row_count;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT publish a draft project');

  begin
    execute $q$delete from public.projects where slug = 'rls-fixture-published'$q$;
    get diagnostics n = row_count;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT delete a project');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  5. Authenticated but NOT an admin
--     The most commonly missed boundary: a valid session is not authorisation.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int; ok boolean;
begin
  raise notice '';
  raise notice '── 5. Authenticated non-admin ──────────────────────────';
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000ff');

  perform pg_temp.assert(public.current_admin_role() is null,
    'a user with no admin_roles row has NO role');
  perform pg_temp.assert(not public.can_view_admin(),
    'a user with no admin_roles row CANNOT view admin');

  select count(*) into n from public.projects where slug = 'rls-fixture-draft';
  perform pg_temp.assert(n = 0, 'a logged-in non-admin CANNOT read drafts');

  select count(*) into n from public.contact_messages;
  perform pg_temp.assert(n = 0, 'a logged-in non-admin CANNOT read contact messages');

  select count(*) into n from public.audit_logs;
  perform pg_temp.assert(n = 0, 'a logged-in non-admin CANNOT read audit logs');

  select count(*) into n from public.media_assets where visibility = 'private';
  perform pg_temp.assert(n = 0, 'a logged-in non-admin CANNOT read private media');

  begin
    insert into public.projects (slug, status) values ('nonadmin-injected', 'draft');
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'a logged-in non-admin CANNOT create a project');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  6. Viewer role — read-only
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int; ok boolean;
begin
  raise notice '';
  raise notice '── 6. Viewer role ──────────────────────────────────────';
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000fe');

  perform pg_temp.assert(public.current_admin_role() = 'viewer', 'viewer role resolves');
  perform pg_temp.assert(public.can_view_admin(), 'viewer CAN view admin');
  perform pg_temp.assert(not public.can_edit_content(), 'viewer CANNOT edit content');
  perform pg_temp.assert(not public.is_owner(), 'viewer is NOT owner');

  select count(*) into n from public.projects where slug = 'rls-fixture-draft';
  perform pg_temp.assert(n = 1, 'viewer CAN read drafts');

  select count(*) into n from public.contact_messages;
  perform pg_temp.assert(n > 0, 'viewer CAN read the message inbox');

  begin
    insert into public.projects (slug, status) values ('viewer-injected', 'draft');
    ok := false;
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'viewer CANNOT create a project');

  begin
    execute $q$update public.projects set featured = true where slug = 'rls-fixture-draft'$q$;
    get diagnostics n = row_count;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'viewer CANNOT update a project');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  7. Owner role
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare n int; ok boolean;
begin
  raise notice '';
  raise notice '── 7. Owner role ───────────────────────────────────────';
  perform pg_temp.become_user('00000000-0000-4000-8000-000000000001');

  perform pg_temp.assert(public.is_owner(), 'owner role resolves');
  perform pg_temp.assert(public.can_edit_content(), 'owner CAN edit content');

  select count(*) into n from public.media_assets where visibility = 'private';
  perform pg_temp.assert(n > 0, 'owner CAN see private media rows');

  update public.projects set featured = true where slug = 'rls-fixture-draft';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'owner CAN update a project');

  -- Audit log stays append-only even for the owner: no INSERT grant exists.
  begin
    insert into public.audit_logs (action, summary) values ('admin.login', 'forged');
    ok := false;
  exception when insufficient_privilege then ok := true;
       when others then ok := true;
  end;
  perform pg_temp.assert(ok,
    'even the owner CANNOT insert an audit log from a client session (service-role only)');

  begin
    execute $q$update public.audit_logs set summary = 'tampered'$q$;
    get diagnostics n = row_count;
    ok := (n = 0);
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'audit logs CANNOT be updated by anyone');

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  8. Publish gates enforced by the database, not the UI
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare ok boolean; v_media uuid;
begin
  raise notice '';
  raise notice '── 8. Database publish gates ───────────────────────────';

  -- A certificate cannot be published without a recorded privacy review.
  insert into public.certificates (slug, issuer_en, status)
  values ('rls-gate-no-review', 'Gate Test', 'draft')
  on conflict (slug) where deleted_at is null do nothing;

  begin
    update public.certificates set status = 'published' where slug = 'rls-gate-no-review';
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a certificate CANNOT be published without a privacy review');

  -- …nor without a redacted public preview.
  update public.certificates
     set privacy_reviewed_at = now(), contains_sensitive_data = false
   where slug = 'rls-gate-no-review';

  begin
    update public.certificates set status = 'published' where slug = 'rls-gate-no-review';
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a certificate CANNOT be published without a public preview image');

  -- An "original" must reference a private asset.
  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
  values ('public-media', 'rls-gate/public-thing.png', 'other', 'public',
          'public-thing.png', 'image/png', 999)
  on conflict (bucket_id, storage_path) do nothing;

  select id into v_media from public.media_assets
   where storage_path = 'rls-gate/public-thing.png';

  begin
    update public.certificates set original_media_id = v_media where slug = 'rls-gate-no-review';
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'original_media_id CANNOT point at a publicly stored asset');

  -- media_assets itself refuses a public certificate original.
  begin
    insert into public.media_assets
      (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
    values ('public-media', 'rls-gate/bad-original.pdf', 'certificate_original', 'public',
            'bad.pdf', 'application/pdf', 999);
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a certificate_original asset CANNOT be stored with public visibility');

  -- A testimonial cannot be published without recorded consent.
  insert into public.testimonials (slug, author_name_en, status)
  values ('rls-gate-no-consent', 'Gate Person', 'draft')
  on conflict (slug) where deleted_at is null do nothing;

  begin
    update public.testimonials set status = 'published' where slug = 'rls-gate-no-consent';
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a testimonial CANNOT be published without recorded consent');

  -- A metric cannot claim verification without a source.
  begin
    insert into public.project_metrics (project_id, label_en, value, is_verified)
    select id, 'No source', '100', true from public.projects where slug = 'rls-fixture-published';
    ok := false;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a metric CANNOT be marked verified without a source note');

  -- published_at is derived from status, never accepted from the client.
  insert into public.projects (slug, status, published_at)
  values ('rls-gate-forged-date', 'draft', now() - interval '5 years')
  on conflict (slug) where deleted_at is null do nothing;

  perform pg_temp.assert(
    (select published_at from public.projects where slug = 'rls-gate-forged-date') is null,
    'published_at is cleared for a draft even when the client supplies one'
  );
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  9. Admin RPCs refuse unauthorised callers
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare ok boolean;
begin
  raise notice '';
  raise notice '── 9. Admin RPC authorisation ──────────────────────────';
  perform pg_temp.become_anon();

  begin
    perform public.admin_dashboard_summary();
    ok := false;
  exception when insufficient_privilege then ok := true;
       when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT call admin_dashboard_summary()');

  begin
    perform public.admin_content_health();
    ok := false;
  exception when insufficient_privilege then ok := true;
       when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT call admin_content_health()');

  begin
    perform public.admin_insights(30);
    ok := false;
  exception when insufficient_privilege then ok := true;
       when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT call admin_insights()');

  -- The rate-limit probe IS callable by anon, and leaks nothing but a wait time.
  perform pg_temp.assert(
    (public.check_contact_rate_limit('never-seen-hash') ->> 'blocked') = 'false',
    'anon CAN call check_contact_rate_limit() and it returns only a decision'
  );

  perform pg_temp.become_postgres();
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  10. RLS is enabled everywhere it must be
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  missing text;
begin
  raise notice '';
  raise notice '── 10. Coverage ────────────────────────────────────────';

  select string_agg(c.relname, ', ' order by c.relname) into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  perform pg_temp.assert(missing is null,
    coalesce('every public table has RLS enabled', 'tables without RLS: ' || missing));

  select string_agg(c.relname, ', ' order by c.relname) into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  perform pg_temp.assert(missing is null,
    coalesce('every RLS-enabled table has at least one policy',
             'RLS enabled but no policy (fully closed): ' || missing));
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Cleanup
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  delete from public.project_metrics
   where label_en in ('Verified metric', 'Unverified metric', 'No source');
  delete from public.projects where slug like 'rls-fixture-%' or slug like 'rls-gate-%';
  delete from public.certificates where slug like 'rls-fixture-%' or slug like 'rls-gate-%';
  delete from public.testimonials where slug like 'rls-gate-%';
  delete from public.media_assets where storage_path like 'rls-fixture/%'
                                     or storage_path like 'rls-gate/%';
  delete from public.contact_messages where email in ('fixture@example.com', 'anon@example.com');
  delete from public.page_views where path = '/en';
  delete from public.admin_roles where user_id = '00000000-0000-4000-8000-0000000000fe';
  delete from auth.users where id in ('00000000-0000-4000-8000-0000000000ff',
                                      '00000000-0000-4000-8000-0000000000fe');

  raise notice '';
  raise notice '════════════════════════════════════════════════════════';
  raise notice ' RLS suite: ALL ASSERTIONS PASSED';
  raise notice '════════════════════════════════════════════════════════';
end $$;
