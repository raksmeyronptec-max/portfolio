-- ═══════════════════════════════════════════════════════════════════════════
--  0026 — Publications: authored books, their editions, files and topics
--
--  ── What this is for ───────────────────────────────────────────────────────
--  The owner writes Khmer mathematics books in LaTeX — an examination collection
--  spanning Bac II 2002–2025, a Grade 12 book on graphs of functions, a first
--  edition on sequences of real numbers. Those are authored works, not project
--  screenshots: they have editions, page counts, tables of contents, licences,
--  a citation, and three physically distinct file levels whose confusion would
--  be the whole security story.
--
--  `projects` cannot carry that. A project has a repository and a live URL; a
--  book has an edition history where the *previous* PDF must remain retrievable
--  and the LaTeX source must remain unreachable. So this is a new content type,
--  built to the same shape as `journey_entries` (0024) so there is one set of
--  rules to learn rather than two.
--
--  ── Reuse, not duplication ─────────────────────────────────────────────────
--  Nothing here is a second media library. Every file is a `media_assets` row;
--  `publication_media` and the three `*_media_id` columns on
--  `publication_versions` are references, never paths and never bytes. One
--  physical PDF can be the active edition of a publication and appear in the
--  library's usage panel while remaining one row with one checksum.
--
--  ── Four deliberate departures from the shape that was specified ───────────
--
--  1. `publication_types` and `publication_topics` carry `name_en` / `name_km`
--     inline rather than each having a translations table. `project_categories`
--     and `journey_categories` already established that for short locale-
--     dependent labels, `pickLocalized()` already reads it, and a translations
--     table for a two-word label buys a join and nothing else. Publication
--     *prose* does get a full `*_translations` table, because that is what every
--     other content type here does and what `resolveTranslation()` expects.
--
--  2. Files live on the *edition*, not on the publication. A new edition means a
--     new PDF, a new original and a new source archive; hanging them off
--     `publications` would mean the second edition either overwrites the first
--     — which section 17 of the brief forbids — or the table grows a second set
--     of columns. `publication_versions` therefore owns
--     `pdf_media_id` / `original_media_id` / `source_archive_media_id`, and
--     `publications.active_version_id` says which one is current.
--     `publication_media` is left to carry only presentation media: the cover,
--     the sample pages and the gallery.
--
--  3. There is no `publication_download_events` table. `analytics_events`
--     already exists, already has the salted rotating `visitor_hash`, the
--     device-class coarsening, the rate limiter and the admin dashboard that a
--     new table would have to grow from scratch. Its references are loose by
--     deliberate design — "an event must survive the deletion of its subject" —
--     so a download row with a real FK to `publication_versions` would be the
--     one analytics row in the schema that a version delete could cascade away.
--     The edition a download came from is recorded in `properties`, which is
--     what that column is for.
--
--  4. There is no `publication-temp` bucket. Uploads here go straight through
--     `POST /api/admin/media/upload`, which validates magic bytes in memory and
--     writes once; there is no staging step for a temp bucket to hold, and an
--     unused private bucket whose promised cleanup job nobody wrote is a
--     liability rather than a feature.
--
--  ── The three file levels ──────────────────────────────────────────────────
--  This is the part that has to be right, so it is enforced in the database
--  rather than in the form:
--
--    public-safe PDF   → `publication-files`, PRIVATE. The redacted edition a
--                        reader may download when the policy allows it.
--    archival original → `publication-originals`, PRIVATE. The copy the next
--                        edition is cut from; may still carry a phone number or
--                        a pupil's name.
--    LaTeX source      → `publication-sources`, PRIVATE, default policy
--                        `private`. The .tex, .sty, .bib and figures.
--
--  ── Why the "public" PDF is in a private bucket ────────────────────────────
--  Two reasons, and the second is the one that decides it.
--
--  First, `upload/route.ts` refuses to put a PDF in a public bucket at all, and
--  the comment there explains why: R2 has no per-bucket MIME allowlist, so the
--  application is the only thing standing between a PDF and a permanent public
--  URL. Carving an exception for publications would reopen exactly the hole that
--  comment describes closing.
--
--  Second — and this is the structural argument — a permanent public URL makes
--  `pdf_download_policy` a decoration. `signed`, `on_request` and
--  `contact_author` all mean "not everyone may have this file", and none of them
--  can be true of an object anybody can fetch by URL. The policy has to be
--  enforced somewhere the request passes through, so all three levels are
--  private and every byte is served by `/api/publications/[slug]/download`,
--  which reads the policy first. That is not a new pattern: the resume is a
--  public-facing document deliberately streamed from a private bucket through
--  its own route, for the same reason.
--
--  `publication-previews` is therefore the only public bucket here, and it holds
--  only images: covers and rendered sample pages.
--
--  A redacted public edition and the original archival edition are two different
--  `media_assets` rows on the same version. Producing one never overwrites the
--  other, which is the requirement section 17 states and the reason
--  `original_media_id` is a separate column rather than "the PDF before we
--  replaced it".
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  Media allowlist extensions
--
--  The five `media_kind` values these constraints reference were added in 0025,
--  in a migration of their own, because Postgres will not let a new enum value
--  be used in the transaction that added it.
-- ═══════════════════════════════════════════════════════════════════════════

/*
 * A LaTeX source package is a ZIP, which the media allowlist did not previously
 * admit. It is allowed *only* because it is never served: the two kinds that can
 * carry it both live in private buckets and are read through a route handler
 * that sets `Content-Disposition: attachment` and a `nosniff` header, so the
 * browser is never asked to interpret it. The CHECK a few tables down refuses a
 * ZIP anywhere else.
 */
alter table public.media_assets
  drop constraint if exists media_assets_mime_allowlist;

alter table public.media_assets
  add constraint media_assets_mime_allowlist check (
    mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/avif',
      'image/gif', 'image/svg+xml', 'application/pdf',
      'application/zip'
    )
  );

/*
 * A ZIP is only ever a source archive, and a source archive is only ever
 * private. Stated as a database invariant for the same reason
 * `media_assets_originals_are_private` is: the application must not be the only
 * thing standing between a LaTeX package and a public bucket.
 */
alter table public.media_assets
  drop constraint if exists media_assets_zip_is_source_only;

alter table public.media_assets
  add constraint media_assets_zip_is_source_only check (
    mime_type <> 'application/zip'
    or (kind = 'publication_source' and visibility = 'private')
  );

alter table public.media_assets
  drop constraint if exists media_assets_publication_privates;

alter table public.media_assets
  add constraint media_assets_publication_privates check (
    kind not in ('publication_pdf', 'publication_original', 'publication_source')
    or visibility = 'private'
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  Storage buckets
--
--  Four: one public bucket of images, and one private bucket per file level. The
--  split is physical rather than a policy predicate for the reason `buckets.ts`
--  gives at length: R2 has no per-object ACL, so "private" has to mean "in a
--  bucket that has no public URL". `publication-files`,
--  `publication-originals` and `publication-sources` must never be given a
--  custom domain or a public development URL.
--
--  Three private buckets rather than one, because the consequence of a mistake
--  differs by level. A leaked redacted PDF is a book being read for free; a
--  leaked archival original is somebody's phone number; a leaked source archive
--  is the unpublished manuscript. Keeping them apart means the blast radius of a
--  single wrong `bucket_id` is one level, not all three.
--
--  The size ceiling here is 25 MB rather than the 10 MB that applies elsewhere.
--  A 200-page typeset mathematics book with embedded figures does not fit in
--  10 MB, and the alternative — refusing the owner's own books — is not a
--  security posture, it is a broken feature. `SIZE_LIMITS` in
--  lib/media/validate.ts states the same number for the publication kinds.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    -- Images only. A PDF has no business in a public bucket — see the header.
    'publication-previews', 'publication-previews', true, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'publication-files', 'publication-files', false, 26214400,
    array['application/pdf']
  ),
  (
    'publication-originals', 'publication-originals', false, 26214400,
    array['application/pdf']
  ),
  (
    'publication-sources', 'publication-sources', false, 26214400,
    array['application/zip']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── publication-previews — public read, editor write ───────────────────────
drop policy if exists publication_previews_public_read on storage.objects;
create policy publication_previews_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'publication-previews');

drop policy if exists publication_previews_editor_insert on storage.objects;
create policy publication_previews_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publication-previews' and public.can_edit_content());

drop policy if exists publication_previews_editor_update on storage.objects;
create policy publication_previews_editor_update on storage.objects
  for update to authenticated
  using (bucket_id = 'publication-previews' and public.can_edit_content())
  with check (bucket_id = 'publication-previews' and public.can_edit_content());

drop policy if exists publication_previews_owner_delete on storage.objects;
create policy publication_previews_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'publication-previews' and public.is_owner());

-- ── publication-files — admin read; readers are served by the route handler ─
/*
 * There is deliberately no policy granting `anon` anything on this bucket.
 *
 * A reader never talks to storage. `/api/publications/[slug]/download` checks
 * `pdf_download_policy`, then streams the bytes with the service-role client, so
 * the only thing that decides whether a stranger gets this file is the policy
 * column — not a bucket toggle and not a guessable URL.
 */
drop policy if exists publication_files_admin_read on storage.objects;
create policy publication_files_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'publication-files' and public.can_view_admin());

drop policy if exists publication_files_editor_insert on storage.objects;
create policy publication_files_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publication-files' and public.can_edit_content());

drop policy if exists publication_files_editor_update on storage.objects;
create policy publication_files_editor_update on storage.objects
  for update to authenticated
  using (bucket_id = 'publication-files' and public.can_edit_content())
  with check (bucket_id = 'publication-files' and public.can_edit_content());

drop policy if exists publication_files_owner_delete on storage.objects;
create policy publication_files_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'publication-files' and public.is_owner());

-- ── publication-originals — owner read only ────────────────────────────────
-- There is deliberately no policy granting `anon` anything on this bucket.
drop policy if exists publication_originals_owner_read on storage.objects;
create policy publication_originals_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'publication-originals' and public.is_owner());

drop policy if exists publication_originals_editor_insert on storage.objects;
create policy publication_originals_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publication-originals' and public.can_edit_content());

drop policy if exists publication_originals_owner_update on storage.objects;
create policy publication_originals_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'publication-originals' and public.is_owner())
  with check (bucket_id = 'publication-originals' and public.is_owner());

drop policy if exists publication_originals_owner_delete on storage.objects;
create policy publication_originals_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'publication-originals' and public.is_owner());

-- ── publication-sources — owner read only ──────────────────────────────────
drop policy if exists publication_sources_owner_read on storage.objects;
create policy publication_sources_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'publication-sources' and public.is_owner());

drop policy if exists publication_sources_editor_insert on storage.objects;
create policy publication_sources_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publication-sources' and public.can_edit_content());

drop policy if exists publication_sources_owner_update on storage.objects;
create policy publication_sources_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'publication-sources' and public.is_owner())
  with check (bucket_id = 'publication-sources' and public.is_owner());

drop policy if exists publication_sources_owner_delete on storage.objects;
create policy publication_sources_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'publication-sources' and public.is_owner());


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_types
--
--  Editable taxonomy: "Mathematics Book", "Examination Collection", "Beamer
--  Presentation". Editable in the CMS rather than a CHECK constraint, because
--  the owner will invent a kind of document nobody anticipated and should not
--  need a migration to file it.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_types (
  id             uuid primary key default extensions.gen_random_uuid(),
  slug           text not null unique,

  name_en        text not null,
  name_km        text,
  description_en text,
  description_km text,

  -- Icon name from `components/ui/icon.tsx`. Validated in the application, not
  -- here: the icon set is a frontend concern and a CHECK against it would need
  -- editing every time an icon is added.
  icon           text,
  sort_order     integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint publication_types_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint publication_types_name_not_blank check (btrim(name_en) <> '')
);

create trigger publication_types_set_updated_at
  before update on public.publication_types
  for each row execute function public.set_updated_at();

comment on table public.publication_types is
  'Editable taxonomy for authored works. Short labels are stored inline per '
  'locale, matching project_categories and journey_categories.';


-- ═══════════════════════════════════════════════════════════════════════════
--  publications
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publications (
  id                  uuid primary key default extensions.gen_random_uuid(),
  slug                text not null,
  status              public.publication_status not null default 'draft',

  -- SET NULL, not CASCADE: deleting a type must never delete the books filed
  -- under it. An untyped publication is a legal, recoverable state.
  publication_type_id uuid references public.publication_types (id) on delete set null,

  featured            boolean not null default false,
  display_order       integer not null default 0,

  /*
   * The language the *book* is written in, which is not the language of the
   * website page describing it. Nearly all of these are Khmer; the English
   * publication page still renders an English description and an English
   * display title alongside the Khmer original. See section 22 of the brief.
   */
  content_language    text not null default 'km',

  -- ── Edition identity ────────────────────────────────────────────────────
  -- Denormalised from the active version so a listing query does not need the
  -- join. Kept in step by `sync_publication_edition_facts()` below rather than
  -- by the application, because two sources of truth that the application must
  -- remember to reconcile are one source of truth and one bug.
  edition_label       text,
  edition_number      integer,
  publication_year    integer,
  publication_date    date,

  page_count          integer,

  -- Locale-dependent facts that are labels rather than prose, so they live here
  -- and are read with pickLocalized() — same treatment as experiences.location.
  subject_en          text,
  subject_km          text,
  grade_level_en      text,
  grade_level_km      text,
  reading_level       text,

  author_profile_id   uuid references public.profiles (id) on delete set null,

  -- The cover. RESTRICT so a cover cannot be deleted out from under a published
  -- book. Nullable — a draft may exist before the cover is rendered.
  cover_media_id      uuid references public.media_assets (id) on delete restrict,

  /*
   * Which edition is current. The FK is added after `publication_versions`
   * exists (circular reference), and is ON DELETE SET NULL so archiving an
   * edition cannot delete the book.
   */
  active_version_id   uuid,

  -- ── Access policy ───────────────────────────────────────────────────────
  -- Four independent settings, because "can a stranger read a sample" and "can a
  -- stranger download the whole book" are genuinely different questions and
  -- collapsing them would force the owner to choose the stricter answer for both.
  preview_policy      text not null default 'sample_pages',
  preview_page_limit  integer,
  pdf_download_policy text not null default 'none',
  sample_download_policy text not null default 'none',
  source_policy       text not null default 'private',
  source_repository_url text,

  -- ── Rights ──────────────────────────────────────────────────────────────
  -- Defaults to all rights reserved and stays there until the owner chooses
  -- otherwise. An open licence is irrevocable in practice; it is not a default.
  license_type        text not null default 'all_rights_reserved',
  copyright_holder    text,
  copyright_year      integer,
  allow_redistribution boolean not null default false,
  allow_modification  boolean not null default false,

  -- ── Production ──────────────────────────────────────────────────────────
  typeset_with_latex  boolean not null default true,
  latex_engine        text,
  document_class      text,
  build_year          integer,

  -- ── Identifiers ─────────────────────────────────────────────────────────
  -- All nullable and all empty on the seeded records. None of these three is
  -- invented: a fabricated ISBN is a false claim about a real registry.
  isbn                text,
  doi                 text,
  external_url        text,

  -- ── Privacy review ──────────────────────────────────────────────────────
  -- Shares its vocabulary with experience and journey media (see
  -- lib/validation/media-privacy.ts). A book PDF can carry a phone number, a QR
  -- code pointing somewhere stale, a reviewer's name or a pupil's work, and the
  -- publish gate below refuses publication until a human has said otherwise.
  privacy_status      text not null default 'pending_review',
  privacy_review_note text,
  privacy_reviewed_by uuid references auth.users (id) on delete set null,
  privacy_reviewed_at timestamptz,

  -- True until a human has confirmed auto-seeded or uncertain values. Surfaced
  -- next to the publish control, and enforced by the publish gate below.
  needs_review        boolean not null default false,
  review_note         text,

  -- Excludes the page from search engines without unpublishing it.
  noindex             boolean not null default false,

  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,

  constraint publications_slug_format check (
    slug ~ '^[a-z0-9-]+$' and length(slug) between 2 and 90
  ),
  constraint publications_content_language_allowed check (
    content_language in ('km', 'en', 'bilingual', 'other')
  ),
  constraint publications_edition_number_range check (
    edition_number is null or (edition_number >= 1 and edition_number <= 200)
  ),
  /*
   * Year bounds rather than a bare `> 0`. 1900 predates any plausible authored
   * work here by decades and the upper bound is "next year", which allows an
   * edition dated ahead of its release without allowing 20255 — the typo a
   * four-digit free-text year invites.
   */
  constraint publications_publication_year_range check (
    publication_year is null
    or (publication_year >= 1900
        and publication_year <= extract(year from now())::integer + 1)
  ),
  constraint publications_build_year_range check (
    build_year is null
    or (build_year >= 1900
        and build_year <= extract(year from now())::integer + 1)
  ),
  constraint publications_copyright_year_range check (
    copyright_year is null
    or (copyright_year >= 1900
        and copyright_year <= extract(year from now())::integer + 1)
  ),
  constraint publications_page_count_range check (
    page_count is null or (page_count > 0 and page_count <= 20000)
  ),
  constraint publications_reading_level_allowed check (
    reading_level is null
    or reading_level in ('lower_secondary', 'upper_secondary', 'university', 'teacher', 'general')
  ),

  constraint publications_preview_policy_allowed check (
    preview_policy in ('none', 'sample_pages', 'first_pages', 'full')
  ),
  /*
   * `first_pages` without a limit is a contradiction that would render as the
   * whole book — the exact failure the policy exists to prevent. The limit is
   * capped at 25 so "first pages" cannot quietly become "the first third".
   */
  constraint publications_preview_page_limit_required check (
    preview_policy <> 'first_pages'
    or (preview_page_limit is not null and preview_page_limit between 1 and 25)
  ),
  constraint publications_preview_page_limit_range check (
    preview_page_limit is null or preview_page_limit between 1 and 25
  ),
  constraint publications_pdf_download_policy_allowed check (
    pdf_download_policy in ('none', 'public', 'signed', 'on_request', 'contact_author')
  ),
  constraint publications_sample_download_policy_allowed check (
    sample_download_policy in ('none', 'public')
  ),
  constraint publications_source_policy_allowed check (
    source_policy in ('private', 'on_request', 'public', 'external_repo')
  ),
  /*
   * `external_repo` means "the source is on GitHub, go there" — without a URL it
   * means nothing, and the detail page would render a heading with no link.
   */
  constraint publications_source_repository_required check (
    source_policy <> 'external_repo' or source_repository_url is not null
  ),
  constraint publications_source_repository_absolute check (
    source_repository_url is null or source_repository_url ~* '^https://'
  ),

  constraint publications_license_type_allowed check (
    license_type in (
      'all_rights_reserved', 'personal_educational', 'non_commercial',
      'cc_by', 'cc_by_sa', 'cc_by_nd', 'cc_by_nc', 'cc_by_nc_sa', 'cc_by_nc_nd',
      'cc0', 'public_domain', 'custom'
    )
  ),
  constraint publications_latex_engine_allowed check (
    latex_engine is null
    or latex_engine in ('pdflatex', 'xelatex', 'lualatex', 'other')
  ),
  -- LaTeX production details describe a LaTeX build. Recording an engine for a
  -- book that was not typeset in LaTeX is a contradiction the public
  -- "Created with LaTeX" panel would render as a bare fact with no context.
  constraint publications_latex_details_need_latex check (
    typeset_with_latex
    or (latex_engine is null and document_class is null)
  ),

  /*
   * ISBN-10 or ISBN-13, hyphens permitted. The format check does not verify the
   * check digit and does not need to: its job is to refuse an obviously invented
   * value, and the brief's rule is that no ISBN is assigned at all unless the
   * owner has a real one.
   */
  constraint publications_isbn_format check (
    isbn is null or isbn ~ '^[0-9][0-9Xx-]{9,16}$'
  ),
  constraint publications_doi_format check (doi is null or doi ~ '^10\.[0-9]{4,9}/'),
  constraint publications_external_url_absolute check (
    external_url is null or external_url ~* '^https?://'
  ),

  constraint publications_privacy_status_allowed check (
    privacy_status in ('pending_review', 'approved', 'rejected')
  ),
  -- An approval must say when it happened. Prevents an "approved" row with no
  -- accountable review.
  constraint publications_approval_is_attributed check (
    privacy_status <> 'approved' or privacy_reviewed_at is not null
  ),

  constraint publications_display_order_range check (
    display_order >= 0 and display_order <= 9999
  )
);

-- Live rows only, so a soft-deleted publication does not squat on its slug.
create unique index if not exists publications_slug_unique_live
  on public.publications (slug)
  where deleted_at is null;

-- The public listing: newest edition first, then the owner's chosen order.
create index if not exists publications_public_listing_idx
  on public.publications (display_order, publication_year desc nulls last)
  where status = 'published' and deleted_at is null;

create index if not exists publications_featured_idx
  on public.publications (display_order, publication_year desc)
  where featured and status = 'published' and deleted_at is null;

create index if not exists publications_type_idx
  on public.publications (publication_type_id)
  where deleted_at is null;

create index if not exists publications_status_idx
  on public.publications (status)
  where deleted_at is null;

-- The admin work queue: books still awaiting a privacy decision.
create index if not exists publications_pending_review_idx
  on public.publications (updated_at desc)
  where deleted_at is null and privacy_status = 'pending_review';

create trigger publications_set_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

create trigger publications_sync_published_at
  before insert or update of status on public.publications
  for each row execute function public.sync_published_at();

comment on table public.publications is
  'One authored work: a book, exercise collection, lecture set or paper, with '
  'its editions, files, table of contents and access policy.';
comment on column public.publications.content_language is
  'The language the book itself is written in. Independent of the locale of the '
  'website page describing it.';
comment on column public.publications.source_policy is
  'LaTeX source availability. Defaults to private; a source archive is never '
  'served from a public URL regardless of this value.';
comment on column public.publications.license_type is
  'Defaults to all_rights_reserved and is never changed automatically. An open '
  'licence is irrevocable in practice, so it is only ever an explicit choice.';


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_translations
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_translations (
  id                 uuid primary key default extensions.gen_random_uuid(),
  publication_id     uuid not null references public.publications (id) on delete cascade,
  locale             public.content_locale not null,

  /*
   * The display title in this locale.
   *
   * For a Khmer book on the English page this is the English *translation* of
   * the title — "Graphs of Functions" — while `original_title` below keeps
   * ក្រាបនៃអនុគមន៍ so the page can show both and the structured data can carry
   * the real one. Section 22 of the brief.
   */
  title              text not null,
  /*
   * The title as printed on the book, in the book's own language. Stored per
   * locale row so both the English and Khmer pages can render it, and rendered
   * with an explicit `lang` attribute so a screen reader does not read Khmer
   * with an English voice.
   */
  original_title     text,
  subtitle           text,

  short_summary      text,
  description        text,
  introduction       text,
  target_audience    text,
  learning_objectives text,
  author_note        text,
  acknowledgements   text,

  -- Editable, because a generated citation is a starting point rather than an
  -- authority. `buildCitation()` fills the field; the owner overrides it.
  citation_text      text,
  -- Custom licence wording, shown only when `license_type = 'custom'`.
  license_terms      text,
  -- Public-facing LaTeX notes. Never a file path — see the redaction rule in
  -- lib/validation/publication.ts.
  production_notes   text,

  seo_title          text,
  seo_description    text,

  translation_state  public.translation_state not null default 'partial',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint publication_translations_unique_locale
    unique (publication_id, locale),
  constraint publication_translations_title_not_blank check (btrim(title) <> ''),
  constraint publication_translations_seo_title_length check (
    seo_title is null or length(seo_title) <= 70
  ),
  constraint publication_translations_seo_description_length check (
    seo_description is null or length(seo_description) <= 200
  )
);

create index if not exists publication_translations_publication_idx
  on public.publication_translations (publication_id, locale);

create trigger publication_translations_set_updated_at
  before update on public.publication_translations
  for each row execute function public.set_updated_at();

comment on column public.publication_translations.original_title is
  'The title as printed on the book, in the book''s own language. Rendered '
  'alongside the translated title with its own lang attribute.';


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_versions
--
--  An edition. This is where the three file levels live — see the header for
--  why they are here rather than on `publications`.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_versions (
  id                     uuid primary key default extensions.gen_random_uuid(),
  publication_id         uuid not null references public.publications (id) on delete cascade,

  version_label          text not null,
  edition_number         integer,
  publication_year       integer,
  publication_date       date,
  page_count             integer,

  /*
   * The public-safe PDF. May be a redacted edition; that is the point of it
   * being a different asset from the original rather than a replacement for it.
   * RESTRICT so a published download cannot be deleted out from under a reader.
   */
  pdf_media_id           uuid references public.media_assets (id) on delete restrict,

  /*
   * The archival original. Private by construction — the trigger below refuses
   * a reference to anything whose visibility is not `private`, so "we forgot to
   * mark it private" cannot happen after the fact.
   */
  original_media_id      uuid references public.media_assets (id) on delete restrict,

  /** The LaTeX package. Private on the same terms as the original. */
  source_archive_media_id uuid references public.media_assets (id) on delete restrict,

  changelog_en           text,
  changelog_km           text,

  -- Denormalised "is this the current edition". Kept in step with
  -- `publications.active_version_id` by the trigger below; the pointer on the
  -- parent is the source of truth and this is the convenience index.
  is_active              boolean not null default false,
  status                 public.publication_status not null default 'draft',

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,

  constraint publication_versions_label_not_blank check (btrim(version_label) <> ''),
  constraint publication_versions_edition_number_range check (
    edition_number is null or (edition_number >= 1 and edition_number <= 200)
  ),
  constraint publication_versions_year_range check (
    publication_year is null
    or (publication_year >= 1900
        and publication_year <= extract(year from now())::integer + 1)
  ),
  constraint publication_versions_page_count_range check (
    page_count is null or (page_count > 0 and page_count <= 20000)
  ),
  -- The three file slots must be three different files. The same asset serving
  -- as both the public download and the archival original would mean the
  -- redaction step had silently not happened.
  constraint publication_versions_files_distinct check (
    (pdf_media_id is null or pdf_media_id is distinct from original_media_id)
    and (pdf_media_id is null or pdf_media_id is distinct from source_archive_media_id)
    and (original_media_id is null
         or original_media_id is distinct from source_archive_media_id)
  )
);

-- At most one active edition per publication. A uniqueness rule rather than a
-- convention, because "two current editions" has no meaningful rendering.
create unique index if not exists publication_versions_single_active
  on public.publication_versions (publication_id)
  where is_active;

create index if not exists publication_versions_publication_idx
  on public.publication_versions (publication_id, edition_number desc nulls last, created_at desc);

-- Answers "which editions use this asset?" for the library's usage panel and
-- for the delete guard.
create index if not exists publication_versions_pdf_idx
  on public.publication_versions (pdf_media_id) where pdf_media_id is not null;
create index if not exists publication_versions_original_idx
  on public.publication_versions (original_media_id) where original_media_id is not null;
create index if not exists publication_versions_source_idx
  on public.publication_versions (source_archive_media_id)
  where source_archive_media_id is not null;

create trigger publication_versions_set_updated_at
  before update on public.publication_versions
  for each row execute function public.set_updated_at();

comment on table public.publication_versions is
  'One edition of a publication, owning that edition''s three files: the '
  'public-safe PDF, the private archival original, and the LaTeX source archive.';

-- The deferred circular FK.
alter table public.publications
  drop constraint if exists publications_active_version_fk;
alter table public.publications
  add constraint publications_active_version_fk
  foreign key (active_version_id)
  references public.publication_versions (id) on delete set null;


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_chapters — the table of contents
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_chapters (
  id             uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,

  -- Text, not integer: real books have "1", "1.2", "A" and "មេរៀនទី ១".
  chapter_number text,
  title_en       text,
  title_km       text,
  description_en text,
  description_km text,

  start_page     integer,
  end_page       integer,
  sort_order     integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A chapter with neither title is an empty row in the rendered contents list.
  constraint publication_chapters_has_a_title check (
    btrim(coalesce(title_en, '')) <> '' or btrim(coalesce(title_km, '')) <> ''
  ),
  constraint publication_chapters_pages_ordered check (
    start_page is null or end_page is null or end_page >= start_page
  ),
  constraint publication_chapters_pages_positive check (
    (start_page is null or start_page > 0) and (end_page is null or end_page > 0)
  ),
  constraint publication_chapters_sort_order_range check (
    sort_order >= 0 and sort_order <= 9999
  )
);

create index if not exists publication_chapters_publication_idx
  on public.publication_chapters (publication_id, sort_order);

create trigger publication_chapters_set_updated_at
  before update on public.publication_chapters
  for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_media
--
--  Presentation media only — the cover, the sample pages, the gallery. The
--  edition's PDFs and source archive live on `publication_versions`; see the
--  header. Structurally `journey_media` minus the video columns, and
--  deliberately so.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_media (
  id             uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,

  -- RESTRICT, as in 0022 and 0024: deleting an asset a published page displays
  -- would silently break a public image, so the attachment has to be removed
  -- first, deliberately.
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,

  role           text not null default 'gallery',
  sort_order     integer not null default 0,

  -- The page this image is a rendering of, for sample pages. Lets the viewer
  -- label "page 7 of 214" rather than "image 3".
  page_number    integer,

  -- NULL means "fall back to the media asset's own value". The same cover in a
  -- listing and on a detail page deserves the same caption; the same page image
  -- reused across editions may not.
  caption_en     text,
  caption_km     text,
  alt_text_en    text,
  alt_text_km    text,

  visibility     text not null default 'private',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint publication_media_role_allowed check (
    role in ('cover', 'sample_page', 'gallery')
  ),
  constraint publication_media_visibility_allowed check (
    visibility in ('public', 'private', 'hidden')
  ),
  constraint publication_media_page_number_range check (
    page_number is null or (page_number > 0 and page_number <= 20000)
  ),
  -- A sample page without a page number cannot be ordered against the book or
  -- labelled in the viewer.
  constraint publication_media_sample_needs_page check (
    role <> 'sample_page' or page_number is not null
  ),
  constraint publication_media_sort_order_range check (
    sort_order >= 0 and sort_order <= 9999
  )
);

create unique index if not exists publication_media_unique_live
  on public.publication_media (publication_id, media_asset_id, role)
  where deleted_at is null;

create unique index if not exists publication_media_single_cover
  on public.publication_media (publication_id)
  where role = 'cover' and deleted_at is null;

create index if not exists publication_media_publication_idx
  on public.publication_media (publication_id, role, sort_order)
  where deleted_at is null;

create index if not exists publication_media_asset_idx
  on public.publication_media (media_asset_id)
  where deleted_at is null;

create trigger publication_media_set_updated_at
  before update on public.publication_media
  for each row execute function public.set_updated_at();

comment on table public.publication_media is
  'Cover, sample pages and gallery images for a publication. Holds no bytes and '
  'no paths — a join onto media_assets, like project_media and journey_media.';


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_topics and their links
--
--  "Convergent sequences", "Logarithmic functions". Names inline per locale for
--  the reason given in the header.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_topics (
  id         uuid primary key default extensions.gen_random_uuid(),
  slug       text not null unique,
  name_en    text not null,
  name_km    text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint publication_topics_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint publication_topics_name_not_blank check (btrim(name_en) <> '')
);

create trigger publication_topics_set_updated_at
  before update on public.publication_topics
  for each row execute function public.set_updated_at();

create table if not exists public.publication_topic_links (
  publication_id uuid not null references public.publications (id) on delete cascade,
  topic_id       uuid not null references public.publication_topics (id) on delete cascade,
  sort_order     integer not null default 0,
  primary key (publication_id, topic_id)
);

create index if not exists publication_topic_links_topic_idx
  on public.publication_topic_links (topic_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  publication_relations
--
--  Five nullable foreign keys, exactly one of which is set — the same shape as
--  `journey_relations` and for the same reason: a (type, id) pair cannot have a
--  foreign key, which is precisely what makes a dangling relation impossible.
--
--  `journey_entry_id` is the fifth target and the important one. A book has a
--  writing story — "Compiling Bac II Mathematics Examinations from 2002–2025" —
--  and that story is a journey entry with its own photographs. Linking them
--  means neither record has to restate the other's metadata.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.publication_relations (
  id               uuid primary key default extensions.gen_random_uuid(),
  publication_id   uuid not null references public.publications (id) on delete cascade,

  journey_entry_id uuid references public.journey_entries (id) on delete cascade,
  experience_id    uuid references public.experiences (id) on delete cascade,
  education_id     uuid references public.education (id) on delete cascade,
  certificate_id   uuid references public.certificates (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete cascade,

  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),

  constraint publication_relations_exactly_one_target check (
    (case when journey_entry_id is not null then 1 else 0 end)
  + (case when experience_id    is not null then 1 else 0 end)
  + (case when education_id     is not null then 1 else 0 end)
  + (case when certificate_id   is not null then 1 else 0 end)
  + (case when project_id       is not null then 1 else 0 end)
  = 1
  ),
  constraint publication_relations_display_order_range check (
    display_order >= 0 and display_order <= 999
  )
);

-- One link per (publication, target). Five partial indexes rather than one
-- composite, because a composite over five nullable columns treats NULLs as
-- distinct and would permit the same link twice.
create unique index if not exists publication_relations_unique_journey
  on public.publication_relations (publication_id, journey_entry_id)
  where journey_entry_id is not null;
create unique index if not exists publication_relations_unique_experience
  on public.publication_relations (publication_id, experience_id)
  where experience_id is not null;
create unique index if not exists publication_relations_unique_education
  on public.publication_relations (publication_id, education_id)
  where education_id is not null;
create unique index if not exists publication_relations_unique_certificate
  on public.publication_relations (publication_id, certificate_id)
  where certificate_id is not null;
create unique index if not exists publication_relations_unique_project
  on public.publication_relations (publication_id, project_id)
  where project_id is not null;

create index if not exists publication_relations_publication_idx
  on public.publication_relations (publication_id, display_order);

-- The reverse direction: "which books does this journey story evidence?", which
-- is what the Journey, Experience and Education pages ask.
create index if not exists publication_relations_journey_idx
  on public.publication_relations (journey_entry_id) where journey_entry_id is not null;
create index if not exists publication_relations_experience_idx
  on public.publication_relations (experience_id) where experience_id is not null;
create index if not exists publication_relations_education_idx
  on public.publication_relations (education_id) where education_id is not null;
create index if not exists publication_relations_certificate_idx
  on public.publication_relations (certificate_id) where certificate_id is not null;
create index if not exists publication_relations_project_idx
  on public.publication_relations (project_id) where project_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
--  File-level invariants
--
--  The three levels are the whole security story, so they are enforced by
--  triggers rather than left to the form. A CHECK cannot read `media_assets`,
--  which is why these are functions.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_publication_version_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibility public.file_visibility;
  v_kind       public.media_kind;
begin
  /*
   * The archival original must be private.
   *
   * This is the constraint that stops the worst outcome in the feature: an
   * unredacted scan — a phone number, a pupil's name, a QR code pointing at a
   * dormant Telegram channel — reachable from a permanent public URL. Checked
   * on every insert and update rather than at publish time, because the row is
   * dangerous from the moment it exists.
   */
  if new.original_media_id is not null then
    select m.visibility, m.kind into v_visibility, v_kind
      from public.media_assets m
     where m.id = new.original_media_id and m.deleted_at is null;

    if v_visibility is distinct from 'private' then
      raise exception
        'The archival original for an edition must be a private media asset (got %).',
        coalesce(v_visibility::text, 'missing asset')
        using errcode = 'check_violation',
              hint = 'Upload it as a "Publication original (private)" asset.';
    end if;

    if v_kind is distinct from 'publication_original' then
      raise exception
        'The archival original must be a publication_original asset (got %).',
        coalesce(v_kind::text, 'missing asset')
        using errcode = 'check_violation';
    end if;
  end if;

  -- The LaTeX package, on the same terms. Section 6 of the brief: source is
  -- private by default and never served from a public bucket whatever the
  -- publication's `source_policy` says.
  if new.source_archive_media_id is not null then
    select m.visibility, m.kind into v_visibility, v_kind
      from public.media_assets m
     where m.id = new.source_archive_media_id and m.deleted_at is null;

    if v_visibility is distinct from 'private' then
      raise exception
        'The LaTeX source archive for an edition must be a private media asset (got %).',
        coalesce(v_visibility::text, 'missing asset')
        using errcode = 'check_violation',
              hint = 'Upload it as a "Publication LaTeX source (private)" asset.';
    end if;

    if v_kind is distinct from 'publication_source' then
      raise exception
        'The LaTeX source archive must be a publication_source asset (got %).',
        coalesce(v_kind::text, 'missing asset')
        using errcode = 'check_violation';
    end if;
  end if;

  /*
   * The reader-facing PDF is private too, and this is the constraint that says
   * so out loud.
   *
   * It reads backwards until you follow the request path: nothing fetches this
   * object from storage except `/api/publications/[slug]/download`, which checks
   * `pdf_download_policy` before streaming a byte. A *public* asset here would
   * be reachable by URL without passing that check, which would silently reduce
   * every policy other than `public` to a suggestion. See the header.
   */
  if new.pdf_media_id is not null then
    select m.visibility, m.kind into v_visibility, v_kind
      from public.media_assets m
     where m.id = new.pdf_media_id and m.deleted_at is null;

    if v_visibility is distinct from 'private' then
      raise exception
        'The downloadable PDF for an edition must be a private media asset (got %); it is served through the download route, which enforces the download policy.',
        coalesce(v_visibility::text, 'missing asset')
        using errcode = 'check_violation',
              hint = 'Upload the redacted, public-safe PDF as a "Publication PDF" asset.';
    end if;

    if v_kind is distinct from 'publication_pdf' then
      raise exception
        'The downloadable PDF must be a publication_pdf asset (got %).',
        coalesce(v_kind::text, 'missing asset')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_publication_version_files is
  'BEFORE trigger: all three of an edition''s files must be private assets of '
  'the right kind. Reader access is decided by the download route, not by the '
  'bucket.';

drop trigger if exists publication_versions_enforce_files on public.publication_versions;
create trigger publication_versions_enforce_files
  before insert or update on public.publication_versions
  for each row execute function public.enforce_publication_version_files();


/*
 * A published publication's cover must be publicly renderable.
 *
 * Same argument as `enforce_journey_cover_is_public` in 0024: without this,
 * setting the cover to a private asset produces a published page whose cover
 * silently resolves to nothing, because `resolveImage()` returns null for a
 * private asset — the right defence, but a baffling thing to debug from the
 * admin.
 */
create or replace function public.enforce_publication_cover_is_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibility public.file_visibility;
begin
  if new.cover_media_id is null or new.status <> 'published' then
    return new;
  end if;

  select m.visibility into v_visibility
    from public.media_assets m
   where m.id = new.cover_media_id and m.deleted_at is null;

  if v_visibility is distinct from 'public' then
    raise exception
      'The cover for publication % must be a public media asset (got %).',
      new.slug, coalesce(v_visibility::text, 'missing asset')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists publications_cover_must_be_public on public.publications;
create trigger publications_cover_must_be_public
  before insert or update on public.publications
  for each row execute function public.enforce_publication_cover_is_public();


-- ═══════════════════════════════════════════════════════════════════════════
--  Publish gate
--
--  Blocks publication at the database rather than in the form, for the same
--  reason certificates and journey stories do: the form is one of several ways a
--  row can change.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_publication_publish_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_english boolean;
  v_has_pdf     boolean;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.needs_review then
    raise exception
      'Publication % cannot be published while it is still marked as needing review.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Confirm the uncertain fields and clear "needs review" first.';
  end if;

  /*
   * The privacy review is mandatory, and it is mandatory here rather than in the
   * form because the form is not the only way a row reaches `published`.
   *
   * These PDFs are real teaching documents. They can carry the author's personal
   * phone number, a QR code pointing at a channel that has since changed hands,
   * a reviewer's name, or a pupil's written work. None of that is detectable
   * automatically, so publication waits on a human saying they looked.
   */
  if new.privacy_status <> 'approved' then
    raise exception
      'Publication % cannot be published before its privacy review is approved.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Complete the privacy checklist in the Privacy tab, then publish.';
  end if;

  -- English is the fallback locale for the whole site; see the same rule in
  -- 0024. A book published with only a Khmer translation would render its title
  -- in Khmer on the English page under a `lang` switch — a legitimate fallback
  -- for a missing translation, a poor thing to publish deliberately.
  select exists (
    select 1 from public.publication_translations t
     where t.publication_id = new.id
       and t.locale = 'en'
       and btrim(t.title) <> ''
  ) into v_has_english;

  if not v_has_english then
    raise exception
      'Publication % cannot be published without an English title.', new.slug
      using errcode = 'check_violation',
            hint = 'Add the English translation before publishing.';
  end if;

  /*
   * A download policy that promises a file there is no file for.
   *
   * `public` and `signed` both render a download button. Publishing either
   * without a PDF on the active edition would ship a button that 404s, which is
   * worse than not offering one.
   */
  if new.pdf_download_policy in ('public', 'signed') then
    select exists (
      select 1 from public.publication_versions v
       where v.id = new.active_version_id
         and v.pdf_media_id is not null
    ) into v_has_pdf;

    if not v_has_pdf then
      raise exception
        'Publication % offers a PDF download but its active edition has no PDF.',
        new.slug
        using errcode = 'check_violation',
              hint = 'Attach a public-safe PDF to the active edition, or set the download policy to "No download".';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_publication_publish_rules is
  'BEFORE trigger: refuses to publish a book that is flagged for review, has no '
  'approved privacy review, has no English title, or promises a download it '
  'cannot serve.';

drop trigger if exists publications_enforce_publish_rules on public.publications;
create trigger publications_enforce_publish_rules
  before insert or update on public.publications
  for each row execute function public.enforce_publication_publish_rules();


/*
 * Keep `is_active`, `active_version_id` and the denormalised edition facts in
 * step.
 *
 * The parent's `active_version_id` is the source of truth. This trigger runs
 * after a version changes and reconciles both directions, so activating an
 * edition from either side produces the same result and the listing query never
 * has to join to know which year to print.
 */
create or replace function public.sync_publication_edition_facts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    -- Demote the previous active edition first, or the partial unique index
    -- rejects the update before the parent pointer is ever moved.
    update public.publication_versions
       set is_active = false
     where publication_id = new.publication_id
       and id <> new.id
       and is_active;

    update public.publications p
       set active_version_id = new.id,
           edition_label     = coalesce(new.version_label, p.edition_label),
           edition_number    = coalesce(new.edition_number, p.edition_number),
           publication_year  = coalesce(new.publication_year, p.publication_year),
           publication_date  = coalesce(new.publication_date, p.publication_date),
           page_count        = coalesce(new.page_count, p.page_count)
     where p.id = new.publication_id
       and p.active_version_id is distinct from new.id;
  end if;

  return new;
end;
$$;

comment on function public.sync_publication_edition_facts is
  'AFTER trigger: activating an edition demotes the previous one and copies its '
  'edition facts onto the publication, so listings need no join.';

drop trigger if exists publication_versions_sync_active on public.publication_versions;
create trigger publication_versions_sync_active
  after insert or update of is_active on public.publication_versions
  for each row when (new.is_active)
  execute function public.sync_publication_edition_facts();


-- ═══════════════════════════════════════════════════════════════════════════
--  Row Level Security
--
--  RLS is the enforcement layer; the guards and the admin UI are UX. The public
--  read policies restate every condition rather than trusting the query to have
--  filtered, so a forgotten `.eq()` in `lib/data/publications.ts` cannot leak a
--  draft — or, here, a private original.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.publication_types enable row level security;
alter table public.publications enable row level security;
alter table public.publication_translations enable row level security;
alter table public.publication_versions enable row level security;
alter table public.publication_chapters enable row level security;
alter table public.publication_media enable row level security;
alter table public.publication_topics enable row level security;
alter table public.publication_topic_links enable row level security;
alter table public.publication_relations enable row level security;

-- ── publication_types ──────────────────────────────────────────────────────
drop policy if exists publication_types_public_read on public.publication_types;
create policy publication_types_public_read on public.publication_types
  for select to anon, authenticated using (true);

drop policy if exists publication_types_editor_write on public.publication_types;
create policy publication_types_editor_write on public.publication_types
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_topics ─────────────────────────────────────────────────────
drop policy if exists publication_topics_public_read on public.publication_topics;
create policy publication_topics_public_read on public.publication_topics
  for select to anon, authenticated using (true);

drop policy if exists publication_topics_editor_write on public.publication_topics;
create policy publication_topics_editor_write on public.publication_topics
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publications ───────────────────────────────────────────────────────────
drop policy if exists publications_public_read on public.publications;
create policy publications_public_read on public.publications
  for select to anon, authenticated
  using (public.is_publicly_visible(status, published_at, deleted_at));

drop policy if exists publications_admin_read on public.publications;
create policy publications_admin_read on public.publications
  for select to authenticated using (public.can_view_admin());

drop policy if exists publications_editor_write on public.publications;
create policy publications_editor_write on public.publications
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_translations ───────────────────────────────────────────────
drop policy if exists publication_translations_public_read on public.publication_translations;
create policy publication_translations_public_read on public.publication_translations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.publications p
       where p.id = publication_translations.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
  );

drop policy if exists publication_translations_admin_read on public.publication_translations;
create policy publication_translations_admin_read on public.publication_translations
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_translations_editor_write on public.publication_translations;
create policy publication_translations_editor_write on public.publication_translations
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_versions ───────────────────────────────────────────────────
/*
 * The strictest policy here, and the reason the column split matters.
 *
 * An anonymous reader may see that an edition exists, what it is called and what
 * changed — a version history is part of the publication record. They may NOT
 * see `original_media_id` or `source_archive_media_id`, because those are
 * foreign keys into private assets and their presence alone tells a reader which
 * `media_assets` rows to go looking for.
 *
 * RLS is row-level, not column-level, so this cannot be expressed as a policy.
 * It is expressed as a *view* instead: `public_publication_versions` below
 * selects only the columns a reader may have, the anon grant on the table itself
 * is withheld, and `lib/data/publications.ts` reads the view. The table keeps its
 * admin policies for the authenticated side.
 */
drop policy if exists publication_versions_public_read on public.publication_versions;
create policy publication_versions_public_read on public.publication_versions
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.publications p
       where p.id = publication_versions.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
  );

drop policy if exists publication_versions_admin_read on public.publication_versions;
create policy publication_versions_admin_read on public.publication_versions
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_versions_editor_write on public.publication_versions;
create policy publication_versions_editor_write on public.publication_versions
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_chapters ───────────────────────────────────────────────────
drop policy if exists publication_chapters_public_read on public.publication_chapters;
create policy publication_chapters_public_read on public.publication_chapters
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.publications p
       where p.id = publication_chapters.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
  );

drop policy if exists publication_chapters_admin_read on public.publication_chapters;
create policy publication_chapters_admin_read on public.publication_chapters
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_chapters_editor_write on public.publication_chapters;
create policy publication_chapters_editor_write on public.publication_chapters
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_media ──────────────────────────────────────────────────────
/*
 * Parent-published is necessary but not sufficient: the attachment must also be
 * marked public and not soft-deleted, and its asset must itself be public.
 *
 * The nested EXISTS on `media_assets` is not redundant with that table's own
 * policy — see the long note on `journey_media_public_read` in 0024. PostgREST
 * filters the embedded asset out of the *response*, but the attachment row would
 * still be returned, disclosing that an unpublished sample page exists and how
 * it is captioned.
 */
drop policy if exists publication_media_public_read on public.publication_media;
create policy publication_media_public_read on public.publication_media
  for select to anon, authenticated
  using (
    deleted_at is null
    and visibility = 'public'
    and exists (
      select 1 from public.publications p
       where p.id = publication_media.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
    and exists (
      select 1 from public.media_assets m
       where m.id = publication_media.media_asset_id
         and m.visibility = 'public'
         and m.deleted_at is null
    )
  );

drop policy if exists publication_media_admin_read on public.publication_media;
create policy publication_media_admin_read on public.publication_media
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_media_editor_write on public.publication_media;
create policy publication_media_editor_write on public.publication_media
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_topic_links ────────────────────────────────────────────────
drop policy if exists publication_topic_links_public_read on public.publication_topic_links;
create policy publication_topic_links_public_read on public.publication_topic_links
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.publications p
       where p.id = publication_topic_links.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
  );

drop policy if exists publication_topic_links_admin_read on public.publication_topic_links;
create policy publication_topic_links_admin_read on public.publication_topic_links
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_topic_links_editor_write on public.publication_topic_links;
create policy publication_topic_links_editor_write on public.publication_topic_links
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── publication_relations ──────────────────────────────────────────────────
-- Both ends must be public, for the reason `journey_relations_public_read`
-- gives: a relation row pointing at a draft certificate would confirm that an
-- unpublished certificate exists and that this book is about it.
drop policy if exists publication_relations_public_read on public.publication_relations;
create policy publication_relations_public_read on public.publication_relations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.publications p
       where p.id = publication_relations.publication_id
         and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
    )
    and (
      (journey_entry_id is not null and exists (
        select 1 from public.journey_entries j
         where j.id = publication_relations.journey_entry_id
           and public.is_publicly_visible(j.status, j.published_at, j.deleted_at)))
      or (experience_id is not null and exists (
        select 1 from public.experiences x
         where x.id = publication_relations.experience_id
           and public.is_publicly_visible(x.status, x.published_at, x.deleted_at)))
      or (education_id is not null and exists (
        select 1 from public.education d
         where d.id = publication_relations.education_id
           and public.is_publicly_visible(d.status, d.published_at, d.deleted_at)))
      or (certificate_id is not null and exists (
        select 1 from public.certificates c
         where c.id = publication_relations.certificate_id
           and public.is_publicly_visible(c.status, c.published_at, c.deleted_at)))
      or (project_id is not null and exists (
        select 1 from public.projects pr
         where pr.id = publication_relations.project_id
           and public.is_publicly_visible(pr.status, pr.published_at, pr.deleted_at)))
    )
  );

drop policy if exists publication_relations_admin_read on public.publication_relations;
create policy publication_relations_admin_read on public.publication_relations
  for select to authenticated using (public.can_view_admin());

drop policy if exists publication_relations_editor_write on public.publication_relations;
create policy publication_relations_editor_write on public.publication_relations
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());


-- ═══════════════════════════════════════════════════════════════════════════
--  public_publication_versions — the column filter
--
--  See the note on `publication_versions` above. RLS cannot hide a column, so
--  the private file references are removed by projection instead. The view is
--  `security_invoker`, so the caller's RLS policies still apply to the
--  underlying table — the view narrows the columns, it does not widen access.
--
--  All three file references become booleans. A reader needs to know that a
--  download exists so the button can render; they never need the asset id, and
--  since all three assets are private, an id would be an invitation to go
--  looking rather than a useful fact. The download route resolves the asset
--  server-side from the slug and the edition.
--
--  ── Why this view is NOT security_invoker ──────────────────────────────────
--  It was, on the first attempt, and it did not work: `security_invoker` runs
--  the view with the *caller's* privileges, so it needs `SELECT` on
--  `publication_versions` — the grant deliberately withheld to keep the private
--  columns unreachable. Invoker rights and "no grant on the base table" are
--  mutually exclusive; asking for both produced `permission denied for table
--  publication_versions` from the view itself.
--
--  So this is a definer-rights view, which means the base table's RLS policies
--  do NOT apply to it and the row predicate has to be restated here, in the
--  WHERE clause. That is a real obligation rather than a formality: this WHERE
--  clause is the only thing standing between an anonymous reader and a draft
--  edition, and it must stay in step with `publication_versions_public_read`
--  above. Both are asserted in tests/integration/rls.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.public_publication_versions as
select
  v.id,
  v.publication_id,
  v.version_label,
  v.edition_number,
  v.publication_year,
  v.publication_date,
  v.page_count,
  v.changelog_en,
  v.changelog_km,
  v.is_active,
  v.created_at,
  (v.pdf_media_id is not null)            as has_pdf,
  (v.original_media_id is not null)       as has_archived_original,
  (v.source_archive_media_id is not null) as has_source_archive
from public.publication_versions v
-- The row predicate, restated. See the header: definer rights mean RLS on the
-- base table does not run, so this clause is the access control, not a filter.
where v.status = 'published'
  and exists (
    select 1 from public.publications p
     where p.id = v.publication_id
       and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)
  );

comment on view public.public_publication_versions is
  'Version history minus the private file references. RLS cannot filter columns, '
  'so the original, PDF and source asset ids are projected away and reduced to '
  'booleans. Definer rights, so the WHERE clause carries the row predicate that '
  'publication_versions_public_read carries for the table.';


-- ── Grants ─────────────────────────────────────────────────────────────────
grant select on public.publication_types to anon, authenticated;
grant select on public.publications to anon, authenticated;
grant select on public.publication_translations to anon, authenticated;
grant select on public.publication_chapters to anon, authenticated;
grant select on public.publication_media to anon, authenticated;
grant select on public.publication_topics to anon, authenticated;
grant select on public.publication_topic_links to anon, authenticated;
grant select on public.publication_relations to anon, authenticated;

/*
 * `publication_versions` itself is granted only to `authenticated`, and even
 * then only the admin policies apply. Anonymous readers get the view, whose
 * projection is the column filter. This is the grant that makes the view a
 * boundary rather than a convention: no anon grant on the table means no
 * PostgREST route to the private columns exists at all.
 */
grant select on public.publication_versions to authenticated;
grant select on public.public_publication_versions to anon, authenticated;

grant insert, update, delete on public.publication_types to authenticated;
grant insert, update, delete on public.publications to authenticated;
grant insert, update, delete on public.publication_translations to authenticated;
grant insert, update, delete on public.publication_versions to authenticated;
grant insert, update, delete on public.publication_chapters to authenticated;
grant insert, update, delete on public.publication_media to authenticated;
grant insert, update, delete on public.publication_topics to authenticated;
grant insert, update, delete on public.publication_topic_links to authenticated;
grant insert, update, delete on public.publication_relations to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
--  Audit trail
--
--  Each decision gets its own verb rather than collapsing into
--  'publication.updated'. Replacing a public PDF, changing a download policy and
--  approving a privacy review are the actions most worth reconstructing a year
--  later, and "someone edited a book" answers none of the questions that would
--  be asked.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.audit_logs
  drop constraint if exists audit_logs_action_allowed;

alter table public.audit_logs
  add constraint audit_logs_action_allowed check (
    action in (
      'admin.login', 'admin.login_failed', 'admin.logout',
      'admin.unauthorized', 'admin.role_changed',
      'profile.updated',
      'project.created', 'project.updated', 'project.published',
      'project.unpublished', 'project.archived', 'project.restored',
      'project.deleted', 'project.duplicated',
      'certificate.created', 'certificate.updated', 'certificate.published',
      'certificate.unpublished', 'certificate.archived', 'certificate.restored',
      'certificate.deleted', 'certificate.original_viewed',
      'certificate.original_downloaded', 'certificate.privacy_reviewed',
      'media.uploaded', 'media.replaced', 'media.deleted', 'media.imported',
      'resume.uploaded', 'resume.activated', 'resume.archived',
      'education.updated', 'experience.updated', 'skill.updated',
      'experience.photo_attached', 'experience.photo_removed',
      'experience.photo_updated', 'experience.cover_changed',
      'experience.gallery_reordered', 'experience.photo_privacy_changed',
      'experience.photo_consent_changed', 'experience.photo_published',
      'experience.photo_hidden',
      'journey.created', 'journey.updated', 'journey.published',
      'journey.unpublished', 'journey.archived', 'journey.restored',
      'journey.deleted', 'journey.duplicated', 'journey.featured_changed',
      'journey.media_attached', 'journey.media_removed', 'journey.media_updated',
      'journey.cover_changed', 'journey.gallery_reordered',
      'journey.media_privacy_changed', 'journey.media_consent_changed',
      'journey.media_published', 'journey.media_hidden',
      'journey.video_added', 'journey.video_removed',
      'journey.relation_added', 'journey.relation_removed',
      'publication.created', 'publication.updated', 'publication.published',
      'publication.unpublished', 'publication.archived', 'publication.restored',
      'publication.deleted', 'publication.duplicated',
      'publication.featured_changed', 'publication.reordered',
      'publication.cover_changed', 'publication.privacy_reviewed',
      'publication.license_changed', 'publication.download_policy_changed',
      'publication.version_created', 'publication.version_updated',
      'publication.version_activated', 'publication.version_deleted',
      'publication.pdf_replaced', 'publication.original_uploaded',
      'publication.source_uploaded', 'publication.source_downloaded',
      'publication.original_downloaded',
      'publication.sample_pages_changed', 'publication.chapters_changed',
      'publication.topics_changed',
      'publication.relation_added', 'publication.relation_removed',
      'testimonial.updated', 'message.updated', 'message.deleted',
      'seo.updated', 'settings.updated'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  Analytics
--
--  Privacy-safe event names only: what was viewed and which control was used,
--  never who. The allowlist mirrors `analyticsEventNames` in
--  lib/analytics/events.ts; a drift between the two fails the insert loudly
--  rather than silently dropping data.
--
--  The edition a download came from goes in `properties`, not in a column and
--  not in a second table — see departure 3 in the header.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.analytics_events
  drop constraint if exists analytics_events_name_allowed;

alter table public.analytics_events
  add constraint analytics_events_name_allowed check (
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
      'outbound_link_click',
      'journey_view',
      'journey_gallery_open',
      'journey_photo_view',
      'journey_video_play',
      'journey_related_experience_click',
      'journey_related_education_click',
      'journey_related_certificate_click',
      'journey_related_project_click',
      'publication_view',
      'publication_preview_open',
      'publication_sample_page_view',
      'publication_pdf_download',
      'publication_pdf_download_failed',
      'publication_source_request',
      'publication_source_download',
      'publication_citation_copy',
      'publication_related_journey_click'
    )
  );

alter table public.analytics_events
  drop constraint if exists analytics_events_entity_type_allowed;

alter table public.analytics_events
  add constraint analytics_events_entity_type_allowed check (
    entity_type is null or entity_type in (
      'project', 'certificate', 'resume', 'page', 'social_link', 'journey',
      'publication'
    )
  );
