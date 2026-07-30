-- ═══════════════════════════════════════════════════════════════════════════
--  0004 — Projects and case studies
--
--  Locale-independent facts live on `projects`. All prose lives in
--  `project_translations`, one row per locale. Nothing translatable is
--  duplicated on the parent table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Taxonomies ──────────────────────────────────────────────────────────────

create table if not exists public.project_categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name_en     text not null,
  name_km     text,
  description_en text,
  description_km text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint project_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create trigger project_categories_set_updated_at
  before update on public.project_categories
  for each row execute function public.set_updated_at();

create table if not exists public.technologies (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  -- e.g. language / framework / database / platform / service / tool
  group_name  text,
  icon        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint technologies_slug_format check (slug ~ '^[a-z0-9+.#-]+$')
);

create trigger technologies_set_updated_at
  before update on public.technologies
  for each row execute function public.set_updated_at();

-- ── projects ────────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null,
  status          public.publication_status not null default 'draft',
  project_status  public.project_status not null default 'live',
  featured        boolean not null default false,
  sort_order      integer not null default 0,

  -- Locale-independent facts. All nullable: an unverified fact must be able to
  -- stay empty rather than being filled in with a guess.
  role_en         text,
  role_km         text,
  organization_en text,
  organization_km text,
  team_size       integer,
  duration_label_en text,
  duration_label_km text,
  live_url        text,
  repository_url  text,
  cover_media_id  uuid references public.media_assets (id) on delete set null,
  og_image_media_id uuid references public.media_assets (id) on delete set null,
  demo_video_url  text,

  started_at      date,
  completed_at    date,

  -- True until a human has confirmed the auto-seeded values. Surfaced in the
  -- admin UI and blocks a silent publish.
  needs_review    boolean not null default false,
  review_note     text,

  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,

  constraint projects_slug_format check (slug ~ '^[a-z0-9-]+$' and length(slug) between 2 and 80),
  constraint projects_team_size_sane check (team_size is null or team_size between 1 and 500),
  constraint projects_dates_ordered check (
    started_at is null or completed_at is null or completed_at >= started_at
  ),
  constraint projects_live_url_absolute check (
    live_url is null or live_url ~* '^https?://'
  ),
  constraint projects_repo_url_absolute check (
    repository_url is null or repository_url ~* '^https?://'
  ),
  constraint projects_demo_url_absolute check (
    demo_video_url is null or demo_video_url ~* '^https?://'
  )
);

-- Slug uniqueness applies to live rows only, so a soft-deleted project does not
-- permanently squat on its slug.
create unique index if not exists projects_slug_unique_live
  on public.projects (slug)
  where deleted_at is null;

create index if not exists projects_public_listing_idx
  on public.projects (published_at desc, sort_order)
  where status = 'published' and deleted_at is null;

create index if not exists projects_featured_idx
  on public.projects (sort_order)
  where featured and status = 'published' and deleted_at is null;

create index if not exists projects_status_idx
  on public.projects (status)
  where deleted_at is null;

create index if not exists projects_needs_review_idx
  on public.projects (updated_at desc)
  where needs_review and deleted_at is null;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger projects_sync_published_at
  before insert or update of status on public.projects
  for each row execute function public.sync_published_at();

-- ── project_translations ────────────────────────────────────────────────────
-- The full case study, per locale. Long-form fields are nullable so a partially
-- written case study is a legal draft.
create table if not exists public.project_translations (
  id              uuid primary key default extensions.gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  locale          public.content_locale not null,

  title           text not null,
  summary         text,

  -- Case-study sections
  overview        text,
  problem         text,
  target_users    text,
  goals           text,
  my_role         text,
  responsibilities text,
  constraints     text,
  research        text,
  ux_decisions    text,
  architecture    text,
  database_decisions text,
  key_features    text,
  security_notes  text,
  accessibility_notes text,
  seo_notes       text,
  performance_notes text,
  challenges      text,
  solution        text,
  results         text,
  lessons         text,
  next_steps      text,

  -- Structured rich-content blocks (validated application-side against a
  -- closed block schema; never raw HTML).
  body_blocks     jsonb not null default '[]'::jsonb,

  seo_title       text,
  seo_description text,

  translation_state public.translation_state not null default 'partial',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint project_translations_unique_locale unique (project_id, locale),
  constraint project_translations_title_not_blank check (btrim(title) <> ''),
  constraint project_translations_body_is_array check (
    jsonb_typeof(body_blocks) = 'array'
  ),
  constraint project_translations_seo_title_length check (
    seo_title is null or length(seo_title) <= 70
  ),
  constraint project_translations_seo_description_length check (
    seo_description is null or length(seo_description) between 50 and 160
  )
);

create index if not exists project_translations_locale_idx
  on public.project_translations (locale);

-- Backs the public keyword search on the projects list page.
create index if not exists project_translations_search_idx
  on public.project_translations
  using gin ((coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(problem, '')) extensions.gin_trgm_ops);

create trigger project_translations_set_updated_at
  before update on public.project_translations
  for each row execute function public.set_updated_at();

-- ── Join tables ─────────────────────────────────────────────────────────────

create table if not exists public.project_category_links (
  project_id  uuid not null references public.projects (id) on delete cascade,
  category_id uuid not null references public.project_categories (id) on delete cascade,
  primary key (project_id, category_id)
);

create index if not exists project_category_links_category_idx
  on public.project_category_links (category_id);

create table if not exists public.project_technologies (
  project_id    uuid not null references public.projects (id) on delete cascade,
  technology_id uuid not null references public.technologies (id) on delete cascade,
  sort_order    integer not null default 0,
  primary key (project_id, technology_id)
);

create index if not exists project_technologies_technology_idx
  on public.project_technologies (technology_id);

-- ── project_media ───────────────────────────────────────────────────────────
create table if not exists public.project_media (
  id           uuid primary key default extensions.gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  media_id     uuid not null references public.media_assets (id) on delete cascade,
  -- desktop_screenshot | mobile_screenshot | diagram | before | after | gallery
  variant      text not null default 'gallery',
  caption_en   text,
  caption_km   text,
  -- Pairs a `before` shot with its `after` counterpart.
  pair_key     text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint project_media_unique unique (project_id, media_id, variant),
  constraint project_media_variant_allowed check (
    variant in ('desktop_screenshot', 'mobile_screenshot', 'diagram',
                'before', 'after', 'gallery')
  )
);

create index if not exists project_media_project_idx
  on public.project_media (project_id, sort_order);

-- ── project_features ────────────────────────────────────────────────────────
create table if not exists public.project_features (
  id            uuid primary key default extensions.gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  title_en      text not null,
  title_km      text,
  description_en text,
  description_km text,
  icon          text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists project_features_project_idx
  on public.project_features (project_id, sort_order);

create trigger project_features_set_updated_at
  before update on public.project_features
  for each row execute function public.set_updated_at();

-- ── project_metrics ─────────────────────────────────────────────────────────
-- Results are opt-in and carry their own provenance. `is_verified` defaults to
-- false and unverified metrics are filtered out of the public query, so an
-- unsubstantiated number cannot reach the public site by accident.
create table if not exists public.project_metrics (
  id            uuid primary key default extensions.gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  label_en      text not null,
  label_km      text,
  value         text not null,
  unit          text,
  -- performance | scale | efficiency | accessibility | seo | deployment | other
  metric_type   text not null default 'other',
  -- How this number was established. Required before it can be verified.
  source_note   text,
  measured_at   date,
  is_verified   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint project_metrics_type_allowed check (
    metric_type in ('performance', 'scale', 'efficiency', 'accessibility',
                    'seo', 'deployment', 'other')
  ),
  -- A metric cannot be marked verified without stating where it came from.
  constraint project_metrics_verified_needs_source check (
    not is_verified or (source_note is not null and btrim(source_note) <> '')
  )
);

create index if not exists project_metrics_project_idx
  on public.project_metrics (project_id, sort_order);

create index if not exists project_metrics_verified_idx
  on public.project_metrics (project_id)
  where is_verified;

create trigger project_metrics_set_updated_at
  before update on public.project_metrics
  for each row execute function public.set_updated_at();

comment on column public.project_metrics.is_verified is
  'Only verified metrics are returned to the public site. Requires source_note.';
