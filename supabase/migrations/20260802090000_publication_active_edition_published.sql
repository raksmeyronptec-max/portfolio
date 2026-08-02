-- ═══════════════════════════════════════════════════════════════════════════
--  0028 — A publication that offers a download needs a *published* edition
--
--  ── The gap this closes ────────────────────────────────────────────────────
--  0026's publish gate checked that the active edition carried a PDF, and it
--  read `publication_versions` directly to do so. The public page reads
--  `public_publication_versions`, which additionally requires the edition's own
--  `status = 'published'`.
--
--  The two therefore disagreed. A publication could be published, with an active
--  edition, with a PDF attached — passing the gate — while the reader saw no
--  download button at all, because the edition was still a draft and the view
--  filtered it out. Nothing failed and nothing was logged; the button simply did
--  not render, which is the hardest class of bug to report.
--
--  The gate now asks the same question the view does. An edition still starts as
--  a draft, which is how one is prepared — the difference is that promoting the
--  *publication* while its active edition is unpublished is now refused, with a
--  sentence saying which control to use.
--
--  ── Why tighten the gate rather than widen the view ────────────────────────
--  Widening the view to expose the active edition regardless of its status would
--  publish the edition being prepared: the copy that has not been through privacy
--  review. The gate is the side that should move.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_publication_publish_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_english   boolean;
  v_active_status public.publication_status;
  v_active_pdf    uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.needs_review then
    raise exception
      'Publication % cannot be published while it is still marked as needing review.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Confirm the uncertain fields and clear "needs review" first.';
  end if;

  /*
   * The privacy review is mandatory, and it is mandatory here rather than in the
   * form because the form is not the only way a row reaches `published`.
   *
   * These PDFs are real teaching documents. They can carry the author's personal
   * phone number, a QR code pointing at a channel that has since changed hands,
   * a reviewer's name, or a pupil's written work. None of that is detectable
   * automatically, so publication waits on a human saying they looked.
   */
  if new.privacy_status <> 'approved' then
    raise exception
      'Publication % cannot be published before its privacy review is approved.',
      new.slug
      using errcode = 'check_violation',
            hint = 'Complete the privacy checklist in the Privacy tab, then publish.';
  end if;

  -- English is the fallback locale for the whole site; see the same rule in
  -- 0024. A book published with only a Khmer translation would render its title
  -- in Khmer on the English page under a `lang` switch — a legitimate fallback
  -- for a missing translation, a poor thing to publish deliberately.
  select exists (
    select 1 from public.publication_translations t
     where t.publication_id = new.id
       and t.locale = 'en'
       and btrim(t.title) <> ''
  ) into v_has_english;

  if not v_has_english then
    raise exception
      'Publication % cannot be published without an English title.', new.slug
      using errcode = 'check_violation',
            hint = 'Add the English translation before publishing.';
  end if;

  /*
   * A download policy that promises a file the reader cannot actually get.
   *
   * `public` and `signed` both render a download button. Two things have to be
   * true for that button to work, and 0026 only checked the first:
   *
   *   1. the active edition has a PDF; and
   *   2. the active edition is itself published — otherwise
   *      `public_publication_versions` filters it out, `has_pdf` comes back
   *      false, and the page renders no button while the gate said yes.
   */
  if new.pdf_download_policy in ('public', 'signed') then
    select v.status, v.pdf_media_id
      into v_active_status, v_active_pdf
      from public.publication_versions v
     where v.id = new.active_version_id;

    if v_active_status is null then
      raise exception
        'Publication % offers a PDF download but has no active edition.', new.slug
        using errcode = 'check_violation',
              hint = 'Create an edition and make it active, or set the download policy to "No download".';
    end if;

    if v_active_pdf is null then
      raise exception
        'Publication % offers a PDF download but its active edition has no PDF.',
        new.slug
        using errcode = 'check_violation',
              hint = 'Attach a public-safe PDF to the active edition, or set the download policy to "No download".';
    end if;

    if v_active_status <> 'published' then
      raise exception
        'Publication % offers a PDF download but its active edition is still %.',
        new.slug, v_active_status
        using errcode = 'check_violation',
              hint = 'Set the active edition''s status to Published, or set the download policy to "No download".';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_publication_publish_rules is
  'BEFORE trigger: refuses to publish a book that is flagged for review, has no '
  'approved privacy review, has no English title, or promises a download its '
  'active edition cannot actually serve — including when that edition is itself '
  'unpublished, which the public view filters out.';
