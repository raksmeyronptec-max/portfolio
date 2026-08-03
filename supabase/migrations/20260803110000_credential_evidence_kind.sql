-- ═══════════════════════════════════════════════════════════════════════════
--  0032 — Separate what a credential proves from what it is merely about
--
--  `certificate_skills` is one flat list rendered under the heading "Skills
--  demonstrated". That heading is a claim, and for most of the collection it is
--  not one the document supports.
--
--  An attendance certificate from a one-day summit proves attendance. Listing
--  "Education Technology" under "skills demonstrated" invites a reader — or an
--  automated CV parser — to conclude the holder was assessed on it. A Bac II
--  certificate evidences completion of the examination and a grade; it does not
--  evidence "STEM education" or "critical thinking", however reasonable those
--  are as descriptions of the holder's interests.
--
--  So each entry now says which of two things it is:
--
--    confirms          the document itself evidences this. Completion,
--                      attendance, a grade, a named programme.
--    related_interest  a topic the credential connects to, which it does not
--                      assess. Honest context, not evidence.
--
--  ── Why every existing row becomes `related_interest` ──────────────────────
--  The weaker claim, deliberately, and for the same reason the verification
--  backfill made everything `awaiting_verification`: nothing stored anywhere
--  records that a human ever checked whether a given credential actually
--  assesses a given skill. Defaulting to `confirms` would launder the existing
--  inflation into a field that now looks deliberate, which is worse than the
--  flat list — it would carry the problem forward wearing a label that says it
--  was considered.
--
--  Promoting an entry to `confirms` is one click per skill in the admin, and it
--  is a claim the owner should make one at a time.
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.credential_evidence_kind as enum ('confirms', 'related_interest');
exception when duplicate_object then null; end $$;

alter table public.certificate_skills
  add column if not exists evidence_kind public.credential_evidence_kind
    not null default 'related_interest';

comment on column public.certificate_skills.evidence_kind is
  '`confirms` = the document evidences this. `related_interest` = a connected '
  'topic the credential does not assess. Defaults to the weaker claim.';

-- Existing rows predate the distinction, so none of them carries a decision.
update public.certificate_skills
   set evidence_kind = 'related_interest'
 where evidence_kind is null;

-- The public detail page renders the two groups separately and in this order.
create index if not exists certificate_skills_evidence_idx
  on public.certificate_skills (certificate_id, evidence_kind, sort_order);
