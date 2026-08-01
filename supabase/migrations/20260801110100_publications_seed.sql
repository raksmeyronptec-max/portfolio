-- ═══════════════════════════════════════════════════════════════════════════
--  0027 — Publication taxonomy, and draft records for the three supplied books
--
--  ── The rule this file follows ─────────────────────────────────────────────
--  Only what the owner actually supplied. The brief gave three Khmer titles, a
--  suggested English title for each, a type, a subject, a target level, a short
--  verified description and — for one of them — a year and an edition. It did
--  not give page counts, ISBNs, publishers, chapter lists with page ranges, or
--  cover images. So none of those appear here.
--
--  Every record is therefore:
--    · status          = 'draft'          — nothing is published by seeding
--    · privacy_status  = 'pending_review' — which the publish gate in 0026
--                                           refuses to publish through
--    · needs_review    = true             — a second, independent gate
--    · pdf_download_policy = 'none'       — no file is attached yet, and a
--                                           policy that promises one would make
--                                           the record unpublishable anyway
--    · license_type    = 'all_rights_reserved'
--                                         — never anything else by default
--
--  `review_note` names exactly which fields are unconfirmed, because "needs
--  review" on its own only says that something is wrong. Same reasoning as
--  migration 0012 and 0025.
--
--  ── Why no files are attached ──────────────────────────────────────────────
--  A migration cannot upload bytes. The PDFs go through
--  `POST /api/admin/media/upload` with kind `publication_pdf` (the redacted,
--  reader-facing edition) and `publication_original` (the archival copy), and
--  are then attached to an edition from the admin. Seeding a
--  `publication_versions` row pointing at nothing would produce an edition that
--  looks attached and is not, which is worse than an obviously empty one.
--
--  ── Khmer text ─────────────────────────────────────────────────────────────
--  The three Khmer titles are the owner's own, used verbatim. Khmer descriptions
--  restate only what the brief stated. Where a phrase would require inventing
--  official terminology, the English row carries it and the Khmer page falls
--  back — correctly labelled, which the site is already designed to do.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Types ──────────────────────────────────────────────────────────────────
-- The full list from section 4 of the brief. All editable in the admin; the
-- three seeded books use three of them.

insert into public.publication_types (slug, name_en, name_km, icon, sort_order)
values
  ('mathematics-book',     'Mathematics Book',      'សៀវភៅគណិតវិទ្យា',       'book',       10),
  ('exercise-collection',  'Exercise Collection',   'កម្រងលំហាត់',            'layers',     20),
  ('examination-collection','Examination Collection','កម្រងវិញ្ញាសា',          'fileText',   30),
  ('learning-guide',       'Learning Guide',        'ឯកសារមេរៀន',             'bookOpen',   40),
  ('worksheet-collection', 'Worksheet Collection',  'សន្លឹកកិច្ចការ',          'file',       50),
  ('teaching-guide',       'Teaching Guide',        'សៀវភៅណែនាំគ្រូ',         'users',      60),
  ('lecture-notes',        'Lecture Notes',         'កំណត់ចំណាំមេរៀន',        'scroll',     70),
  ('beamer-presentation',  'Beamer Presentation',   'ស្លាយបង្រៀន',            'presentation', 80),
  ('research-paper',       'Research Paper',        'អត្ថបទស្រាវជ្រាវ',        'search',     90),
  ('article',              'Article',               'អត្ថបទ',                  'fileText',  100),
  ('workbook',             'Workbook',              'សៀវភៅលំហាត់',            'book',      110),
  ('other',                'Other',                 'ផ្សេងៗ',                  'folder',    999)
on conflict (slug) do nothing;

-- ── Topics ─────────────────────────────────────────────────────────────────
-- Only the topic groups the brief listed as *verified* for the three books.
-- Nothing is inferred from a title.

insert into public.publication_topics (slug, name_en, name_km, sort_order)
values
  ('rational-functions',    'Rational functions',    'អនុគមន៍សនិទាន',          10),
  ('logarithmic-functions', 'Logarithmic functions', 'អនុគមន៍លោការីត',          20),
  ('exponential-functions', 'Exponential functions', 'អនុគមន៍អ៉ិចស្ប៉ូណង់ស្យែល', 30),
  ('graph-analysis',        'Graph analysis',        'ការវិភាគក្រាប',           40),
  ('real-sequences',        'Real-number sequences', 'ស្វ៊ីតនៃចំនួនពិត',        50),
  ('subsequences',          'Subsequences',          'ស្វ៊ីតរង',                60),
  ('monotonic-sequences',   'Monotonic sequences',   'ស្វ៊ីតឯកតាមួយ',           70),
  ('bounded-sequences',     'Bounded sequences',     'ស្វ៊ីតមានព្រំដែន',        80),
  ('convergent-sequences',  'Convergent sequences',  'ស្វ៊ីតរួមបញ្ចូល',         90),
  ('cauchy-sequences',      'Cauchy sequences',      'ស្វ៊ីតកូស៊ី',            100),
  ('practice-exercises',    'Practice exercises',    'លំហាត់អនុវត្ត',          110)
on conflict (slug) do nothing;


-- ═══════════════════════════════════════════════════════════════════════════
--  A helper, used three times and then dropped.
--
--  Dropped for the same reason 0025's was: leaving a `seed_*` function in the
--  schema invites it being called again later against content the owner has
--  since edited, and it has no purpose outside this migration.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.seed_publication_draft(
  p_slug             text,
  p_type_slug        text,
  p_title_en         text,
  p_title_km         text,
  p_original_title   text,
  p_summary_en       text,
  p_summary_km       text,
  p_description_en   text,
  p_subject_en       text,
  p_subject_km       text,
  p_grade_en         text,
  p_grade_km         text,
  p_reading_level    text,
  p_audience_en      text,
  p_year             integer,
  p_edition_label    text,
  p_edition_number   integer,
  p_review_note      text,
  p_display_order    integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_type_id uuid;
begin
  select id into v_type_id from public.publication_types where slug = p_type_slug;

  insert into public.publications (
    slug, status, publication_type_id, featured, display_order,
    content_language, edition_label, edition_number, publication_year,
    subject_en, subject_km, grade_level_en, grade_level_km, reading_level,
    -- No file is attached, so nothing is offered. See the header.
    preview_policy, pdf_download_policy, sample_download_policy, source_policy,
    -- Never anything but all rights reserved, and never automatically.
    license_type, allow_redistribution, allow_modification,
    typeset_with_latex,
    privacy_status, needs_review, review_note
  )
  values (
    p_slug, 'draft', v_type_id, false, p_display_order,
    'km', p_edition_label, p_edition_number, p_year,
    p_subject_en, p_subject_km, p_grade_en, p_grade_km, p_reading_level,
    'none', 'none', 'none', 'private',
    'all_rights_reserved', false, false,
    true,
    'pending_review', true, p_review_note
  )
  returning id into v_id;

  insert into public.publication_translations (
    publication_id, locale, title, original_title, short_summary, description,
    target_audience, translation_state
  )
  values (
    v_id, 'en', p_title_en, p_original_title, p_summary_en, p_description_en,
    p_audience_en, 'partial'
  );

  -- The Khmer row carries the owner's own title. A summary is written only where
  -- the brief supplied one; otherwise the Khmer page falls back to English,
  -- labelled, which is the site's designed behaviour.
  insert into public.publication_translations (
    publication_id, locale, title, original_title, short_summary, translation_state
  )
  values (v_id, 'km', p_title_km, p_original_title, p_summary_km, 'partial');

  return v_id;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
--  1 — កម្រងវិញ្ញាសាគណិតវិទ្យា
-- ═══════════════════════════════════════════════════════════════════════════

select public.seed_publication_draft(
  'mathematics-examination-collection',
  'examination-collection',
  'Mathematics Examination Collection, 2002–2025',
  'កម្រងវិញ្ញាសាគណិតវិទ្យា',
  'កម្រងវិញ្ញាសាគណិតវិទ្យា',
  'A practice collection of mathematics examination papers from 2002 through 2025 '
  'for Grade 12 science-track learners.',
  'កម្រងវិញ្ញាសាគណិតវិទ្យាសម្រាប់សិស្សថ្នាក់ទី១២ ផ្នែកវិទ្យាសាស្ត្រ ចាប់ពីឆ្នាំ ២០០២ ដល់ ២០២៥។',
  'A practice collection of mathematics examination papers from 2002 through 2025, '
  'compiled as a revision resource for Grade 12 science-track learners preparing '
  'for Cambodia''s Upper Secondary Education Examination.',
  'Mathematics', 'គណិតវិទ្យា',
  'Grade 12 — Science Track', 'ថ្នាក់ទី១២ ផ្នែកវិទ្យាសាស្ត្រ',
  'upper_secondary',
  'Students preparing for Cambodia''s Upper Secondary Education Examination.',
  -- No publication year: the brief gives the *range the papers cover*, which is
  -- not the year the collection was issued. Conflating the two would put a
  -- fabricated date in the citation and in the structured data.
  null,
  null,
  null,
  'Unconfirmed: the year this collection was compiled or issued (2002–2025 is the '
  'range of papers it covers, not its publication date), the page count, the '
  'edition, and whether the papers are reproduced with permission. Attach the '
  'public-safe PDF and the archival original before publishing, and check the '
  'colophon for a personal phone number or a QR code.',
  10
);


-- ═══════════════════════════════════════════════════════════════════════════
--  2 — ក្រាបនៃអនុគមន៍
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_id uuid;
begin
  v_id := public.seed_publication_draft(
    'graphs-of-functions',
    'mathematics-book',
    'Graphs of Functions',
    'ក្រាបនៃអនុគមន៍',
    'ក្រាបនៃអនុគមន៍',
    'A Grade 12 mathematics book on the graphs of rational, logarithmic and '
    'exponential functions, with explanations and practice problems.',
    'សៀវភៅគណិតវិទ្យាថ្នាក់ទី១២ ស្តីពីក្រាបនៃអនុគមន៍សនិទាន អនុគមន៍លោការីត និងអនុគមន៍អ៉ិចស្ប៉ូណង់ស្យែល '
    'ព្រមទាំងការពន្យល់ និងលំហាត់អនុវត្ត។',
    'A Grade 12 mathematics book about the graphs of functions. It covers rational '
    'functions, logarithmic functions and exponential functions, with explanations, '
    'graph analysis and practice exercises.',
    'Functions and Mathematical Analysis', 'អនុគមន៍ និងវិភាគគណិតវិទ្យា',
    'Grade 12', 'ថ្នាក់ទី១២',
    'upper_secondary',
    'Grade 12 learners studying functions and their graphs.',
    null,
    null,
    null,
    'Unconfirmed: the publication year, the page count, the edition, and whether a '
    'cover exists. Attach the public-safe PDF and the archival original before '
    'publishing. The topic list below is the one the brief verified — add to it '
    'only from the book''s actual contents page.',
    20
  );

  -- Only the topic groups the brief listed as verified for this book.
  insert into public.publication_topic_links (publication_id, topic_id, sort_order)
  select v_id, t.id, t.sort_order
    from public.publication_topics t
   where t.slug in (
     'rational-functions', 'logarithmic-functions', 'exponential-functions',
     'graph-analysis', 'practice-exercises'
   );
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  3 — ស្វ៊ីតនៃចំនួនពិត
--
--  The only one of the three with a year and an edition the brief actually
--  states: first edition, 2025. Both are recorded; nothing else is.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_id uuid;
begin
  v_id := public.seed_publication_draft(
    'sequences-of-real-numbers',
    'mathematics-book',
    'Sequences of Real Numbers',
    'ស្វ៊ីតនៃចំនួនពិត',
    'ស្វ៊ីតនៃចំនួនពិត',
    'A mathematical-analysis resource on sequences of real numbers, for Grade 11 '
    'learners and university students. First edition, 2025.',
    'ឯកសារសិក្សាផ្នែកវិភាគគណិតវិទ្យា ស្តីពីស្វ៊ីតនៃចំនួនពិត សម្រាប់សិស្សថ្នាក់ទី១១ '
    'និងនិស្សិតសាកលវិទ្យាល័យ។ បោះពុម្ពលើកទី១ ឆ្នាំ២០២៥។',
    'A mathematical-analysis learning resource about sequences of real numbers. It '
    'covers subsequences, monotonic sequences, bounded sequences, convergent '
    'sequences and Cauchy sequences, with practice exercises.',
    'Mathematical Analysis', 'វិភាគគណិតវិទ្យា',
    'Grade 11 and university', 'ថ្នាក់ទី១១ និងសាកលវិទ្យាល័យ',
    'university',
    'Grade 11 learners and university students studying mathematical analysis.',
    2025,
    'First edition',
    1,
    'Unconfirmed: the page count, whether a cover exists, and the LaTeX engine and '
    'document class used. Attach the public-safe PDF and the archival original '
    'before publishing. A LaTeX source archive exists for this book — upload it as '
    '"Publication LaTeX source" only after removing .aux, .log, .out, .toc and '
    '.synctex.gz, which record absolute paths from the machine it was built on.',
    30
  );

  insert into public.publication_topic_links (publication_id, topic_id, sort_order)
  select v_id, t.id, t.sort_order
    from public.publication_topics t
   where t.slug in (
     'real-sequences', 'subsequences', 'monotonic-sequences',
     'bounded-sequences', 'convergent-sequences', 'cauchy-sequences',
     'practice-exercises'
   );
end $$;


drop function if exists public.seed_publication_draft(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, integer, text, integer, text, integer
);


do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.publications where deleted_at is null;
  raise notice '── Publications seeded ──────────────────────────';
  raise notice 'Publications: % (all drafts, all pending privacy review)', v_count;
  raise notice 'No files are attached — upload the PDFs in /admin/media, then';
  raise notice 'create an edition for each publication and activate it.';
  raise notice 'Nothing was auto-published. Review each draft in /admin first.';
  raise notice '─────────────────────────────────────────────────';
end $$;
