import { MEDIA_COLUMNS, resolveImage, type MediaAsset, type ResolvedImage } from "./media";
import { pickLocalized, type TranslationRow } from "./translation";
import type { Locale } from "@/i18n/config";
import {
  buildBibTeX,
  buildCitation,
  citationKey,
  resolvePublicationAccess,
  type ContentLanguage,
  type LicenseType,
  type PdfDownloadPolicy,
  type PreviewPolicy,
  type PublicationAccess,
  type SampleDownloadPolicy,
  type SourcePolicy,
} from "@/lib/validation/publication";

/**
 * Shapes and resolvers shared by the public and admin publication readers.
 *
 * Isomorphic: no `server-only` import, no database client. It exists so the two
 * readers cannot drift on what a "publication summary" contains, and so the
 * column lists are written once — a `select` that forgets `content_language`
 * produces a page whose Khmer title is announced in English, and that is the
 * kind of bug a shared constant prevents outright.
 */

// ── Column lists ────────────────────────────────────────────────────────────

/**
 * Publication columns safe to select for a public page.
 *
 * Deliberately does NOT include `privacy_review_note`, `review_note`,
 * `created_by` or `updated_by`. RLS returns the row to anonymous readers once it
 * is published, so the column list is what keeps the internal notes off the
 * wire — the same argument the `public_publication_versions` view makes for the
 * private file references.
 */
export const PUBLICATION_PUBLIC_COLUMNS = `
  id, slug, featured, display_order, content_language,
  edition_label, edition_number, publication_year, publication_date, page_count,
  subject_en, subject_km, grade_level_en, grade_level_km, reading_level,
  cover_media_id, active_version_id,
  preview_policy, preview_page_limit, pdf_download_policy, sample_download_policy,
  source_policy, source_repository_url,
  license_type, copyright_holder, copyright_year,
  allow_redistribution, allow_modification,
  typeset_with_latex, latex_engine, document_class, build_year,
  isbn, doi, external_url, noindex,
  published_at, updated_at
` as const;

export const PUBLICATION_TRANSLATION_COLUMNS = `
  locale, title, original_title, subtitle, short_summary, description,
  introduction, target_audience, learning_objectives, author_note,
  acknowledgements, citation_text, license_terms, production_notes,
  seo_title, seo_description
` as const;

export const PUBLICATION_MEDIA_COLUMNS = `
  id, role, sort_order, page_number, caption_en, caption_km,
  alt_text_en, alt_text_km, visibility
` as const;

export const PUBLICATION_CHAPTER_COLUMNS = `
  id, chapter_number, title_en, title_km, description_en, description_km,
  start_page, end_page, sort_order
` as const;

/**
 * Edition columns for a public page.
 *
 * Read from `public_publication_versions`, never from `publication_versions`.
 * The view is the column boundary; anonymous readers have no grant on the table
 * at all, so selecting from it here would fail closed rather than leak — but
 * naming the view keeps the intent legible.
 */
export const PUBLICATION_VERSION_PUBLIC_COLUMNS = `
  id, version_label, edition_number, publication_year, publication_date,
  page_count, changelog_en, changelog_km, is_active, has_pdf,
  has_archived_original, has_source_archive
` as const;

// ── Row shapes ──────────────────────────────────────────────────────────────

export type PublicationTranslationRow = TranslationRow & {
  title: string;
  original_title: string | null;
  subtitle: string | null;
  short_summary: string | null;
  description: string | null;
  introduction: string | null;
  target_audience: string | null;
  learning_objectives: string | null;
  author_note: string | null;
  acknowledgements: string | null;
  citation_text: string | null;
  license_terms: string | null;
  production_notes: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type PublicationTypeRow = {
  id: string;
  slug: string;
  name_en: string;
  name_km: string | null;
  icon: string | null;
} | null;

export type PublicationMediaRow = {
  id: string;
  role: string;
  sort_order: number;
  page_number: number | null;
  caption_en: string | null;
  caption_km: string | null;
  alt_text_en: string | null;
  alt_text_km: string | null;
  visibility: string;
  media_assets: MediaAsset | null;
};

export type PublicationChapterRow = {
  id: string;
  chapter_number: string | null;
  title_en: string | null;
  title_km: string | null;
  description_en: string | null;
  description_km: string | null;
  start_page: number | null;
  end_page: number | null;
  sort_order: number;
};

export type PublicationVersionRow = {
  id: string;
  version_label: string;
  edition_number: number | null;
  publication_year: number | null;
  publication_date: string | null;
  page_count: number | null;
  changelog_en: string | null;
  changelog_km: string | null;
  is_active: boolean;
  has_pdf: boolean;
  has_archived_original: boolean;
  has_source_archive: boolean;
};

// ── Resolved shapes ─────────────────────────────────────────────────────────

export type PublicationType = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
};

export type PublicationTopic = { id: string; slug: string; name: string };

export type PublicationSamplePage = {
  id: string;
  pageNumber: number | null;
  image: ResolvedImage;
  caption: string | null;
};

export type PublicationChapter = {
  id: string;
  number: string | null;
  title: string;
  description: string | null;
  startPage: number | null;
  endPage: number | null;
};

export type PublicationEdition = {
  id: string;
  label: string;
  editionNumber: number | null;
  year: number | null;
  pageCount: number | null;
  changelog: string | null;
  isActive: boolean;
  hasPdf: boolean;
  hasArchivedOriginal: boolean;
  hasSourceArchive: boolean;
};

export type PublicationSummary = {
  id: string;
  slug: string;
  href: string;
  featured: boolean;

  /** Display title in the requested locale. */
  title: string;
  /** The title as printed on the book, when it differs from `title`. */
  originalTitle: string | null;
  /** `lang` for `originalTitle`, so Khmer is not announced in English. */
  originalTitleLang: string | null;
  subtitle: string | null;
  summary: string | null;

  /** True when the requested locale had no translation and English was used. */
  isFallback: boolean;
  /** Locale the rendered prose is actually written in. */
  contentLocale: Locale | null;

  type: PublicationType | null;
  subject: string | null;
  gradeLevel: string | null;
  editionLabel: string | null;
  year: number | null;
  pageCount: number | null;
  contentLanguage: ContentLanguage;
  typesetWithLatex: boolean;

  cover: ResolvedImage | null;
  topics: PublicationTopic[];

  /** What a reader may actually do — see `resolvePublicationAccess`. */
  access: PublicationAccess;
};

export type PublicationDetail = PublicationSummary & {
  description: string | null;
  introduction: string | null;
  targetAudience: string | null;
  learningObjectives: string[];
  authorNote: string | null;
  acknowledgements: string | null;

  citation: string;
  citationKey: string;
  /** BibTeX entry, or null when there is not enough verified metadata. */
  bibtex: string | null;

  /**
   * The raw preview policy.
   *
   * Carried alongside `access` because the two answer different questions:
   * `access.canPreview` says whether to render the reader at all, and this says
   * what the reader will show — which is what the note under the button has to
   * state accurately.
   */
  previewPolicy: PreviewPolicy;
  licenseType: LicenseType;
  licenseTerms: string | null;
  copyrightHolder: string | null;
  copyrightYear: number | null;
  allowRedistribution: boolean;
  allowModification: boolean;

  latexEngine: string | null;
  documentClass: string | null;
  buildYear: number | null;
  productionNotes: string | null;
  sourceRepositoryUrl: string | null;
  sourcePolicy: SourcePolicy;

  isbn: string | null;
  doi: string | null;
  externalUrl: string | null;
  noindex: boolean;

  chapters: PublicationChapter[];
  samplePages: PublicationSamplePage[];
  gallery: PublicationSamplePage[];
  editions: PublicationEdition[];
  activeEdition: PublicationEdition | null;

  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

/** Where a publication links to elsewhere in the portfolio. */
export type PublicationRelationTarget = {
  type: "journey" | "experience" | "education" | "certificate" | "project";
  id: string;
  title: string;
  href: string | null;
};

// ── Resolvers ───────────────────────────────────────────────────────────────

export function toPublicationType(
  row: PublicationTypeRow,
  locale: Locale,
): PublicationType | null {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
    icon: row.icon,
  };
}

/**
 * Turn an attachment row into a renderable image.
 *
 * Returns `null` — rather than a broken image — when the asset is missing or
 * private, and the caller filters those out. Captions and alt text on the
 * attachment override the asset's own; a blank override counts as absent, which
 * is what makes "clear this caption to fall back" work.
 */
export function resolvePublicationMedia(
  row: PublicationMediaRow,
  locale: Locale,
): PublicationSamplePage | null {
  const image = resolveImage(row.media_assets, locale, "preview");
  if (!image) return null;

  const alt = pickLocalized(locale, row.alt_text_en, row.alt_text_km);
  const caption = pickLocalized(locale, row.caption_en, row.caption_km);

  return {
    id: row.id,
    pageNumber: row.page_number,
    image: { ...image, alt: alt ?? image.alt, caption: caption ?? image.caption },
    caption: caption ?? image.caption,
  };
}

export function resolveChapter(
  row: PublicationChapterRow,
  locale: Locale,
): PublicationChapter | null {
  const title = pickLocalized(locale, row.title_en, row.title_km);
  // A chapter with no title in either language cannot be rendered as a list
  // item. The database CHECK makes this unreachable; the guard keeps the type
  // honest rather than asserting.
  if (!title) return null;

  return {
    id: row.id,
    number: row.chapter_number,
    title,
    description: pickLocalized(locale, row.description_en, row.description_km),
    startPage: row.start_page,
    endPage: row.end_page,
  };
}

export function resolveEdition(
  row: PublicationVersionRow,
  locale: Locale,
): PublicationEdition {
  return {
    id: row.id,
    label: row.version_label,
    editionNumber: row.edition_number,
    year: row.publication_year,
    pageCount: row.page_count,
    changelog: pickLocalized(locale, row.changelog_en, row.changelog_km),
    isActive: row.is_active,
    hasPdf: row.has_pdf,
    hasArchivedOriginal: row.has_archived_original,
    hasSourceArchive: row.has_source_archive,
  };
}

/**
 * Split newline-separated bullets into a list.
 *
 * Matches how `achievements` works on experiences and `highlights` on journey
 * stories: one textarea in the admin, a `<ul>` on the page.
 */
export function splitObjectives(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line !== "");
}

/**
 * Partition attachments into sample pages and gallery images.
 *
 * Sample pages are ordered by the page they show rather than by `sort_order`:
 * a reader flipping through a preview expects page 12 after page 7 regardless of
 * the order the admin happened to attach them in. Gallery images keep the
 * admin's order, because there is no natural one.
 */
export function splitPublicationMedia(
  rows: readonly PublicationMediaRow[] | undefined,
  locale: Locale,
): { samplePages: PublicationSamplePage[]; gallery: PublicationSamplePage[] } {
  const resolved = (rows ?? [])
    .map((row) => ({ row, item: resolvePublicationMedia(row, locale) }))
    .filter(
      (entry): entry is { row: PublicationMediaRow; item: PublicationSamplePage } =>
        entry.item !== null,
    );

  const samplePages = resolved
    .filter((entry) => entry.row.role === "sample_page")
    .sort((a, b) => (a.item.pageNumber ?? 0) - (b.item.pageNumber ?? 0))
    .map((entry) => entry.item);

  const gallery = resolved
    .filter((entry) => entry.row.role === "gallery")
    .sort((a, b) => a.row.sort_order - b.row.sort_order)
    .map((entry) => entry.item);

  return { samplePages, gallery };
}

/**
 * The citation to display.
 *
 * The owner's hand-edited `citation_text` wins outright; otherwise one is built
 * from verified metadata. `buildCitation` omits everything it does not know
 * rather than inventing a publisher or a place — see its own comment.
 */
export function resolveCitation(input: {
  override: string | null;
  authorName: string | null;
  originalTitle: string | null;
  title: string;
  editionLabel: string | null;
  editionNumber: number | null;
  publicationYear: number | null;
  isbn: string | null;
  doi: string | null;
  url: string | null;
}): string {
  if (input.override?.trim()) return input.override.trim();
  return buildCitation(input);
}

export { buildBibTeX, citationKey, resolvePublicationAccess };
export type {
  ContentLanguage,
  LicenseType,
  PdfDownloadPolicy,
  PreviewPolicy,
  PublicationAccess,
  SampleDownloadPolicy,
  SourcePolicy,
};
export { MEDIA_COLUMNS };
