-- ═══════════════════════════════════════════════════════════════════════════
--  0031 — Credential privacy defaults, and validity split from verification
--
--  Prompted by an audit of the ten published credentials on the live site. Two
--  problems, both of which the schema made easy to get wrong.
--
--  ── 1. `credential_id` was public by construction ──────────────────────────
--  The column sat in `public_certificates`, was rendered on the detail page and
--  was emitted as schema.org `identifier`. Nothing decided that; it was simply
--  in the view. On the published Bac II record the value is a 21-digit
--  examination identifier — precisely the "candidate number / examination
--  identifier / document serial number" class that must not be public by
--  default.
--
--  The fix is not to delete the column: the owner needs it, and some credentials
--  genuinely have a public verification code meant to be quoted. It is to split
--  the *value* from the *decision to publish it*. `credential_id` stays private;
--  `show_credential_id` is an explicit, default-false opt-in, and the public
--  view exposes the identifier only when that flag is set.
--
--  Same treatment for the exact score, which the audit found published as a
--  three-decimal figure alongside per-subject grades.
--
--  ── 2. One status field meant two different things ─────────────────────────
--  `credential_status` is `active | expired | revoked | unverified`, which mixes
--  "is this qualification still valid?" with "has anyone checked it is real?".
--  The consequence on the live site: all ten credentials — including permanent
--  diplomas, a university transcript and four school commendation letters —
--  render as "Active" with a green dot, which reads as *verified* to a visitor
--  and is a claim the project cannot support for any of them.
--
--  A permanent qualification is not "active"; it has no expiry. And none of the
--  ten has a working issuer verification link. So validity and verification
--  become separate columns, each with an honest default, and the old column is
--  kept and backfilled from rather than dropped — it is still what the admin
--  list and the existing RLS-tested publish gate read.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Validity: is the qualification still in force? ──────────────────────────
do $$ begin
  create type public.credential_validity as enum (
    'valid', 'no_expiry', 'expired', 'revoked', 'unknown'
  );
exception when duplicate_object then null; end $$;

-- ── Verification: has anyone established that it is genuine, and how? ───────
do $$ begin
  create type public.credential_verification as enum (
    'verified_by_issuer',
    'verification_link_available',
    'manually_reviewed',
    'awaiting_verification',
    'issuer_verification_unavailable',
    'unverified'
  );
exception when duplicate_object then null; end $$;

alter table public.certificates
  add column if not exists validity_status public.credential_validity
    not null default 'unknown',
  add column if not exists verification_status public.credential_verification
    not null default 'awaiting_verification',
  -- When the verification was actually performed. Displayed only for a status
  -- that claims verification happened, and never invented from `updated_at`.
  add column if not exists verified_on date,

  -- Secure defaults. Every one of these is a decision the owner has to take
  -- deliberately, per credential, and the absence of a decision is "do not
  -- publish it".
  add column if not exists show_credential_id boolean not null default false,
  add column if not exists show_exact_score boolean not null default false;

comment on column public.certificates.credential_id is
  'Private by default. Published only when `show_credential_id` is true — the '
  'value is frequently an examination or serial number.';
comment on column public.certificates.validity_status is
  'Is the qualification still in force? Independent of whether anyone has '
  'verified it. A permanent diploma is `no_expiry`, never `valid`.';
comment on column public.certificates.verification_status is
  'How well established it is that the credential is genuine. Defaults to '
  '`awaiting_verification`: uploading a scan verifies nothing.';

-- A verification date only means something for a status that claims one, and a
-- status that claims one is not credible without a date.
alter table public.certificates
  drop constraint if exists certificates_verified_on_matches_status;
alter table public.certificates
  add constraint certificates_verified_on_matches_status check (
    case
      when verification_status in ('verified_by_issuer', 'manually_reviewed')
        then verified_on is not null
      else verified_on is null
    end
  );

-- `verification_link_available` is a claim about a link. Without one it is false.
alter table public.certificates
  drop constraint if exists certificates_verification_link_present;
alter table public.certificates
  add constraint certificates_verification_link_present check (
    verification_status <> 'verification_link_available'
    or verification_url is not null
  );

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Deliberately conservative, and deliberately not clever. Every existing row is
-- mapped to the weakest claim its data actually supports:
--
--   • validity comes from the dates, which are facts already in the row;
--   • verification becomes `awaiting_verification` for everything, because no
--     stored field records that anyone verified anything. Inferring
--     "verified" from `credential_status = 'active'` would carry the original
--     defect forward under a new name, which is the whole thing this migration
--     exists to stop.
update public.certificates
   set validity_status = (case
         when credential_status = 'revoked' then 'revoked'
         when credential_status = 'expired' then 'expired'
         when expires_on is not null and expires_on < current_date then 'expired'
         when expires_on is not null then 'valid'
         -- No expiry date recorded on a diploma, transcript or commendation is
         -- not missing data — those documents do not expire.
         when issued_on is not null then 'no_expiry'
         else 'unknown'
       end)::public.credential_validity
 where validity_status = 'unknown';

update public.certificates
   set verification_status = (case
         when verification_url is not null then 'verification_link_available'
         else 'awaiting_verification'
       end)::public.credential_verification
 where verification_status = 'awaiting_verification';

-- ═══════════════════════════════════════════════════════════════════════════
--  Column-level privacy, enforced by the database
--
--  The public pages read `certificates` directly, not `public_certificates` —
--  PostgREST cannot embed translations, categories and media through a view, so
--  the view is not on the hot path and fixing only the view would have changed
--  nothing about what the site publishes.
--
--  So the redaction becomes a generated column. `public_credential_id` is what
--  the application selects; the private `credential_id` never appears in a
--  public query at all. That is stronger than remembering to check a flag in the
--  mapper, because the unsafe value is not in the result set to begin with.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.certificates
  drop column if exists public_credential_id;

alter table public.certificates
  add column public_credential_id text
  generated always as (case when show_credential_id then credential_id end) stored;

comment on column public.certificates.public_credential_id is
  'The credential identifier, but only once the owner opted in via '
  '`show_credential_id`. This is the column public queries select; '
  '`credential_id` itself must never appear in one.';

-- ── The public view ─────────────────────────────────────────────────────────
--
-- Dropped and recreated rather than replaced: CREATE OR REPLACE cannot remove or
-- reorder a column, and `credential_id` has to go. Verified beforehand that
-- nothing else in the schema depends on it.

drop view if exists public.public_certificates;

create view public.public_certificates
with (security_invoker = true) as
  select
    c.id,
    c.slug,
    c.category_id,
    c.credential_status,
    c.validity_status,
    c.verification_status,
    c.verified_on,
    c.featured,
    c.sort_order,
    c.issuer_en,
    c.issuer_km,
    c.issuer_url,
    c.issued_on,
    c.expires_on,
    c.public_credential_id,
    c.show_exact_score,
    c.verification_url,
    c.preview_media_id,
    c.og_image_media_id,
    c.allow_public_download,
    c.published_at
  from public.certificates c
 where public.is_publicly_visible(c.status, c.published_at, c.deleted_at);

grant select on public.public_certificates to anon, authenticated;

comment on view public.public_certificates is
  'Public projection of certificates. `credential_id` is deliberately absent: '
  'only `public_credential_id` is exposed, and only when the owner opted in.';
