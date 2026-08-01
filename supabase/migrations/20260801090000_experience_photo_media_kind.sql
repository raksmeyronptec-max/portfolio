-- ═══════════════════════════════════════════════════════════════════════════
--  0021 — `experience_photo` media kind
--
--  Kept in its own migration, ahead of the one that uses it.
--
--  Postgres allows ALTER TYPE … ADD VALUE inside a transaction from 12 onwards,
--  but the new value cannot be *used* in that same transaction. Splitting the
--  addition from the table that references it removes the question entirely and
--  keeps 0022 re-runnable.
--
--  Why a distinct kind rather than reusing 'other': the media library filters and
--  the upload form both branch on `kind`, and "photographs of classrooms, pupils
--  and schools" is exactly the category that needs to be findable when a privacy
--  question is asked later. It is a public kind — see `isPrivateKind` — because
--  the only image ever attached to a published experience is a redacted,
--  reviewed copy. The private original, where one exists, stays a
--  'certificate_original'-style private upload and is never attached.
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  alter type public.media_kind add value if not exists 'experience_photo';
end $$;
