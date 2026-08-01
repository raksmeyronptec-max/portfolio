-- ═══════════════════════════════════════════════════════════════════════════
--  0024 — Journey: editorial stories, their media, and their relations
--
--  ── What this is for ───────────────────────────────────────────────────────
--  The owner has several years of photographs and video from fieldwork, teaching
--  practicums, award ceremonies, an international exchange and university life.
--  A single gallery of all of it would be a social-media feed, which is the one
--  thing this portfolio is not. So the unit of publication is a *story*: a dated,
--  titled, bilingual account of one thing that happened, which carries its own
--  media and points at whichever Experience, Education, Certificate or Project
--  record it is evidence for.
--
--  ── Reuse, not duplication ─────────────────────────────────────────────────
--  Nothing here is a second media library. `journey_media` holds no bytes and no
--  paths; it is a join onto `media_assets`, exactly like `project_media` and
--  `experience_media`, so one physical file can appear in an award story, on a
--  certificate page and in the homepage's featured strip while remaining one
--  canonical row with one checksum and one alt text.
--
--  ── Three deliberate departures from the shape that was specified ──────────
--
--  1. Categories carry `name_en` / `name_km` inline rather than having their own
--     translations table. `project_categories` already established that pattern
--     for short locale-dependent labels, `pickLocalized()` already reads it, and
--     a translations table for a two-word label buys a join and nothing else.
--     Entry *prose* does get a full `*_translations` table, because that is what
--     every other content type here does and what `resolveTranslation()` expects.
--
--  2. `journey_relations` uses four nullable foreign keys rather than a
--     `(related_type text, related_id uuid)` pair. The polymorphic pair cannot be
--     given a foreign key, which is precisely what makes "is this still linked to
--     anything?" answerable and a dangling relation impossible — the same
--     argument migration 0022 makes for not making `experience_media`
--     polymorphic. A CHECK enforces that exactly one is set, so the row still
--     behaves as a tagged union; it just has referential integrity as well.
--
--  3. Photographs and videos share `journey_media` with a `kind` discriminator
--     rather than living in separate tables. An editorial story interleaves them
--     — a video sits between the second and third photograph — and two tables
--     would mean two independent sort orders that cannot express that. The
--     CHECK constraints below make each kind's required columns mandatory, so
--     the union stays honest.
--
--  ── Video is referenced, never hosted ──────────────────────────────────────
--  `journey_media` stores an external `video_url` plus a poster image drawn from
--  the media library. It does not store uploaded video bytes, and that is a
--  design decision rather than an omission:
--
--    · the upload ceiling is 10 MB (see SIZE_LIMITS); a two-minute phone video
--      from a science fair is comfortably past that;
--    · there is no transcoder in this stack — `sharp` handles stills only — so an
--      uploaded original would be served as a camera original, which section 26
--      of the brief and every performance instinct forbid;
--    · serving video from the same origin as the site puts a 200 MB egress spike
--      in front of the pages that matter.
--
--  So the honest architecture is the one the brief itself sanctions for large
--  files: the video lives on a video platform, and this table holds the
--  reference, the poster, the bilingual title and the transcript. Everything
--  about privacy, consent and ordering works identically for both kinds.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
--  journey_categories
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.journey_categories (
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

  constraint journey_categories_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint journey_categories_name_not_blank check (btrim(name_en) <> '')
);

create trigger journey_categories_set_updated_at
  before update on public.journey_categories
  for each row execute function public.set_updated_at();

comment on table public.journey_categories is
  'Editable taxonomy for journey stories. Short labels are stored inline per '
  'locale, matching project_categories.';

-- ═══════════════════════════════════════════════════════════════════════════
--  journey_entries
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.journey_entries (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null,
  status          public.publication_status not null default 'draft',

  -- SET NULL, not CASCADE: deleting a category must never delete the stories
  -- filed under it. An uncategorised story is a legal, recoverable state.
  category_id     uuid references public.journey_categories (id) on delete set null,

  featured        boolean not null default false,
  sort_order      integer not null default 0,

  /*
   * Dates at the precision that is actually evidenced.
   *
   * The same problem migration 0012 solved for education and experience: the
   * owner knows a photograph is from 2024 but not the day, and forcing that into
   * a `date` would mean inventing one. `event_date` carries whatever real date
   * exists, `date_precision` says how much of it to believe, and the
   * `period_label_*` pair is what actually renders.
   */
  event_date      date,
  date_precision  text not null default 'day',
  period_start    date,
  period_end      date,
  period_label_en text,
  period_label_km text,

  -- Locale-dependent facts that are labels rather than prose, so they live here
  -- and are read with pickLocalized() — same treatment as experiences.location.
  location_en     text,
  location_km     text,
  organisation_en text,
  organisation_km text,

  external_url    text,

  -- The lead image. Nullable — a story may be published as prose alone.
  -- RESTRICT so a cover cannot be deleted out from under a published story.
  cover_media_id  uuid references public.media_assets (id) on delete restrict,

  -- True until a human has confirmed auto-seeded or uncertain values. Surfaced
  -- next to the publish control, and enforced by the publish gate below.
  needs_review    boolean not null default false,
  review_note     text,

  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,

  constraint journey_entries_slug_format check (
    slug ~ '^[a-z0-9-]+$' and length(slug) between 2 and 90
  ),
  constraint journey_entries_date_precision_allowed check (
    date_precision in ('day', 'month', 'year', 'range', 'unknown')
  ),
  constraint journey_entries_period_ordered check (
    period_start is null or period_end is null or period_end >= period_start
  ),
  constraint journey_entries_external_url_absolute check (
    external_url is null or external_url ~* '^https?://'
  ),
  constraint journey_entries_sort_order_range check (
    sort_order >= 0 and sort_order <= 9999
  )
);

-- Live rows only, so a soft-deleted story does not squat on its slug forever.
create unique index if not exists journey_entries_slug_unique_live
  on public.journey_entries (slug)
  where deleted_at is null;

-- The public timeline: newest first, by the date the story is *about* rather
-- than the date it was typed up.
create index if not exists journey_entries_public_timeline_idx
  on public.journey_entries (event_date desc nulls last, sort_order)
  where status = 'published' and deleted_at is null;

create index if not exists journey_entries_featured_idx
  on public.journey_entries (sort_order, event_date desc)
  where featured and status = 'published' and deleted_at is null;

create index if not exists journey_entries_category_idx
  on public.journey_entries (category_id)
  where deleted_at is null;

create index if not exists journey_entries_status_idx
  on public.journey_entries (status)
  where deleted_at is null;

create index if not exists journey_entries_needs_review_idx
  on public.journey_entries (updated_at desc)
  where needs_review and deleted_at is null;

create trigger journey_entries_set_updated_at
  before update on public.journey_entries
  for each row execute function public.set_updated_at();

create trigger journey_entries_sync_published_at
  before insert or update of status on public.journey_entries
  for each row execute function public.sync_published_at();

comment on table public.journey_entries is
  'One editorial story: a dated, titled account of one event, with its own media '
  'and links to the Experience/Education/Certificate/Project records it evidences.';
comment on column public.journey_entries.date_precision is
  'How much of event_date is actually evidenced. Rendering uses period_label_* '
  'in preference to formatting the date at a precision nobody confirmed.';

-- ═══════════════════════════════════════════════════════════════════════════
--  journey_entry_translations
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.journey_entry_translations (
  id                uuid primary key default extensions.gen_random_uuid(),
  journey_entry_id  uuid not null references public.journey_entries (id) on delete cascade,
  locale            public.content_locale not null,

  title             text not null,
  eyebrow           text,
  summary           text,
  -- The long-form account. Nullable, so a half-written story is a legal draft.
  story             text,
  -- Newline-separated bullets, matching how `achievements` works on experiences.
  highlights        text,

  seo_title         text,
  seo_description   text,

  translation_state public.translation_state not null default 'partial',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint journey_entry_translations_unique_locale
    unique (journey_entry_id, locale),
  constraint journey_entry_translations_title_not_blank check (btrim(title) <> ''),
  constraint journey_entry_translations_seo_title_length check (
    seo_title is null or length(seo_title) <= 70
  ),
  constraint journey_entry_translations_seo_description_length check (
    seo_description is null or length(seo_description) <= 200
  )
);

create index if not exists journey_entry_translations_entry_idx
  on public.journey_entry_translations (journey_entry_id, locale);

create trigger journey_entry_translations_set_updated_at
  before update on public.journey_entry_translations
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
--  journey_media
--
--  Structurally `experience_media` plus a kind discriminator and the video
--  columns. The privacy model is character-for-character the same, and
--  deliberately so — the reviewer should not have to learn two sets of rules for
--  two photographs of the same classroom.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.journey_media (
  id               uuid primary key default extensions.gen_random_uuid(),
  journey_entry_id uuid not null references public.journey_entries (id) on delete cascade,

  /*
   * photo → the image itself. video → the poster frame.
   *
   * RESTRICT, not CASCADE, exactly as in 0022: deleting an asset a published
   * story displays would silently break a public image, so the attachment has to
   * be removed first, deliberately.
   *
   * Nullable only because a video may be drafted before its poster is chosen.
   * The CHECKs below make it mandatory for a photo, and mandatory for anything
   * public.
   */
  media_id         uuid references public.media_assets (id) on delete restrict,

  kind             text not null default 'photo',
  role             text not null default 'gallery',
  sort_order       integer not null default 0,

  -- ── Video ───────────────────────────────────────────────────────────────
  -- See the header: the bytes live on a video platform, the reference lives
  -- here. `video_provider` is derived from the URL by the application and stored
  -- so the embed can be built without re-parsing on every render.
  video_url        text,
  video_provider   text,
  duration_seconds integer,
  video_title_en   text,
  video_title_km   text,
  transcript_en    text,
  transcript_km    text,

  -- ── Contextual overrides ────────────────────────────────────────────────
  -- NULL means "fall back to the media asset's own value". The same photograph
  -- in two stories deserves two captions; see the note in 0022.
  caption_en       text,
  caption_km       text,
  alt_text_en      text,
  alt_text_km      text,

  photo_date       date,
  location_en      text,
  location_km      text,
  credit           text,

  -- ── Privacy, consent, visibility ────────────────────────────────────────
  privacy_status   text not null default 'pending_review',
  consent_status   text not null default 'pending',
  visibility       text not null default 'private',

  focal_x          numeric(4,3),
  focal_y          numeric(4,3),

  -- The fact of the review, its author and its date. The ticked boxes are NOT
  -- stored — that would imply a legal record this CMS cannot substantiate.
  review_note      text,
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint journey_media_kind_allowed check (kind in ('photo', 'video')),
  constraint journey_media_role_allowed check (role in ('cover', 'gallery')),

  constraint journey_media_privacy_status_allowed check (
    privacy_status in ('pending_review', 'approved', 'rejected')
  ),
  constraint journey_media_consent_status_allowed check (
    consent_status in ('not_required', 'pending', 'confirmed', 'denied')
  ),
  constraint journey_media_visibility_allowed check (
    visibility in ('public', 'private', 'hidden')
  ),

  -- A photograph is its image. Without one there is nothing to render.
  constraint journey_media_photo_needs_asset check (
    kind <> 'photo' or media_id is not null
  ),

  -- A video is its URL, and only an http(s) one — a `javascript:` or `data:`
  -- URL reaching an iframe src would be a script-execution hole, so it is
  -- refused at the lowest layer rather than only in the form.
  constraint journey_media_video_needs_url check (
    kind <> 'video' or (video_url is not null and video_url ~* '^https://')
  ),
  constraint journey_media_video_provider_allowed check (
    video_provider is null
    or video_provider in ('youtube', 'vimeo', 'other')
  ),
  constraint journey_media_duration_sane check (
    duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 86400)
  ),

  /*
   * A public video must have a poster.
   *
   * Not cosmetic. Poster-first is what stops the page loading a third-party
   * player — and its cookies — before anyone asks for it, so "no poster" and
   * "public" together would mean an autoloading embed, which section 12 of the
   * brief and the site's own CSP posture both rule out.
   */
  constraint journey_media_public_video_needs_poster check (
    kind <> 'video' or visibility <> 'public' or media_id is not null
  ),

  /*
   * The publication invariant. This is the guarantee; everything else is
   * convenience.
   *
   * A row cannot be public unless a privacy review approved it and consent is
   * confirmed or genuinely not required. `pending`, `denied` and `rejected` are
   * all unpublishable, and no application code path — action, script, or a
   * session in Supabase Studio — can talk its way past a CHECK.
   */
  constraint journey_media_public_requires_review check (
    visibility <> 'public'
    or (privacy_status = 'approved'
        and consent_status in ('not_required', 'confirmed'))
  ),

  -- An approval must say when it happened. Prevents an "approved" row with no
  -- accountable review.
  constraint journey_media_approval_is_attributed check (
    privacy_status <> 'approved' or reviewed_at is not null
  ),

  constraint journey_media_focal_range check (
    (focal_x is null or (focal_x >= 0 and focal_x <= 1))
    and (focal_y is null or (focal_y >= 0 and focal_y <= 1))
  ),
  constraint journey_media_sort_order_range check (
    sort_order >= 0 and sort_order <= 9999
  )
);

/*
 * One live attachment per (entry, asset) — but only for photographs.
 *
 * Videos are excluded from the uniqueness rule because two videos in one story
 * legitimately share a poster image while pointing at different URLs, and a
 * video with no poster yet has `media_id IS NULL`, which a plain unique index
 * would happily allow many of but which reads confusingly next to the photo
 * rule. Stating the scope makes the intent explicit.
 */
create unique index if not exists journey_media_unique_live_photo
  on public.journey_media (journey_entry_id, media_id)
  where deleted_at is null and kind = 'photo';

-- At most one cover per story. A uniqueness rule rather than a convention,
-- because "two covers" has no meaningful rendering.
create unique index if not exists journey_media_single_cover
  on public.journey_media (journey_entry_id)
  where role = 'cover' and deleted_at is null;

create index if not exists journey_media_entry_idx
  on public.journey_media (journey_entry_id, sort_order)
  where deleted_at is null;

-- Answers "which stories use this asset?" for the library's usage panel and for
-- the delete guard.
create index if not exists journey_media_media_idx
  on public.journey_media (media_id)
  where deleted_at is null;

-- The public render path.
create index if not exists journey_media_public_idx
  on public.journey_media (journey_entry_id, role, sort_order)
  where deleted_at is null
    and visibility = 'public'
    and privacy_status = 'approved';

-- The admin work queue.
create index if not exists journey_media_pending_review_idx
  on public.journey_media (created_at desc)
  where deleted_at is null and privacy_status = 'pending_review';

create trigger journey_media_set_updated_at
  before update on public.journey_media
  for each row execute function public.set_updated_at();

comment on table public.journey_media is
  'Photographs and video references attached to a journey story. Captions and '
  'alt text here are contextual overrides of the media asset''s own values.';
comment on column public.journey_media.video_url is
  'External video platform URL. This CMS references video, it does not host it — '
  'there is no transcoder in the stack and the upload ceiling is 10 MB.';
comment on column public.journey_media.consent_status is
  'Records only that the admin asserted a consent position. It is not, and does '
  'not claim to be, evidence of legal consent.';

-- ═══════════════════════════════════════════════════════════════════════════
--  journey_relations
--
--  Four nullable foreign keys, exactly one of which is set. See the header for
--  why this is not a (related_type, related_id) pair.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.journey_relations (
  id               uuid primary key default extensions.gen_random_uuid(),
  journey_entry_id uuid not null references public.journey_entries (id) on delete cascade,

  experience_id    uuid references public.experiences (id) on delete cascade,
  education_id     uuid references public.education (id) on delete cascade,
  certificate_id   uuid references public.certificates (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete cascade,

  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),

  /*
   * Exactly one target. Written as an arithmetic sum rather than a chain of
   * boolean ORs because the sum states the rule once and cannot be edited into
   * saying "at least one" by accident when a fifth relation type is added.
   */
  constraint journey_relations_exactly_one_target check (
    (case when experience_id  is not null then 1 else 0 end)
  + (case when education_id   is not null then 1 else 0 end)
  + (case when certificate_id is not null then 1 else 0 end)
  + (case when project_id     is not null then 1 else 0 end)
  = 1
  ),
  constraint journey_relations_display_order_range check (
    display_order >= 0 and display_order <= 999
  )
);

-- One link per (story, target). Four partial indexes rather than one composite,
-- because a composite over four nullable columns treats NULLs as distinct and
-- would permit the same link twice.
create unique index if not exists journey_relations_unique_experience
  on public.journey_relations (journey_entry_id, experience_id)
  where experience_id is not null;
create unique index if not exists journey_relations_unique_education
  on public.journey_relations (journey_entry_id, education_id)
  where education_id is not null;
create unique index if not exists journey_relations_unique_certificate
  on public.journey_relations (journey_entry_id, certificate_id)
  where certificate_id is not null;
create unique index if not exists journey_relations_unique_project
  on public.journey_relations (journey_entry_id, project_id)
  where project_id is not null;

create index if not exists journey_relations_entry_idx
  on public.journey_relations (journey_entry_id, display_order);

-- The reverse direction: "which stories does this experience have?", which is
-- what the Experience and Education pages ask.
create index if not exists journey_relations_experience_idx
  on public.journey_relations (experience_id) where experience_id is not null;
create index if not exists journey_relations_education_idx
  on public.journey_relations (education_id) where education_id is not null;
create index if not exists journey_relations_certificate_idx
  on public.journey_relations (certificate_id) where certificate_id is not null;
create index if not exists journey_relations_project_idx
  on public.journey_relations (project_id) where project_id is not null;

comment on table public.journey_relations is
  'Links a journey story to the Experience, Education, Certificate or Project '
  'record it is evidence for. Exactly one target column is set per row.';

-- ═══════════════════════════════════════════════════════════════════════════
--  Publish gate
--
--  Blocks publication at the database rather than in the form, for the same
--  reason certificates do: the form is one of several ways a row can change.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_journey_publish_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_english boolean;
begin
  if new.status <> 'published' then
    return new;
  end if;

  -- `needs_review` exists to stop a seeded or uncertain record going public
  -- while a field is still marked unconfirmed. Publishing it is a decision
  -- someone has to take explicitly, by clearing the flag.
  if new.needs_review then
    raise exception
      'Journey story % cannot be published while it is still marked as needing review.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Confirm the uncertain fields and clear "needs review" first.';
  end if;

  /*
   * English is the fallback locale for the whole site — `resolveTranslation()`
   * falls back to it before falling back to anything. A story published with
   * only a Khmer translation would render its title in Khmer on the English
   * page with a `lang` switch, which is a legitimate fallback for a *missing*
   * translation but a poor thing to publish deliberately.
   */
  select exists (
    select 1 from public.journey_entry_translations t
     where t.journey_entry_id = new.id
       and t.locale = 'en'
       and btrim(t.title) <> ''
  ) into v_has_english;

  if not v_has_english then
    raise exception
      'Journey story % cannot be published without an English title.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Add the English translation before publishing.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_journey_publish_rules is
  'BEFORE trigger: refuses to publish a story that is still flagged for review '
  'or has no English translation.';

drop trigger if exists journey_entries_enforce_publish_rules on public.journey_entries;
create trigger journey_entries_enforce_publish_rules
  before insert or update on public.journey_entries
  for each row execute function public.enforce_journey_publish_rules();

/*
 * A published story's cover must be publicly renderable.
 *
 * Without this, setting the cover to a private asset would produce a published
 * page whose lead image silently resolves to nothing — `resolveImage()` returns
 * null for a private asset, which is the right defence but a confusing outcome
 * to debug from the admin.
 */
create or replace function public.enforce_journey_cover_is_public()
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
   where m.id = new.cover_media_id
     and m.deleted_at is null;

  if v_visibility is distinct from 'public' then
    raise exception
      'The cover image for journey story % must be a public media asset (got %).',
      new.slug, coalesce(v_visibility::text, 'missing asset')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists journey_entries_cover_must_be_public on public.journey_entries;
create trigger journey_entries_cover_must_be_public
  before insert or update on public.journey_entries
  for each row execute function public.enforce_journey_cover_is_public();

-- ═══════════════════════════════════════════════════════════════════════════
--  Row Level Security
--
--  RLS is the enforcement layer for this codebase; the guards and the admin UI
--  are UX. Public read policies below therefore restate every condition rather
--  than trusting the query to have filtered — a forgotten `.eq()` in
--  `lib/data/journey.ts` must not be able to leak a draft.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.journey_categories enable row level security;
alter table public.journey_entries enable row level security;
alter table public.journey_entry_translations enable row level security;
alter table public.journey_media enable row level security;
alter table public.journey_relations enable row level security;

-- ── journey_categories ─────────────────────────────────────────────────────
-- A taxonomy label is not confidential, and the public filter chips need them.
drop policy if exists journey_categories_public_read on public.journey_categories;
create policy journey_categories_public_read on public.journey_categories
  for select to anon, authenticated using (true);

drop policy if exists journey_categories_editor_write on public.journey_categories;
create policy journey_categories_editor_write on public.journey_categories
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── journey_entries ────────────────────────────────────────────────────────
drop policy if exists journey_entries_public_read on public.journey_entries;
create policy journey_entries_public_read on public.journey_entries
  for select to anon, authenticated
  using (public.is_publicly_visible(status, published_at, deleted_at));

drop policy if exists journey_entries_admin_read on public.journey_entries;
create policy journey_entries_admin_read on public.journey_entries
  for select to authenticated
  using (public.can_view_admin());

drop policy if exists journey_entries_editor_write on public.journey_entries;
create policy journey_entries_editor_write on public.journey_entries
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── journey_entry_translations ─────────────────────────────────────────────
drop policy if exists journey_entry_translations_public_read
  on public.journey_entry_translations;
create policy journey_entry_translations_public_read
  on public.journey_entry_translations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.journey_entries e
       where e.id = journey_entry_translations.journey_entry_id
         and public.is_publicly_visible(e.status, e.published_at, e.deleted_at)
    )
  );

drop policy if exists journey_entry_translations_admin_read
  on public.journey_entry_translations;
create policy journey_entry_translations_admin_read
  on public.journey_entry_translations
  for select to authenticated using (public.can_view_admin());

drop policy if exists journey_entry_translations_editor_write
  on public.journey_entry_translations;
create policy journey_entry_translations_editor_write
  on public.journey_entry_translations
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── journey_media ──────────────────────────────────────────────────────────
/*
 * The strictest predicate in the schema, and identical in shape to
 * `experience_media_public_read` in 0022.
 *
 * Parent-published is necessary but nowhere near sufficient: the attachment must
 * also be marked public, privacy-approved, consent-settled and not soft-deleted.
 *
 * The nested EXISTS on `media_assets` is not redundant with that table's own
 * policy. PostgREST resolves an embedded join with the caller's privileges, so a
 * private asset is already filtered out of the *response* — but the row
 * referencing it would still be returned, disclosing that an unpublished
 * photograph exists and how it is captioned. Filtering here means an anonymous
 * reader cannot even count them.
 *
 * Videos are exempt from the asset check only in the sense that their poster is
 * optional at draft time; the CHECK constraint already refuses a public video
 * without one, and when a poster is set it must be a public asset like any other.
 */
drop policy if exists journey_media_public_read on public.journey_media;
create policy journey_media_public_read on public.journey_media
  for select to anon, authenticated
  using (
    deleted_at is null
    and visibility = 'public'
    and privacy_status = 'approved'
    and consent_status in ('not_required', 'confirmed')
    and exists (
      select 1 from public.journey_entries e
       where e.id = journey_media.journey_entry_id
         and public.is_publicly_visible(e.status, e.published_at, e.deleted_at)
    )
    and (
      media_id is null
      or exists (
        select 1 from public.media_assets m
         where m.id = journey_media.media_id
           and m.visibility = 'public'
           and m.deleted_at is null
      )
    )
  );

drop policy if exists journey_media_admin_read on public.journey_media;
create policy journey_media_admin_read on public.journey_media
  for select to authenticated using (public.can_view_admin());

drop policy if exists journey_media_editor_write on public.journey_media;
create policy journey_media_editor_write on public.journey_media
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── journey_relations ──────────────────────────────────────────────────────
/*
 * Both ends must be public.
 *
 * A relation row pointing at a draft certificate would otherwise be returned to
 * anonymous readers — the embedded join would come back empty, but the row's
 * existence would confirm there is an unpublished certificate and that this
 * story is about it. The story end and the target end are therefore both
 * checked here.
 */
drop policy if exists journey_relations_public_read on public.journey_relations;
create policy journey_relations_public_read on public.journey_relations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.journey_entries e
       where e.id = journey_relations.journey_entry_id
         and public.is_publicly_visible(e.status, e.published_at, e.deleted_at)
    )
    and (
      (experience_id is not null and exists (
        select 1 from public.experiences x
         where x.id = journey_relations.experience_id
           and public.is_publicly_visible(x.status, x.published_at, x.deleted_at)))
      or (education_id is not null and exists (
        select 1 from public.education d
         where d.id = journey_relations.education_id
           and public.is_publicly_visible(d.status, d.published_at, d.deleted_at)))
      or (certificate_id is not null and exists (
        select 1 from public.certificates c
         where c.id = journey_relations.certificate_id
           and public.is_publicly_visible(c.status, c.published_at, c.deleted_at)))
      or (project_id is not null and exists (
        select 1 from public.projects p
         where p.id = journey_relations.project_id
           and public.is_publicly_visible(p.status, p.published_at, p.deleted_at)))
    )
  );

drop policy if exists journey_relations_admin_read on public.journey_relations;
create policy journey_relations_admin_read on public.journey_relations
  for select to authenticated using (public.can_view_admin());

drop policy if exists journey_relations_editor_write on public.journey_relations;
create policy journey_relations_editor_write on public.journey_relations
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

-- ── Grants ─────────────────────────────────────────────────────────────────
grant select on public.journey_categories to anon, authenticated;
grant select on public.journey_entries to anon, authenticated;
grant select on public.journey_entry_translations to anon, authenticated;
grant select on public.journey_media to anon, authenticated;
grant select on public.journey_relations to anon, authenticated;

grant insert, update, delete on public.journey_categories to authenticated;
grant insert, update, delete on public.journey_entries to authenticated;
grant insert, update, delete on public.journey_entry_translations to authenticated;
grant insert, update, delete on public.journey_media to authenticated;
grant insert, update, delete on public.journey_relations to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Audit trail
--
--  Each decision gets its own verb rather than collapsing into
--  'journey.updated'. Attaching, approving and publishing a photograph of other
--  people are the actions most worth reconstructing a year later, and "someone
--  edited a story" answers none of the questions that would be asked.
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
      'journey_related_project_click'
    )
  );

alter table public.analytics_events
  drop constraint if exists analytics_events_entity_type_allowed;

alter table public.analytics_events
  add constraint analytics_events_entity_type_allowed check (
    entity_type is null or entity_type in (
      'project', 'certificate', 'resume', 'page', 'social_link', 'journey'
    )
  );
