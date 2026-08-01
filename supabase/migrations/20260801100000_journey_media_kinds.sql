-- ═══════════════════════════════════════════════════════════════════════════
--  0023 — `journey_photo` and `video_poster` media kinds
--
--  In its own migration, ahead of the one that uses them, for the same reason
--  0021 was: Postgres permits ALTER TYPE … ADD VALUE inside a transaction, but
--  the new value cannot be *used* in that transaction. Splitting keeps 0024
--  re-runnable.
--
--  ── Why two new kinds rather than reusing `experience_photo` ───────────────
--  `kind` is what the media library filters on, and the question the owner will
--  actually ask a year from now is "where did this photograph come from and what
--  was it for?". A classroom photograph attached to a professional role and a
--  photograph of an award ceremony are different answers, and collapsing them
--  would make the library's privacy queue unreadable at exactly the moment it
--  matters.
--
--  `video_poster` is separate again because a poster frame is not a photograph
--  of an event — it is a still standing in for a video, it is chosen for
--  legibility at small sizes rather than for what it depicts, and it should not
--  turn up when the owner filters for "photographs I might publish".
--
--  Both are PUBLIC kinds. What makes a journey photograph safe to serve is the
--  privacy review recorded on the *attachment* (see 0024), not the bucket it
--  sits in — identical to the reasoning in 0021. A file that could not pass that
--  review does not belong in this library at all.
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  alter type public.media_kind add value if not exists 'journey_photo';
end $$;

do $$ begin
  alter type public.media_kind add value if not exists 'video_poster';
end $$;
