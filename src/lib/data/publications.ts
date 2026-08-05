import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, resolveImage } from "@/lib/content/media";
import {
  PUBLICATION_CHAPTER_COLUMNS,
  PUBLICATION_MEDIA_COLUMNS,
  PUBLICATION_PUBLIC_COLUMNS,
  PUBLICATION_TRANSLATION_COLUMNS,
  PUBLICATION_VERSION_PUBLIC_COLUMNS,
  resolveChapter,
  resolveCitation,
  resolveEdition,
  resolvePublicationAccess,
  buildBibTeX,
  splitObjectives,
  splitPublicationMedia,
  toPublicationType,
  citationKey,
  type PublicationChapter,
  type PublicationChapterRow,
  type PublicationDetail,
  type PublicationMediaRow,
  type PublicationRelationTarget,
  type PublicationSummary,
  type PublicationTopic,
  type PublicationTranslationRow,
  type PublicationTypeRow,
  type PublicationVersionRow,
} from "@/lib/content/publication";
import { pickLocalized, resolveTranslation } from "@/lib/content/translation";
import { localePath, type Locale } from "@/i18n/config";
import type {
  ContentLanguage,
  LicenseType,
  PreviewPolicy,
  SourcePolicy,
} from "@/lib/validation/publication";

/**
 * Public reads for publications.
 *
 * Read through `createSupabasePublicClient()` — the anon client that never
 * writes cookies, because a cookie write would opt these pages out of static
 * rendering.
 *
 * As everywhere else in `lib/data/*`, these queries deliberately do NOT filter
 * on `status`, `deleted_at` or `visibility`. RLS does all of it (migration
 * 0026), and re-stating the predicate here would imply the database were not the
 * gate — at which point a forgotten `.eq()` becomes a leak rather than a
 * redundancy. What is filtered here is only ordering and presentation.
 *
 * Two things this module never selects, at all:
 *
 *   · `publication_versions` — the table. Editions come from the
 *     `public_publication_versions` view, whose projection is what keeps the
 *     three private asset ids off the wire. Anonymous readers have no grant on
 *     the table, so a mistake here fails closed, but the view is named
 *     explicitly so the intent is legible.
 *   · the internal review columns. `PUBLICATION_PUBLIC_COLUMNS` omits
 *     `review_note`, `privacy_review_note`, `created_by` and `updated_by`; RLS
 *     returns the row once it is published, so the column list is what keeps the
 *     admin's private notes private.
 */

type PublicationRow = {
  id: string;
  slug: string;
  featured: boolean;
  display_order: number;
  content_language: string;
  edition_label: string | null;
  edition_number: number | null;
  publication_year: number | null;
  publication_date: string | null;
  page_count: number | null;
  subject_en: string | null;
  subject_km: string | null;
  grade_level_en: string | null;
  grade_level_km: string | null;
  reading_level: string | null;
  cover_media_id: string | null;
  active_version_id: string | null;
  preview_policy: string;
  preview_page_limit: number | null;
  pdf_download_policy: string;
  sample_download_policy: string;
  source_policy: string;
  source_repository_url: string | null;
  license_type: string;
  copyright_holder: string | null;
  copyright_year: number | null;
  allow_redistribution: boolean;
  allow_modification: boolean;
  typeset_with_latex: boolean;
  latex_engine: string | null;
  document_class: string | null;
  build_year: number | null;
  isbn: string | null;
  doi: string | null;
  external_url: string | null;
  noindex: boolean;
  published_at: string | null;
  updated_at: string;
  publication_types: PublicationTypeRow;
  publication_translations: PublicationTranslationRow[];
  publication_media?: PublicationMediaRow[];
  publication_chapters?: PublicationChapterRow[];
  publication_topic_links?: Array<{
    publication_topics: { id: string; slug: string; name_en: string; name_km: string | null } | null;
  }>;
  cover?: unknown;
};

const TYPE_SELECT = "publication_types(id, slug, name_en, name_km, icon)";
const TRANSLATION_SELECT = `publication_translations(${PUBLICATION_TRANSLATION_COLUMNS})`;
const TOPIC_SELECT =
  "publication_topic_links(publication_topics(id, slug, name_en, name_km))";
const COVER_SELECT = `cover:media_assets!publications_cover_media_id_fkey(${MEDIA_COLUMNS})`;
const MEDIA_SELECT = `publication_media(${PUBLICATION_MEDIA_COLUMNS}, media_assets(${MEDIA_COLUMNS}))`;
const CHAPTER_SELECT = `publication_chapters(${PUBLICATION_CHAPTER_COLUMNS})`;

const SUMMARY_SELECT = `${PUBLICATION_PUBLIC_COLUMNS}, ${TYPE_SELECT}, ${TRANSLATION_SELECT}, ${TOPIC_SELECT}, ${COVER_SELECT}`;
const DETAIL_SELECT = `${SUMMARY_SELECT}, ${MEDIA_SELECT}, ${CHAPTER_SELECT}`;

// ── Shared resolution ───────────────────────────────────────────────────────

function resolveTopics(row: PublicationRow, locale: Locale): PublicationTopic[] {
  return (row.publication_topic_links ?? [])
    .map((link) => link.publication_topics)
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null)
    .map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      name: pickLocalized(locale, topic.name_en, topic.name_km) ?? topic.slug,
    }));
}

/**
 * Build the parts of a summary that do not depend on the edition list.
 *
 * `access` needs to know whether the active edition has a PDF, which lives in a
 * different table, so it is passed in rather than guessed. A listing that has
 * not loaded editions passes `hasPdf: false` and the card simply shows no
 * download button — a card is not the place to promise a file anyway.
 */
function toSummary(
  row: PublicationRow,
  locale: Locale,
  editionFacts: { hasPdf: boolean; hasSourceArchive: boolean },
): PublicationSummary {
  const { row: translation, actualLocale, isFallback } = resolveTranslation(
    row.publication_translations,
    locale,
  );

  const { samplePages } = splitPublicationMedia(row.publication_media, locale);

  const title = translation?.title ?? row.slug;
  const originalTitle = translation?.original_title ?? null;

  return {
    id: row.id,
    slug: row.slug,
    href: localePath(locale, `/publications/${row.slug}`),
    featured: row.featured,

    title,
    /*
     * Only surfaced when it actually differs. Repeating the same string under
     * itself as "Original title: …" is noise on a Khmer page where the display
     * title already *is* the original.
     */
    originalTitle:
      originalTitle && originalTitle.trim() !== title.trim() ? originalTitle : null,
    originalTitleLang: contentLanguageTagFor(row.content_language as ContentLanguage),
    subtitle: translation?.subtitle ?? null,
    summary: translation?.short_summary ?? null,

    isFallback,
    contentLocale: actualLocale,

    type: toPublicationType(row.publication_types, locale),
    subject: pickLocalized(locale, row.subject_en, row.subject_km),
    gradeLevel: pickLocalized(locale, row.grade_level_en, row.grade_level_km),
    editionLabel: row.edition_label,
    year: row.publication_year,
    pageCount: row.page_count,
    contentLanguage: row.content_language as ContentLanguage,
    typesetWithLatex: row.typeset_with_latex,

    cover: resolveImage(
      (row.cover ?? null) as Parameters<typeof resolveImage>[0],
      locale,
      "card",
    ),
    topics: resolveTopics(row, locale),

    access: resolvePublicationAccess({
      previewPolicy: row.preview_policy as never,
      previewPageLimit: row.preview_page_limit,
      pdfDownloadPolicy: row.pdf_download_policy as never,
      sampleDownloadPolicy: row.sample_download_policy as never,
      sourcePolicy: row.source_policy as SourcePolicy,
      sourceRepositoryUrl: row.source_repository_url,
      hasPdf: editionFacts.hasPdf,
      hasSourceArchive: editionFacts.hasSourceArchive,
      hasSamplePages: samplePages.length > 0,
    }),
  };
}

/**
 * `lang` for a book's own title.
 *
 * `bilingual` and `other` deliberately return `null`: the caller then omits the
 * attribute and inherits the page's, which is the honest answer. Tagging a
 * bilingual book as `km` would have a screen reader read its English half in
 * Khmer.
 */
function contentLanguageTagFor(language: ContentLanguage): string | null {
  if (language === "km") return "km";
  if (language === "en") return "en";
  return null;
}

// ── Listing ─────────────────────────────────────────────────────────────────

export type PublicationListing = {
  publications: PublicationSummary[];
  /** Every type that has at least one published publication, for the filters. */
  types: Array<{ id: string; slug: string; name: string; count: number }>;
  subjects: string[];
  years: number[];
};

/**
 * Lightweight evidence check for pages that only need to link to the published
 * collection. RLS remains the publication boundary; drafts return no row.
 */
export async function hasPublishedPublications(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("publications")
      .select("id")
      .limit(1)
      .maybeSingle();

    return !error && Boolean(data?.id);
  } catch {
    return false;
  }
}

/**
 * Every published publication, newest edition first within the owner's order.
 *
 * Editions are fetched in one extra query rather than joined, because the join
 * would be against a view and PostgREST cannot embed a view that has no declared
 * foreign key. One `in` query for the whole page is cheaper than the alternative
 * anyway.
 */
export async function getPublications(locale: Locale): Promise<PublicationListing> {
  if (!isSupabaseConfigured()) {
    return { publications: [], types: [], subjects: [], years: [] };
  }

  const supabase = await createSupabasePublicClient();

  const { data, error } = await supabase
    .from("publications")
    .select(SUMMARY_SELECT)
    .order("display_order", { ascending: true })
    .order("publication_year", { ascending: false, nullsFirst: false });

  if (error || !data) return { publications: [], types: [], subjects: [], years: [] };

  const rows = data as unknown as PublicationRow[];
  const editionFacts = await loadActiveEditionFacts(
    rows.map((row) => row.active_version_id).filter((id): id is string => Boolean(id)),
  );

  const publications = rows.map((row) =>
    toSummary(
      row,
      locale,
      editionFacts.get(row.active_version_id ?? "") ?? {
        hasPdf: false,
        hasSourceArchive: false,
      },
    ),
  );

  return {
    publications,
    types: collectTypes(publications),
    subjects: [
      ...new Set(
        publications.map((p) => p.subject).filter((s): s is string => Boolean(s)),
      ),
    ].sort((a, b) => a.localeCompare(b)),
    years: [
      ...new Set(publications.map((p) => p.year).filter((y): y is number => y !== null)),
    ].sort((a, b) => b - a),
  };
}

function collectTypes(publications: PublicationSummary[]) {
  const counts = new Map<string, { id: string; slug: string; name: string; count: number }>();

  for (const publication of publications) {
    if (!publication.type) continue;
    const existing = counts.get(publication.type.id);
    if (existing) existing.count += 1;
    else counts.set(publication.type.id, { ...publication.type, count: 1 });
  }

  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which of a set of editions carry a PDF and a source archive.
 *
 * Reads the *view*, so the answer comes back as booleans and no asset id is ever
 * loaded into a public page's props — a props object is serialised into the HTML
 * for hydration, so an id here would be published even if nothing rendered it.
 */
async function loadActiveEditionFacts(
  versionIds: string[],
): Promise<Map<string, { hasPdf: boolean; hasSourceArchive: boolean }>> {
  const facts = new Map<string, { hasPdf: boolean; hasSourceArchive: boolean }>();
  if (versionIds.length === 0) return facts;

  const supabase = await createSupabasePublicClient();
  const { data } = await supabase
    .from("public_publication_versions")
    .select("id, has_pdf, has_source_archive")
    .in("id", versionIds);

  for (const row of (data ?? []) as Array<{
    id: string;
    has_pdf: boolean;
    has_source_archive: boolean;
  }>) {
    facts.set(row.id, {
      hasPdf: row.has_pdf,
      hasSourceArchive: row.has_source_archive,
    });
  }

  return facts;
}

/** Featured publications for the homepage. Capped, and never more than four. */
export async function getFeaturedPublications(
  locale: Locale,
  limit = 3,
): Promise<PublicationSummary[]> {
  const { publications } = await getPublications(locale);
  return publications.filter((publication) => publication.featured).slice(0, Math.min(limit, 4));
}

// ── Detail ──────────────────────────────────────────────────────────────────

export async function getPublication(
  slug: string,
  locale: Locale,
): Promise<PublicationDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabasePublicClient();

  const { data, error } = await supabase
    .from("publications")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as PublicationRow;

  const { data: versionData } = await supabase
    .from("public_publication_versions")
    .select(PUBLICATION_VERSION_PUBLIC_COLUMNS)
    .eq("publication_id", row.id)
    .order("edition_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const editions = ((versionData ?? []) as unknown as PublicationVersionRow[]).map(
    (version) => resolveEdition(version, locale),
  );

  const activeEdition =
    editions.find((edition) => edition.id === row.active_version_id) ??
    editions.find((edition) => edition.isActive) ??
    null;

  const summary = toSummary(row, locale, {
    hasPdf: activeEdition?.hasPdf ?? false,
    hasSourceArchive: activeEdition?.hasSourceArchive ?? false,
  });

  const { row: translation } = resolveTranslation(row.publication_translations, locale);
  const { samplePages, gallery } = splitPublicationMedia(row.publication_media, locale);

  const chapters = (row.publication_chapters ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((chapter) => resolveChapter(chapter, locale))
    .filter((chapter): chapter is PublicationChapter => chapter !== null);

  const authorName = await getAuthorName();

  const citationInput = {
    authorName,
    originalTitle: translation?.original_title ?? null,
    title: summary.title,
    editionLabel: row.edition_label,
    editionNumber: row.edition_number,
    publicationYear: row.publication_year,
    isbn: row.isbn,
    doi: row.doi,
    url: null,
  };

  return {
    ...summary,

    previewPolicy: row.preview_policy as PreviewPolicy,

    description: translation?.description ?? null,
    introduction: translation?.introduction ?? null,
    targetAudience: translation?.target_audience ?? null,
    learningObjectives: splitObjectives(translation?.learning_objectives),
    authorNote: translation?.author_note ?? null,
    acknowledgements: translation?.acknowledgements ?? null,

    citation: resolveCitation({
      override: translation?.citation_text ?? null,
      ...citationInput,
    }),
    citationKey: citationKey(row.slug, row.publication_year),
    /*
     * BibTeX is built from the *verified* metadata, never from the owner's
     * hand-edited citation string — a free-text citation cannot be parsed back
     * into fields, and guessing would produce an entry that silently disagrees
     * with the one displayed above it.
     */
    bibtex: buildBibTeX({
      ...citationInput,
      citationKey: citationKey(row.slug, row.publication_year),
    }),

    licenseType: row.license_type as LicenseType,
    licenseTerms: translation?.license_terms ?? null,
    copyrightHolder: row.copyright_holder,
    copyrightYear: row.copyright_year,
    allowRedistribution: row.allow_redistribution,
    allowModification: row.allow_modification,

    /*
     * LaTeX facts are shown only when the book was actually typeset in LaTeX.
     * The database CHECK already forbids an engine on a non-LaTeX book, so this
     * is belt and braces — but a "Created with LaTeX" panel on a Word document
     * would be a false claim about the author's process, which is exactly the
     * class of invention section 13 rules out.
     */
    latexEngine: row.typeset_with_latex ? row.latex_engine : null,
    documentClass: row.typeset_with_latex ? row.document_class : null,
    buildYear: row.typeset_with_latex ? row.build_year : null,
    productionNotes: translation?.production_notes ?? null,
    sourceRepositoryUrl: row.source_repository_url,
    sourcePolicy: row.source_policy as SourcePolicy,

    isbn: row.isbn,
    doi: row.doi,
    externalUrl: row.external_url,
    noindex: row.noindex,

    chapters,
    samplePages,
    gallery,
    editions,
    activeEdition,

    seoTitle: translation?.seo_title ?? null,
    seoDescription: translation?.seo_description ?? null,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The author's display name, for the citation.
 *
 * Reads `public_profile`, not `profiles`. The `profiles` table is readable only
 * by the row's owner or an admin — correctly, since it holds the account email —
 * so an anonymous read of it returns nothing and the citation silently loses its
 * author. `public_profile` is the view that exists precisely to expose the
 * handful of deliberately public identity fields, and it is what
 * `getOwnerProfile()` has always used.
 *
 * Falls back to `null` rather than to a placeholder: a citation missing its
 * author is short, whereas one crediting "Portfolio Owner" is wrong.
 */
async function getAuthorName(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabasePublicClient();
  const { data } = await supabase
    .from("public_profile")
    .select("display_name")
    .limit(1)
    .maybeSingle();

  return (data as { display_name: string | null } | null)?.display_name ?? null;
}

// ── Relations ───────────────────────────────────────────────────────────────

/**
 * What this publication links to elsewhere in the portfolio.
 *
 * Every target is loaded through its own table, so RLS filters each one
 * independently — a link to a draft certificate resolves to nothing rather than
 * to a broken card. The relation row itself is already filtered by
 * `publication_relations_public_read`, which checks both ends; this is the
 * second half of the same rule, applied where the titles come from.
 */
export async function getPublicationRelations(
  publicationId: string,
  locale: Locale,
): Promise<PublicationRelationTarget[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabasePublicClient();

  const { data } = await supabase
    .from("publication_relations")
    .select(
      `
      id, display_order,
      journey_entries(id, slug, journey_entry_translations(locale, title)),
      experiences(id, slug, experience_translations(locale, role_title)),
      education(id, slug, education_translations(locale, institution)),
      certificates(id, slug, certificate_translations(locale, title)),
      projects(id, slug, project_translations(locale, title))
    `,
    )
    .eq("publication_id", publicationId)
    .order("display_order", { ascending: true });

  return ((data ?? []) as unknown as RelationRow[])
    .map((relation) => toRelationTarget(relation, locale))
    .filter((target): target is PublicationRelationTarget => target !== null);
}

type RelationRow = {
  id: string;
  display_order: number;
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

/**
 * Resolve a relation row into a labelled, linkable target.
 *
 * Experience and Education have no per-entry public page — they are sections of
 * a listing — so their `href` is the listing anchored to the entry, exactly as
 * `toRelationTarget` in `lib/data/journey.ts` does it. Journey stories,
 * certificates and projects have real detail routes.
 */
function toRelationTarget(
  row: RelationRow,
  locale: Locale,
): PublicationRelationTarget | null {
  const label = (
    rows: Array<{ locale: string } & Record<string, unknown>> | undefined,
    field: string,
  ) => {
    const { row: translation } = resolveTranslation(rows ?? [], locale);
    const value = translation?.[field];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };

  if (row.journey_entries) {
    return {
      type: "journey",
      id: row.journey_entries.id,
      title:
        label(row.journey_entries.journey_entry_translations, "title") ??
        row.journey_entries.slug,
      href: localePath(locale, `journey/${row.journey_entries.slug}`),
    };
  }

  if (row.experiences) {
    return {
      type: "experience",
      id: row.experiences.id,
      title:
        label(row.experiences.experience_translations, "role_title") ??
        row.experiences.slug,
      href: `${localePath(locale, "experience")}#experience-${row.experiences.slug}`,
    };
  }

  if (row.education) {
    return {
      type: "education",
      id: row.education.id,
      title:
        label(row.education.education_translations, "institution") ?? row.education.slug,
      href: `${localePath(locale, "education")}#education-${row.education.slug}`,
    };
  }

  if (row.certificates) {
    return {
      type: "certificate",
      id: row.certificates.id,
      title:
        label(row.certificates.certificate_translations, "title") ?? row.certificates.slug,
      href: localePath(locale, `certificates/${row.certificates.slug}`),
    };
  }

  if (row.projects) {
    return {
      type: "project",
      id: row.projects.id,
      title: label(row.projects.project_translations, "title") ?? row.projects.slug,
      href: localePath(locale, `projects/${row.projects.slug}`),
    };
  }

  return null;
}

/**
 * Publications linked to a given journey story, experience or education record.
 *
 * The reverse direction, for the cross-links on those pages. Returns summaries
 * with `hasPdf: false` — a cross-link is a "read more" card, not a download
 * surface, and loading edition facts for it would be three extra queries on a
 * page that is not about publications.
 */
export async function getPublicationsRelatedTo(
  target: { type: "journey" | "experience" | "education" | "certificate" | "project"; id: string },
  locale: Locale,
): Promise<PublicationSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const column = {
    journey: "journey_entry_id",
    experience: "experience_id",
    education: "education_id",
    certificate: "certificate_id",
    project: "project_id",
  }[target.type];

  const supabase = await createSupabasePublicClient();

  const { data } = await supabase
    .from("publication_relations")
    .select(`publications(${SUMMARY_SELECT})`)
    .eq(column, target.id)
    .order("display_order", { ascending: true });

  return ((data ?? []) as unknown as Array<{ publications: PublicationRow | null }>)
    .map((relation) => relation.publications)
    .filter((row): row is PublicationRow => row !== null)
    .map((row) => toSummary(row, locale, { hasPdf: false, hasSourceArchive: false }));
}

// ── Navigation and sitemap ──────────────────────────────────────────────────

/**
 * The publication before and after this one, in listing order.
 *
 * Computed from the full ordered list rather than with two comparison queries,
 * because the ordering is a compound of `display_order` and
 * `publication_year DESC NULLS LAST`, and expressing "the row before this one"
 * in that ordering as a WHERE clause is both unreadable and easy to get subtly
 * wrong. The list is small — this is a portfolio, not a catalogue.
 */
export async function getAdjacentPublications(
  slug: string,
  locale: Locale,
): Promise<{ previous: PublicationSummary | null; next: PublicationSummary | null }> {
  const { publications } = await getPublications(locale);
  const index = publications.findIndex((publication) => publication.slug === slug);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: index > 0 ? (publications[index - 1] ?? null) : null,
    next: index < publications.length - 1 ? (publications[index + 1] ?? null) : null,
  };
}

/** Slugs and modification times for the sitemap. */
export async function getPublicationSitemapEntries(): Promise<
  Array<{ slug: string; updatedAt: string; noindex: boolean }>
> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createSupabasePublicClient();
  const { data } = await supabase
    .from("publications")
    .select("slug, updated_at, noindex")
    .order("display_order", { ascending: true });

  return ((data ?? []) as Array<{ slug: string; updated_at: string; noindex: boolean }>).map(
    (row) => ({ slug: row.slug, updatedAt: row.updated_at, noindex: row.noindex }),
  );
}
