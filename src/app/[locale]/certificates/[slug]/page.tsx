import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, NeighbourNav } from "@/components/ui/navigation";
import {
  Badge,
  Card,
  CardBody,
  MetaList,
  ProseText,
  Tag,
} from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import {
  CredentialStatusPair,
  VerificationStatus,
} from "@/components/public/credential-status";
import { OutboundLink } from "@/components/public/outbound-link";
import { JourneyStoryLinks } from "@/components/public/journey-story-links";
import { getJourneyStoriesByRelation } from "@/lib/data/journey";
import { formatDate, getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, locales, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { publicStorageUrl, resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import {
  getCertificateBySlug,
  getCertificateNeighbours,
  getPublishedCertificateSlugs,
} from "@/lib/data/certificates";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  credentialSchema,
  graph,
} from "@/lib/seo/jsonld";

export const revalidate = 300;

export async function generateStaticParams() {
  const certificates = await getPublishedCertificateSlugs();
  return locales.flatMap((locale) =>
    certificates.map((certificate) => ({ locale, slug: certificate.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const certificate = await getCertificateBySlug(slug, locale);
  if (!certificate) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  return buildPageMetadata({
    locale,
    path: `certificates/${slug}`,
    title: certificate.seoTitle ?? `${certificate.title} — ${certificate.issuer}`,
    description:
      certificate.seoDescription ??
      truncateDescription(certificate.description, locale),
    ogImage: certificate.ogImage ?? certificate.preview,
    type: "article",
    publishedTime: certificate.publishedAt,
    modifiedTime: certificate.updatedAt,
  });
}

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const certificate = await getCertificateBySlug(slug, locale);
  if (!certificate) notFound();

  /*
   * Related journey stories.
   *
   * Section 18 of the brief, and the whole reason these are a *link* rather than
   * an embedded gallery: the credential document and the award-ceremony
   * photograph are different artefacts. The redacted scan above is the
   * credential; the ceremony photographs live on the story and must never stand
   * in for the document itself.
   */
  const [journeyStoriesByCertificate, neighbours] = await Promise.all([
    getJourneyStoriesByRelation("certificate", locale),
    // Ordered exactly as the listing is, so "next" means the card that followed
    // the one the visitor clicked.
    getCertificateNeighbours(slug, locale),
  ]);

  const journeyStories = journeyStoriesByCertificate[certificate.id];

  // Only ever the redacted preview: `resolveImage` returns null for any private
  // asset, and the original's id is not even selected by the query.
  const preview = resolveImage(certificate.preview, locale, "preview");
  const contentLang = langAttribute(locale, certificate.contentLocale);


  const structuredData = graph([
    credentialSchema({
      locale,
      slug: certificate.slug,
      title: certificate.title,
      description: certificate.description,
      issuerName: certificate.issuer,
      issuerUrl: certificate.issuerUrl,
      issuedOn: certificate.issuedOn,
      expiresOn: certificate.expiresOn,
      /*
        Only the opted-in identifier reaches structured data. The audit found
        four credentials emitting schema.org `identifier`, one of them a 21-digit
        examination number — published because the field existed, not because
        anyone decided it should be.
      */
      credentialId: certificate.publicCredentialId,
      imageUrl:
        (certificate.preview
          ? publicStorageUrl(
              certificate.preview.bucket_id,
              certificate.preview.preview_path ?? certificate.preview.storage_path,
              certificate.preview.storage_provider,
            )
          : null) ?? undefined,
      categoryName: certificate.category?.name,
    }),
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      {
        name: t.nav.certificates,
        url: absoluteUrl(localePath(locale, "certificates")),
      },
      {
        name: certificate.title,
        url: absoluteUrl(localePath(locale, `certificates/${certificate.slug}`)),
      },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker
        locale={locale}
        eventName="certificate_view"
        entityType="certificate"
        entityId={certificate.id}
        entitySlug={certificate.slug}
      />

      <article className="container-content flex flex-col gap-8 py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.certificates, href: localePath(locale, "certificates") },
            { label: certificate.title },
          ]}
          label={t.a11y.breadcrumb}
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          {/* ── Preview ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <figure className="flex flex-col gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-lg) border border-border bg-surface-muted">
                {preview ? (
                  <Image
                    src={preview.src}
                    alt={preview.alt || certificate.title}
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    priority
                    placeholder={preview.blurDataURL ? "blur" : undefined}
                    blurDataURL={preview.blurDataURL ?? undefined}
                    className="object-contain p-4"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-foreground-subtle">
                    <p className="px-6 text-center text-small">
                      {t.certificates.emptyState}
                    </p>
                  </div>
                )}
              </div>

              <figcaption className="text-[0.8125rem] text-foreground-muted">
                {t.certificates.previewNote}
              </figcaption>
            </figure>

            {/*
              Text alternative to the scan itself. A certificate image is
              unreadable to a screen reader and to anyone who cannot see it, so the
              CMS carries a written summary of what the document shows.
            */}
            {certificate.imageSummary ? (
              <Card>
                <CardBody className="flex flex-col gap-2">
                  <h2 className="text-h4 font-semibold">
                    {t.certificates.documentSummary}
                  </h2>
                  <ProseText text={certificate.imageSummary} className="text-small" />
                </CardBody>
              </Card>
            ) : null}
          </div>

          {/* ── Details ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {certificate.category ? (
                <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent-subtle-foreground">
                  {certificate.category.name}
                </p>
              ) : null}

              <h1 className="text-h1 font-bold" lang={contentLang}>
                {certificate.title}
              </h1>

              <p className="text-body-lg text-foreground-muted">
                {t.certificates.issuer}:{" "}
                {certificate.issuerUrl ? (
                  <OutboundLink
                    href={certificate.issuerUrl}
                    newTabHint={t.a11y.opensInNewTab}
                    event={{
                      name: "outbound_link_click",
                      locale,
                      entityType: "certificate",
                      entityId: certificate.id,
                      properties: { url: certificate.issuerUrl },
                    }}
                    className="text-primary underline underline-offset-2 hover:decoration-2"
                  >
                    {certificate.issuer}
                  </OutboundLink>
                ) : (
                  <span className="font-medium text-foreground">
                    {certificate.issuer}
                  </span>
                )}
              </p>

              <CredentialStatusPair
                verification={certificate.verificationStatus}
                validity={certificate.validityStatus}
                t={t}
                className="text-small"
              />
            </div>

            {certificate.description ? (
              <ProseText text={certificate.description} />
            ) : null}

            <Card>
              <CardBody>
                <MetaList
                  items={[
                    {
                      label: t.certificates.issuedOn,
                      value: certificate.issuedOn
                        ? formatDate(certificate.issuedOn, locale)
                        : undefined,
                    },
                    {
                      /*
                        Validity, not a guessed expiry. This row used to print
                        "No expiry" whenever `expires_on` was NULL, which
                        conflates "this qualification is permanent" with "nobody
                        recorded an expiry date" — the first is a fact about a
                        diploma, the second is missing data.
                      */
                      label: t.certificates.validityLabel,
                      value:
                        certificate.validityStatus === "valid" &&
                        certificate.expiresOn
                          ? formatDate(certificate.expiresOn, locale)
                          : t.certificates.validity[certificate.validityStatus],
                    },
                    {
                      label: t.certificates.credentialId,
                      // `undefined` drops the row entirely rather than rendering
                      // an empty definition — see MetadataList.
                      value: certificate.publicCredentialId ?? undefined,
                    },
                    {
                      label: t.certificates.category,
                      value: certificate.category?.name,
                    },
                  ]}
                />
              </CardBody>
            </Card>

            {certificate.skills.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-h4 font-semibold">{t.certificates.skills}</h2>
                <ul className="flex flex-wrap gap-1.5">
                  {certificate.skills.map((skill) => (
                    <li key={skill.id}>
                      <Tag>{skill.label}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* ── Verification ──────────────────────────────────────────────
              A section rather than a lone button. The question "is this real,
              and how would I know?" deserves an answer in words: the previous
              treatment offered either a Verify button or the single line "No
              online verification available", which told a reader nothing about
              whether that was the issuer's limitation or an outstanding task.
            */}
            <Card>
              <CardBody className="flex flex-col gap-3">
                <h2 className="text-h4 font-semibold">
                  {t.certificates.verificationLabel}
                </h2>

                <VerificationStatus
                  status={certificate.verificationStatus}
                  t={t}
                  className="text-base"
                />

                <p className="max-w-[62ch] text-small text-foreground-muted">
                  {t.certificates.verificationExplained[certificate.verificationStatus]}
                </p>

                {/*
                  Only rendered for a status that claims a verification happened.
                  A database CHECK guarantees `verified_on` is present for those
                  and absent otherwise, so this cannot print a date that was
                  really just `updated_at`.
                */}
                {certificate.verifiedOn ? (
                  <p className="text-small text-foreground-subtle">
                    {t.certificates.verifiedOn}{" "}
                    <time dateTime={certificate.verifiedOn}>
                      {formatDate(certificate.verifiedOn, locale)}
                    </time>
                  </p>
                ) : null}

                {certificate.verificationUrl ? (
                  <div>
                    <OutboundLink
                      href={certificate.verificationUrl}
                      newTabHint={t.a11y.opensInNewTab}
                      event={{
                        name: "certificate_verify_click",
                        locale,
                        entityType: "certificate",
                        entityId: certificate.id,
                        entitySlug: certificate.slug,
                        properties: { url: certificate.verificationUrl },
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover"
                    >
                      {t.certificates.verify}
                    </OutboundLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            {/* ── Previous / next ───────────────────────────────────────────
              Sits above "All certificates" so the two ways out are together:
              step sideways through the collection, or leave it. */}
            <NeighbourNav
              label={t.certificates.credentialNavigation}
              previous={
                neighbours.previous
                  ? {
                      href: localePath(
                        locale,
                        `certificates/${neighbours.previous.slug}`,
                      ),
                      label: t.certificates.previousCredential,
                      title: neighbours.previous.title,
                    }
                  : null
              }
              next={
                neighbours.next
                  ? {
                      href: localePath(locale, `certificates/${neighbours.next.slug}`),
                      label: t.certificates.nextCredential,
                      title: neighbours.next.title,
                    }
                  : null
              }
            />

            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href={localePath(locale, "certificates")}
                variant="outline"
                iconStart="arrowLeft"
              >
                {t.certificates.backToCertificates}
              </ButtonLink>
            </div>

            {/*
              The original scan is never offered here. Download is only possible
              when the admin has explicitly cleared the document for public
              download AND recorded that it holds no sensitive data — a condition
              the database enforces with a trigger.
            */}
            {!certificate.allowPublicDownload ? (
              /*
                States the reason, not just the absence. "This document is not
                available for download" reads as a fault or an oversight; the
                truth is that withholding it is the deliberate protection, and
                saying so turns a dead end into an explanation.
              */
              <Notice tone="info" icon="lock" title={t.certificates.previewOnly}>
                <p>{t.certificates.previewOnlyExplained}</p>
              </Notice>
            ) : null}

            {journeyStories && journeyStories.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-6">
                <h2 className="text-h4 font-semibold">{t.journey.fromJourney}</h2>
                <JourneyStoryLinks locale={locale} t={t} stories={journeyStories} />
              </div>
            ) : null}

            {certificate.relatedProjects.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-6">
                <h2 className="text-h4 font-semibold">
                  {t.certificates.relatedProjects}
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {certificate.relatedProjects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={localePath(locale, `projects/${project.slug}`)}
                        className="text-small text-primary underline underline-offset-2 hover:decoration-2"
                      >
                        {project.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {certificate.featured ? (
              <Badge tone="accent" icon="star" className="w-fit">
                {t.common.featured}
              </Badge>
            ) : null}
          </div>
        </div>
      </article>
    </>
  );
}
