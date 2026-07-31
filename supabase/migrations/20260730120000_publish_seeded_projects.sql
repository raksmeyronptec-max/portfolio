-- ═══════════════════════════════════════════════════════════════════════════
--  0015 — Publish the three seeded platform projects
--
--  Context
--    KruSmart, the PTEC Digital Library and PTEC Storage were seeded as drafts.
--    RLS therefore hid them from anon, and the public Projects page rendered
--    "there are no published projects yet" while all three platforms were live
--    and in daily use. That made a working portfolio read as abandoned.
--
--  What this changes
--    Status only. No prose, no URL, no metric and no role wording is touched:
--    the seeded content is already limited to facts observable from a live HTTP
--    response, so publishing it asserts nothing that has not been verified.
--
--  What this deliberately does NOT change
--    • `needs_review` stays true, so the admin dashboard keeps flagging all
--      three for human confirmation.
--    • Every unverified column (team_size, duration, dates, repository_url,
--      metrics) stays NULL rather than being guessed.
--    • Testimonials stay draft. They are other people's words about Ron, and
--      publishing those is a consent decision for a human to make, not a
--      migration.
--    • Certificates are untouched. They hold personal identifiers and are
--      published only after the privacy review.
--
--  Idempotent and non-destructive: it only promotes rows that are still drafts
--  and still carry their seeded review note, so a project an admin has since
--  edited, unpublished on purpose, or soft-deleted is left exactly as it is.
-- ═══════════════════════════════════════════════════════════════════════════

update public.projects
   set status = 'published'
 where slug in ('krusmart', 'ptec-digital-library', 'ptec-storage')
   and status = 'draft'
   and deleted_at is null
   -- Only touch rows still in their seeded state. If someone has cleared the
   -- review note they have already looked at the row, and this must not
   -- second-guess that.
   and needs_review;

-- `published_at` is maintained by the projects_sync_published_at trigger on
-- status change, so it is not set here.
