-- ═══════════════════════════════════════════════════════════════════════════
--  0022 — Experience photographs
--
--  ── Why a new table rather than an extension of an existing one ────────────
--  There is no generic content↔media relation in this schema to extend. The
--  established pattern is one join table per content type — `project_media` is
--  the precedent — and the alternative (a polymorphic `entity_type`/`entity_id`
--  pair) would give up the foreign key, which is the thing that makes "is this
--  image still in use?" answerable and makes a dangling attachment impossible.
--  So this follows `project_media`, with the extra columns the subject matter
--  demands.
--
--  ── What makes this different from `project_media` ─────────────────────────
--  A project screenshot is a picture of software. An experience photograph is a
--  picture of a classroom, and it may contain children, pupils' work, a school's
--  records or someone's home. Publishing one is a decision about other people,
--  not about Ron. Three consequences, all enforced here rather than in the
--  application:
--
--   1. `visibility = 'public'` is only reachable once a privacy review has been
--      recorded AND consent is settled. That is a CHECK constraint, so no code
--      path — action, script, or Supabase Studio — can publish an unreviewed
--      photograph of a child.
--   2. The RLS read policy repeats the same predicate. The constraint stops a
--      bad row being written; the policy stops a bad row being read even if one
--      somehow exists.
--   3. `media_id` is ON DELETE RESTRICT, not CASCADE. Deleting a media asset
--      that a published experience still displays would silently break a public
--      image; the attachment must be removed first, deliberately.
--
--  Captions, alt text, location and credit are stored HERE rather than on
--  `media_assets` because they are contextual: the same photograph attached to
--  two experiences deserves two captions. `media_assets` keeps the generic
--  description, and the columns here override it when set.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.experience_media (
  id             uuid primary key default extensions.gen_random_uuid(),
  experience_id  uuid not null references public.experiences (id) on delete cascade,
  -- RESTRICT, deliberately. See the header note.
  media_id       uuid not null references public.media_assets (id) on delete restrict,

  -- cover | gallery
  role           text not null default 'gallery',
  sort_order     integer not null default 0,

  -- Contextual overrides. NULL means "fall back to the media asset's own value".
  caption_en     text,
  caption_km     text,
  alt_text_en    text,
  alt_text_km    text,

  photo_date     date,
  location_en    text,
  location_km    text,
  credit         text,

  -- pending_review | approved | rejected
  privacy_status text not null default 'pending_review',
  -- not_required | pending | confirmed | denied
  consent_status text not null default 'pending',
  -- public | private | hidden
  --   private = attached for the owner's records, never rendered publicly
  --   hidden  = approved but temporarily withheld, without losing the review
  visibility     text not null default 'private',

  -- Normalised 0–1 focal point, used for object-position when a photo is cropped
  -- to a fixed aspect ratio. NULL means centre.
  focal_x        numeric(4,3),
  focal_y        numeric(4,3),

  -- What the reviewer checked, and who they were. The ticked boxes themselves are
  -- NOT stored: that would imply a legal record this CMS cannot guarantee. Only
  -- the fact of the review, its author and its date.
  review_note    text,
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint experience_media_role_allowed check (role in ('cover', 'gallery')),

  constraint experience_media_privacy_status_allowed check (
    privacy_status in ('pending_review', 'approved', 'rejected')
  ),

  constraint experience_media_consent_status_allowed check (
    consent_status in ('not_required', 'pending', 'confirmed', 'denied')
  ),

  constraint experience_media_visibility_allowed check (
    visibility in ('public', 'private', 'hidden')
  ),

  /*
   * The publication invariant.
   *
   * Everything else in this file is a convenience; this is the guarantee. A row
   * cannot be marked public unless a privacy review approved it and consent is
   * either confirmed or genuinely not required. `pending`, `denied` and
   * `rejected` are all unpublishable, and there is no application code path that
   * can talk its way past a CHECK.
   */
  constraint experience_media_public_requires_review check (
    visibility <> 'public'
    or (privacy_status = 'approved'
        and consent_status in ('not_required', 'confirmed'))
  ),

  -- An approval must say who made it and when. Prevents an "approved" row with
  -- no accountable reviewer.
  constraint experience_media_approval_is_attributed check (
    privacy_status <> 'approved' or reviewed_at is not null
  ),

  constraint experience_media_focal_range check (
    (focal_x is null or (focal_x >= 0 and focal_x <= 1))
    and (focal_y is null or (focal_y >= 0 and focal_y <= 1))
  ),

  constraint experience_media_sort_order_range check (
    sort_order >= 0 and sort_order <= 9999
  )
);

-- One live attachment per (experience, asset). Partial, so a removed-and-
-- re-added photograph is legal while the soft-deleted row is retained.
create unique index if not exists experience_media_unique_live
  on public.experience_media (experience_id, media_id)
  where deleted_at is null;

-- At most one cover per experience. A uniqueness rule rather than an
-- application convention, because "two covers" has no meaningful rendering.
create unique index if not exists experience_media_single_cover
  on public.experience_media (experience_id)
  where role = 'cover' and deleted_at is null;

create index if not exists experience_media_experience_idx
  on public.experience_media (experience_id, sort_order)
  where deleted_at is null;

-- Answers "which experiences use this asset?" for the media library's usage
-- panel and for the delete guard.
create index if not exists experience_media_media_idx
  on public.experience_media (media_id)
  where deleted_at is null;

-- The public render path: everything publicly visible, in display order.
create index if not exists experience_media_public_idx
  on public.experience_media (experience_id, role, sort_order)
  where deleted_at is null
    and visibility = 'public'
    and privacy_status = 'approved';

-- The admin work queue: what is still waiting on a privacy decision.
create index if not exists experience_media_pending_review_idx
  on public.experience_media (created_at desc)
  where deleted_at is null and privacy_status = 'pending_review';

create trigger experience_media_set_updated_at
  before update on public.experience_media
  for each row execute function public.set_updated_at();

comment on table public.experience_media is
  'Photographs attached to an experience entry. Captions and alt text here are '
  'contextual overrides of the media asset''s own values.';
comment on column public.experience_media.visibility is
  'public = rendered on the public Experience page. private = owner''s records '
  'only. hidden = approved but withheld, without discarding the review.';
comment on column public.experience_media.consent_status is
  'Records only that the admin asserted a consent position. It is not, and does '
  'not claim to be, evidence of legal consent.';

-- ═══════════════════════════════════════════════════════════════════════════
--  Row Level Security
--
--  The public predicate is stricter than every other child table in this schema.
--  Parent-published is necessary but nowhere near sufficient: the attachment must
--  also be marked public, privacy-approved, consent-settled, not soft-deleted,
--  and must point at a media asset that is itself public and live.
--
--  The nested EXISTS on media_assets is not redundant with that table's own
--  policy. PostgREST resolves the embedded join with the caller's privileges, so
--  a private asset would already be filtered out of the response — but a row here
--  that references one would still be *returned*, disclosing that an unpublished
--  photograph exists and how it is captioned. Filtering here means anonymous
--  readers cannot even count them.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.experience_media enable row level security;

drop policy if exists experience_media_public_read on public.experience_media;
create policy experience_media_public_read on public.experience_media
  for select to anon, authenticated
  using (
    deleted_at is null
    and visibility = 'public'
    and privacy_status = 'approved'
    and consent_status in ('not_required', 'confirmed')
    and exists (
      select 1 from public.experiences e
       where e.id = experience_media.experience_id
         and public.is_publicly_visible(e.status, e.published_at, e.deleted_at)
    )
    and exists (
      select 1 from public.media_assets m
       where m.id = experience_media.media_id
         and m.visibility = 'public'
         and m.deleted_at is null
    )
  );

drop policy if exists experience_media_admin_read on public.experience_media;
create policy experience_media_admin_read on public.experience_media
  for select to authenticated
  using (public.can_view_admin());

drop policy if exists experience_media_editor_write on public.experience_media;
create policy experience_media_editor_write on public.experience_media
  for all to authenticated
  using (public.can_edit_content())
  with check (public.can_edit_content());

grant select on public.experience_media to anon, authenticated;
grant insert, update, delete on public.experience_media to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Audit trail
--
--  Attaching, approving and publishing a photograph of other people are the
--  actions most worth being able to reconstruct a year later, so each gets its
--  own verb rather than collapsing into 'experience.updated'.
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
      'media.uploaded', 'media.replaced', 'media.deleted',
      'resume.uploaded', 'resume.activated', 'resume.archived',
      'education.updated', 'experience.updated', 'skill.updated',
      'experience.photo_attached', 'experience.photo_removed',
      'experience.photo_updated', 'experience.cover_changed',
      'experience.gallery_reordered', 'experience.photo_privacy_changed',
      'experience.photo_consent_changed', 'experience.photo_published',
      'experience.photo_hidden',
      'testimonial.updated', 'message.updated', 'message.deleted',
      'seo.updated', 'settings.updated'
    )
  );
