import type { Locale } from "@/i18n/config";

/**
 * The filename a downloaded résumé arrives with.
 *
 * ── Why this is derived and not stored ─────────────────────────────────────
 * The upload's own name is whatever was on the owner's disk — here,
 * `cv_ron_raksmey.pdf`. That lands in a recruiter's downloads folder beside
 * a dozen other files and says nothing about whose it is, which language it is
 * in, or how current. Renaming the stored asset would fix it once and then rot
 * the next time a file is uploaded; deriving it means every future upload is
 * named correctly without anyone remembering to do it.
 *
 * The shape is `Ron-Raksmey-Resume-EN-2026.pdf`:
 *   · the owner's name, so the file identifies itself out of context
 *   · the document type
 *   · the PDF's own locale — which is not always the page's, since an English
 *     résumé is served as a labelled fallback on the Khmer page
 *   · the year, read from the version label rather than from today's clock: a
 *     résumé published in 2026 is still the 2026 résumé when downloaded in 2027
 *
 * Falls back to the stored filename if a version is ever labelled without a
 * year, because a slightly awkward real name beats a confidently wrong one.
 */
export function resumeDownloadFilename({
  versionLabel,
  locale,
  originalFilename,
  /** Overridable so the owner's name is not hard-coded in two places. */
  owner = "Ron Raksmey",
}: {
  versionLabel: string;
  locale: Locale;
  originalFilename: string | null;
  owner?: string;
}): string {
  const year = versionLabel.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return originalFilename || `resume-${locale}.pdf`;

  const name = owner.trim().split(/\s+/).filter(Boolean).join("-");
  return `${name}-Resume-${locale.toUpperCase()}-${year}.pdf`;
}
