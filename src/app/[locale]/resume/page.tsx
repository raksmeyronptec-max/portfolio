import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { PrintButton } from "@/components/public/print-button";
import { ResumeDownloadButton } from "@/components/public/resume-download";
import {
  Badge,
  Card,
  CardBody,
  Divider,
  MetaList,
  ProseText,
  SmartLink,
  Tag,
} from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import {
  formatDate,
  formatFileSize,
  getDictionary,
  interpolate,
} from "@/i18n/dictionary";
import {
  isLocale,
  localeMeta,
  localePath,
  otherLocales,
  type Locale,
} from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { fileTypeLabel } from "@/lib/content/media";
import { getSeoOverride, getSiteSettings, getSpokenLanguages } from "@/lib/data/site";
import { getEducation, getExperiences, getCapabilityGroups } from "@/lib/data/cv";
import { getActiveResume, getAvailableResumeLocales } from "@/lib/data/resume";
import { getFeaturedProjects } from "@/lib/data/projects";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, profilePageSchema } from "@/lib/seo/jsonld";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("resume", locale);

  return buildPageMetadata({
    locale,
    path: "resume",
    title: override?.title ?? t.resume.title,
    description: override?.description ?? t.resume.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

/**
 * Resume page.
 *
 * Serves three needs from one route:
 *  1. A readable web resume built from the same CMS data as the rest of the site,
 *     so it can never drift from the Education and Experience pages.
 *  2. A PDF download of the active resume version, counted server-side.
 *  3. A print-friendly rendering — `@media print` in globals.css hides the header,
 *     footer and controls, and expands link URLs.
 */
export default async function ResumePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  const [settings, resume, availableLocales, education, experiences, capabilities, languages, projects] =
    await Promise.all([
      getSiteSettings(locale),
      getActiveResume(locale),
      getAvailableResumeLocales(),
      getEducation(locale),
      getExperiences(locale),
      getCapabilityGroups(locale),
      getSpokenLanguages(locale),
      getFeaturedProjects(locale, 6),
    ]);

  const alternateLocale = otherLocales(locale).find((candidate) =>
    availableLocales.includes(candidate),
  );

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.resume, url: absoluteUrl(localePath(locale, "resume")) },
    ]),
    profilePageSchema({
      locale,
      path: "resume",
      name: settings.siteName,
      description: settings.positioning,
      dateModified: resume?.updatedAt,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker locale={locale} eventName="resume_view" entityType="resume" />

      {/* `data-print="hide"` is set inside PageHeader's own section via the
          global print rules; the band itself is decoration and never printed. */}
      <div data-print="hide">
        <PageHeader
          title={t.resume.title}
          description={t.resume.description}
          eyebrow={t.nav.resume}
          breadcrumbs={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.resume },
          ]}
          breadcrumbLabel={t.a11y.breadcrumb}
          watermark="CV"
        />
      </div>

      <div className="container-narrow flex flex-col gap-8 py-14 sm:py-16">
        <div data-print="hide" className="flex flex-col gap-6">
          {/* ── Version + actions ───────────────────────────────────────── */}
          {resume ? (
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-foreground-muted">
                  <Badge tone="primary">
                    {interpolate(t.resume.currentVersion, {
                      label: resume.versionLabel,
                    })}
                  </Badge>
                  <span>
                    {interpolate(t.resume.lastUpdated, {
                      date: formatDate(resume.updatedAt, locale),
                    })}
                  </span>
                </div>

                {resume.isFallback ? (
                  <Notice tone="info">
                    <p>
                      {interpolate(t.resume.noResumeForLocale, {
                        language: localeMeta[locale].nativeName,
                        fallback: localeMeta[resume.locale].nativeName,
                      })}
                    </p>
                  </Notice>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <ResumeDownloadButton
                    locale={locale}
                    resumeId={resume.id}
                    label={t.resume.download}
                    /* Type and size are announced with the link, so a screen-reader
                       user knows what they are about to download. */
                    fileHint={interpolate(t.a11y.fileTypeAndSize, {
                      type: fileTypeLabel(resume.asset.mime_type),
                      size: formatFileSize(resume.asset.file_size_bytes, locale),
                    })}
                  />

                  <PrintButton label={t.resume.print} />

                  {alternateLocale ? (
                    <ButtonLink
                      href={localePath(alternateLocale, "resume")}
                      variant="ghost"
                      hrefLang={localeMeta[alternateLocale].tag}
                    >
                      {interpolate(t.resume.viewOtherLanguage, {
                        language: localeMeta[alternateLocale].nativeName,
                      })}
                    </ButtonLink>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : (
            <Notice tone="warning">
              <p>{t.resume.noResume}</p>
            </Notice>
          )}
        </div>

        {/* ── Web resume ───────────────────────────────────────────────────── */}
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h2 className="text-h2 font-bold">{settings.siteName}</h2>
            {settings.positioning ? (
              <p className="text-body-lg text-foreground-muted">
                {settings.positioning}
              </p>
            ) : null}

            <MetaList
              className="mt-2"
              items={[
                { label: t.about.locationHeading, value: settings.location ?? undefined },
                {
                  label: t.contact.directEmail,
                  value: settings.contactEmail ? (
                    <SmartLink
                      href={`mailto:${settings.contactEmail}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {settings.contactEmail}
                    </SmartLink>
                  ) : undefined,
                },
                {
                  label: t.contact.directTelegram,
                  value: settings.telegramHandle ?? undefined,
                },
              ]}
            />
          </header>

          <Divider />

          <ResumeSection title={t.resume.sections.education}>
            {education.length === 0 ? (
              <EmptyState title={t.education.emptyState} />
            ) : (
              <ul className="flex flex-col gap-4">
                {education.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">{entry.institution}</p>
                      {entry.periodLabel ? (
                        <p className="font-mono text-[0.8125rem] text-foreground-muted">
                          {entry.periodLabel}
                        </p>
                      ) : null}
                    </div>
                    {entry.qualification ? (
                      <p className="text-small text-foreground-muted">
                        {entry.qualification}
                      </p>
                    ) : null}
                    {entry.gradeValue && entry.gradeScale ? (
                      <p className="text-small">
                        {t.education.grade}: {entry.gradeValue} — {entry.gradeScale}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ResumeSection>

          <ResumeSection title={t.resume.sections.experience}>
            {experiences.length === 0 ? (
              <EmptyState title={t.experience.emptyState} />
            ) : (
              <ul className="flex flex-col gap-4">
                {experiences.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">{entry.roleTitle}</p>
                      {entry.periodLabel ? (
                        <p className="font-mono text-[0.8125rem] text-foreground-muted">
                          {entry.periodLabel}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-small text-foreground-muted">
                      {entry.organization}
                      {entry.location ? ` · ${entry.location}` : ""}
                    </p>
                    {entry.summary ? (
                      <ProseText text={entry.summary} className="text-small" />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ResumeSection>

          {projects.length > 0 ? (
            <ResumeSection title={t.resume.sections.projects}>
              <ul className="flex flex-col gap-3">
                {projects.map((project) => (
                  <li key={project.id} className="flex flex-col gap-0.5">
                    <p className="font-semibold">
                      <SmartLink
                        href={localePath(locale, `projects/${project.slug}`)}
                        className="underline decoration-transparent underline-offset-2 hover:decoration-current"
                      >
                        {project.title}
                      </SmartLink>
                    </p>
                    {project.summary ? (
                      <p className="text-small text-foreground-muted">
                        {project.summary}
                      </p>
                    ) : null}
                    {project.liveUrl ? (
                      <p className="text-[0.8125rem] text-foreground-subtle">
                        {project.liveUrl}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ResumeSection>
          ) : null}

          {capabilities.length > 0 ? (
            <ResumeSection title={t.resume.sections.skills}>
              <div className="flex flex-col gap-4">
                {capabilities.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    <p className="text-small font-semibold">{group.name}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.skills.map((skill) => (
                        <li key={skill.id}>
                          <Tag>{skill.name}</Tag>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ResumeSection>
          ) : null}

          {languages.length > 0 ? (
            <ResumeSection title={t.resume.sections.languages}>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {languages.map((language) => (
                  <li key={language.id} className="text-small">
                    <span className="font-medium">{language.name}</span>
                    <span className="text-foreground-muted"> — {language.proficiency}</span>
                  </li>
                ))}
              </ul>
            </ResumeSection>
          ) : null}
        </article>
      </div>
    </>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent-subtle-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
