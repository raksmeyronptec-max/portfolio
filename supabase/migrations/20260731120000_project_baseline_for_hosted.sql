-- ═══════════════════════════════════════════════════════════════════════════
--  0017 — Create the three platform projects on a hosted database
--
--  The bug this fixes
--    `supabase db push` applies migrations and nothing else. It never runs
--    seed.sql. But the three project rows, the project categories and the
--    technology list only ever existed *in* seed.sql — so on the hosted
--    project those tables were empty, and had been since day one.
--
--    Migration 0016 then applied perfectly and did nothing at all, because
--    every one of its statements joins `public.projects` and there was nothing
--    to join to. The public Projects page kept rendering "0 projects" and
--    falling back to the hard-coded platform list in lib/data/live-platforms.ts
--    — which is exactly the "reads as abandoned" state that fallback exists to
--    soften, not to be a permanent answer.
--
--  What this does
--    Creates the baseline the content import needs — categories, technologies,
--    the three project rows and their links — and then calls
--    `public.import_project_case_studies()` to fill in the case studies.
--
--  Scope
--    Projects only. Certificates, testimonials, education and experience are
--    also empty on the hosted database, and they are deliberately not created
--    here: certificates carry personal identifiers and are gated behind a
--    privacy review, and testimonials are other people's words awaiting
--    recorded consent. Publishing either from a migration would route around a
--    decision that belongs to a human.
--
--  Idempotence
--    Every insert is ON CONFLICT DO NOTHING against a real unique constraint,
--    so re-running changes nothing. On a local `db reset` this runs before
--    seed.sql, whose identical inserts then no-op — the two cannot fight.
--
--    A project the owner has already created by hand under one of these slugs
--    is left completely alone: the conflict target is the live-slug index, so
--    their row wins and nothing here overwrites it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Taxonomies ──────────────────────────────────────────────────────────────
-- The full list, not just the four in use. The Projects page builds its filter
-- controls from these tables, and a category that exists but is unused is
-- harmless — `getUsedTechnologies()` already hides technologies no published
-- project references, so an offered filter never returns an empty page.

insert into public.project_categories (slug, name_en, name_km, sort_order)
values
  ('education-technology',  'Education Technology',  'បច្ចេកវិទ្យាអប់រំ',              1),
  ('academic-repository',   'Academic Repository',   'ឃ្លាំងឯកសារសិក្សា',             2),
  ('web-application',       'Web Application',       'កម្មវិធីវេប',                    3),
  ('internal-tool',         'Internal Tool',         'ឧបករណ៍ប្រើប្រាស់ក្នុងស្ថាប័ន',    4),
  ('storage-infrastructure','Storage Infrastructure','មូលដ្ឋានរចនាសម្ព័ន្ធផ្ទុកឯកសារ', 5),
  ('ux-ui',                 'UX/UI',                 'UX/UI',                          6),
  ('open-source',           'Open Source',           'កូដចំហ',                        7),
  ('personal-project',      'Personal Project',      'គម្រោងផ្ទាល់ខ្លួន',              8)
on conflict (slug) do nothing;

-- Only technologies evidenced by a live response header or a CSP allowlist
-- entry of one of the three platforms, plus this portfolio's own stack.
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

-- ── The three projects ──────────────────────────────────────────────────────
--
--  `sort_order` is already the final order (Library, KruSmart, Storage) rather
--  than the order seed.sql used, so 0016's reordering step is a no-op here.
--
--  `review_note` is a short placeholder that starts with "Verified from",
--  which is what `is_unreviewed_project_import()` matches on. The import called
--  at the bottom of this file immediately replaces it with the full note naming
--  what still needs owner confirmation. Restating those three long notes here
--  would just create a second copy to drift.
insert into public.projects (
  slug, status, project_status, featured, sort_order,
  role_en, role_km, organization_en, organization_km,
  live_url, year_label,
  needs_review, review_note
) values
  (
    'ptec-digital-library', 'published', 'live', true, 1,
    'Full-stack development', 'ការអភិវឌ្ឍពេញលេញ',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://library.ptec.edu.kh/', null,
    true,
    'Verified from public evidence — the full note is written by the content import below.'
  ),
  (
    'krusmart', 'published', 'live', true, 2,
    'Product design and development', 'ការរចនា និងអភិវឌ្ឍផលិតផល',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://www.krusmart.org/', null,
    true,
    'Verified from public evidence — the full note is written by the content import below.'
  ),
  (
    'ptec-storage', 'published', 'live', true, 3,
    'Infrastructure', 'មូលដ្ឋានរចនាសម្ព័ន្ធ',
    'Phnom Penh Teacher Education College (PTEC)', 'វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)',
    'https://storage-ptec.online/', null,
    true,
    'Verified from public evidence — the full note is written by the content import below.'
  )
-- The slug uniqueness index is partial (`where deleted_at is null`), so the
-- index predicate has to be restated for ON CONFLICT to infer it.
on conflict (slug) where deleted_at is null do nothing;

-- ── Links ───────────────────────────────────────────────────────────────────

insert into public.project_category_links (project_id, category_id)
select p.id, c.id
  from public.projects p
  join (values
    ('ptec-digital-library', 'academic-repository'),
    ('ptec-digital-library', 'education-technology'),
    ('ptec-digital-library', 'web-application'),
    ('krusmart',             'education-technology'),
    ('krusmart',             'web-application'),
    ('ptec-storage',         'storage-infrastructure')
  ) as l(proj_slug, cat_slug) on l.proj_slug = p.slug
  join public.project_categories c on c.slug = l.cat_slug
on conflict do nothing;

-- Each entry is evidenced by a live response header or a Content-Security-Policy
-- allowlist entry, never inferred from how the UI looks.
insert into public.project_technologies (project_id, technology_id, sort_order)
select p.id, t.id, l.sort_order
  from public.projects p
  join (values
    ('ptec-digital-library', 'nextjs',               1),
    ('ptec-digital-library', 'react',                2),
    ('ptec-digital-library', 'vercel',               3),
    ('ptec-digital-library', 'supabase',             4),
    ('ptec-digital-library', 'postgresql',           5),
    ('ptec-digital-library', 'cloudflare-r2',        6),
    ('ptec-digital-library', 'vercel-blob',          7),
    ('ptec-digital-library', 'cloudflare-turnstile', 8),
    ('ptec-digital-library', 'google-oauth',         9),
    ('ptec-digital-library', 'vercel-analytics',    10),

    ('krusmart', 'netlify',          1),
    ('krusmart', 'firebase',         2),
    ('krusmart', 'gemini-api',       3),
    ('krusmart', 'emailjs',          4),
    ('krusmart', 'recaptcha',        5),
    ('krusmart', 'render',           6),
    ('krusmart', 'google-analytics', 7),

    ('ptec-storage', 'cloudflare', 1)
  ) as l(proj_slug, tech_slug, sort_order) on l.proj_slug = p.slug
  join public.technologies t on t.slug = l.tech_slug
on conflict do nothing;

-- ── Fill in the case studies ────────────────────────────────────────────────
-- Defined by migration 0016. Now that the rows it looks for exist, this is the
-- call that actually lands the bilingual prose, the features and the metrics.
select public.import_project_case_studies();
