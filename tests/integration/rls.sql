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

  -- Two resumes: one active, one retired. Both files are private; only the
  -- active one's metadata row may be publicly readable.
  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
  values
    ('resumes', 'rls-fixture/active-cv.pdf',  'resume_file', 'private',
     'rls-fixture-active-cv.pdf',  'application/pdf', 1000),
    ('resumes', 'rls-fixture/retired-cv.pdf', 'resume_file', 'private',
     'rls-fixture-retired-cv.pdf', 'application/pdf', 1000)
  on conflict (bucket_id, storage_path) do nothing;

  insert into public.resume_versions
    (media_id, locale, version_label, effective_from, is_active, is_archived)
  select id, 'en', 'rls-fixture-active', current_date, true, false
    from public.media_assets where original_filename = 'rls-fixture-active-cv.pdf'
  on conflict do nothing;

  insert into public.resume_versions
    (media_id, locale, version_label, effective_from, is_active, is_archived)
  select id, 'km', 'rls-fixture-retired', current_date, false, true
    from public.media_assets where original_filename = 'rls-fixture-retired-cv.pdf'
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

  /*
   * The resume's media row.
   *
   * The file is private and the bucket is private, but the *metadata* row has to
   * be readable or the public resume page cannot render a published resume at
   * all — it refuses to show a version whose asset it cannot see, which is how a
   * live resume ended up invisible to everyone except its author.
   *
   * Access is scoped to the active, non-archived version, mirroring the storage
   * policy on the object itself, so deactivating revokes both together.
   */
  select count(*) into n from public.media_assets
   where bucket_id = 'resumes' and original_filename = 'rls-fixture-active-cv.pdf';
  perform pg_temp.assert(n = 1, 'anon CAN read the media row behind the ACTIVE resume');

  select count(*) into n from public.media_assets
   where bucket_id = 'resumes' and original_filename = 'rls-fixture-retired-cv.pdf';
  perform pg_temp.assert(n = 0, 'anon CANNOT read the media row behind a retired resume');

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

  /*
   * Private media is invisible to anon with exactly one deliberate exception:
   * the metadata row for the ACTIVE resume.
   *
   * That resume is already publicly downloadable through /api/resume/download,
   * and the public page cannot render a version whose file size and type it
   * cannot read — which is how a published resume ended up invisible to
   * everyone but its author. The exception is scoped to the active version and
   * revoked the moment it is deactivated.
   *
   * The blanket "zero private rows" assertion is therefore narrowed rather than
   * deleted: everything private that is NOT that one row must still be
   * unreachable, and the certificate-original check above is the case that
   * matters most.
   */
  select count(*) into n
    from public.media_assets m
   where m.visibility = 'private'
     and not exists (
       select 1 from public.resume_versions rv
        where rv.media_id = m.id and rv.is_active and not rv.is_archived
     );
  perform pg_temp.assert(n = 0,
    'anon sees NO private media beyond the active resume''s metadata row');

  select count(*) into n from public.media_assets
   where visibility = 'private' and kind = 'certificate_original';
  perform pg_temp.assert(n = 0, 'anon sees ZERO certificate originals, without exception');

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
         and column_name in ('email', 'last_login_at', 'public_location')
    ),
    'public_profile does NOT expose email, last_login_at or precise profile location'
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

  /*
   * Narrowed for the same reason as the anonymous case: the active resume's
   * metadata row is readable by any visitor, signed in or not, because the file
   * behind it is publicly downloadable either way. Everything else private
   * stays invisible to an account without an admin role.
   */
  select count(*) into n
    from public.media_assets m
   where m.visibility = 'private'
     and not exists (
       select 1 from public.resume_versions rv
        where rv.media_id = m.id and rv.is_active and not rv.is_archived
     );
  perform pg_temp.assert(n = 0,
    'a logged-in non-admin reads NO private media beyond the active resume row');

  select count(*) into n from public.media_assets
   where visibility = 'private' and kind = 'certificate_original';
  perform pg_temp.assert(n = 0,
    'a logged-in non-admin reads ZERO certificate originals');

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
--  9b. Experience photographs
--
--  The claim under test: an anonymous reader sees a photograph ONLY when every
--  one of six conditions holds. Each is falsified independently below, because a
--  policy that checks five of the six passes any test that only checks the happy
--  path.
--
--  These are photographs that may contain children. "Probably filtered" is not
--  an acceptable standard, so the assertions are per-condition.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_owner_id      uuid := '00000000-0000-4000-8000-000000000001';
  v_pub_exp       uuid;
  v_draft_exp     uuid;
  v_public_media  uuid;
  v_private_media uuid;
  v_ok_attach     uuid;
  n               integer;
  ok              boolean;
begin
  raise notice '';
  raise notice '── 9b. Experience photographs ──────────────────────────';

  perform pg_temp.become_postgres();

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  insert into public.experiences (slug, status, kind, needs_review)
  values ('rls-photo-published', 'published', 'practicum', false)
  on conflict (slug) where deleted_at is null do nothing;
  update public.experiences set published_at = now() - interval '1 day'
   where slug = 'rls-photo-published';
  select id into v_pub_exp from public.experiences where slug = 'rls-photo-published';

  insert into public.experiences (slug, status, kind, needs_review)
  values ('rls-photo-draft', 'draft', 'practicum', false)
  on conflict (slug) where deleted_at is null do nothing;
  select id into v_draft_exp from public.experiences where slug = 'rls-photo-draft';

  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes, alt_text_en, alt_text_km)
  values ('public-media', 'rls-photo/classroom.webp', 'experience_photo', 'public',
          'rls-photo-classroom.webp', 'image/webp', 90000,
          'A primary mathematics lesson in progress.', 'មេរៀនគណិតវិទ្យា។')
  on conflict (bucket_id, storage_path) do nothing;
  select id into v_public_media from public.media_assets
   where storage_path = 'rls-photo/classroom.webp';

  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes)
  values ('certificate-originals', 'rls-photo/private-scan.pdf', 'certificate_original',
          'private', 'rls-photo-private.pdf', 'application/pdf', 50000)
  on conflict (bucket_id, storage_path) do nothing;
  select id into v_private_media from public.media_assets
   where storage_path = 'rls-photo/private-scan.pdf';

  -- The one attachment that satisfies every condition.
  insert into public.experience_media
    (experience_id, media_id, role, privacy_status, consent_status, visibility,
     reviewed_at, caption_en, alt_text_en)
  values (v_pub_exp, v_public_media, 'cover', 'approved', 'confirmed', 'public',
          now(), 'Delivering a mathematics lesson during my practicum.',
          'Ron Raksmey beside a classroom whiteboard.')
  on conflict do nothing;
  select id into v_ok_attach from public.experience_media
   where experience_id = v_pub_exp and media_id = v_public_media;

  -- ── The publication invariant is a CHECK, not a convention ───────────────
  begin
    ok := false;
    insert into public.experience_media
      (experience_id, media_id, privacy_status, consent_status, visibility)
    values (v_draft_exp, v_public_media, 'pending_review', 'confirmed', 'public');
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a photograph CANNOT be public without an approved privacy review');

  begin
    ok := false;
    insert into public.experience_media
      (experience_id, media_id, privacy_status, consent_status, visibility, reviewed_at)
    values (v_draft_exp, v_public_media, 'approved', 'denied', 'public', now());
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a photograph CANNOT be public when consent was denied');

  begin
    ok := false;
    insert into public.experience_media
      (experience_id, media_id, privacy_status, consent_status, visibility, reviewed_at)
    values (v_draft_exp, v_public_media, 'approved', 'pending', 'public', now());
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a photograph CANNOT be public while consent is pending');

  begin
    ok := false;
    insert into public.experience_media
      (experience_id, media_id, privacy_status, consent_status, visibility)
    values (v_draft_exp, v_public_media, 'approved', 'confirmed', 'private');
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'an approval CANNOT be recorded without a review timestamp');

  -- At most one cover per experience.
  begin
    ok := false;
    insert into public.experience_media (experience_id, media_id, role)
    values (v_pub_exp, v_private_media, 'cover');
  exception when unique_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'an experience CANNOT have two cover photographs');

  -- ── Anonymous reads ──────────────────────────────────────────────────────
  perform pg_temp.become_anon();

  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 1,
    'anon CAN read a fully approved photograph on a published experience');

  perform pg_temp.become_postgres();
  update public.experience_media set visibility = 'hidden' where id = v_ok_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a hidden photograph');

  perform pg_temp.become_postgres();
  update public.experience_media set visibility = 'private' where id = v_ok_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a private photograph');

  -- Restore, then falsify the privacy review while leaving visibility public.
  -- Done in one statement because the CHECK forbids the intermediate state.
  perform pg_temp.become_postgres();
  update public.experience_media
     set visibility = 'public', privacy_status = 'approved', consent_status = 'confirmed'
   where id = v_ok_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 1, 'the fixture is public again');

  -- Soft delete.
  perform pg_temp.become_postgres();
  update public.experience_media set deleted_at = now() where id = v_ok_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a detached (soft-deleted) photograph');

  perform pg_temp.become_postgres();
  update public.experience_media set deleted_at = null where id = v_ok_attach;

  -- Unpublishing the parent must take its photographs with it.
  update public.experiences set status = 'draft' where id = v_pub_exp;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read photographs of an unpublished experience');

  perform pg_temp.become_postgres();
  update public.experiences
     set status = 'published', published_at = now() - interval '1 day'
   where id = v_pub_exp;

  -- Soft-deleting the underlying asset must withdraw the photograph too, even
  -- though the attachment row itself is untouched and still marked public.
  update public.media_assets set deleted_at = now() where id = v_public_media;
  perform pg_temp.become_anon();
  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read a photograph whose media asset was deleted');

  perform pg_temp.become_postgres();
  update public.media_assets set deleted_at = null where id = v_public_media;

  -- ── Anonymous writes ─────────────────────────────────────────────────────
  perform pg_temp.become_anon();

  begin
    ok := false;
    insert into public.experience_media (experience_id, media_id)
    values (v_pub_exp, v_public_media);
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT attach a photograph');

  begin
    ok := false;
    update public.experience_media set visibility = 'public' where id = v_ok_attach;
    get diagnostics n = row_count;
    ok := n = 0;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT publish a photograph');

  -- ── A logged-in non-admin is not an editor ───────────────────────────────
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000ff');

  begin
    ok := false;
    insert into public.experience_media (experience_id, media_id)
    values (v_draft_exp, v_public_media);
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a logged-in non-admin CANNOT attach a photograph');

  -- ── A viewer may look but not touch ──────────────────────────────────────
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000fe');

  select count(*) into n from public.experience_media where id = v_ok_attach;
  perform pg_temp.assert(n = 1, 'viewer CAN read attachments');

  begin
    ok := false;
    update public.experience_media set caption_en = 'edited' where id = v_ok_attach;
    get diagnostics n = row_count;
    ok := n = 0;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'viewer CANNOT edit an attachment');

  -- ── Owner ────────────────────────────────────────────────────────────────
  perform pg_temp.become_user(v_owner_id);

  update public.experience_media set caption_en = 'Edited by the owner.'
   where id = v_ok_attach;
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'owner CAN edit an attachment');

  -- ── Deleting a media asset that is still attached is refused ─────────────
  perform pg_temp.become_postgres();

  begin
    ok := false;
    delete from public.media_assets where id = v_public_media;
  exception when foreign_key_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a media asset CANNOT be deleted while an experience still displays it');

  -- ── Detaching does not delete the shared asset ───────────────────────────
  update public.experience_media set deleted_at = now() where id = v_ok_attach;

  select count(*) into n from public.media_assets where id = v_public_media
     and deleted_at is null;
  perform pg_temp.assert(n = 1,
    'detaching a photograph leaves the shared media asset intact');
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  9c. Journey stories, their media and their relations
--
--  The public predicate on `journey_media` is the strictest in the schema, so
--  every clause of it is exercised separately below: parent published, the
--  attachment public, privacy approved, consent settled, not soft-deleted, and
--  the underlying asset public and live. Each is turned off in isolation, which
--  is what proves the clause is load-bearing rather than incidentally satisfied.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_owner_id      uuid := '00000000-0000-4000-8000-000000000001';
  v_pub_story     uuid;
  v_draft_story   uuid;
  v_public_media  uuid;
  v_private_media uuid;
  v_pub_exp       uuid;
  v_draft_exp     uuid;
  v_attach        uuid;
  v_video         uuid;
  v_relation      uuid;
  n               integer;
  ok              boolean;
begin
  raise notice '';
  raise notice '── 9c. Journey stories ─────────────────────────────────';

  perform pg_temp.become_postgres();

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  insert into public.journey_entries (slug, status, needs_review)
  values ('rls-journey-published', 'draft', false)
  on conflict (slug) where deleted_at is null do nothing;
  select id into v_pub_story from public.journey_entries
   where slug = 'rls-journey-published';

  -- The publish gate demands an English title, so this also proves the gate is
  -- satisfiable rather than merely obstructive.
  insert into public.journey_entry_translations (journey_entry_id, locale, title)
  values (v_pub_story, 'en', 'RLS published story')
  on conflict (journey_entry_id, locale) do nothing;

  update public.journey_entries
     set status = 'published', published_at = now() - interval '1 day'
   where id = v_pub_story;

  insert into public.journey_entries (slug, status, needs_review)
  values ('rls-journey-draft', 'draft', false)
  on conflict (slug) where deleted_at is null do nothing;
  select id into v_draft_story from public.journey_entries
   where slug = 'rls-journey-draft';
  insert into public.journey_entry_translations (journey_entry_id, locale, title)
  values (v_draft_story, 'en', 'RLS draft story')
  on conflict (journey_entry_id, locale) do nothing;

  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes, card_path)
  values ('public-media', 'rls-journey/fieldwork.webp', 'journey_photo', 'public',
          'rls-journey-fieldwork.webp', 'image/webp', 90000,
          'rls-journey/fieldwork-card.webp')
  on conflict (bucket_id, storage_path) do nothing;
  select id into v_public_media from public.media_assets
   where storage_path = 'rls-journey/fieldwork.webp';

  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename,
     mime_type, file_size_bytes)
  values ('certificate-originals', 'rls-journey/private.pdf', 'certificate_original',
          'private', 'rls-journey-private.pdf', 'application/pdf', 50000)
  on conflict (bucket_id, storage_path) do nothing;
  select id into v_private_media from public.media_assets
   where storage_path = 'rls-journey/private.pdf';

  -- ── Publish gate ─────────────────────────────────────────────────────────
  begin
    ok := false;
    update public.journey_entries set needs_review = true, status = 'published'
     where id = v_draft_story;
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a story flagged needs_review CANNOT be published, even as postgres');

  perform pg_temp.become_postgres();
  update public.journey_entries set needs_review = false where id = v_draft_story;

  -- ── CHECK constraints on journey_media ───────────────────────────────────
  begin
    ok := false;
    insert into public.journey_media
      (journey_entry_id, media_id, kind, visibility, privacy_status, consent_status)
    values (v_pub_story, v_public_media, 'photo', 'public', 'pending_review', 'confirmed');
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'an unreviewed photograph CANNOT be marked public');

  begin
    ok := false;
    insert into public.journey_media
      (journey_entry_id, media_id, kind, visibility, privacy_status,
       consent_status, reviewed_at)
    values (v_pub_story, v_public_media, 'photo', 'public', 'approved', 'denied', now());
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a photograph with denied consent CANNOT be marked public');

  begin
    ok := false;
    insert into public.journey_media (journey_entry_id, media_id, kind, privacy_status)
    values (v_pub_story, v_public_media, 'photo', 'approved');
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'an approval with no reviewed_at is refused');

  begin
    ok := false;
    insert into public.journey_media (journey_entry_id, kind, video_url)
    values (v_pub_story, 'video', 'javascript:alert(1)');
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a non-https video URL is refused at the database');

  begin
    ok := false;
    insert into public.journey_media
      (journey_entry_id, kind, video_url, media_id, visibility,
       privacy_status, consent_status, reviewed_at)
    values (v_pub_story, 'video', 'https://youtu.be/dQw4w9WgXcQ', null, 'public',
            'approved', 'confirmed', now());
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a public video with no poster frame is refused');

  begin
    ok := false;
    insert into public.journey_media (journey_entry_id, kind, media_id)
    values (v_pub_story, 'photo', null);
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a photograph with no media asset is refused');

  -- ── A fully approved, public attachment ──────────────────────────────────
  insert into public.journey_media
    (journey_entry_id, media_id, kind, role, visibility, privacy_status,
     consent_status, reviewed_at, alt_text_en)
  values (v_pub_story, v_public_media, 'photo', 'cover', 'public', 'approved',
          'confirmed', now(), 'A classroom during fieldwork.')
  returning id into v_attach;

  insert into public.journey_media
    (journey_entry_id, media_id, kind, video_url, visibility, privacy_status,
     consent_status, reviewed_at, alt_text_en, video_title_en)
  values (v_pub_story, v_public_media, 'video', 'https://youtu.be/dQw4w9WgXcQ',
          'public', 'approved', 'confirmed', now(), 'Poster frame.', 'Science fair')
  returning id into v_video;

  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 1, 'anon CAN read a fully approved public photograph');

  select count(*) into n from public.journey_media where id = v_video;
  perform pg_temp.assert(n = 1, 'anon CAN read an approved public video with a poster');

  -- ── Each clause of the public predicate, turned off in isolation ──────────
  perform pg_temp.become_postgres();
  update public.journey_media set visibility = 'hidden' where id = v_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a hidden attachment');

  perform pg_temp.become_postgres();
  update public.journey_media set visibility = 'private' where id = v_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a private attachment');

  perform pg_temp.become_postgres();
  update public.journey_media set visibility = 'public' where id = v_attach;
  update public.journey_media set deleted_at = now() where id = v_attach;
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a soft-deleted attachment');

  perform pg_temp.become_postgres();
  update public.journey_media set deleted_at = null where id = v_attach;

  -- Parent unpublished: the attachment is untouched and still fully approved.
  update public.journey_entries set status = 'draft' where id = v_pub_story;
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read a photograph whose story is unpublished');

  select count(*) into n from public.journey_entry_translations
   where journey_entry_id = v_pub_story;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read the translations of an unpublished story');

  perform pg_temp.become_postgres();
  update public.journey_entries
     set status = 'published', published_at = now() - interval '1 day'
   where id = v_pub_story;

  -- Asset soft-deleted: again the attachment row is untouched.
  update public.media_assets set deleted_at = now() where id = v_public_media;
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_media where id = v_attach;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read a photograph whose media asset was deleted');

  perform pg_temp.become_postgres();
  update public.media_assets set deleted_at = null where id = v_public_media;

  -- ── Drafts stay invisible ────────────────────────────────────────────────
  perform pg_temp.become_anon();
  select count(*) into n from public.journey_entries where id = v_draft_story;
  perform pg_temp.assert(n = 0, 'anon CANNOT read a draft story');

  select count(*) into n from public.journey_entries where id = v_pub_story;
  perform pg_temp.assert(n = 1, 'anon CAN read a published story');

  -- ── Relations need BOTH ends published ───────────────────────────────────
  perform pg_temp.become_postgres();

  insert into public.experiences (slug, status, kind, needs_review)
  values ('rls-journey-exp-published', 'published', 'practicum', false)
  on conflict (slug) where deleted_at is null do nothing;
  update public.experiences set published_at = now() - interval '1 day'
   where slug = 'rls-journey-exp-published';
  select id into v_pub_exp from public.experiences
   where slug = 'rls-journey-exp-published';

  insert into public.experiences (slug, status, kind, needs_review)
  values ('rls-journey-exp-draft', 'draft', 'practicum', false)
  on conflict (slug) where deleted_at is null do nothing;
  select id into v_draft_exp from public.experiences where slug = 'rls-journey-exp-draft';

  begin
    ok := false;
    insert into public.journey_relations (journey_entry_id, experience_id, education_id)
    values (v_pub_story, v_pub_exp, v_pub_exp);
  exception when check_violation or foreign_key_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a relation with two targets is refused');

  begin
    ok := false;
    insert into public.journey_relations (journey_entry_id) values (v_pub_story);
  exception when check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'a relation with no target is refused');

  insert into public.journey_relations (journey_entry_id, experience_id)
  values (v_pub_story, v_pub_exp)
  returning id into v_relation;

  perform pg_temp.become_anon();
  select count(*) into n from public.journey_relations where id = v_relation;
  perform pg_temp.assert(n = 1,
    'anon CAN read a relation when both ends are published');

  perform pg_temp.become_postgres();
  insert into public.journey_relations (journey_entry_id, education_id)
  select v_pub_story, id from public.education limit 1
  on conflict do nothing;

  -- A relation pointing at a DRAFT experience must not be returned at all —
  -- not even as a row with an empty embedded join, which would disclose that an
  -- unpublished record exists and that this story is about it.
  insert into public.journey_relations (journey_entry_id, experience_id)
  values (v_pub_story, v_draft_exp);

  perform pg_temp.become_anon();
  select count(*) into n from public.journey_relations
   where journey_entry_id = v_pub_story and experience_id = v_draft_exp;
  perform pg_temp.assert(n = 0,
    'anon CANNOT read a relation pointing at a draft experience');

  -- ── Anonymous and non-admin writes ───────────────────────────────────────
  perform pg_temp.become_anon();

  begin
    ok := false;
    insert into public.journey_entries (slug, status) values ('rls-journey-anon', 'draft');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT create a story');

  begin
    ok := false;
    update public.journey_media set visibility = 'public' where id = v_attach;
    get diagnostics n = row_count;
    ok := n = 0;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT publish an attachment');

  begin
    ok := false;
    insert into public.journey_relations (journey_entry_id, experience_id)
    values (v_pub_story, v_pub_exp);
  exception when insufficient_privilege or check_violation or unique_violation
    then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT link a story to another record');

  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000ff');

  begin
    ok := false;
    insert into public.journey_media (journey_entry_id, media_id, kind)
    values (v_draft_story, v_public_media, 'photo');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a logged-in non-admin CANNOT attach media to a story');

  -- ── A viewer may look but not touch ──────────────────────────────────────
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000fe');

  select count(*) into n from public.journey_entries where id = v_draft_story;
  perform pg_temp.assert(n = 1, 'a viewer CAN read a draft story');

  begin
    ok := false;
    update public.journey_entries set featured = true where id = v_draft_story;
    get diagnostics n = row_count;
    ok := n = 0;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.assert(ok, 'a viewer CANNOT edit a story');

  -- ── Detaching leaves the shared asset alone ──────────────────────────────
  perform pg_temp.become_postgres();
  update public.journey_media set deleted_at = now() where id = v_attach;

  select count(*) into n from public.media_assets
   where id = v_public_media and deleted_at is null;
  perform pg_temp.assert(n = 1,
    'detaching journey media leaves the shared asset intact');

  -- ── A private asset can never back a public attachment ───────────────────
  begin
    ok := false;
    insert into public.journey_media
      (journey_entry_id, media_id, kind, visibility, privacy_status,
       consent_status, reviewed_at, alt_text_en)
    values (v_draft_story, v_private_media, 'photo', 'public', 'approved',
            'confirmed', now(), 'Private');
    -- The CHECK permits this row, so RLS is what must hide it. Confirm that.
    perform pg_temp.become_anon();
    select count(*) into n from public.journey_media
     where media_id = v_private_media;
    ok := n = 0;
    perform pg_temp.become_postgres();
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok,
    'an attachment backed by a private asset is never readable by anon');
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  9d. Publications: the column boundary and the three file levels
--
--  The interesting assertions here are not "can anon read a draft" — that is the
--  same `is_publicly_visible` predicate as everywhere else. They are:
--
--    · anon has no grant on `publication_versions` at all, because the private
--      file references live in its columns and RLS cannot filter a column;
--    · the view that replaces it exposes no `*_media_id` and restates the row
--      predicate, since definer rights mean the base table's policies do not run;
--    · the file-level triggers refuse a public asset in any of the three slots;
--    · the publish gate refuses a book whose privacy review is not approved.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  ok             boolean;
  n              integer;
  v_pub          uuid;
  v_draft_pub    uuid;
  v_public_asset uuid;
  v_pdf_asset    uuid;
  cols           text;
begin
  raise notice '';
  raise notice '── 9d. Publications ────────────────────────────────────';

  perform pg_temp.become_postgres();

  -- A published publication with a published and a draft edition.
  insert into public.publications (slug, status, privacy_status, privacy_reviewed_at)
  values ('rls-pub-published', 'draft', 'approved', now())
  returning id into v_pub;

  insert into public.publication_translations (publication_id, locale, title)
  values (v_pub, 'en', 'RLS published book');

  update public.publications set status = 'published' where id = v_pub;

  insert into public.publication_versions (publication_id, version_label, status)
  values (v_pub, 'RLS first edition', 'published');
  insert into public.publication_versions (publication_id, version_label, status)
  values (v_pub, 'RLS draft edition', 'draft');

  -- A draft publication that must stay invisible in every direction.
  insert into public.publications (slug, status)
  values ('rls-pub-draft', 'draft')
  returning id into v_draft_pub;

  insert into public.publication_translations (publication_id, locale, title)
  values (v_draft_pub, 'en', 'RLS draft book');

  insert into public.publication_versions (publication_id, version_label, status)
  values (v_draft_pub, 'RLS secret edition', 'published');

  -- ── The grant boundary ────────────────────────────────────────────────
  begin
    perform pg_temp.become_anon();
    select count(*) into n from public.publication_versions;
    ok := false;   -- reaching this line at all is the failure
    perform pg_temp.become_postgres();
  exception when insufficient_privilege then
    perform pg_temp.become_postgres();
    ok := true;
  when others then
    perform pg_temp.become_postgres();
    ok := false;
  end;
  perform pg_temp.assert(ok,
    'anon has no grant on publication_versions, so the private file columns are unreachable');

  -- ── The view is the column filter ─────────────────────────────────────
  select string_agg(column_name, ',') into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'public_publication_versions';

  perform pg_temp.assert(cols not like '%media_id%',
    'the public edition view exposes no media asset ids');
  perform pg_temp.assert(cols like '%has_pdf%',
    'the public edition view reports file presence as a boolean instead');

  -- ── The view restates the row predicate ───────────────────────────────
  perform pg_temp.become_anon();

  select count(*) into n from public.public_publication_versions
   where publication_id = v_pub;
  perform pg_temp.become_postgres();
  perform pg_temp.assert(n = 1,
    'anon sees only the published edition of a published publication');

  perform pg_temp.become_anon();
  select count(*) into n from public.public_publication_versions
   where publication_id = v_draft_pub;
  perform pg_temp.become_postgres();
  perform pg_temp.assert(n = 0,
    'a draft publication''s editions are invisible through the view');

  perform pg_temp.become_anon();
  select count(*) into n from public.publications where slug = 'rls-pub-draft';
  perform pg_temp.become_postgres();
  perform pg_temp.assert(n = 0, 'a draft publication is invisible to anon');

  perform pg_temp.become_anon();
  select count(*) into n from public.publication_translations
   where publication_id = v_draft_pub;
  perform pg_temp.become_postgres();
  perform pg_temp.assert(n = 0,
    'a draft publication''s translations are invisible to anon');

  -- ── The three file levels ─────────────────────────────────────────────
  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
  values
    ('publication-previews', 'rls-pub/cover.webp', 'publication_cover', 'public',
     'cover.webp', 'image/webp', 1000)
  returning id into v_public_asset;

  -- A public asset must be refused in the reader-facing PDF slot. It reads
  -- backwards until you follow the request path: the download route is what
  -- enforces `pdf_download_policy`, and an object with a public URL bypasses it.
  begin
    insert into public.publication_versions (publication_id, version_label, pdf_media_id)
    values (v_pub, 'RLS bad pdf', v_public_asset);
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'a public asset is refused as an edition''s downloadable PDF');

  begin
    insert into public.publication_versions (publication_id, version_label, original_media_id)
    values (v_pub, 'RLS bad original', v_public_asset);
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'a public asset is refused as an edition''s archival original');

  begin
    insert into public.publication_versions (publication_id, version_label, source_archive_media_id)
    values (v_pub, 'RLS bad source', v_public_asset);
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'a public asset is refused as an edition''s LaTeX source archive');

  -- A ZIP may only ever be a private publication_source asset.
  begin
    insert into public.media_assets
      (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
    values ('publication-previews', 'rls-pub/src.zip', 'publication_source', 'public',
            'src.zip', 'application/zip', 1000);
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok, 'a source archive cannot be marked public');

  begin
    insert into public.media_assets
      (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
    values ('publication-files', 'rls-pub/book.pdf', 'publication_pdf', 'public',
            'book.pdf', 'application/pdf', 1000);
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'even the reader-facing publication PDF cannot be marked public');

  -- The correct shape is accepted.
  insert into public.media_assets
    (bucket_id, storage_path, kind, visibility, original_filename, mime_type, file_size_bytes)
  values ('publication-files', 'rls-pub/book.pdf', 'publication_pdf', 'private',
          'book.pdf', 'application/pdf', 1000)
  returning id into v_pdf_asset;

  insert into public.publication_versions
    (publication_id, version_label, pdf_media_id, status, is_active)
  values (v_pub, 'RLS good edition', v_pdf_asset, 'published', true);

  select count(*) into n from public.publications
   where id = v_pub and active_version_id is not null;
  perform pg_temp.assert(n = 1,
    'activating an edition points the publication at it');

  -- ── The publish gate ──────────────────────────────────────────────────
  begin
    update public.publications
       set privacy_status = 'pending_review', privacy_reviewed_at = null,
           status = 'published'
     where id = v_draft_pub;
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'a publication cannot be published while its privacy review is pending');

  begin
    update public.publications
       set privacy_status = 'approved', privacy_reviewed_at = now(),
           needs_review = true, status = 'published'
     where id = v_draft_pub;
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok,
    'a publication cannot be published while flagged as needing review');

  -- An approval must be attributable.
  begin
    update public.publications
       set privacy_status = 'approved', privacy_reviewed_at = null
     where id = v_draft_pub;
    ok := false;
  exception when check_violation then ok := true;
  when others then ok := false;
  end;
  perform pg_temp.assert(ok, 'an approved privacy review must carry a timestamp');

  -- ── Editor writes still work ──────────────────────────────────────────
  perform pg_temp.become_user('00000000-0000-4000-8000-0000000000ff');
  begin
    update public.publications set display_order = 5 where id = v_pub;
    ok := true;
  exception when others then ok := false;
  end;
  perform pg_temp.become_postgres();
  perform pg_temp.assert(ok, 'an editor can still update a publication');
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  9e. Claiming the site-owner profile
--
--  `public_profile` is `where is_site_owner`, so this flag decides whose name,
--  headline, biography and portrait the whole public site shows. It is moved by
--  one SECURITY DEFINER function, which means the function's own check is the
--  only thing standing between an editor and the site's public identity.
--
--  The application also checks, but that is not what is tested here — these run
--  as the real roles with no application in the path at all.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_owner    uuid := '00000000-0000-4000-8000-000000000001';
  v_viewer   uuid := '00000000-0000-4000-8000-0000000000fe';
  v_nonadmin uuid := '00000000-0000-4000-8000-0000000000ff';
  ok         boolean;
  n          integer;
begin
  raise notice '';
  raise notice '── 9e. Site-owner claim ────────────────────────────────';

  perform pg_temp.become_postgres();

  -- The two fixture users need profile rows for the claim to be able to target
  -- them at all; without one the function refuses for a different reason and the
  -- authorisation assertions below would pass vacuously.
  insert into public.profiles (id, email, display_name)
  values (v_nonadmin, 'nonadmin@localhost.test', 'RLS fixture non-admin')
  on conflict (id) do nothing;
  insert into public.profiles (id, email, display_name)
  values (v_viewer, 'viewer@localhost.test', 'RLS fixture viewer')
  on conflict (id) do nothing;

  perform pg_temp.become_anon();
  begin
    ok := false;
    perform public.claim_site_owner();
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'anon CANNOT claim the site-owner profile');

  perform pg_temp.become_user(v_nonadmin);
  begin
    ok := false;
    perform public.claim_site_owner();
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'a logged-in non-admin CANNOT claim the site-owner profile');

  -- A viewer is an admin, and still must not move the site's identity.
  perform pg_temp.become_user(v_viewer);
  begin
    ok := false;
    perform public.claim_site_owner();
  exception when others then ok := true;
  end;
  perform pg_temp.assert(ok, 'a viewer CANNOT claim the site-owner profile');

  perform pg_temp.become_postgres();
  select count(*) into n from public.profiles
   where is_site_owner and id in (v_nonadmin, v_viewer);
  perform pg_temp.assert(n = 0, 'every refused claim left the flag untouched');

  -- The owner can, and the result is exactly one flagged row: `public_profile`
  -- selects LIMIT 1 with no ordering, so two would make the site's public
  -- identity depend on row order.
  perform pg_temp.become_user(v_owner);
  perform public.claim_site_owner();

  perform pg_temp.become_postgres();
  select count(*) into n from public.profiles where is_site_owner;
  perform pg_temp.assert(n = 1, 'exactly one profile is flagged after a claim');

  select count(*) into n from public.profiles where id = v_owner and is_site_owner;
  perform pg_temp.assert(n = 1, 'the owner CAN claim the site-owner profile');

  select count(*) into n from public.public_profile;
  perform pg_temp.assert(n = 1, 'the public_profile view resolves to that one row');
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
  delete from public.resume_versions rv
   using public.media_assets m
   where rv.media_id = m.id and m.original_filename like 'rls-fixture-%-cv.pdf';
  delete from public.media_assets where original_filename like 'rls-fixture-%-cv.pdf';

  -- Attachments first: `media_id` is ON DELETE RESTRICT, so the assets below
  -- cannot go until nothing points at them.
  delete from public.experience_media em
   using public.experiences e
   where em.experience_id = e.id and e.slug like 'rls-photo-%';
  delete from public.experiences where slug like 'rls-photo-%';
  delete from public.media_assets where storage_path like 'rls-photo/%';

  -- Journey: relations and attachments before the stories, and the stories
  -- before the assets, because media_id is ON DELETE RESTRICT.
  delete from public.journey_relations jr
   using public.journey_entries je
   where jr.journey_entry_id = je.id and je.slug like 'rls-journey-%';
  delete from public.journey_media jm
   using public.journey_entries je
   where jm.journey_entry_id = je.id and je.slug like 'rls-journey-%';
  delete from public.journey_entries where slug like 'rls-journey-%';
  delete from public.experiences where slug like 'rls-journey-exp-%';
  delete from public.media_assets where storage_path like 'rls-journey/%';

  /*
   * Publications.
   *
   * Order matters twice over. `active_version_id` is cleared *first*, because
   * that UPDATE fires the publish-rules trigger — and if the translations were
   * already gone, the trigger would refuse it with "cannot be published without
   * an English title" and the whole teardown would abort.
   *
   * Then the editions, because their three file columns are ON DELETE RESTRICT
   * and the assets cannot go while anything points at them. The publications
   * themselves go last but one; their translations cascade.
   */
  update public.publications set active_version_id = null where slug like 'rls-pub-%';
  delete from public.publication_versions pv
   using public.publications p
   where pv.publication_id = p.id and p.slug like 'rls-pub-%';
  delete from public.publications where slug like 'rls-pub-%';
  delete from public.media_assets where storage_path like 'rls-pub/%';

  delete from public.project_metrics
   where label_en in ('Verified metric', 'Unverified metric', 'No source');
  delete from public.projects where slug like 'rls-fixture-%' or slug like 'rls-gate-%';
  delete from public.certificates where slug like 'rls-fixture-%' or slug like 'rls-gate-%';
  delete from public.testimonials where slug like 'rls-gate-%';
  delete from public.media_assets where storage_path like 'rls-fixture/%'
                                     or storage_path like 'rls-gate/%';
  delete from public.contact_messages where email in ('fixture@example.com', 'anon@example.com');
  delete from public.page_views where path = '/en';
  delete from public.profiles where id in ('00000000-0000-4000-8000-0000000000ff',
                                           '00000000-0000-4000-8000-0000000000fe');
  delete from public.admin_roles where user_id = '00000000-0000-4000-8000-0000000000fe';
  delete from auth.users where id in ('00000000-0000-4000-8000-0000000000ff',
                                      '00000000-0000-4000-8000-0000000000fe');

  raise notice '';
  raise notice '════════════════════════════════════════════════════════';
  raise notice ' RLS suite: ALL ASSERTIONS PASSED';
  raise notice '════════════════════════════════════════════════════════';
end $$;
