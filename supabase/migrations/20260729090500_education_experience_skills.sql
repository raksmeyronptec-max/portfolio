-- ═══════════════════════════════════════════════════════════════════════════
--  0006 — Education, experience, capabilities and testimonials
-- ═══════════════════════════════════════════════════════════════════════════

-- ── education ───────────────────────────────────════════════════════════════
create table if not exists public.education (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null,
  status          public.publication_status not null default 'draft',
  sort_order      integer not null default 0,

  institution_url text,
  -- e.g. high_school | teacher_education | university | professional_development
  kind            text not null default 'university',
  started_on      date,
  ended_on        date,
  is_current      boolean not null default false,
  -- Free text: "Mon–Fri", "Weekends". Kept as a label because it is not a date.
  schedule_label_en text,
  schedule_label_km text,
  -- Grade/GPA are stored as text plus their scale so "3.79" is never rendered
  -- without "/ 4.00", and so a letter grade like "A" is equally representable.
  grade_value     text,
  grade_scale     text,
  grade_source_note text,

  needs_review    boolean not null default false,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint education_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint education_kind_allowed check (
    kind in ('high_school', 'teacher_education', 'university',
             'professional_development', 'certification', 'other')
  ),
  constraint education_dates_ordered check (
    started_on is null or ended_on is null or ended_on >= started_on
  ),
  constraint education_current_has_no_end check (not is_current or ended_on is null),
  constraint education_institution_url_absolute check (
    institution_url is null or institution_url ~* '^https?://'
  ),
  -- A grade may not be published without stating its scale.
  constraint education_grade_needs_scale check (
    grade_value is null or grade_scale is not null
  )
);

create unique index if not exists education_slug_unique_live
  on public.education (slug) where deleted_at is null;

create index if not exists education_public_idx
  on public.education (sort_order, started_on desc)
  where status = 'published' and deleted_at is null;

create trigger education_set_updated_at
  before update on public.education
  for each row execute function public.set_updated_at();

create trigger education_sync_published_at
  before insert or update of status on public.education
  for each row execute function public.sync_published_at();

create table if not exists public.education_translations (
  id            uuid primary key default extensions.gen_random_uuid(),
  education_id  uuid not null references public.education (id) on delete cascade,
  locale        public.content_locale not null,
  institution   text not null,
  qualification text,
  field_of_study text,
  description   text,
  achievements  text,
  translation_state public.translation_state not null default 'partial',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint education_translations_unique_locale unique (education_id, locale),
  constraint education_translations_institution_not_blank check (btrim(institution) <> '')
);

create trigger education_translations_set_updated_at
  before update on public.education_translations
  for each row execute function public.set_updated_at();

-- ── experiences ─────────────────────────────────────────────────────────────
create table if not exists public.experiences (
  id            uuid primary key default extensions.gen_random_uuid(),
  slug          text not null,
  status        public.publication_status not null default 'draft',
  sort_order    integer not null default 0,

  -- teaching | practicum | development | volunteer | leadership | other
  kind          text not null default 'other',
  organization_url text,
  location_en   text,
  location_km   text,
  employment_type text,
  started_on    date,
  ended_on      date,
  is_current    boolean not null default false,

  needs_review  boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint experiences_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint experiences_kind_allowed check (
    kind in ('teaching', 'practicum', 'development', 'volunteer',
             'leadership', 'tutoring', 'other')
  ),
  constraint experiences_dates_ordered check (
    started_on is null or ended_on is null or ended_on >= started_on
  ),
  constraint experiences_current_has_no_end check (not is_current or ended_on is null),
  constraint experiences_org_url_absolute check (
    organization_url is null or organization_url ~* '^https?://'
  )
);

create unique index if not exists experiences_slug_unique_live
  on public.experiences (slug) where deleted_at is null;

create index if not exists experiences_public_idx
  on public.experiences (started_on desc nulls last, sort_order)
  where status = 'published' and deleted_at is null;

create trigger experiences_set_updated_at
  before update on public.experiences
  for each row execute function public.set_updated_at();

create trigger experiences_sync_published_at
  before insert or update of status on public.experiences
  for each row execute function public.sync_published_at();

create table if not exists public.experience_translations (
  id             uuid primary key default extensions.gen_random_uuid(),
  experience_id  uuid not null references public.experiences (id) on delete cascade,
  locale         public.content_locale not null,
  role_title     text not null,
  organization   text not null,
  summary        text,
  description    text,
  achievements   text,
  translation_state public.translation_state not null default 'partial',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint experience_translations_unique_locale unique (experience_id, locale),
  constraint experience_translations_role_not_blank check (btrim(role_title) <> '')
);

create trigger experience_translations_set_updated_at
  before update on public.experience_translations
  for each row execute function public.set_updated_at();

create table if not exists public.experience_tags (
  id            uuid primary key default extensions.gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  label_en      text not null,
  label_km      text,
  sort_order    integer not null default 0,
  constraint experience_tags_unique unique (experience_id, label_en)
);

-- ── Capabilities ────────────────────────────────────════════════════════════
-- Deliberately no numeric proficiency column: the redesign replaces percentage
-- bars with evidence, so a capability is demonstrated by linking it to projects
-- and credentials rather than by asserting a score.
create table if not exists public.skill_categories (
  id            uuid primary key default extensions.gen_random_uuid(),
  slug          text not null unique,
  name_en       text not null,
  name_km       text,
  description_en text,
  description_km text,
  icon          text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint skill_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create trigger skill_categories_set_updated_at
  before update on public.skill_categories
  for each row execute function public.set_updated_at();

create table if not exists public.skills (
  id            uuid primary key default extensions.gen_random_uuid(),
  category_id   uuid not null references public.skill_categories (id) on delete cascade,
  slug          text not null,
  name_en       text not null,
  name_km       text,
  description_en text,
  description_km text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint skills_slug_unique unique (category_id, slug),
  constraint skills_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index if not exists skills_category_idx
  on public.skills (category_id, sort_order) where is_published;

create trigger skills_set_updated_at
  before update on public.skills
  for each row execute function public.set_updated_at();

-- Evidence links: "this capability is demonstrated by that project".
create table if not exists public.skill_project_links (
  skill_id   uuid not null references public.skills (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  primary key (skill_id, project_id)
);

create index if not exists skill_project_links_project_idx
  on public.skill_project_links (project_id);

create table if not exists public.skill_certificate_links (
  skill_id       uuid not null references public.skills (id) on delete cascade,
  certificate_id uuid not null references public.certificates (id) on delete cascade,
  primary key (skill_id, certificate_id)
);

-- ── testimonials ────────────────────────────────════════════════════════════
-- No rating column: star ratings on personal references were removed in the
-- redesign. `consent_recorded_at` must be set before publishing.
create table if not exists public.testimonials (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null,
  status          public.publication_status not null default 'draft',
  featured        boolean not null default false,
  sort_order      integer not null default 0,

  author_name_en  text not null,
  author_name_km  text,
  -- Public profile link only. Private contact details are intentionally not
  -- modelled here: v1 published a referee's mobile number and this schema makes
  -- that impossible to repeat.
  author_url      text,
  avatar_media_id uuid references public.media_assets (id) on delete set null,
  -- e.g. colleague | mentor | classmate | supervisor | collaborator
  relationship    text,

  consent_recorded_at timestamptz,
  consent_note    text,

  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint testimonials_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint testimonials_author_not_blank check (btrim(author_name_en) <> ''),
  constraint testimonials_author_url_absolute check (
    author_url is null or author_url ~* '^https?://'
  ),
  constraint testimonials_relationship_allowed check (
    relationship is null or relationship in (
      'colleague', 'mentor', 'classmate', 'supervisor',
      'collaborator', 'student', 'other'
    )
  )
);

create unique index if not exists testimonials_slug_unique_live
  on public.testimonials (slug) where deleted_at is null;

create index if not exists testimonials_public_idx
  on public.testimonials (sort_order)
  where status = 'published' and deleted_at is null;

create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();

create trigger testimonials_sync_published_at
  before insert or update of status on public.testimonials
  for each row execute function public.sync_published_at();

-- A quote about a real person cannot be published without recorded consent.
create or replace function public.enforce_testimonial_consent()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.consent_recorded_at is null then
    raise exception
      'Testimonial % cannot be published without recorded author consent.',
      new.slug
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger testimonials_enforce_consent
  before insert or update on public.testimonials
  for each row execute function public.enforce_testimonial_consent();

create table if not exists public.testimonial_translations (
  id              uuid primary key default extensions.gen_random_uuid(),
  testimonial_id  uuid not null references public.testimonials (id) on delete cascade,
  locale          public.content_locale not null,
  quote           text not null,
  author_role     text,
  organization    text,
  translation_state public.translation_state not null default 'partial',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint testimonial_translations_unique_locale unique (testimonial_id, locale),
  constraint testimonial_translations_quote_not_blank check (btrim(quote) <> ''),
  constraint testimonial_translations_quote_length check (length(quote) <= 1200)
);

create trigger testimonial_translations_set_updated_at
  before update on public.testimonial_translations
  for each row execute function public.set_updated_at();
