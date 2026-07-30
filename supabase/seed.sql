-- ═══════════════════════════════════════════════════════════════════════════
--  SEED — Ron Raksmey Portfolio CMS
--
--  Run by `supabase db reset` against the LOCAL stack. It is not executed by
--  `supabase db push`, so it never touches a hosted project by accident.
--
--  Content policy for this file
--  ────────────────────────────
--  1. Only facts evidenced by the v1 codebase or by a live HTTP response are
--     seeded as values.
--  2. Anything unverifiable (team size, duration, user counts, performance
--     scores, exact responsibilities) is left NULL and the row is flagged
--     `needs_review = true` with a `review_note` naming what is missing.
--  3. Every project and certificate starts as `draft`. Nothing auto-publishes.
--  4. No credential records are invented — only the categories are seeded.
--
--  Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Site settings ───────────────────────────────────────────────────────────
insert into public.site_settings (
  id, site_name_en, site_name_km,
  tagline_en, tagline_km,
  positioning_en, positioning_km,
  hero_headline_en, hero_headline_km,
  hero_subheadline_en, hero_subheadline_km,
  availability_status_en, availability_status_km,
  is_available_for_work,
  location_en, location_km,
  contact_email, telegram_handle, facebook_url,
  default_locale, contact_form_enabled, chat_widget_enabled
) values (
  true,
  'Ron Raksmey', 'រុន រស្មី',
  'Educator, Mathematics Student and Full-Stack Product Builder',
  'អ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល',
  'Building practical digital tools that improve teaching, learning and access to academic resources.',
  'បង្កើតឧបករណ៍ឌីជីថលជាក់ស្តែង ដើម្បីលើកកម្ពស់ការបង្រៀន ការសិក្សា និងការទទួលបានឯកសារសិក្សា។',
  'I build digital tools that make teaching, learning and academic resources easier to access.',
  'ខ្ញុំបង្កើតឧបករណ៍ឌីជីថល ដែលធ្វើឱ្យការបង្រៀន ការសិក្សា និងឯកសារសិក្សាកាន់តែងាយស្រួលទទួលបាន។',
  'I am an educator, mathematics student and full-stack product builder creating practical digital platforms for teachers, students and academic institutions in Cambodia.',
  'ខ្ញុំជាអ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល ដែលកំពុងបង្កើតវេទិកាឌីជីថលជាក់ស្តែងសម្រាប់គ្រូបង្រៀន សិស្សានុសិស្ស និងស្ថាប័នសិក្សានៅកម្ពុជា។',
  'Open to teaching, tutoring and product collaborations',
  'បើកចំហសម្រាប់ការបង្រៀន ការជួយបំប៉ន និងកិច្ចសហការលើផលិតផល',
  true,
  'Phnom Penh, Cambodia', 'រាជធានីភ្នំពេញ ប្រទេសកម្ពុជា',
  'raksmeyron97@gmail.com', '@Ron_Raksmey',
  'https://www.facebook.com/ronraksmey',
  'en', true, false
)
on conflict (id) do nothing;

-- ── Social links ────────────────────────────────────────────────────────────
insert into public.social_links (platform, label_en, label_km, url, handle, icon, sort_order)
values
  ('email',    'Email',    'អ៊ីមែល',    'mailto:raksmeyron97@gmail.com',      'raksmeyron97@gmail.com', 'mail',     1),
  ('telegram', 'Telegram', 'តេឡេក្រាម', 'https://t.me/Ron_Raksmey',           '@Ron_Raksmey',           'telegram', 2),
  ('facebook', 'Facebook', 'ហ្វេសប៊ុក',  'https://www.facebook.com/ronraksmey','@ronraksmey',            'facebook', 3)
on conflict (platform) do nothing;

-- ── Languages (proficiency labels, never percentages) ───────────────────────
insert into public.languages
  (code, name_en, name_km, proficiency_label_en, proficiency_label_km, cefr_level, is_native, sort_order)
values
  ('km', 'Khmer',   'ខ្មែរ',    'Mother tongue', 'ភាសាកំណើត',   null, true,  1),
  ('en', 'English', 'អង់គ្លេស', 'Intermediate',  'មធ្យម',       null, false, 2),
  ('fr', 'French',  'បារាំង',   'A1 — beginner', 'A1 — ដំបូង',  'A1', false, 3)
on conflict (code) do nothing;

-- ── Project categories ──────────────────────────────────────────────────────
insert into public.project_categories (slug, name_en, name_km, sort_order)
values
  ('education-technology', 'Education Technology', 'បច្ចេកវិទ្យាអប់រំ',           1),
  ('academic-repository',  'Academic Repository',  'ឃ្លាំងឯកសារសិក្សា',          2),
  ('web-application',      'Web Application',      'កម្មវិធីវេប',                 3),
  ('internal-tool',        'Internal Tool',        'ឧបករណ៍ប្រើប្រាស់ក្នុងស្ថាប័ន', 4),
  ('storage-infrastructure','Storage Infrastructure','មូលដ្ឋានរចនាសម្ព័ន្ធផ្ទុកឯកសារ', 5),
  ('ux-ui',                'UX/UI',                'UX/UI',                        6),
  ('open-source',          'Open Source',          'កូដចំហ',                      7),
  ('personal-project',     'Personal Project',     'គម្រោងផ្ទាល់ខ្លួន',           8)
on conflict (slug) do nothing;

-- ── Certificate categories ──────────────────────────────────────────────────
--  Categories only. No credential records are invented: the admin adds the real
--  documents together with their redacted previews.
insert into public.certificate_categories (slug, name_en, name_km, icon, sort_order)
values
  ('high-school-diploma',     'High-School Diploma',          'សញ្ញាបត្រមធ្យមសិក្សាទុតិយភូមិ', 'scroll',   1),
  ('bacii-certificate',       'BacII Certificate',            'សញ្ញាបត្របាក់ឌុប',              'scroll',   2),
  ('academic-award',          'Academic Award',               'រង្វាន់សិក្សា',                  'award',    3),
  ('university-credential',   'University Credential',        'សញ្ញាបត្រសាកលវិទ្យាល័យ',        'graduate', 4),
  ('teacher-training',        'Teacher-Training Credential',  'សញ្ញាបត្របណ្តុះបណ្តាលគ្រូ',      'teacher',  5),
  ('professional-certificate','Professional Certificate',     'វិញ្ញាបនបត្រវិជ្ជាជីវៈ',          'badge',    6),
  ('workshop',                'Workshop',                     'សិក្ខាសាលា',                     'users',    7),
  ('competition',             'Competition',                  'ការប្រកួតប្រជែង',                'trophy',   8),
  ('volunteer',               'Volunteer Certificate',        'វិញ្ញាបនបត្រស្ម័គ្រចិត្ត',        'heart',    9),
  ('course-completion',       'Course Completion',            'វិញ្ញាបនបត្របញ្ចប់វគ្គសិក្សា',   'check',   10),
  ('other-achievement',       'Other Achievement',            'សមិទ្ធផលផ្សេងៗ',                 'star',    11)
on conflict (slug) do nothing;

-- ── Technologies ────────────────────────────────────────────────────────────
--  Only technologies evidenced by live HTTP headers / CSP allowlists of the
--  three deployed projects, plus the stack of this portfolio itself.
insert into public.technologies (slug, name, group_name, sort_order)
values
  ('nextjs',              'Next.js',              'framework', 1),
  ('react',               'React',                'framework', 2),
  ('typescript',          'TypeScript',           'language',  3),
  ('postgresql',          'PostgreSQL',           'database',  4),
  ('supabase',            'Supabase',             'platform',  5),
  ('tailwindcss',         'Tailwind CSS',         'styling',   6),
  ('vercel',              'Vercel',               'platform',  7),
  ('netlify',             'Netlify',              'platform',  8),
  ('cloudflare',          'Cloudflare',           'platform',  9),
  ('cloudflare-r2',       'Cloudflare R2',        'service',  10),
  ('cloudflare-turnstile','Cloudflare Turnstile', 'service',  11),
  ('vercel-blob',         'Vercel Blob',          'service',  12),
  ('firebase',            'Firebase',             'platform', 13),
  ('google-oauth',        'Google OAuth',         'service',  14),
  ('gemini-api',          'Google Gemini API',    'service',  15),
  ('emailjs',             'EmailJS',              'service',  16),
  ('recaptcha',           'Google reCAPTCHA',     'service',  17),
  ('render',              'Render',               'platform', 18),
  ('google-analytics',    'Google Analytics',     'service',  19),
  ('vercel-analytics',    'Vercel Analytics',     'service',  20)
on conflict (slug) do nothing;

-- ── Capability groups (no proficiency scores by design) ─────────────────────
insert into public.skill_categories (slug, name_en, name_km, description_en, description_km, icon, sort_order)
values
  ('education', 'Education', 'ការអប់រំ',
   'Classroom practice and instructional design.',
   'ការអនុវត្តក្នុងថ្នាក់រៀន និងការរចនាមេរៀន។', 'book', 1),
  ('product-engineering', 'Product and Engineering', 'ផលិតផល និងវិស្វកម្ម',
   'Building and shipping full-stack web products.',
   'ការបង្កើត និងដាក់ដំណើរការផលិតផលវេបពេញលេញ។', 'code', 2),
  ('academic-systems', 'Academic Systems', 'ប្រព័ន្ធសិក្សា',
   'Digital libraries, repositories and content workflows.',
   'បណ្ណាល័យឌីជីថល ឃ្លាំងឯកសារ និងលំហូរការងារខ្លឹមសារ។', 'library', 3),
  ('product-quality', 'Product Quality', 'គុណភាពផលិតផល',
   'The non-functional work that decides whether a product is usable.',
   'ការងារមិនមែនមុខងារ ដែលកំណត់ថាផលិតផលអាចប្រើប្រាស់បានឬអត់។', 'shield', 4)
on conflict (slug) do nothing;

insert into public.skills (category_id, slug, name_en, name_km, sort_order)
select c.id, s.slug, s.name_en, s.name_km, s.sort_order
  from public.skill_categories c
  join (values
    ('education', 'lesson-planning',        'Lesson planning',            'ការរៀបចំផែនការមេរៀន',        1),
    ('education', 'mathematics-instruction','Mathematics instruction',    'ការបង្រៀនគណិតវិទ្យា',        2),
    ('education', 'student-assessment',     'Student assessment',         'ការវាយតម្លៃសិស្ស',           3),
    ('education', 'learning-materials',     'Learning-material design',   'ការរចនាឯកសារសិក្សា',        4),
    ('education', 'education-technology',   'Education technology',       'បច្ចេកវិទ្យាអប់រំ',          5),

    ('product-engineering', 'full-stack-development', 'Full-stack development', 'ការអភិវឌ្ឍពេញលេញ',   1),
    ('product-engineering', 'nextjs',                 'Next.js',                'Next.js',            2),
    ('product-engineering', 'typescript',             'TypeScript',             'TypeScript',         3),
    ('product-engineering', 'supabase',               'Supabase',               'Supabase',           4),
    ('product-engineering', 'postgresql',             'PostgreSQL',             'PostgreSQL',         5),
    ('product-engineering', 'api-integration',        'API integration',        'ការភ្ជាប់ API',       6),
    ('product-engineering', 'auth',                   'Authentication and authorization', 'ការផ្ទៀងផ្ទាត់ និងការអនុញ្ញាត', 7),
    ('product-engineering', 'admin-dashboards',       'Admin dashboards',       'ផ្ទាំងគ្រប់គ្រង',      8),

    ('academic-systems', 'digital-libraries',     'Digital libraries',           'បណ្ណាល័យឌីជីថល',        1),
    ('academic-systems', 'academic-repositories', 'Academic repositories',       'ឃ្លាំងឯកសារសិក្សា',    2),
    ('academic-systems', 'metadata-management',   'Metadata management',         'ការគ្រប់គ្រង Metadata', 3),
    ('academic-systems', 'search-discovery',      'Search and discovery',        'ការស្វែងរក',            4),
    ('academic-systems', 'cms-workflows',         'Content-management workflows', 'លំហូរការងារខ្លឹមសារ',  5),
    ('academic-systems', 'file-media-systems',    'File and media systems',      'ប្រព័ន្ធឯកសារ និងមេឌា', 6),
    ('academic-systems', 'multilingual-platforms','Multilingual platforms',      'វេទិកាពហុភាសា',         7),

    ('product-quality', 'ux-ui-design',   'UX/UI design',   'ការរចនា UX/UI',        1),
    ('product-quality', 'accessibility',  'Accessibility',  'លទ្ធភាពប្រើប្រាស់',    2),
    ('product-quality', 'technical-seo',  'Technical SEO',  'SEO បច្ចេកទេស',        3),
    ('product-quality', 'performance',    'Performance',    'ដំណើរការរហ័ស',         4),
    ('product-quality', 'analytics',      'Analytics',      'ការវិភាគទិន្នន័យ',      5),
    ('product-quality', 'qa',             'QA',             'ការធានាគុណភាព',        6),
    ('product-quality', 'security',       'Security',       'សុវត្ថិភាព',            7)
  ) as s(category_slug, slug, name_en, name_km, sort_order)
    on s.category_slug = c.slug
on conflict (category_id, slug) do nothing;

-- ── SEO defaults for the static routes ──────────────────────────────────────
insert into public.seo_overrides (route_key, locale, title, description, sitemap_priority)
values
  ('home', 'en', 'Ron Raksmey — Educator and Full-Stack Product Builder',
   'Educator, mathematics student and full-stack product builder in Phnom Penh, building practical digital tools for teaching, learning and academic resources.', 1.0),
  ('home', 'km', 'រុន រស្មី — អ្នកអប់រំ និងអ្នកបង្កើតផលិតផលឌីជីថល',
   'អ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថលនៅរាជធានីភ្នំពេញ ដែលបង្កើតឧបករណ៍ជាក់ស្តែងសម្រាប់ការបង្រៀន ការសិក្សា និងឯកសារសិក្សា។', 1.0),
  -- Deliberately names no individual project. Every seeded project starts as a
  -- draft pending review, and a description that lists them would publish those
  -- names in the page's own <meta> tag while the case studies themselves are
  -- still unpublished — the exact leak the E2E "draft projects do not appear
  -- anywhere" assertion exists to catch. Add specific names here only once the
  -- corresponding case study is published.
  ('projects', 'en', 'Projects and Case Studies — Ron Raksmey',
   'Case studies of the education and academic platforms built by Ron Raksmey, covering the problem, the approach taken and what was actually shipped.', 0.9),
  ('projects', 'km', 'គម្រោង និងករណីសិក្សា — រុន រស្មី',
   'ករណីសិក្សាអំពីវេទិកាអប់រំ និងសិក្សា ដែលបង្កើតដោយ រុន រស្មី ដោយបង្ហាញពីបញ្ហា វិធីសាស្ត្រ និងលទ្ធផលជាក់ស្តែង។', 0.9),
  ('certificates', 'en', 'Certificates and Academic Achievements — Ron Raksmey',
   'A library of verified certificates, academic awards and teacher-education credentials held by Ron Raksmey.', 0.8),
  ('certificates', 'km', 'វិញ្ញាបនបត្រ និងសមិទ្ធផលសិក្សា — រុន រស្មី',
   'បណ្ណាល័យវិញ្ញាបនបត្រ រង្វាន់សិក្សា និងសញ្ញាបត្របណ្តុះបណ្តាលគ្រូរបស់ រុន រស្មី។', 0.8),
  ('about', 'en', 'About Ron Raksmey — Educator and Builder',
   'The journey of an educator and mathematics student who builds digital platforms for Cambodian teachers, students and academic institutions.', 0.7),
  ('about', 'km', 'អំពី រុន រស្មី — អ្នកអប់រំ និងអ្នកបង្កើត',
   'ដំណើររបស់អ្នកអប់រំ និងនិស្សិតគណិតវិទ្យា ដែលបង្កើតវេទិកាឌីជីថលសម្រាប់គ្រូបង្រៀន សិស្ស និងស្ថាប័នសិក្សានៅកម្ពុជា។', 0.7),
  ('experience', 'en', 'Experience — Ron Raksmey',
   'Teaching practicum, student-teacher training and software product work by Ron Raksmey in Phnom Penh, Cambodia.', 0.7),
  ('experience', 'km', 'បទពិសោធន៍ — រុន រស្មី',
   'កម្មសិក្សាបង្រៀន ការបណ្តុះបណ្តាលគរុនិស្សិត និងការងារផលិតផលកម្មវិធីរបស់ រុន រស្មី នៅរាជធានីភ្នំពេញ។', 0.7),
  ('education', 'en', 'Education — Ron Raksmey',
   'Teacher education at PTEC, a Bachelor of Mathematics at Khemarak University, and BacII science-track graduation.', 0.7),
  ('education', 'km', 'ការអប់រំ — រុន រស្មី',
   'ការបណ្តុះបណ្តាលគ្រូនៅ PTEC បរិញ្ញាបត្រគណិតវិទ្យានៅសាកលវិទ្យាល័យខេមរៈ និងការបញ្ចប់បាក់ឌុបផ្នែកវិទ្យាសាស្ត្រ។', 0.7),
  ('resume', 'en', 'Resume — Ron Raksmey',
   'Read or download the current resume of Ron Raksmey, educator, mathematics student and full-stack product builder.', 0.6),
  ('resume', 'km', 'ប្រវត្តិរូបសង្ខេប — រុន រស្មី',
   'អាន ឬទាញយកប្រវត្តិរូបសង្ខេបបច្ចុប្បន្នរបស់ រុន រស្មី អ្នកអប់រំ និងអ្នកបង្កើតផលិតផលឌីជីថល។', 0.6),
  ('contact', 'en', 'Contact Ron Raksmey',
   'Get in touch about teaching opportunities, tutoring, academic platforms or a digital-product collaboration in Cambodia.', 0.6),
  ('contact', 'km', 'ទំនាក់ទំនង រុន រស្មី',
   'ទាក់ទងអំពីឱកាសបង្រៀន ការជួយបំប៉ន វេទិកាសិក្សា ឬកិច្ចសហការលើផលិតផលឌីជីថលនៅកម្ពុជា។', 0.6)
on conflict (route_key, locale) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  EDUCATION
--
--  Migrated from v1. Note what is deliberately NOT seeded: the "3.79 GPA" claim.
--  v1 attributes it to RUPP in the hero and to a Mathematics major at Khemarak
--  University in the education card, and the chatbot prompt asserts both at once.
--  Seeding either would mean picking a side, so the number is omitted and the
--  conflict is recorded in review_note for the admin to resolve.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.education (
  slug, kind, status, sort_order,
  institution_url, started_on, ended_on, is_current,
  period_label_en, period_label_km,
  schedule_label_en, schedule_label_km,
  grade_value, grade_scale, grade_source_note,
  needs_review, review_note
) values
  (
    'ptec-teacher-education', 'teacher_education', 'published', 1,
    'https://www.ptec.edu.kh/home/', '2023-01-01', null, true,
    '2023 — 2028 (expected)', '២០២៣ — ២០២៨ (រំពឹងទុក)',
    'Monday – Friday', 'ច័ន្ទ – សុក្រ',
    null, null, null,
    true,
    'Only the year 2023 is evidenced for the start. The stored start date is a placeholder used for ordering — confirm the real enrolment date. Also confirm whether the 3.79 GPA claimed in the v1 hero belongs to this programme, to Khemarak University, or to RUPP: the v1 site asserts all three.'
  ),
  (
    'khemarak-university-mathematics', 'university', 'published', 2,
    'https://khemarakuniversity.edu.kh/km', null, null, true,
    'Year 3 — expected 2027', 'ឆ្នាំទី៣ — រំពឹងទុក ២០២៧',
    'Saturday – Sunday', 'សៅរ៍ – អាទិត្យ',
    null, null, null,
    true,
    'GPA deliberately not migrated. v1 credits a 3.79 GPA to "RUPP" in the hero and the achievements carousel while naming Khemarak University as the mathematics institution here. Set grade_value and grade_scale only once the correct institution is confirmed.'
  ),
  (
    'cambodia-japan-friendship-high-school', 'high_school', 'published', 3,
    null, null, '2023-01-01', false,
    'Graduated 2023', 'បញ្ចប់ការសិក្សា ២០២៣',
    null, null,
    'A', 'Cambodian BacII overall grade (A–E)',
    'Stated consistently across the v1 portfolio. Confirm against the BacII certificate before treating as verified.',
    true,
    'The "99.734 percentile" figure from v1 was not migrated because no source for it exists in the codebase. Add it back only with a verifiable source. Graduation month is unknown; the stored date is year-accurate only.'
  )
-- The slug uniqueness index is partial (`where deleted_at is null`), so the
-- index predicate has to be restated for ON CONFLICT to infer it.
on conflict (slug) where deleted_at is null do nothing;

insert into public.education_translations
  (education_id, locale, institution, qualification, field_of_study, description, translation_state)
select e.id, t.locale, t.institution, t.qualification, t.field_of_study, t.description, 'complete'
  from public.education e
  join (values
    ('ptec-teacher-education', 'en'::public.content_locale,
     'Phnom Penh Teacher Education College (PTEC)',
     'Bachelor of Education — Primary School (12+4)',
     'Primary education',
     'Student teacher (គរុនិស្សិត) in the 12+4 primary-education programme, studying pedagogy, lesson planning and classroom practice alongside a mathematics degree taken at weekends.'),
    ('ptec-teacher-education', 'km'::public.content_locale,
     'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
     'បរិញ្ញាបត្រអប់រំ — បឋមសិក្សា (១២+៤)',
     'បឋមសិក្សា',
     'គរុនិស្សិតក្នុងកម្មវិធីបឋមសិក្សា ១២+៤ សិក្សាគរុកោសល្យ ការរៀបចំផែនការមេរៀន និងការអនុវត្តក្នុងថ្នាក់រៀន ស្របពេលជាមួយការសិក្សាគណិតវិទ្យានៅចុងសប្តាហ៍។'),

    ('khemarak-university-mathematics', 'en'::public.content_locale,
     'Khemarak University',
     'Bachelor of Mathematics',
     'Mathematics',
     'Year 3 of a Bachelor of Mathematics, studied at weekends in parallel with full-time teacher education. The mathematics content directly supports primary and secondary mathematics instruction.'),
    ('khemarak-university-mathematics', 'km'::public.content_locale,
     'សាកលវិទ្យាល័យខេមរៈ',
     'បរិញ្ញាបត្រគណិតវិទ្យា',
     'គណិតវិទ្យា',
     'ឆ្នាំទី៣ នៃបរិញ្ញាបត្រគណិតវិទ្យា សិក្សានៅចុងសប្តាហ៍ ស្របពេលជាមួយការបណ្តុះបណ្តាលគ្រូពេញម៉ោង។ ខ្លឹមសារគណិតវិទ្យាជួយផ្ទាល់ដល់ការបង្រៀនគណិតវិទ្យាបឋម និងមធ្យមសិក្សា។'),

    ('cambodia-japan-friendship-high-school', 'en'::public.content_locale,
     'Cambodia Japan Friendship Middle and High School',
     'National High School Diploma (BacII) — Science track',
     'Science',
     'Graduated from the science track with an overall Grade A in the national BacII examination.'),
    ('cambodia-japan-friendship-high-school', 'km'::public.content_locale,
     'អនុវិទ្យាល័យ និងវិទ្យាល័យមិត្តភាពកម្ពុជា-ជប៉ុន',
     'សញ្ញាបត្រមធ្យមសិក្សាទុតិយភូមិ (បាក់ឌុប) — ផ្នែកវិទ្យាសាស្ត្រ',
     'វិទ្យាសាស្ត្រ',
     'បញ្ចប់ការសិក្សាផ្នែកវិទ្យាសាស្ត្រ ដោយទទួលបាននិទ្ទេសរួម A ក្នុងការប្រឡងបាក់ឌុបថ្នាក់ជាតិ។')
  ) as t(edu_slug, locale, institution, qualification, field_of_study, description)
    on t.edu_slug = e.slug
on conflict (education_id, locale) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  EXPERIENCE
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.experiences (
  slug, kind, status, sort_order,
  organization_url, location_en, location_km,
  started_on, ended_on, is_current,
  period_label_en, period_label_km,
  needs_review, review_note
) values
  (
    'ptec-student-teacher', 'teaching', 'published', 1,
    'https://www.ptec.edu.kh/home/',
    'Phnom Penh, Cambodia', 'រាជធានីភ្នំពេញ ប្រទេសកម្ពុជា',
    '2023-01-01', null, true,
    '2023 — present', '២០២៣ — បច្ចុប្បន្ន',
    true,
    'Start month unknown; the stored date is year-accurate only and used for ordering.'
  ),
  (
    'capital-practice-primary-school-practicum', 'practicum', 'published', 2,
    null,
    'Phnom Penh, Cambodia', 'រាជធានីភ្នំពេញ ប្រទេសកម្ពុជា',
    null, null, false,
    null, null,
    true,
    'v1 gave this entry no dates at all — the timeline literally printed the word "Experience" where a date belongs. Add the practicum start and end dates, the year group taught, and the number of lessons or weeks before publishing any duration claim.'
  )
-- The slug uniqueness index is partial (`where deleted_at is null`), so the
-- index predicate has to be restated for ON CONFLICT to infer it.
on conflict (slug) where deleted_at is null do nothing;

insert into public.experience_translations
  (experience_id, locale, role_title, organization, summary, description, translation_state)
select x.id, t.locale, t.role_title, t.organization, t.summary, t.description, 'complete'
  from public.experiences x
  join (values
    ('ptec-student-teacher', 'en'::public.content_locale,
     'Student Teacher (គរុនិស្សិត)',
     'Phnom Penh Teacher Education College (PTEC)',
     'Training as a primary-school teacher in the 12+4 programme while building digital tools for the college.',
     -- Names no individual project, for the same reason as the projects-route SEO
     -- description above: the case studies are drafts, so naming them here would
     -- advertise pages that do not exist yet. Add the names back once published.
     'Studying pedagogy, lesson planning, student assessment and classroom practice in the 12+4 primary-education programme. In parallel, designed and built digital systems used in a teacher-education context, including a teacher assistant platform and a digital library for the college.'),
    ('ptec-student-teacher', 'km'::public.content_locale,
     'គរុនិស្សិត',
     'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
     'បណ្តុះបណ្តាលជាគ្រូបឋមសិក្សាក្នុងកម្មវិធី ១២+៤ ស្របពេលបង្កើតឧបករណ៍ឌីជីថលសម្រាប់វិទ្យាស្ថាន។',
     'សិក្សាគរុកោសល្យ ការរៀបចំផែនការមេរៀន ការវាយតម្លៃសិស្ស និងការអនុវត្តក្នុងថ្នាក់រៀន ក្នុងកម្មវិធីបឋមសិក្សា ១២+៤។ ស្របពេលនោះ បានរចនា និងបង្កើតប្រព័ន្ធឌីជីថលដែលប្រើប្រាស់ក្នុងបរិបទបណ្តុះបណ្តាលគ្រូ រួមមានវេទិកាជំនួយការគ្រូបង្រៀន និងបណ្ណាល័យឌីជីថលសម្រាប់វិទ្យាស្ថាន។'),

    ('capital-practice-primary-school-practicum', 'en'::public.content_locale,
     'Teaching Practicum — Primary Mathematics',
     'Capital Practice Primary School (សាលាបឋមសិក្សាអនុវត្តរាជធានី)',
     'Classroom teaching practice focused on foundational mathematics for young learners.',
     'Delivered foundational mathematics lessons to primary-school pupils and worked on building a supportive, engaging classroom environment.'),
    ('capital-practice-primary-school-practicum', 'km'::public.content_locale,
     'កម្មសិក្សាបង្រៀន — គណិតវិទ្យាបឋមសិក្សា',
     'សាលាបឋមសិក្សាអនុវត្តរាជធានី',
     'ការអនុវត្តបង្រៀនក្នុងថ្នាក់រៀន ផ្តោតលើគណិតវិទ្យាមូលដ្ឋានសម្រាប់អ្នកសិក្សាវ័យក្មេង។',
     'បង្រៀនមេរៀនគណិតវិទ្យាមូលដ្ឋានដល់សិស្សបឋមសិក្សា និងកសាងបរិយាកាសថ្នាក់រៀនដែលគាំទ្រ និងទាក់ទាញ។')
  ) as t(exp_slug, locale, role_title, organization, summary, description)
    on t.exp_slug = x.slug
on conflict (experience_id, locale) do nothing;

insert into public.experience_tags (experience_id, label_en, label_km, sort_order)
select x.id, t.label_en, t.label_km, t.sort_order
  from public.experiences x
  join (values
    ('ptec-student-teacher', 'Primary Education', 'បឋមសិក្សា', 1),
    ('ptec-student-teacher', 'Mathematics', 'គណិតវិទ្យា', 2),
    ('ptec-student-teacher', '12+4 System', 'ប្រព័ន្ធ ១២+៤', 3),
    ('capital-practice-primary-school-practicum', 'Practicum', 'កម្មសិក្សា', 1),
    ('capital-practice-primary-school-practicum', 'Lesson Planning', 'ការរៀបចំផែនការមេរៀន', 2),
    ('capital-practice-primary-school-practicum', 'Primary Mathematics', 'គណិតវិទ្យាបឋម', 3)
  ) as t(exp_slug, label_en, label_km, sort_order)
    on t.exp_slug = x.slug
on conflict (experience_id, label_en) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  PROJECTS
--
--  All three start as `draft` with `needs_review = true`. Only facts observable
--  from a live HTTP response are seeded. Deliberately left NULL: team_size,
--  duration, repository_url, started_at/completed_at, role wording, and every
--  metric. `results` is intentionally empty prose — there are no verified
--  numbers, and project_metrics rows are only public once `is_verified` is set,
--  which itself requires a source note.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.projects (
  slug, status, project_status, featured, sort_order,
  role_en, role_km, organization_en, organization_km,
  live_url, year_label,
  needs_review, review_note
) values
  (
    'krusmart', 'draft', 'live', true, 1,
    'Product design and development', 'ការរចនា និងអភិវឌ្ឍផលិតផល',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://www.krusmart.org/', null,
    true,
    'Verified from the live site only: Khmer-first UI, the title "KruSmart (PTEC) - ជំនួយការគ្រូបង្រៀនឌីជីថល", an account gate with email/password, a password-strength meter, terms acceptance and an arithmetic bot challenge; hosted on Netlify; the CSP allowlist evidences Firebase, the Google Gemini API, EmailJS, Google Analytics, reCAPTCHA and a separate KHQR service on Render. NOT verified — confirm before publishing: your exact role and responsibilities, team size, duration, start/launch dates, user or school counts, and any performance figures.'
  ),
  (
    'ptec-digital-library', 'draft', 'live', true, 2,
    'Full-stack development', 'ការអភិវឌ្ឍពេញលេញ',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://library.ptec.edu.kh/', null,
    true,
    'Verified from the live site only: the title "Free Digital Library for Teacher Education"; sections Books, Theses, Publications, Learning Paths, Physical Library and News & Events; Next.js on Vercel with prerendering and a 300-second revalidation window; the CSP allowlist evidences Supabase (including realtime), Cloudflare R2, Vercel Blob, Cloudflare Turnstile, Google OAuth and Vercel Analytics; hardened headers including frame-ancestors none and form-action self. NOT verified — confirm before publishing: your role, team size, duration, launch date, collection size, and any adoption or performance numbers.'
  ),
  (
    'ptec-storage', 'draft', 'live', true, 3,
    'Infrastructure', 'មូលដ្ឋានរចនាសម្ព័ន្ធ',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://storage-ptec.online/', null,
    true,
    'Verified from the live site only: the title "PTEC Library Storage"; the landing page states it is a file-delivery service for library.ptec.edu.kh and deliberately shows nothing else; served by Cloudflare; an extremely restrictive CSP (default-src none, img-src self, frame-ancestors none, base-uri none, form-action none); referenced by the Library CSP as both an image host and an API host. NOT verified — confirm before publishing: storage backend and topology, total files or bytes served, cache strategy, and your role.'
  )
-- The slug uniqueness index is partial (`where deleted_at is null`), so the
-- index predicate has to be restated for ON CONFLICT to infer it.
on conflict (slug) where deleted_at is null do nothing;

insert into public.project_translations (
  project_id, locale, title, summary, problem, target_users, overview,
  architecture, security_notes, seo_title, seo_description, translation_state
)
select p.id, t.locale, t.title, t.summary, t.problem, t.target_users, t.overview,
       t.architecture, t.security_notes, t.seo_title, t.seo_description, 'complete'
  from public.projects p
  join (values
    -- ── KruSmart ────────────────────────────────────────────────────────────
    ('krusmart', 'en'::public.content_locale,
     'KruSmart — Digital Teacher Assistant',
     'A Khmer-first web application that gives teachers at PTEC a single place to manage classroom and student information.',
     'Teacher-education work generates a lot of record keeping — class lists, student details, assessment notes — and most of it lives in spreadsheets that are hard to share, easy to break and impossible to use from a phone.',
     'Teachers and student teachers at Phnom Penh Teacher Education College.',
     'KruSmart (ជំនួយការគ្រូបង្រៀនឌីជីថល) is a digital teacher assistant built around a Khmer-first interface. Access is gated behind an account, so classroom data is never public.',
     'The account gate enforces a password-strength check, explicit terms acceptance and an arithmetic bot challenge before registration completes. The deployment is served from Netlify, with Firebase behind the application, a Gemini-powered assistant, EmailJS for transactional mail and a separate KHQR service.',
     'Registration is protected by a bot challenge and a password-strength requirement. The response sets HSTS with preload, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, a Referrer-Policy, and a Content-Security-Policy that pins every third-party origin the app is allowed to talk to.',
     'KruSmart — Digital Teacher Assistant for PTEC',
     'A Khmer-first classroom and student management web app for teachers at Phnom Penh Teacher Education College, built by Ron Raksmey.'),

    ('krusmart', 'km'::public.content_locale,
     'KruSmart — ជំនួយការគ្រូបង្រៀនឌីជីថល',
     'កម្មវិធីវេបភាសាខ្មែរជាចម្បង ដែលផ្តល់ឱ្យគ្រូនៅ PTEC មានកន្លែងតែមួយសម្រាប់គ្រប់គ្រងព័ត៌មានថ្នាក់រៀន និងសិស្ស។',
     'ការងារបណ្តុះបណ្តាលគ្រូបង្កើតឯកសារកត់ត្រាច្រើន — បញ្ជីថ្នាក់ ព័ត៌មានសិស្ស កំណត់ត្រាវាយតម្លៃ — ហើយភាគច្រើនស្ថិតនៅក្នុងឯកសារ Excel ដែលពិបាកចែករំលែក ងាយខូច និងមិនអាចប្រើពីទូរស័ព្ទបានទេ។',
     'គ្រូបង្រៀន និងគរុនិស្សិតនៅវិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ។',
     'KruSmart (ជំនួយការគ្រូបង្រៀនឌីជីថល) គឺជាជំនួយការគ្រូបង្រៀនឌីជីថល ដែលបង្កើតឡើងជុំវិញផ្ទាំងប្រើប្រាស់ភាសាខ្មែរជាចម្បង។ ការចូលប្រើត្រូវការគណនី ដូច្នេះទិន្នន័យថ្នាក់រៀនមិនបានបង្ហាញជាសាធារណៈឡើយ។',
     'ការបង្កើតគណនីតម្រូវឱ្យមានការពិនិត្យកម្រិតសុវត្ថិភាពពាក្យសម្ងាត់ ការយល់ព្រមលក្ខខណ្ឌប្រើប្រាស់ និងការផ្ទៀងផ្ទាត់ការពារ Bot បែបគណិតវិទ្យា។ ប្រព័ន្ធដំណើរការលើ Netlify ដោយមាន Firebase នៅខាងក្រោយ ជំនួយការដែលដំណើរការដោយ Gemini EmailJS សម្រាប់អ៊ីមែល និងសេវា KHQR ដោយឡែក។',
     'ការបង្កើតគណនីត្រូវបានការពារដោយការផ្ទៀងផ្ទាត់ Bot និងតម្រូវការកម្រិតសុវត្ថិភាពពាក្យសម្ងាត់។ ការឆ្លើយតបកំណត់ HSTS ជាមួយ preload, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy និង Content-Security-Policy ដែលកំណត់ដើមកំណើតទីបីទាំងអស់ដែលកម្មវិធីអាចទាក់ទង។',
     'KruSmart — ជំនួយការគ្រូបង្រៀនឌីជីថលសម្រាប់ PTEC',
     'កម្មវិធីវេបគ្រប់គ្រងថ្នាក់រៀន និងសិស្សភាសាខ្មែរជាចម្បង សម្រាប់គ្រូនៅវិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ បង្កើតដោយ រុន រស្មី។'),

    -- ── PTEC Digital Library ────────────────────────────────────────────────
    ('ptec-digital-library', 'en'::public.content_locale,
     'PTEC Digital Library',
     'A free digital library for teacher education, giving students and staff searchable access to books, theses and publications.',
     'Academic material at a teacher-education college is spread across physical shelves, personal drives and printed theses. If a student cannot find a text, it may as well not exist.',
     'Students, student teachers, lecturers and library staff at PTEC, plus anyone researching Cambodian teacher education.',
     'The PTEC Digital Library (បណ្ណាល័យវិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ) publishes the college''s collection online as a browsable, searchable catalogue. Alongside the digital catalogue it documents the physical library — rules, opening hours, collection, committee and team — so the online and on-site services are one service.',
     'A Next.js application deployed on Vercel. Pages are prerendered with a 300-second revalidation window, so the catalogue stays fast while remaining current. Supabase provides the database and realtime channel; file delivery is split across Cloudflare R2 and Vercel Blob, fronted by the dedicated storage host. Sign-in uses Google OAuth, and Cloudflare Turnstile guards the forms.',
     'The response headers are deliberately strict: frame-ancestors none, object-src none, form-action self, X-Frame-Options DENY and HSTS with preload. The Content-Security-Policy enumerates every permitted origin for scripts, images, fonts and network calls rather than relying on wildcards.',
     'PTEC Digital Library — Free Digital Library for Teacher Education',
     'A searchable digital library of books, theses and publications for Phnom Penh Teacher Education College, built with Next.js and Supabase.'),

    ('ptec-digital-library', 'km'::public.content_locale,
     'បណ្ណាល័យឌីជីថល PTEC',
     'បណ្ណាល័យឌីជីថលឥតគិតថ្លៃសម្រាប់ការបណ្តុះបណ្តាលគ្រូ ដែលផ្តល់ឱ្យសិស្ស និងបុគ្គលិកអាចស្វែងរកសៀវភៅ និក្ខេបបទ និងស្នាដៃស្រាវជ្រាវ។',
     'ឯកសារសិក្សានៅវិទ្យាស្ថានបណ្តុះបណ្តាលគ្រូ ខ្ចាត់ខ្ចាយនៅលើធ្នើរសៀវភៅ ក្នុងឧបករណ៍ផ្ទាល់ខ្លួន និងនិក្ខេបបទបោះពុម្ព។ ប្រសិនបើសិស្សរកមិនឃើញឯកសារ វាដូចជាឯកសារនោះមិនមានទេ។',
     'សិស្ស គរុនិស្សិត សាស្ត្រាចារ្យ និងបុគ្គលិកបណ្ណាល័យនៅ PTEC ព្រមទាំងអ្នកស្រាវជ្រាវអំពីការបណ្តុះបណ្តាលគ្រូនៅកម្ពុជា។',
     'បណ្ណាល័យវិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ បង្ហាញឯកសារសម្រាំងរបស់វិទ្យាស្ថានតាមអ៊ីនធឺណិត ជាកាតាឡុកដែលអាចរុករក និងស្វែងរកបាន។ ក្រៅពីកាតាឡុកឌីជីថល វាក៏ចងក្រងព័ត៌មានអំពីបណ្ណាល័យរូបវន្តផងដែរ — បទបញ្ជា ម៉ោងបើក ឯកសារសម្រាំង គណៈកម្មការ និងក្រុមការងារ។',
     'កម្មវិធី Next.js ដែលដំណើរការលើ Vercel។ ទំព័រត្រូវបានបង្កើតជាមុន ជាមួយរយៈពេលធ្វើបច្ចុប្បន្នភាព ៣០០ វិនាទី ដូច្នេះកាតាឡុកនៅតែរហ័ស និងថ្មីជានិច្ច។ Supabase ផ្តល់មូលដ្ឋានទិន្នន័យ និងឆានែល realtime។ ការបញ្ជូនឯកសារបែងចែករវាង Cloudflare R2 និង Vercel Blob។ ការចូលប្រើប្រើ Google OAuth ហើយ Cloudflare Turnstile ការពារទម្រង់បំពេញ។',
     'ក្បាលឆ្លើយតបត្រូវបានកំណត់យ៉ាងតឹងរឹង៖ frame-ancestors none, object-src none, form-action self, X-Frame-Options DENY និង HSTS ជាមួយ preload។ Content-Security-Policy រាយបញ្ជីដើមកំណើតដែលអនុញ្ញាតទាំងអស់ ជាជាងពឹងលើ wildcard។',
     'បណ្ណាល័យឌីជីថល PTEC — បណ្ណាល័យឥតគិតថ្លៃសម្រាប់ការបណ្តុះបណ្តាលគ្រូ',
     'បណ្ណាល័យឌីជីថលដែលអាចស្វែងរកបាន សម្រាប់សៀវភៅ និក្ខេបបទ និងស្នាដៃស្រាវជ្រាវរបស់វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ បង្កើតដោយ Next.js និង Supabase។'),

    -- ── PTEC Storage ────────────────────────────────────────────────────────
    ('ptec-storage', 'en'::public.content_locale,
     'PTEC Storage',
     'The file-delivery layer behind the PTEC Digital Library — deliberately invisible, and built to stay that way.',
     'A digital library is only as good as its file delivery. Serving book scans and theses from the application itself couples download traffic to page traffic and makes every large file a performance problem.',
     'Indirectly, every reader of the PTEC Digital Library. Directly, the library application itself.',
     'PTEC Storage is a dedicated file-delivery service for library.ptec.edu.kh. Its landing page says so and nothing more: there is no catalogue, no navigation and no content to browse. That is the design — it is infrastructure, not a destination.',
     'Served by Cloudflare and referenced by the library application as both an image host and an API host, which separates asset delivery from application rendering.',
     'The service ships one of the most restrictive policies of the three projects: default-src none, img-src self, frame-ancestors none, base-uri none and form-action none, plus nosniff, DENY framing and HSTS. Because it has no UI to protect, everything that is not file delivery is switched off.',
     'PTEC Storage — File Delivery for the PTEC Digital Library',
     'A dedicated Cloudflare-served file-delivery service for the PTEC Digital Library, hardened with a deny-by-default Content-Security-Policy.'),

    ('ptec-storage', 'km'::public.content_locale,
     'PTEC Storage',
     'ស្រទាប់បញ្ជូនឯកសារនៅខាងក្រោយបណ្ណាល័យឌីជីថល PTEC — មិនបង្ហាញខ្លួន ហើយត្រូវបានបង្កើតឡើងដើម្បីរក្សាភាពនោះ។',
     'បណ្ណាល័យឌីជីថលមានតម្លៃស្មើនឹងសមត្ថភាពបញ្ជូនឯកសាររបស់វា។ ការបញ្ជូនឯកសារស្កេន និងនិក្ខេបបទចេញពីកម្មវិធីដោយផ្ទាល់ ធ្វើឱ្យចរាចរណ៍ទាញយកភ្ជាប់ជាមួយចរាចរណ៍ទំព័រ និងធ្វើឱ្យឯកសារធំៗក្លាយជាបញ្ហាដំណើរការ។',
     'ដោយប្រយោល គឺអ្នកអានបណ្ណាល័យឌីជីថល PTEC ទាំងអស់។ ដោយផ្ទាល់ គឺកម្មវិធីបណ្ណាល័យខ្លួនឯង។',
     'PTEC Storage គឺជាសេវាបញ្ជូនឯកសារដោយឡែកសម្រាប់ library.ptec.edu.kh។ ទំព័រដើមរបស់វាបញ្ជាក់តែប៉ុណ្ណោះ៖ គ្មានកាតាឡុក គ្មានផ្ទាំងរុករក និងគ្មានខ្លឹមសារសម្រាប់មើលឡើយ។ នេះជាការរចនាដោយចេតនា — វាជាមូលដ្ឋានរចនាសម្ព័ន្ធ មិនមែនទីតាំងសម្រាប់ទស្សនាទេ។',
     'ដំណើរការដោយ Cloudflare ហើយត្រូវបានយោងដោយកម្មវិធីបណ្ណាល័យទាំងជាកន្លែងផ្ទុករូបភាព និងជា API ដែលបែងចែកការបញ្ជូនឯកសារពីការបង្ហាញកម្មវិធី។',
     'សេវានេះប្រើគោលនយោបាយតឹងរឹងបំផុតក្នុងចំណោមគម្រោងទាំងបី៖ default-src none, img-src self, frame-ancestors none, base-uri none និង form-action none បន្ថែមដោយ nosniff, DENY framing និង HSTS។ ដោយវាគ្មានផ្ទាំងប្រើប្រាស់ដែលត្រូវការពារ អ្វីទាំងអស់ដែលមិនមែនការបញ្ជូនឯកសារត្រូវបានបិទ។',
     'PTEC Storage — ការបញ្ជូនឯកសារសម្រាប់បណ្ណាល័យឌីជីថល PTEC',
     'សេវាបញ្ជូនឯកសារដោយឡែកដែលដំណើរការលើ Cloudflare សម្រាប់បណ្ណាល័យឌីជីថល PTEC ជាមួយ Content-Security-Policy បែប deny-by-default។')
  ) as t(proj_slug, locale, title, summary, problem, target_users, overview,
         architecture, security_notes, seo_title, seo_description)
    on t.proj_slug = p.slug
on conflict (project_id, locale) do nothing;

-- Category assignments
insert into public.project_category_links (project_id, category_id)
select p.id, c.id
  from public.projects p
  join (values
    ('krusmart', 'education-technology'),
    ('krusmart', 'web-application'),
    ('ptec-digital-library', 'academic-repository'),
    ('ptec-digital-library', 'education-technology'),
    ('ptec-digital-library', 'web-application'),
    ('ptec-storage', 'storage-infrastructure')
  ) as l(proj_slug, cat_slug) on l.proj_slug = p.slug
  join public.project_categories c on c.slug = l.cat_slug
on conflict do nothing;

-- Technology assignments — each one is evidenced by a live response header or a
-- Content-Security-Policy allowlist entry, never inferred from the UI.
insert into public.project_technologies (project_id, technology_id, sort_order)
select p.id, t.id, l.sort_order
  from public.projects p
  join (values
    ('krusmart', 'netlify', 1),
    ('krusmart', 'firebase', 2),
    ('krusmart', 'gemini-api', 3),
    ('krusmart', 'emailjs', 4),
    ('krusmart', 'recaptcha', 5),
    ('krusmart', 'render', 6),
    ('krusmart', 'google-analytics', 7),

    ('ptec-digital-library', 'nextjs', 1),
    ('ptec-digital-library', 'react', 2),
    ('ptec-digital-library', 'vercel', 3),
    ('ptec-digital-library', 'supabase', 4),
    ('ptec-digital-library', 'postgresql', 5),
    ('ptec-digital-library', 'cloudflare-r2', 6),
    ('ptec-digital-library', 'vercel-blob', 7),
    ('ptec-digital-library', 'cloudflare-turnstile', 8),
    ('ptec-digital-library', 'google-oauth', 9),
    ('ptec-digital-library', 'vercel-analytics', 10),

    ('ptec-storage', 'cloudflare', 1)
  ) as l(proj_slug, tech_slug, sort_order) on l.proj_slug = p.slug
  join public.technologies t on t.slug = l.tech_slug
on conflict do nothing;

-- Capability evidence links
insert into public.skill_project_links (skill_id, project_id)
select s.id, p.id
  from public.skills s
  join public.skill_categories sc on sc.id = s.category_id
  join (values
    ('product-engineering', 'nextjs',                 'ptec-digital-library'),
    ('product-engineering', 'supabase',               'ptec-digital-library'),
    ('product-engineering', 'postgresql',             'ptec-digital-library'),
    ('product-engineering', 'full-stack-development', 'ptec-digital-library'),
    ('product-engineering', 'auth',                   'ptec-digital-library'),
    ('product-engineering', 'auth',                   'krusmart'),
    ('product-engineering', 'api-integration',        'krusmart'),
    ('academic-systems',    'digital-libraries',      'ptec-digital-library'),
    ('academic-systems',    'academic-repositories',  'ptec-digital-library'),
    ('academic-systems',    'search-discovery',       'ptec-digital-library'),
    ('academic-systems',    'file-media-systems',     'ptec-storage'),
    ('academic-systems',    'multilingual-platforms', 'krusmart'),
    ('education',           'education-technology',   'krusmart'),
    ('product-quality',     'security',               'ptec-storage'),
    ('product-quality',     'security',               'ptec-digital-library'),
    ('product-quality',     'performance',            'ptec-digital-library')
  ) as l(cat_slug, skill_slug, proj_slug)
    on l.cat_slug = sc.slug and l.skill_slug = s.slug
  join public.projects p on p.slug = l.proj_slug
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  TESTIMONIALS
--
--  Migrated as drafts. Two things changed from v1 on purpose:
--   1. The star ratings are gone. They were invented decoration on real people's
--      words.
--   2. Ron Saroeun's mobile number, which v1 rendered publicly, is not migrated
--      and the schema has nowhere to put it.
--  They stay unpublished until consent is recorded — the database enforces this.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.testimonials
  (slug, status, featured, sort_order, author_name_en, author_name_km, author_url, relationship)
values
  ('ron-saroeun', 'draft', true,  1, 'Ron Saroeun', 'រុន សារឿន', null, 'colleague'),
  ('kem-deth',    'draft', true,  2, 'Kem Deth',    'គឹម ដេត',   'https://kem-deth.netlify.app/', 'collaborator'),
  ('hum-sanet',   'draft', true,  3, 'Hum Sanet',   'ហ៊ុំ សាណេត', null, 'classmate')
-- The slug uniqueness index is partial (`where deleted_at is null`), so the
-- index predicate has to be restated for ON CONFLICT to infer it.
on conflict (slug) where deleted_at is null do nothing;

insert into public.testimonial_translations
  (testimonial_id, locale, quote, author_role, organization, translation_state)
select ts.id, t.locale, t.quote, t.author_role, t.organization, 'complete'
  from public.testimonials ts
  join (values
    ('ron-saroeun', 'en'::public.content_locale,
     'Raksmey is an incredibly dedicated individual. His deep understanding of mathematics and passion for sharing knowledge makes him an excellent educator.',
     'Web Developer', 'Wing Bank'),
    ('ron-saroeun', 'km'::public.content_locale,
     'រស្មី គឺជាបុគ្គលដែលមានការលះបង់យ៉ាងខ្លាំង។ ការយល់ដឹងស៊ីជម្រៅរបស់គាត់អំពីគណិតវិទ្យា និងចំណង់ចំណូលចិត្តក្នុងការចែករំលែកចំណេះដឹងធ្វើឱ្យគាត់ក្លាយជាអ្នកអប់រំដ៏ល្អម្នាក់។',
     'អ្នកអភិវឌ្ឍន៍វេបសាយ', 'ធនាគារវីង'),

    ('kem-deth', 'en'::public.content_locale,
     'Raksmey has a profound passion for teaching and technology. His ability to integrate digital tools into his educational approach is truly inspiring.',
     'Web Developer', null),
    ('kem-deth', 'km'::public.content_locale,
     'រស្មី មានចំណង់ចំណូលចិត្តយ៉ាងជ្រាលជ្រៅចំពោះការបង្រៀន និងបច្ចេកវិទ្យា។ សមត្ថភាពរបស់គាត់ក្នុងការបញ្ចូលឧបករណ៍ឌីជីថលទៅក្នុងវិធីសាស្រ្តអប់រំរបស់គាត់គឺពិតជាគួរឱ្យស្ងើចសរសើរណាស់។',
     'អ្នកអភិវឌ្ឍន៍វេបសាយ', null),

    ('hum-sanet', 'en'::public.content_locale,
     'Raksmey is a fantastic collaborator. As a course representative I have seen how he blends technology with education, and I appreciate his creativity.',
     'Course Representative', 'Phnom Penh Teacher Education College (PTEC)'),
    ('hum-sanet', 'km'::public.content_locale,
     'រស្មី គឺជាដៃគូសហការដ៏អស្ចារ្យ។ ក្នុងនាមខ្ញុំជាគណវគ្គ ខ្ញុំបានឃើញរបៀបដែលគាត់រួមបញ្ចូលបច្ចេកវិទ្យាជាមួយការអប់រំ ហើយខ្ញុំកោតសរសើរភាពច្នៃប្រឌិតរបស់គាត់។',
     'គណវគ្គ', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)')
  ) as t(ts_slug, locale, quote, author_role, organization)
    on t.ts_slug = ts.slug
on conflict (testimonial_id, locale) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
--  LOCAL DEVELOPMENT ADMIN
--
--  ⚠️  LOCAL ONLY. This block runs from `supabase db reset`, which only ever
--  targets the local stack. `supabase db push` does not execute seed.sql, so it
--  cannot reach a hosted project.
--
--  For production, create the account in the Supabase dashboard (Authentication
--  → Users) and then grant the role explicitly:
--
--      insert into public.admin_roles (user_id, role)
--      select id, 'owner' from auth.users where email = 'you@example.com';
--
--      insert into public.profiles (id, email, display_name, is_site_owner)
--      select id, email, 'Ron Raksmey', true from auth.users
--       where email = 'you@example.com';
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_user_id uuid := '00000000-0000-4000-8000-000000000001';
  v_email   text := 'admin@localhost.test';
begin
  -- Only create the local account when it is genuinely absent.
  if not exists (select 1 from auth.users where id = v_user_id) then
    /*
     * The four empty-string token columns are not decoration.
     *
     * GoTrue scans these into non-nullable Go strings. A row inserted by hand
     * leaves them NULL, and every sign-in then fails with
     * `500 Database error querying schema` — an error that says nothing about the
     * real cause. Setting them to '' is what makes a hand-seeded account usable.
     */
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new,
      created_at, updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_email,
      extensions.crypt('localdev-password', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Local Dev Owner"}'::jsonb,
      '', '', '', '',
      now(), now()
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      extensions.gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  insert into public.profiles (
    id, email, display_name, is_site_owner,
    public_headline_en, public_headline_km,
    public_bio_en, public_bio_km,
    public_location, public_avatar_url
  ) values (
    v_user_id, v_email, 'Ron Raksmey', true,
    'Educator, Mathematics Student and Full-Stack Product Builder',
    'អ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល',
    'I am an educator, mathematics student and full-stack product builder creating practical digital platforms for teachers, students and academic institutions in Cambodia.',
    'ខ្ញុំជាអ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល ដែលកំពុងបង្កើតវេទិកាឌីជីថលជាក់ស្តែងសម្រាប់គ្រូបង្រៀន សិស្សានុសិស្ស និងស្ថាប័នសិក្សានៅកម្ពុជា។',
    'Phnom Penh, Cambodia',
    '/image/MyPF.jpg'
  )
  on conflict (id) do update
    set is_site_owner = true,
        display_name = excluded.display_name;

  insert into public.admin_roles (user_id, role, note)
  values (v_user_id, 'owner', 'Seeded local development owner.')
  on conflict (user_id) do update set role = 'owner', revoked_at = null;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Post-seed sanity report — printed by `supabase db reset`.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_projects int;
  v_drafts   int;
  v_review   int;
begin
  select count(*) into v_projects from public.projects where deleted_at is null;
  select count(*) into v_drafts   from public.projects where status = 'draft';
  select count(*) into v_review   from public.projects where needs_review;

  raise notice '── Seed complete ────────────────────────────────';
  raise notice 'Projects seeded: % (drafts: %, needing review: %)',
    v_projects, v_drafts, v_review;
  raise notice 'Certificates seeded: 0 — categories only, by design.';
  raise notice 'Nothing was auto-published. Review each draft in /admin first.';
  raise notice '─────────────────────────────────────────────────';
end $$;
