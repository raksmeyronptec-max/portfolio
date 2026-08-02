import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, publicStorageUrl, type MediaAsset } from "@/lib/content/media";
import { locales, type Locale } from "@/i18n/config";
import {
  publicationPublishBlockers,
  publicationPublishWarnings,
  type ContentLanguage,
  type LatexEngine,
  type LicenseType,
  type PdfDownloadPolicy,
  type PreviewPolicy,
  type PrivacyStatus,
  type PublicationRelationType,
  type PublicationStatus,
  type ReadingLevel,
  type SampleDownloadPolicy,
  type SourcePolicy,
} from "@/lib/validation/publication";

/**
 * Admin-side reads for publications.
 *
 * Uses `createSupabaseServerClient()` — the signed-in user's client — so RLS
 * applies. `can_view_admin()` is what returns drafts here; nothing in this file
 * escalates, and nothing uses the service role. If an editor cannot see a row,
 * the answer is a policy, not a client swap.
 *
 * Unlike `lib/data/publications.ts`, this module *does* read
 * `publication_versions` directly rather than through the public view: the admin
 * has to see which asset fills each of the three file slots in order to change
 * them. That is exactly the difference the view exists to draw.
 */

// ── Shapes ──────────────────────────────────────────────────────────────────

export type AdminPublicationRow = {
  id: string;
  slug: string;
  status: PublicationStatus;
  featured: boolean;
  displayOrder: number;
  title: string;
  typeName: string | null;
  year: number | null;
  editionLabel: string | null;
  pageCount: number | null;
  privacyStatus: PrivacyStatus;
  needsReview: boolean;
  pdfDownloadPolicy: PdfDownloadPolicy;
  sourcePolicy: SourcePolicy;
  hasCover: boolean;
  hasActiveEdition: boolean;
  activeEditionHasPdf: boolean;
  translationLocales: Locale[];
  updatedAt: string;
  deletedAt: string | null;
  /** Why this cannot be published, in message codes. */
  blockers: string[];
};

export type AdminPublicationVersion = {
  id: string;
  versionLabel: string;
  editionNumber: number | null;
  publicationYear: number | null;
  publicationDate: string | null;
  pageCount: number | null;
  changelogEn: string | null;
  changelogKm: string | null;
  isActive: boolean;
  status: PublicationStatus;
  createdAt: string;
  /** The three file slots, with just enough to render a filename and a size. */
  pdf: AdminPublicationFile | null;
  original: AdminPublicationFile | null;
  source: AdminPublicationFile | null;
};

export type AdminPublicationFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  visibility: "public" | "private";
  bucketId: string;
};

export type AdminPublicationMedia = {
  id: string;
  role: "cover" | "sample_page" | "gallery";
  sortOrder: number;
  pageNumber: number | null;
  captionEn: string | null;
  captionKm: string | null;
  altTextEn: string | null;
  altTextKm: string | null;
  visibility: "public" | "private" | "hidden";
  asset: MediaAsset | null;
};

export type AdminPublicationChapter = {
  id: string;
  chapterNumber: string | null;
  titleEn: string | null;
  titleKm: string | null;
  descriptionEn: string | null;
  descriptionKm: string | null;
  startPage: number | null;
  endPage: number | null;
  sortOrder: number;
};

export type AdminPublicationTranslation = {
  locale: Locale;
  title: string;
  originalTitle: string | null;
  subtitle: string | null;
  shortSummary: string | null;
  description: string | null;
  introduction: string | null;
  targetAudience: string | null;
  learningObjectives: string | null;
  authorNote: string | null;
  acknowledgements: string | null;
  citationText: string | null;
  licenseTerms: string | null;
  productionNotes: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type AdminPublicationRelation = {
  id: string;
  type: PublicationRelationType;
  targetId: string;
  label: string;
};

export type AdminPublication = {
  id: string;
  slug: string;
  status: PublicationStatus;
  publicationTypeId: string | null;
  featured: boolean;
  displayOrder: number;
  contentLanguage: ContentLanguage;
  editionLabel: string | null;
  editionNumber: number | null;
  publicationYear: number | null;
  publicationDate: string | null;
  pageCount: number | null;
  subjectEn: string | null;
  subjectKm: string | null;
  gradeLevelEn: string | null;
  gradeLevelKm: string | null;
  readingLevel: ReadingLevel | null;
  coverMediaId: string | null;
  cover: MediaAsset | null;
  activeVersionId: string | null;

  previewPolicy: PreviewPolicy;
  previewPageLimit: number | null;
  pdfDownloadPolicy: PdfDownloadPolicy;
  sampleDownloadPolicy: SampleDownloadPolicy;
  sourcePolicy: SourcePolicy;
  sourceRepositoryUrl: string | null;

  licenseType: LicenseType;
  copyrightHolder: string | null;
  copyrightYear: number | null;
  allowRedistribution: boolean;
  allowModification: boolean;

  typesetWithLatex: boolean;
  latexEngine: LatexEngine | null;
  documentClass: string | null;
  buildYear: number | null;

  isbn: string | null;
  doi: string | null;
  externalUrl: string | null;

  privacyStatus: PrivacyStatus;
  privacyReviewNote: string | null;
  privacyReviewedAt: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  noindex: boolean;

  publishedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;

  translations: AdminPublicationTranslation[];
  versions: AdminPublicationVersion[];
  chapters: AdminPublicationChapter[];
  media: AdminPublicationMedia[];
  topicIds: string[];
  relations: AdminPublicationRelation[];

  blockers: string[];
  warnings: string[];
};

export type PublicationTypeOption = {
  id: string;
  slug: string;
  nameEn: string;
  nameKm: string | null;
  icon: string | null;
};

export type PublicationTopicOption = {
  id: string;
  slug: string;
  nameEn: string;
  nameKm: string | null;
};

// ── Selects ─────────────────────────────────────────────────────────────────

const VERSION_SELECT = `
  id, version_label, edition_number, publication_year, publication_date,
  page_count, changelog_en, changelog_km, is_active, status, created_at,
  pdf:media_assets!publication_versions_pdf_media_id_fkey(
    id, original_filename, mime_type, file_size_bytes, visibility, bucket_id
  ),
  original:media_assets!publication_versions_original_media_id_fkey(
    id, original_filename, mime_type, file_size_bytes, visibility, bucket_id
  ),
  source:media_assets!publication_versions_source_archive_media_id_fkey(
    id, original_filename, mime_type, file_size_bytes, visibility, bucket_id
  )
`;

type FileRow = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  visibility: "public" | "private";
  bucket_id: string;
} | null;

function toFile(row: FileRow): AdminPublicationFile | null {
  if (!row) return null;
  return {
    id: row.id,
    filename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    visibility: row.visibility,
    bucketId: row.bucket_id,
  };
}

// ── Listing ─────────────────────────────────────────────────────────────────

/**
 * The admin listing.
 *
 * Includes soft-deleted rows when asked, because the restore control has to live
 * somewhere and a separate "trash" page for a handful of books would be more
 * navigation than content.
 */
export async function getAdminPublications(
  options: { includeDeleted?: boolean } = {},
): Promise<AdminPublicationRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("publications")
    .select(
      `id, slug, status, featured, display_order, edition_label, publication_year,
       page_count, privacy_status, needs_review, pdf_download_policy, source_policy,
       cover_media_id, active_version_id, updated_at, deleted_at,
       publication_types(name_en),
       publication_translations(locale, title)`,
    )
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (!options.includeDeleted) query = query.is("deleted_at", null);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as Array<{
    id: string;
    slug: string;
    status: PublicationStatus;
    featured: boolean;
    display_order: number;
    edition_label: string | null;
    publication_year: number | null;
    page_count: number | null;
    privacy_status: PrivacyStatus;
    needs_review: boolean;
    pdf_download_policy: PdfDownloadPolicy;
    source_policy: SourcePolicy;
    cover_media_id: string | null;
    active_version_id: string | null;
    updated_at: string;
    deleted_at: string | null;
    publication_types: { name_en: string } | null;
    publication_translations: Array<{ locale: string; title: string }>;
  }>;

  /*
   * Which active editions have a PDF, in one query for the whole page.
   *
   * The listing needs this to compute publish blockers — a book whose download
   * policy promises a PDF the active edition does not have cannot be published,
   * and the admin should see that in the list rather than discovering it when
   * the publish button fails.
   */
  const activeIds = rows
    .map((row) => row.active_version_id)
    .filter((id): id is string => Boolean(id));

  const pdfByVersion = new Map<string, boolean>();
  const publishedByVersion = new Map<string, boolean>();
  if (activeIds.length > 0) {
    const { data: versions } = await supabase
      .from("publication_versions")
      .select("id, pdf_media_id, status")
      .in("id", activeIds);

    for (const version of (versions ?? []) as Array<{
      id: string;
      pdf_media_id: string | null;
      status: string;
    }>) {
      pdfByVersion.set(version.id, version.pdf_media_id !== null);
      publishedByVersion.set(version.id, version.status === "published");
    }
  }

  return rows.map((row) => {
    const english = row.publication_translations.find((t) => t.locale === "en");
    const activeHasPdf = pdfByVersion.get(row.active_version_id ?? "") ?? false;

    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      featured: row.featured,
      displayOrder: row.display_order,
      title:
        english?.title ?? row.publication_translations[0]?.title ?? row.slug,
      typeName: row.publication_types?.name_en ?? null,
      year: row.publication_year,
      editionLabel: row.edition_label,
      pageCount: row.page_count,
      privacyStatus: row.privacy_status,
      needsReview: row.needs_review,
      pdfDownloadPolicy: row.pdf_download_policy,
      sourcePolicy: row.source_policy,
      hasCover: row.cover_media_id !== null,
      hasActiveEdition: row.active_version_id !== null,
      activeEditionHasPdf: activeHasPdf,
      translationLocales: row.publication_translations
        .map((t) => t.locale)
        .filter((locale): locale is Locale =>
          (locales as readonly string[]).includes(locale),
        ),
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      blockers: publicationPublishBlockers({
        needsReview: row.needs_review,
        privacyStatus: row.privacy_status,
        hasEnglishTitle: Boolean(english?.title?.trim()),
        pdfDownloadPolicy: row.pdf_download_policy,
        hasActiveVersion: row.active_version_id !== null,
        activeVersionHasPdf: activeHasPdf,
        activeVersionPublished:
          publishedByVersion.get(row.active_version_id ?? "") ?? false,
      }),
    };
  });
}

/** How many publications still need a privacy decision, for the nav badge. */
export async function countPublicationsAwaitingReview(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("publications")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("privacy_status", "pending_review");

  return count ?? 0;
}

// ── One publication, everything about it ────────────────────────────────────

export async function getAdminPublication(id: string): Promise<AdminPublication | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("publications")
    .select(
      `*,
       cover:media_assets!publications_cover_media_id_fkey(${MEDIA_COLUMNS}),
       publication_translations(*),
       publication_chapters(*),
       publication_media(*, media_assets(${MEDIA_COLUMNS})),
       publication_topic_links(topic_id)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Record<string, never> & {
    id: string;
    slug: string;
    publication_translations: Array<Record<string, string | null>>;
    publication_chapters: Array<Record<string, string | number | null>>;
    publication_media: Array<Record<string, unknown>>;
    publication_topic_links: Array<{ topic_id: string }>;
    cover: MediaAsset | null;
  };

  const raw = data as unknown as Record<string, unknown>;

  const { data: versionData } = await supabase
    .from("publication_versions")
    .select(VERSION_SELECT)
    .eq("publication_id", id)
    .order("edition_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const versions = ((versionData ?? []) as unknown as Array<{
    id: string;
    version_label: string;
    edition_number: number | null;
    publication_year: number | null;
    publication_date: string | null;
    page_count: number | null;
    changelog_en: string | null;
    changelog_km: string | null;
    is_active: boolean;
    status: PublicationStatus;
    created_at: string;
    pdf: FileRow;
    original: FileRow;
    source: FileRow;
  }>).map((version) => ({
    id: version.id,
    versionLabel: version.version_label,
    editionNumber: version.edition_number,
    publicationYear: version.publication_year,
    publicationDate: version.publication_date,
    pageCount: version.page_count,
    changelogEn: version.changelog_en,
    changelogKm: version.changelog_km,
    isActive: version.is_active,
    status: version.status,
    createdAt: version.created_at,
    pdf: toFile(version.pdf),
    original: toFile(version.original),
    source: toFile(version.source),
  }));

  const translations: AdminPublicationTranslation[] = row.publication_translations.map(
    (translation) => ({
      locale: translation.locale as Locale,
      title: (translation.title as string) ?? "",
      originalTitle: translation.original_title ?? null,
      subtitle: translation.subtitle ?? null,
      shortSummary: translation.short_summary ?? null,
      description: translation.description ?? null,
      introduction: translation.introduction ?? null,
      targetAudience: translation.target_audience ?? null,
      learningObjectives: translation.learning_objectives ?? null,
      authorNote: translation.author_note ?? null,
      acknowledgements: translation.acknowledgements ?? null,
      citationText: translation.citation_text ?? null,
      licenseTerms: translation.license_terms ?? null,
      productionNotes: translation.production_notes ?? null,
      seoTitle: translation.seo_title ?? null,
      seoDescription: translation.seo_description ?? null,
    }),
  );

  const media: AdminPublicationMedia[] = row.publication_media
    .filter((attachment) => attachment.deleted_at === null)
    .map((attachment) => ({
      id: attachment.id as string,
      role: attachment.role as AdminPublicationMedia["role"],
      sortOrder: attachment.sort_order as number,
      pageNumber: (attachment.page_number as number | null) ?? null,
      captionEn: (attachment.caption_en as string | null) ?? null,
      captionKm: (attachment.caption_km as string | null) ?? null,
      altTextEn: (attachment.alt_text_en as string | null) ?? null,
      altTextKm: (attachment.alt_text_km as string | null) ?? null,
      visibility: attachment.visibility as AdminPublicationMedia["visibility"],
      asset: (attachment.media_assets as MediaAsset | null) ?? null,
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "cover" ? -1 : 1;
      if (a.role === "sample_page" && b.role === "sample_page") {
        return (a.pageNumber ?? 0) - (b.pageNumber ?? 0);
      }
      return a.sortOrder - b.sortOrder;
    });

  const chapters: AdminPublicationChapter[] = row.publication_chapters
    .map((chapter) => ({
      id: chapter.id as string,
      chapterNumber: (chapter.chapter_number as string | null) ?? null,
      titleEn: (chapter.title_en as string | null) ?? null,
      titleKm: (chapter.title_km as string | null) ?? null,
      descriptionEn: (chapter.description_en as string | null) ?? null,
      descriptionKm: (chapter.description_km as string | null) ?? null,
      startPage: (chapter.start_page as number | null) ?? null,
      endPage: (chapter.end_page as number | null) ?? null,
      sortOrder: (chapter.sort_order as number) ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const relations = await getPublicationRelations(id);

  const activeVersion = versions.find(
    (version) => version.id === (raw.active_version_id as string | null),
  );
  const englishTranslation = translations.find((t) => t.locale === "en");
  const khmerTranslation = translations.find((t) => t.locale === "km");

  return {
    id: row.id,
    slug: row.slug,
    status: raw.status as PublicationStatus,
    publicationTypeId: (raw.publication_type_id as string | null) ?? null,
    featured: raw.featured as boolean,
    displayOrder: raw.display_order as number,
    contentLanguage: raw.content_language as ContentLanguage,
    editionLabel: (raw.edition_label as string | null) ?? null,
    editionNumber: (raw.edition_number as number | null) ?? null,
    publicationYear: (raw.publication_year as number | null) ?? null,
    publicationDate: (raw.publication_date as string | null) ?? null,
    pageCount: (raw.page_count as number | null) ?? null,
    subjectEn: (raw.subject_en as string | null) ?? null,
    subjectKm: (raw.subject_km as string | null) ?? null,
    gradeLevelEn: (raw.grade_level_en as string | null) ?? null,
    gradeLevelKm: (raw.grade_level_km as string | null) ?? null,
    readingLevel: (raw.reading_level as ReadingLevel | null) ?? null,
    coverMediaId: (raw.cover_media_id as string | null) ?? null,
    cover: row.cover,
    activeVersionId: (raw.active_version_id as string | null) ?? null,

    previewPolicy: raw.preview_policy as PreviewPolicy,
    previewPageLimit: (raw.preview_page_limit as number | null) ?? null,
    pdfDownloadPolicy: raw.pdf_download_policy as PdfDownloadPolicy,
    sampleDownloadPolicy: raw.sample_download_policy as SampleDownloadPolicy,
    sourcePolicy: raw.source_policy as SourcePolicy,
    sourceRepositoryUrl: (raw.source_repository_url as string | null) ?? null,

    licenseType: raw.license_type as LicenseType,
    copyrightHolder: (raw.copyright_holder as string | null) ?? null,
    copyrightYear: (raw.copyright_year as number | null) ?? null,
    allowRedistribution: raw.allow_redistribution as boolean,
    allowModification: raw.allow_modification as boolean,

    typesetWithLatex: raw.typeset_with_latex as boolean,
    latexEngine: (raw.latex_engine as LatexEngine | null) ?? null,
    documentClass: (raw.document_class as string | null) ?? null,
    buildYear: (raw.build_year as number | null) ?? null,

    isbn: (raw.isbn as string | null) ?? null,
    doi: (raw.doi as string | null) ?? null,
    externalUrl: (raw.external_url as string | null) ?? null,

    privacyStatus: raw.privacy_status as PrivacyStatus,
    privacyReviewNote: (raw.privacy_review_note as string | null) ?? null,
    privacyReviewedAt: (raw.privacy_reviewed_at as string | null) ?? null,
    needsReview: raw.needs_review as boolean,
    reviewNote: (raw.review_note as string | null) ?? null,
    noindex: raw.noindex as boolean,

    publishedAt: (raw.published_at as string | null) ?? null,
    updatedAt: raw.updated_at as string,
    deletedAt: (raw.deleted_at as string | null) ?? null,

    translations,
    versions,
    chapters,
    media,
    topicIds: row.publication_topic_links.map((link) => link.topic_id),
    relations,

    blockers: publicationPublishBlockers({
      needsReview: raw.needs_review as boolean,
      privacyStatus: raw.privacy_status as PrivacyStatus,
      hasEnglishTitle: Boolean(englishTranslation?.title?.trim()),
      pdfDownloadPolicy: raw.pdf_download_policy as PdfDownloadPolicy,
      hasActiveVersion: Boolean(raw.active_version_id),
      activeVersionHasPdf: Boolean(activeVersion?.pdf),
      activeVersionPublished: activeVersion?.status === "published",
    }),
    warnings: publicationPublishWarnings({
      hasCover: Boolean(raw.cover_media_id),
      hasKhmerTitle: Boolean(khmerTranslation?.title?.trim()),
      hasEnglishSummary: Boolean(englishTranslation?.shortSummary?.trim()),
      hasChapters: chapters.length > 0,
      pageCount: (raw.page_count as number | null) ?? null,
    }),
  };
}

// ── Relations ───────────────────────────────────────────────────────────────

async function getPublicationRelations(
  publicationId: string,
): Promise<AdminPublicationRelation[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("publication_relations")
    .select(
      `id, display_order,
       journey_entries(id, slug, journey_entry_translations(locale, title)),
       experiences(id, slug, experience_translations(locale, role_title)),
       education(id, slug, education_translations(locale, institution)),
       certificates(id, slug, certificate_translations(locale, title)),
       projects(id, slug, project_translations(locale, title))`,
    )
    .eq("publication_id", publicationId)
    .order("display_order", { ascending: true });

  type Row = {
    id: string;
    journey_entries: {
      id: string;
      slug: string;
      journey_entry_translations: Array<{ locale: string; title: string }>;
    } | null;
    experiences: {
      id: string;
      slug: string;
      experience_translations: Array<{ locale: string; role_title: string }>;
    } | null;
    education: {
      id: string;
      slug: string;
      education_translations: Array<{ locale: string; institution: string }>;
    } | null;
    certificates: {
      id: string;
      slug: string;
      certificate_translations: Array<{ locale: string; title: string }>;
    } | null;
    projects: {
      id: string;
      slug: string;
      project_translations: Array<{ locale: string; title: string }>;
    } | null;
  };

  /*
   * The admin list is always English-first.
   *
   * Not a locale decision — the admin is one person and the interface is in
   * English. Falling back to the first available translation keeps a Khmer-only
   * record from rendering as a bare slug.
   */
  const label = (
    rows: Array<Record<string, string>> | undefined,
    field: string,
    fallback: string,
  ) => {
    const english = rows?.find((r) => r.locale === "en");
    const value = english?.[field] ?? rows?.[0]?.[field];
    return value?.trim() ? value : fallback;
  };

  return ((data ?? []) as unknown as Row[])
    .map((relation): AdminPublicationRelation | null => {
      if (relation.journey_entries) {
        return {
          id: relation.id,
          type: "journey",
          targetId: relation.journey_entries.id,
          label: label(
            relation.journey_entries.journey_entry_translations,
            "title",
            relation.journey_entries.slug,
          ),
        };
      }
      if (relation.experiences) {
        return {
          id: relation.id,
          type: "experience",
          targetId: relation.experiences.id,
          label: label(
            relation.experiences.experience_translations,
            "role_title",
            relation.experiences.slug,
          ),
        };
      }
      if (relation.education) {
        return {
          id: relation.id,
          type: "education",
          targetId: relation.education.id,
          label: label(
            relation.education.education_translations,
            "institution",
            relation.education.slug,
          ),
        };
      }
      if (relation.certificates) {
        return {
          id: relation.id,
          type: "certificate",
          targetId: relation.certificates.id,
          label: label(
            relation.certificates.certificate_translations,
            "title",
            relation.certificates.slug,
          ),
        };
      }
      if (relation.projects) {
        return {
          id: relation.id,
          type: "project",
          targetId: relation.projects.id,
          label: label(
            relation.projects.project_translations,
            "title",
            relation.projects.slug,
          ),
        };
      }
      return null;
    })
    .filter((relation): relation is AdminPublicationRelation => relation !== null);
}

/** Everything the relation picker can offer, grouped by type. */
export type PublicationRelationOptions = Record<
  PublicationRelationType,
  Array<{ id: string; label: string }>
>;

export async function getPublicationRelationOptions(): Promise<PublicationRelationOptions> {
  const empty: PublicationRelationOptions = {
    journey: [],
    experience: [],
    education: [],
    certificate: [],
    project: [],
  };

  if (!isSupabaseConfigured()) return empty;

  const supabase = await createSupabaseServerClient();

  const pick = (rows: Array<Record<string, string>> | undefined, field: string) => {
    const english = rows?.find((r) => r.locale === "en");
    return english?.[field] ?? rows?.[0]?.[field] ?? "";
  };

  const [journey, experience, education, certificate, project] = await Promise.all([
    supabase
      .from("journey_entries")
      .select("id, slug, journey_entry_translations(locale, title)")
      .is("deleted_at", null)
      .order("event_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("experiences")
      .select("id, slug, experience_translations(locale, role_title)")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("education")
      .select("id, slug, education_translations(locale, institution)")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("certificates")
      .select("id, slug, certificate_translations(locale, title)")
      .is("deleted_at", null)
      .order("issued_on", { ascending: false, nullsFirst: false }),
    supabase
      .from("projects")
      .select("id, slug, project_translations(locale, title)")
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  return {
    journey: (journey.data ?? []).map((row) => {
      const entry = row as unknown as {
        id: string;
        slug: string;
        journey_entry_translations: Array<Record<string, string>>;
      };
      return {
        id: entry.id,
        label: pick(entry.journey_entry_translations, "title") || entry.slug,
      };
    }),
    experience: (experience.data ?? []).map((row) => {
      const entry = row as unknown as {
        id: string;
        slug: string;
        experience_translations: Array<Record<string, string>>;
      };
      return {
        id: entry.id,
        label: pick(entry.experience_translations, "role_title") || entry.slug,
      };
    }),
    education: (education.data ?? []).map((row) => {
      const entry = row as unknown as {
        id: string;
        slug: string;
        education_translations: Array<Record<string, string>>;
      };
      return {
        id: entry.id,
        label: pick(entry.education_translations, "institution") || entry.slug,
      };
    }),
    certificate: (certificate.data ?? []).map((row) => {
      const entry = row as unknown as {
        id: string;
        slug: string;
        certificate_translations: Array<Record<string, string>>;
      };
      return {
        id: entry.id,
        label: pick(entry.certificate_translations, "title") || entry.slug,
      };
    }),
    project: (project.data ?? []).map((row) => {
      const entry = row as unknown as {
        id: string;
        slug: string;
        project_translations: Array<Record<string, string>>;
      };
      return {
        id: entry.id,
        label: pick(entry.project_translations, "title") || entry.slug,
      };
    }),
  };
}

// ── Taxonomies ──────────────────────────────────────────────────────────────

export async function getPublicationTypeOptions(): Promise<PublicationTypeOption[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publication_types")
    .select("id, slug, name_en, name_km, icon")
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  return ((data ?? []) as Array<{
    id: string;
    slug: string;
    name_en: string;
    name_km: string | null;
    icon: string | null;
  }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameKm: row.name_km,
    icon: row.icon,
  }));
}

export async function getPublicationTopicOptions(): Promise<PublicationTopicOption[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publication_topics")
    .select("id, slug, name_en, name_km")
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  return ((data ?? []) as Array<{
    id: string;
    slug: string;
    name_en: string;
    name_km: string | null;
  }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameKm: row.name_km,
  }));
}

/**
 * Assets eligible for a given publication file slot.
 *
 * Filtered by `kind` rather than by MIME, because the kind is what the database
 * triggers check — offering an asset the trigger will reject would produce a
 * confusing failure at save time rather than an absence at pick time.
 */
export async function getPublicationFileOptions(
  kind: "publication_pdf" | "publication_original" | "publication_source",
): Promise<AdminPublicationFile[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, original_filename, mime_type, file_size_bytes, visibility, bucket_id")
    .eq("kind", kind)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as NonNullable<FileRow>[]).map((row) => toFile(row)!);
}

/** All three slots' options in one round trip, for the files manager. */
export async function getPublicationFileLibrary(): Promise<{
  pdf: AdminPublicationFile[];
  original: AdminPublicationFile[];
  source: AdminPublicationFile[];
}> {
  const [pdf, original, source] = await Promise.all([
    getPublicationFileOptions("publication_pdf"),
    getPublicationFileOptions("publication_original"),
    getPublicationFileOptions("publication_source"),
  ]);
  return { pdf, original, source };
}

export type PublicationImageOption = {
  id: string;
  filename: string;
  kind: string;
  thumbnailSrc: string | null;
  altTextEn: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Public images that can serve as a cover or a sample page.
 *
 * Publication kinds sort first because they are what the owner just uploaded,
 * but every public image stays selectable — a diagram already in the library is
 * a legitimate sample illustration, and forcing a duplicate upload would put the
 * same bytes in the bucket twice. Same reasoning as `listAttachableMedia()`.
 *
 * PDFs are excluded: `resolveImage()` cannot render one, so offering it would
 * produce an attachment that renders as a gap.
 */
export async function getPublicationImageOptions(): Promise<PublicationImageOption[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select(
      "id, original_filename, kind, bucket_id, storage_path, storage_provider, thumbnail_path, card_path, alt_text_en, width, height",
    )
    .eq("visibility", "public")
    .is("deleted_at", null)
    .neq("mime_type", "application/pdf")
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as unknown as Array<{
    id: string;
    original_filename: string;
    kind: string;
    bucket_id: string;
    storage_path: string;
    storage_provider: "supabase" | "r2";
    thumbnail_path: string | null;
    card_path: string | null;
    alt_text_en: string | null;
    width: number | null;
    height: number | null;
  }>)
    .map((asset) => ({
      id: asset.id,
      filename: asset.original_filename,
      kind: asset.kind,
      thumbnailSrc: publicStorageUrl(
        asset.bucket_id,
        asset.thumbnail_path ?? asset.card_path ?? asset.storage_path,
        asset.storage_provider,
      ),
      altTextEn: asset.alt_text_en,
      width: asset.width,
      height: asset.height,
    }))
    .sort((a, b) => {
      const rank = (kind: string) =>
        kind === "publication_cover" ? 0 : kind === "publication_page" ? 1 : 2;
      return rank(a.kind) - rank(b.kind);
    });
}
