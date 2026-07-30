-- ═══════════════════════════════════════════════════════════════════════════
--  0012 — Human-readable period labels for education and experience
--
--  Why this exists: the migrated v1 content evidences years ("2023 — 2028") but
--  not months or days, and the teaching practicum has no date at all. Forcing
--  that into a `date` column would mean inventing a day and a month.
--
--  So: `started_on` / `ended_on` stay nullable and are used for sorting and for
--  structured data when a real date is known, while `period_label_*` carries
--  exactly the precision that is actually evidenced. The UI prefers the label
--  when present and falls back to formatting the dates.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.education
  add column if not exists period_label_en text,
  add column if not exists period_label_km text;

alter table public.experiences
  add column if not exists period_label_en text,
  add column if not exists period_label_km text;

comment on column public.education.period_label_en is
  'Display label at the precision that is actually known, e.g. "2023 — 2028 (expected)".';
comment on column public.experiences.period_label_en is
  'Display label at the precision that is actually known. Preferred over the date columns for rendering.';

-- Same reasoning for projects: the year is evidenced, the launch date is not.
alter table public.projects
  add column if not exists period_label_en text,
  add column if not exists period_label_km text,
  add column if not exists year_label text;

comment on column public.projects.year_label is
  'Evidenced year (or year range) for the project card. Null when unknown.';

-- ── review_note everywhere `needs_review` exists ────────────────────────────
-- `needs_review` on its own only says "something is unconfirmed". The note says
-- WHAT is unconfirmed, which is the part the admin actually needs.
alter table public.education
  add column if not exists review_note text;

alter table public.experiences
  add column if not exists review_note text;

alter table public.certificates
  add column if not exists review_note text;

comment on column public.projects.review_note is
  'Names exactly which fields are unconfirmed, shown next to the publish action.';
