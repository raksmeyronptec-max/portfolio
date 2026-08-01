-- ═══════════════════════════════════════════════════════════════════════════
--  0025 — Publication media kinds
--
--  In its own migration, ahead of the one that uses them, for the same reason
--  0021 and 0023 were: Postgres permits ALTER TYPE … ADD VALUE inside a
--  transaction, but the new value cannot be *used* in that transaction — and
--  0026 uses all five, in CHECK constraints that make the private ones private
--  by construction. Splitting keeps 0026 re-runnable.
--
--  ── Why five kinds rather than one `publication_file` ──────────────────────
--  Because `kind` is the column the privacy rules key off, and these five have
--  genuinely different answers to "may this ever be served from a public URL?":
--
--    publication_cover     public   — the cover art, on the listing and the card
--    publication_page      public   — a rendered sample page image
--    publication_pdf       public   — the redacted, public-safe PDF
--    publication_original  PRIVATE  — the archival original the next edition is
--                                     cut from; may still carry a phone number,
--                                     a QR code or a pupil's name
--    publication_source    PRIVATE  — the LaTeX package: .tex, .sty, .bib,
--                                     figures. Private by default, always.
--
--  Collapsing them would mean the difference between "the book people may
--  download" and "the file we must never publish" lived only in application
--  code. Here it is a CHECK constraint in 0026 instead.
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  alter type public.media_kind add value if not exists 'publication_cover';
end $$;

do $$ begin
  alter type public.media_kind add value if not exists 'publication_page';
end $$;

do $$ begin
  alter type public.media_kind add value if not exists 'publication_pdf';
end $$;

do $$ begin
  alter type public.media_kind add value if not exists 'publication_original';
end $$;

do $$ begin
  alter type public.media_kind add value if not exists 'publication_source';
end $$;
