import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, Divider, SectionHeading, SmartLink, Tag } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { PublicationCard } from "@/components/public/publication-card";
import { PublicationCitation } from "@/components/public/publication-citation";
import { PublicationReader } from "@/components/public/publication-reader";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { getDictionary, interpolate } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import {
  getAdjacentPublications,
  getPublication,
  getPublicationRelations,
  getPublications,
} from "@/lib/data/publications";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, personId, prune } from "@/lib/seo/jsonld";
import { licenseUrl, type LicenseType } from "@/lib/validation/publication";

/**
 * One publication.
 *
 * Everything that renders comes from the server. The only client components are
 * the reader (which must not load the document until asked) and the citation
 * copy buttons — both of which are enhancements over content that is already in
 * the HTML.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  /*
   * Deliberately empty: the slugs come from the database, and pre-rendering them
   * at build time would bake in whichever publications happened to be published
   * when the build ran. `revalidate` plus `revalidatePublications()` covers it,
   * and matches how projects and certificates behave.
   */
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const publication = await getPublication(slug, locale);
  if (!publication) return {};

  return buildPageMetadata({
    locale,
    path: `publications/${publication.slug}`,
    title: publication.seoTitle ?? publication.title,
    description:
      publication.seoDescription ??
      truncateDescription(publication.summary ?? publication.description ?? "", locale),
    ogImage: null,
    noIndex: publication.noindex,
  });
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const publication = await getPublication(slug, locale);
  if (!publication) notFound();

  const t = getDictionary(locale);

  const [relations, adjacent, listing] = await Promise.all([
    getPublicationRelations(publication.id, locale),
    getAdjacentPublications(publication.slug, locale),
    getPublications(locale),
  ]);

  const related = listing.publications
    .filter((candidate) => candidate.id !== publication.id)
    .filter(
      (candidate) =>
        candidate.type?.id === publication.type?.id ||
        candidate.subject === publication.subject,
    )
    .slice(0, 3);

  const access = publication.access;
  const activeEdition = publication.activeEdition;

  const downloadHref = `/api/publications/${encodeURIComponent(publication.slug)}/download?file=pdf&locale=${locale}`;
  const sourceHref = `/api/publications/${encodeURIComponent(publication.slug)}/download?file=source&locale=${locale}`;

  /*
   * `Book` structured data, built only from facts that are actually recorded.
   *
   * `prune()` drops every undefined key, which is what makes this honest: no
   * ISBN unless one was entered, no publisher at all (these are self-published,
   * and naming an imprint would be a false claim), no aggregateRating and no
   * review — the brief rules those out and inventing them is the specific abuse
   * that gets structured data penalised.
   *
   * `inLanguage` carries the *book's* language, not the page's.
   */
  const bookSchema = prune({
    "@type": "Book",
    "@id": `${absoluteUrl(publication.href)}#book`,
    name: publication.originalTitle ?? publication.title,
    alternateName: publication.originalTitle ? publication.title : undefined,
    url: absoluteUrl(publication.href),
    author: { "@id": personId() },
    inLanguage:
      publication.contentLanguage === "bilingual"
        ? ["km", "en"]
        : publication.contentLanguage === "other"
          ? undefined
          : publication.contentLanguage,
    numberOfPages: publication.pageCount ?? undefined,
    bookEdition: publication.editionLabel ?? undefined,
    datePublished: publication.year ? String(publication.year) : undefined,
    isbn: publication.isbn ?? undefined,
    description: publication.summary ?? undefined,
    image: publication.cover ? absoluteUrl(publication.cover.src) : undefined,
    license: licenseUrl(publication.licenseType) ?? undefined,
    about: publication.topics.length > 0 ? publication.topics.map((tp) => tp.name) : undefined,
  });

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.publications, url: absoluteUrl(localePath(locale, "publications")) },
      { name: publication.title, url: absoluteUrl(publication.href) },
    ]),
    bookSchema,
  ]);

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker
        locale={locale}
        eventName="publication_view"
        entityType="publication"
        entityId={publication.id}
        entitySlug={publication.slug}
      />

      <PageHeader
        eyebrow={publication.type?.name ?? t.publications.eyebrow}
        title={publication.title}
        description={publication.subtitle}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.publications, href: localePath(locale, "publications") },
          { label: publication.title },
        ]}
        breadcrumbLabel={publication.title}
      >
        {publication.originalTitle ? (
          <p className="text-body leading-khmer text-foreground-muted">
            <span className="text-foreground-subtle">{t.publications.originalTitle}: </span>
            {/*
             * The book's own title, tagged with its own language. Without this a
             * screen reader on the English page reads Khmer with English
             * phonetics — the per-string version of the document-level bug
             * docs/AUDIT.md records from v1.
             */}
            <span lang={publication.originalTitleLang ?? undefined}>
              {publication.originalTitle}
            </span>
          </p>
        ) : null}
      </PageHeader>

      <section className="section-y">
        <div className="container-content grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          {/* ════════════════════════════════════════════════════════════════
              Main column
              ═══════════════════════════════════════════════════════════════ */}
          <div className="flex min-w-0 flex-col gap-10">
            {publication.isFallback ? (
              <Notice tone="info">
                {/*
                 * Said plainly rather than hidden. The reader is about to read
                 * prose in a language they did not ask for, and a `lang`
                 * attribute alone tells assistive technology but not them.
                 */}
                {locale === "km"
                  ? "អត្ថបទខាងក្រោមមានតែជាភាសាអង់គ្លេសប៉ុណ្ណោះ។"
                  : "The description below is shown in English because no translation is available yet."}
              </Notice>
            ) : null}

            {/* ── About ───────────────────────────────────────────────── */}
            {publication.description ? (
              <section aria-labelledby="about-heading" className="flex flex-col gap-3">
                <SectionHeading id="about-heading" headingLevel={2} title={t.publications.aboutHeading} />
                <Prose
                  text={publication.description}
                  lang={publication.isFallback ? publication.contentLocale : null}
                />
              </section>
            ) : null}

            {publication.introduction ? (
              <section aria-labelledby="intro-heading" className="flex flex-col gap-3">
                <SectionHeading id="intro-heading" headingLevel={2} title={t.publications.introductionHeading} />
                <Prose text={publication.introduction} lang={null} />
              </section>
            ) : null}

            {publication.learningObjectives.length > 0 ? (
              <section aria-labelledby="objectives-heading" className="flex flex-col gap-3">
                <SectionHeading id="objectives-heading" headingLevel={2} title={t.publications.objectivesHeading} />
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body leading-khmer text-foreground-muted">
                  {publication.learningObjectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* ── Reader ──────────────────────────────────────────────── */}
            {access.canPreview || publication.samplePages.length > 0 ? (
              <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
                <SectionHeading id="preview-heading" headingLevel={2} title={t.publications.previewHeading} />
                <PublicationReader
                  slug={publication.slug}
                  locale={locale}
                  samplePages={publication.samplePages}
                  /*
                   * Only the two policies that have an inline document. With
                   * `sample_pages` the images above are the preview, and the
                   * route refuses the PDF — so offering the button would show a
                   * control that cannot work.
                   */
                  canPreviewDocument={
                    access.canPreview &&
                    (publication.previewPolicy === "full" ||
                      publication.previewPolicy === "first_pages")
                  }
                  previewPolicy={publication.previewPolicy}
                  previewPageLimit={publication.access.previewPageLimit}
                  totalPages={publication.pageCount}
                />
              </section>
            ) : null}

            {/* ── Contents ────────────────────────────────────────────── */}
            {publication.chapters.length > 0 ? (
              <section aria-labelledby="contents-heading" className="flex flex-col gap-3">
                <SectionHeading id="contents-heading" headingLevel={2} title={t.publications.contentsHeading} />
                <ol className="flex flex-col gap-2">
                  {publication.chapters.map((chapter) => (
                    <li
                      key={chapter.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2 last:border-b-0"
                    >
                      {chapter.number ? (
                        <span className="text-small font-semibold tabular-nums text-foreground-subtle">
                          {chapter.number}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 text-body leading-khmer text-foreground">
                        {chapter.title}
                        {chapter.description ? (
                          <span className="block text-small leading-khmer text-foreground-muted">
                            {chapter.description}
                          </span>
                        ) : null}
                      </span>
                      {chapter.startPage ? (
                        <span className="text-small tabular-nums text-foreground-subtle">
                          {chapter.endPage
                            ? interpolate(t.publications.chapterPages, {
                                start: chapter.startPage,
                                end: chapter.endPage,
                              })
                            : interpolate(t.publications.chapterPage, {
                                start: chapter.startPage,
                              })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {/* ── Author's note ───────────────────────────────────────── */}
            {publication.authorNote ? (
              <section aria-labelledby="note-heading" className="flex flex-col gap-3">
                <SectionHeading id="note-heading" headingLevel={2} title={t.publications.authorNoteHeading} />
                <Prose text={publication.authorNote} lang={null} />
              </section>
            ) : null}

            {publication.acknowledgements ? (
              <section aria-labelledby="ack-heading" className="flex flex-col gap-3">
                <SectionHeading id="ack-heading" headingLevel={2} title={t.publications.acknowledgementsHeading} />
                <Prose text={publication.acknowledgements} lang={null} />
              </section>
            ) : null}

            {/* ── Editions ────────────────────────────────────────────── */}
            {publication.editions.length > 1 ? (
              <section aria-labelledby="editions-heading" className="flex flex-col gap-3">
                <SectionHeading id="editions-heading" headingLevel={2} title={t.publications.editionsHeading} />
                <ul className="flex flex-col gap-3">
                  {publication.editions.map((edition) => (
                    <li key={edition.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3 className="text-body font-semibold leading-khmer text-foreground">
                            {edition.label}
                          </h3>
                          {edition.isActive ? (
                            <Badge tone="success">{t.publications.currentEdition}</Badge>
                          ) : null}
                          {edition.year ? (
                            <span className="text-small tabular-nums text-foreground-subtle">
                              {edition.year}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-small leading-khmer text-foreground-muted">
                          {edition.changelog ?? t.publications.editionNoChangelog}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* ── Citation ────────────────────────────────────────────── */}
            <section aria-labelledby="citation-heading" className="flex flex-col gap-3">
              <SectionHeading id="citation-heading" headingLevel={2} title={t.publications.citationHeading} />
              <PublicationCitation
                citation={publication.citation}
                bibtex={publication.bibtex}
                slug={publication.slug}
                locale={locale}
              />
            </section>

            {/* ── Related records ─────────────────────────────────────── */}
            {relations.length > 0 ? (
              <section aria-labelledby="relations-heading" className="flex flex-col gap-3">
                <SectionHeading id="relations-heading" headingLevel={2} title={t.publications.relatedHeading} />
                <ul className="flex flex-col gap-2">
                  {relations.map((relation) => (
                    <li key={`${relation.type}-${relation.id}`}>
                      <SmartLink
                        href={relation.href ?? "#"}
                        className="inline-flex items-center gap-2 text-body leading-khmer text-foreground hover:underline"
                      >
                        <Icon name="externalLink" size={15} aria-hidden />
                        <span className="text-small uppercase tracking-[0.06em] text-foreground-subtle">
                          {relationLabel(relation.type, t)}
                        </span>
                        {relation.title}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              Sidebar
              ═══════════════════════════════════════════════════════════════ */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
            {publication.cover ? (
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[16rem] overflow-hidden rounded-(--radius-lg) border border-border bg-surface-muted lg:mx-0 lg:max-w-none">
                <Image
                  src={publication.cover.src}
                  alt={publication.cover.alt}
                  fill
                  sizes="(min-width: 1024px) 20rem, 16rem"
                  className="object-cover"
                  priority
                  placeholder={publication.cover.blurDataURL ? "blur" : "empty"}
                  blurDataURL={publication.cover.blurDataURL ?? undefined}
                />
              </div>
            ) : null}

            {/* ── Access ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              {access.canDownloadPdf ? (
                <ButtonLink href={downloadHref} prefetch={false}>
                  <Icon name="download" size={16} />
                  {t.publications.downloadPdf}
                </ButtonLink>
              ) : access.showPdfRequestCta ? (
                <div className="flex flex-col gap-2 rounded-(--radius-md) border border-border p-3">
                  <p className="text-small font-medium leading-khmer text-foreground">
                    {t.publications.downloadOnRequest}
                  </p>
                  <p className="text-small leading-khmer text-foreground-muted">
                    {t.publications.downloadOnRequestBody}
                  </p>
                  <ButtonLink href={localePath(locale, "contact")} variant="secondary">
                    {t.publications.contactAboutThis}
                  </ButtonLink>
                </div>
              ) : null}

              {/* ── LaTeX source ──────────────────────────────────────── */}
              {access.sourceRepositoryUrl ? (
                <ButtonLink
                  href={access.sourceRepositoryUrl}
                  variant="secondary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="externalLink" size={16} />
                  {t.publications.latexSourceRepository}
                </ButtonLink>
              ) : access.canDownloadSource ? (
                <ButtonLink href={sourceHref} variant="secondary" prefetch={false}>
                  <Icon name="download" size={16} />
                  {t.publications.latexSourcePublic}
                </ButtonLink>
              ) : access.showSourceRequestCta ? (
                <p className="text-small leading-khmer text-foreground-muted">
                  {t.publications.latexSourceOnRequest}
                </p>
              ) : null}
            </div>

            {/* ── Facts ───────────────────────────────────────────────── */}
            <dl className="flex flex-col gap-2 text-small">
              <Fact label={t.publications.type} value={publication.type?.name} />
              <Fact label={t.publications.subject} value={publication.subject} />
              <Fact label={t.publications.level} value={publication.gradeLevel} />
              <Fact
                label={t.publications.audience}
                value={publication.targetAudience}
              />
              <Fact label={t.publications.edition} value={publication.editionLabel} />
              <Fact
                label={t.publications.year}
                value={publication.year ? String(publication.year) : null}
              />
              <Fact
                label={t.publications.language}
                value={languageLabel(publication.contentLanguage, t)}
              />
              <Fact
                label={t.publications.pages}
                value={publication.pageCount ? String(publication.pageCount) : null}
              />
              {/*
               * ISBN and DOI appear only when the owner entered a real one. They
               * are never generated — a fabricated ISBN is a false claim about a
               * real registry.
               */}
              <Fact label="ISBN" value={publication.isbn} />
              <Fact label="DOI" value={publication.doi} />
            </dl>

            {publication.topics.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-small font-semibold text-foreground">
                  {t.publications.topics}
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {publication.topics.map((topic) => (
                    <li key={topic.id}>
                      <Tag>{topic.name}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Divider />

            {/* ── Licence ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <h2 className="text-small font-semibold text-foreground">
                {t.publications.licenceHeading}
              </h2>
              <p className="text-small leading-khmer text-foreground-muted">
                {licenseLabel(publication.licenseType, t)}
              </p>
              {publication.copyrightHolder && publication.copyrightYear ? (
                <p className="text-small leading-khmer text-foreground-subtle">
                  {interpolate(t.publications.copyright, {
                    year: publication.copyrightYear,
                    holder: publication.copyrightHolder,
                  })}
                </p>
              ) : null}
              <p className="text-small leading-khmer text-foreground-subtle">
                {publication.allowRedistribution
                  ? t.publications.redistributionAllowed
                  : t.publications.redistributionNotAllowed}
              </p>
              <p className="text-small leading-khmer text-foreground-subtle">
                {publication.allowModification
                  ? t.publications.modificationAllowed
                  : t.publications.modificationNotAllowed}
              </p>
              {publication.licenseTerms ? (
                <Prose text={publication.licenseTerms} lang={null} className="text-small" />
              ) : null}
              {licenseUrl(publication.licenseType) ? (
                <SmartLink
                  href={licenseUrl(publication.licenseType)!}
                  className="text-small text-foreground-muted underline"
                >
                  {t.publications.licenceReadTerms}
                </SmartLink>
              ) : null}
            </div>

            {/* ── Production ──────────────────────────────────────────── */}
            {publication.typesetWithLatex ? (
              <>
                <Divider />
                <div className="flex flex-col gap-2">
                  <h2 className="text-small font-semibold text-foreground">
                    {t.publications.latexHeading}
                  </h2>
                  <dl className="flex flex-col gap-1.5 text-small">
                    <Fact
                      label={t.publications.latexEngine}
                      value={publication.latexEngine}
                    />
                    <Fact
                      label={t.publications.latexDocumentClass}
                      value={publication.documentClass}
                    />
                    <Fact
                      label={t.publications.latexBuildYear}
                      value={publication.buildYear ? String(publication.buildYear) : null}
                    />
                  </dl>
                  {publication.productionNotes ? (
                    <Prose
                      text={publication.productionNotes}
                      lang={null}
                      className="text-small"
                    />
                  ) : null}
                  {publication.sourcePolicy === "private" ? (
                    <p className="text-small leading-khmer text-foreground-subtle">
                      {t.publications.latexSourcePrivate}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeEdition?.pageCount ? (
              <p className="text-[0.75rem] leading-khmer text-foreground-subtle">
                {interpolate(t.publications.pageCountPlural, {
                  count: activeEdition.pageCount,
                })}
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      {/* ── Related publications ──────────────────────────────────────────── */}
      {related.length > 0 ? (
        <section className="section-y border-t border-border">
          <div className="container-content flex flex-col gap-6">
            <SectionHeading headingLevel={2} title={t.publications.relatedPublicationsHeading} />
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.id} className="flex">
                  <PublicationCard publication={item} locale={locale} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── Previous / next ───────────────────────────────────────────────── */}
      {adjacent.previous || adjacent.next ? (
        <nav
          aria-label={t.publications.publicationNavigation}
          className="border-t border-border"
        >
          <div className="container-content flex flex-wrap justify-between gap-4 py-8">
            {adjacent.previous ? (
              <SmartLink
                href={adjacent.previous.href}
                className="group flex max-w-[48%] flex-col gap-1"
              >
                <span className="text-small text-foreground-subtle">
                  <Icon name="arrowLeft" size={14} aria-hidden /> {t.publications.previousPublication}
                </span>
                <span className="text-body leading-khmer text-foreground group-hover:underline">
                  {adjacent.previous.title}
                </span>
              </SmartLink>
            ) : (
              <span />
            )}

            {adjacent.next ? (
              <SmartLink
                href={adjacent.next.href}
                className="group flex max-w-[48%] flex-col gap-1 text-right"
              >
                <span className="text-small text-foreground-subtle">
                  {t.publications.nextPublication} <Icon name="arrowRight" size={14} aria-hidden />
                </span>
                <span className="text-body leading-khmer text-foreground group-hover:underline">
                  {adjacent.next.title}
                </span>
              </SmartLink>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────────

/**
 * Plain-text prose, split into paragraphs on blank lines.
 *
 * Not `dangerouslySetInnerHTML` — `react/no-danger` is an error in this codebase
 * and these fields are admin-authored plain text, not markup.
 */
function Prose({
  text,
  lang,
  className,
}: {
  text: string;
  lang: Locale | null;
  className?: string;
}) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim() !== "");

  return (
    <div className={className} lang={lang ?? undefined}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="mb-3 text-body leading-khmer text-foreground-muted last:mb-0"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/** One `dt`/`dd` pair, rendered only when there is a value. */
function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 leading-khmer text-foreground">{value}</dd>
    </div>
  );
}

type Dictionary = ReturnType<typeof getDictionary>;

function relationLabel(type: string, t: Dictionary): string {
  const map: Record<string, string> = {
    journey: t.publications.relatedJourney,
    experience: t.publications.relatedExperience,
    education: t.publications.relatedEducation,
    certificate: t.publications.relatedCertificate,
    project: t.publications.relatedProject,
  };
  return map[type] ?? type;
}

function languageLabel(language: string, t: Dictionary): string {
  const map: Record<string, string> = {
    km: t.publications.languageKm,
    en: t.publications.languageEn,
    bilingual: t.publications.languageBilingual,
    other: t.publications.languageOther,
  };
  return map[language] ?? language;
}

function licenseLabel(license: LicenseType, t: Dictionary): string {
  const map: Record<LicenseType, string> = {
    all_rights_reserved: t.publications.licenceAllRightsReserved,
    personal_educational: t.publications.licencePersonalEducational,
    non_commercial: t.publications.licenceNonCommercial,
    cc_by: t.publications.licenceCcBy,
    cc_by_sa: t.publications.licenceCcBySa,
    cc_by_nd: t.publications.licenceCcByNd,
    cc_by_nc: t.publications.licenceCcByNc,
    cc_by_nc_sa: t.publications.licenceCcByNcSa,
    cc_by_nc_nd: t.publications.licenceCcByNcNd,
    cc0: t.publications.licenceCc0,
    public_domain: t.publications.licencePublicDomain,
    custom: t.publications.licenceCustom,
  };
  return map[license];
}
