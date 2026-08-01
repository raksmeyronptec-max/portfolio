-- ═══════════════════════════════════════════════════════════════════════════
--  0025 — Journey taxonomy, and draft stories for the owner's known topics
--
--  ── The rule this file follows ─────────────────────────────────────────────
--  Only what the owner actually supplied. The brief named seven topics and the
--  institutions involved; it did not give dates, participants, award names,
--  organisers or outcomes. So none of those appear here.
--
--  Every entry is therefore:
--    · status = 'draft'          — nothing is published by seeding
--    · event_date = NULL         — a date nobody evidenced is not invented
--    · date_precision='unknown'  — and the UI is told so, rather than guessing
--    · needs_review = true       — which the publish gate in 0024 refuses to
--                                  publish through until a human clears it
--
--  `review_note` names exactly which fields are unconfirmed, because
--  "needs review" on its own only says that something is wrong. That is the same
--  reasoning migration 0012 gives for adding review_note in the first place.
--
--  The English summaries below restate only what the brief itself stated. Where
--  a Khmer translation would require knowing a proper noun's official Khmer
--  form — a school's registered name, an award's formal title — the Khmer row is
--  omitted rather than transliterated, and the entry's review note says so. A
--  wrong Khmer institution name published under the owner's byline is worse than
--  an English fallback that the site is already designed to render correctly.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Categories ─────────────────────────────────────────────────────────────
-- Khmer names supplied by the owner in the brief are used verbatim. The rest are
-- standard Khmer educational vocabulary; all are editable in the admin.

insert into public.journey_categories (slug, name_en, name_km, icon, sort_order)
values
  ('education',              'Education',                  'ការសិក្សា',                                  'graduation', 10),
  ('teaching-practicum',     'Teaching Practicum',         'កម្មសិក្សាបង្រៀន',                           'teacher',    20),
  ('fieldwork',              'Fieldwork',                  'ការងារចុះទីតាំង',                            'mapPin',     30),
  ('academic-achievement',   'Academic Achievement',       'សមិទ្ធផលសិក្សា',                             'trophy',     40),
  ('award',                  'Award',                      'រង្វាន់',                                     'award',      50),
  ('international-exchange', 'International Exchange',     'ការផ្លាស់ប្តូរបទពិសោធន៍អន្តរជាតិ',            'globe',      60),
  ('workshop',               'Workshop',                   'សិក្ខាសាលា',                                  'users',      70),
  ('science-fair',           'Science Fair',               'ពិព័រណ៍វិទ្យាសាស្ត្រ',                        'lightbulb',  80),
  ('presentation',           'Presentation',               'ការធ្វើបទបង្ហាញ',                             'scroll',     90),
  ('technology',             'Technology',                 'បច្ចេកវិទ្យា',                                'code',      100),
  ('artificial-intelligence','Artificial Intelligence',    'បញ្ញាសិប្បនិម្មិត',                           'database',  110),
  ('university-life',        'University Life',            'ជីវិតសិក្សានៅសាកលវិទ្យាល័យ',                  'library',   120),
  ('teacher-education',      'Teacher Education',          'ការបណ្តុះបណ្តាលគ្រូ',                        'book',      130),
  ('community-activity',     'Community Activity',         'សកម្មភាពសហគមន៍',                              'heart',     140),
  ('personal-milestone',     'Personal Milestone',         'ព្រឹត្តិការណ៍សំខាន់ផ្ទាល់ខ្លួន',              'star',      150),
  ('other',                  'Other',                      'ផ្សេងៗ',                                      'folder',    999)
on conflict (slug) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  Draft stories
--
--  Inserted through a helper so each entry states only its own facts, and so
--  re-running the migration is a no-op rather than a duplicate-slug failure.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.seed_journey_draft(
  p_slug            text,
  p_category_slug   text,
  p_title_en        text,
  p_summary_en      text,
  p_organisation_en text,
  p_location_en     text,
  p_review_note     text,
  p_sort_order      integer
)
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- Never touch a story the owner has already started editing.
  if exists (select 1 from public.journey_entries where slug = p_slug) then
    return;
  end if;

  insert into public.journey_entries (
    slug, status, category_id, featured, sort_order,
    event_date, date_precision,
    organisation_en, location_en,
    needs_review, review_note
  )
  values (
    p_slug,
    'draft',
    (select id from public.journey_categories where slug = p_category_slug),
    false,
    p_sort_order,
    -- No date was supplied for any of these. NULL plus 'unknown' is the honest
    -- representation; the timeline groups undated stories separately rather
    -- than filing them under a year nobody confirmed.
    null,
    'unknown',
    p_organisation_en,
    p_location_en,
    true,
    p_review_note
  )
  returning id into v_id;

  insert into public.journey_entry_translations (
    journey_entry_id, locale, title, summary, translation_state
  )
  values (v_id, 'en', p_title_en, p_summary_en, 'partial');
end;
$$;

select public.seed_journey_draft(
  'ptom-plp-fieldwork-kakoh-primary-school',
  'fieldwork',
  'PTOM and PLP Fieldwork at Kakoh Primary School',
  'Testing PTOM instruments and Primary Learning Programme activities during '
  'fieldwork at Kakoh Primary School.',
  'Kakoh Primary School',
  null,
  'Unconfirmed: the dates of the fieldwork, the full official name of the school, '
  'the Khmer name of the school, the cohort or programme this formed part of, and '
  'what PTOM stands for in full. Add the Khmer translation once the school''s '
  'registered Khmer name is confirmed. Photographs are pupils in a classroom — '
  'every one needs the school''s permission before it can be published.',
  10
);

select public.seed_journey_draft(
  'experience-exchange-with-korean-teachers',
  'international-exchange',
  'Experience Exchange with Korean Teachers',
  'An exchange of teaching experience with visiting teachers from Korea.',
  null,
  null,
  'Unconfirmed: the dates, the visiting institution or programme, who organised '
  'the exchange, where it was held, and Ron''s role in it. Do not name individual '
  'visiting teachers without their permission. Add the Khmer translation once the '
  'programme''s official name is confirmed.',
  20
);

select public.seed_journey_draft(
  'outstanding-student-and-grade-a-recognition',
  'academic-achievement',
  'Outstanding Student and Grade A Recognition',
  'Recognition received for outstanding student performance and a Grade A result.',
  null,
  null,
  'Unconfirmed: the dates, the awarding institution, the exact official title of '
  'each award, the subject or programme the Grade A relates to, and whether these '
  'are one award or two separate ones. Link this story to the corresponding '
  'Certificate record once it exists — the award-ceremony photograph is event '
  'evidence and must not be used as the credential document itself.',
  30
);

select public.seed_journey_draft(
  'science-fair-activities',
  'science-fair',
  'Science Fair Activities',
  'Participation in science fair activities, recorded in photographs and video.',
  null,
  null,
  'Unconfirmed: the dates, which science fair or fairs these are, the host '
  'institution, the project or exhibit presented, and Ron''s role. The brief notes '
  'video exists for this topic — add it as an external video URL with a poster '
  'frame, and write the context explaining the activity and Ron''s role, which '
  'section 22 of the brief requires for science fair video specifically.',
  40
);

select public.seed_journey_draft(
  'how-to-use-ai-presentation',
  'artificial-intelligence',
  'How to Use AI Presentation',
  'An educational presentation on how to use AI.',
  null,
  null,
  'Unconfirmed: the dates, the audience, the host institution or event, whether '
  'this is one presentation or a series, and the platform the video is hosted on. '
  'Provide a written summary or transcript alongside the video — this is the '
  'topic where the brief asks for one explicitly, and it is also what makes the '
  'content usable without playing the video at all.',
  50
);

select public.seed_journey_draft(
  'my-learning-journey-at-rupp',
  'university-life',
  'My Learning Journey at RUPP',
  'Student life and academic activities at the Royal University of Phnom Penh.',
  'Royal University of Phnom Penh',
  'Phnom Penh, Cambodia',
  'Unconfirmed: the period this covers, which activities the photographs show, '
  'and which of them are worth publishing. Link this to the existing RUPP '
  'Education record. Add the Khmer translation — RUPP''s official Khmer name '
  'should be taken from the university rather than transliterated.',
  60
);

select public.seed_journey_draft(
  'my-teacher-education-journey-at-ptec',
  'teacher-education',
  'My Teacher-Education Journey at PTEC',
  'Teacher-education study and student activities at PTEC.',
  'PTEC',
  null,
  'Unconfirmed: the period this covers, PTEC''s full official name in English and '
  'in Khmer, and which activities the photographs show. Link this to the existing '
  'PTEC Education record, and to the teaching practicum Experience records where '
  'the story overlaps them.',
  70
);

/*
 * The helper is dropped once it has run.
 *
 * Leaving a `seed_*` function in the schema invites it being called again later
 * against content the owner has since edited, and it has no purpose outside this
 * migration. The rows it created are ordinary rows and are unaffected.
 */
drop function if exists public.seed_journey_draft(
  text, text, text, text, text, text, text, integer
);
