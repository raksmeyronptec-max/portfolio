import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ClosingBand } from "@/components/public/closing-band";
import { CopyButton } from "@/components/public/resume/copy-button";
import { ResumeIdentity } from "@/components/public/resume/identity";
import { ResumeSectionNav } from "@/components/public/resume/section-nav";
import { ResumeUtilityPanel } from "@/components/public/resume/utility-panel";
import {
  ResumeCapabilities,
  ResumeContact,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeLanguages,
  ResumeProjects,
  ResumePublications,
  ResumeSection,
} from "@/components/public/resume/sections";
import {
  formatDate,
  formatFileSize,
  getDictionary,
  interpolate,
} from "@/i18n/dictionary";
import {
  isLocale,
  localePath,
  otherLocales,
  type Locale,
} from "@/i18n/config";
import { absoluteUrl, siteUrl } from "@/lib/supabase/env";
import { fileTypeLabel } from "@/lib/content/media";
import { getSeoOverride, getSiteSettings, getSpokenLanguages } from "@/lib/data/site";
import { getEducation, getExperiences } from "@/lib/data/cv";
import { getActiveResume, getAvailableResumeLocales } from "@/lib/data/resume";
import { getFeaturedProjects } from "@/lib/data/projects";
import { getFeaturedPublications } from "@/lib/data/publications";
import {
  buildResumeCapabilities,
  buildResumeContact,
  buildResumeEducation,
  buildResumeExperience,
  buildResumePublications,
  type ResumeProjectInput,
} from "@/lib/content/resume-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, profilePageSchema } from "@/lib/seo/jsonld";

/**
 * The Resume page.
 *
 * ── Two documents, one source ──────────────────────────────────────────────
 * A readable web résumé and a formal PDF. Both describe the same career, and
 * the web one is assembled from the very CMS rows the Experience, Education,
 * Projects and Publications pages use — so it cannot drift from them. What it
 * adds is résumé framing: reverse-chronological order, four contributions per
 * role instead of seven, and a capability summary derived from the tags those
 * roles already carry.
 *
 * ── And a third rendering: paper ───────────────────────────────────────────
 * `@media print` in globals.css turns this into an A4 document — the ink
 * header, the utility panel and the navigation drop out, the print-only
 * identity block appears, and external URLs are appended after their labels.
 * Printing is never triggered automatically; `PrintButton` is a real button.
 */

export const revalidate = 300;

const SECTION_IDS = {
  profile: "resume-profile",
  capabilities: "resume-capabilities",
  experience: "resume-experience",
  education: "resume-education",
  projects: "resume-projects",
  publications: "resume-publications",
  contact: "resume-contact",
} as const;

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

export default async function ResumePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  const [
    settings,
    resume,
    availableLocales,
    education,
    experiences,
    languages,
    projects,
    publications,
  ] = await Promise.all([
    getSiteSettings(locale),
    getActiveResume(locale),
    getAvailableResumeLocales(),
    getEducation(locale),
    getExperiences(locale),
    getSpokenLanguages(locale),
    getFeaturedProjects(locale, 3),
    getFeaturedPublications(locale, 3),
  ]);

  const projectInputs: ResumeProjectInput[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    liveUrl: project.liveUrl,
    role: project.role,
    technologies: project.technologies,
    categories: project.categories,
  }));

  const experienceEntries = buildResumeExperience({
    entries: experiences,
    projects: projectInputs,
    locale,
    t,
  });
  const educationEntries = buildResumeEducation({ entries: education, locale, t });
  const capabilities = buildResumeCapabilities({
    experiences,
    projects: projectInputs,
    t,
  });
  const publicationEntries = buildResumePublications({
    publications: publications.map((publication) => ({
      id: publication.id,
      slug: publication.slug,
      href: publication.href,
      title: publication.title,
      subject: publication.subject,
      year: publication.year,
      contentLanguage: publication.contentLanguage,
      typeName: publication.type?.name ?? null,
    })),
    locale,
    t,
  });

  const pageUrl = absoluteUrl(localePath(locale, "resume"));
  const contactLinks = buildResumeContact({
    settings,
    locale,
    t,
    siteUrl: siteUrl(),
  });

  /*
   * Availability is rendered only when the owner has both flagged themselves
   * available and written a status line. Neither is inferred: an unset flag
   * removes the row rather than printing a guess about their circumstances.
   */
  const availability =
    settings.isAvailableForWork && settings.availabilityStatus
      ? settings.availabilityStatus
      : null;

  const alternateLocale =
    otherLocales(locale).find((candidate) => availableLocales.includes(candidate)) ??
    null;

  const fileHint = resume
    ? interpolate(t.a11y.fileTypeAndSize, {
        type: fileTypeLabel(resume.asset.mime_type),
        size: formatFileSize(resume.asset.file_size_bytes, locale),
      })
    : "";

  const navSections = [
    { id: SECTION_IDS.profile, label: t.resume.nav.overview },
    { id: SECTION_IDS.capabilities, label: t.resume.capabilities.heading },
    { id: SECTION_IDS.experience, label: t.resume.sections.experience },
    { id: SECTION_IDS.education, label: t.resume.sections.education },
    ...(projectInputs.length > 0
      ? [{ id: SECTION_IDS.projects, label: t.resume.sections.projects }]
      : []),
    ...(publicationEntries.length > 0
      ? [{ id: SECTION_IDS.publications, label: t.resume.publications.heading }]
      : []),
    { id: SECTION_IDS.contact, label: t.resume.sections.contact },
  ];

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.resume, url: absoluteUrl(localePath(locale, "resume")) },
    ]),
    profilePageSchema({
      locale,
      path: "resume",
      name: settings.siteName,
      description: t.resume.description,
      dateModified: resume?.updatedAt,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker locale={locale} eventName="resume_view" entityType="resume" />

      <ResumeIdentity
        locale={locale}
        t={t}
        name={settings.siteName}
        location={settings.location}
        availability={availability}
        resume={resume ? { id: resume.id, fileHint } : null}
      />

      <div className="container-content py-12 sm:py-14">
        {/*
          Two columns on wide screens, one everywhere else. The utility panel
          comes *after* the résumé in the DOM so a screen reader and a keyboard
          user reach the content first; `lg:order-2` moves it to the right
          visually without changing that order.
        */}
        <div className="resume-layout grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:gap-14">
          <main className="resume-body flex min-w-0 flex-col gap-10">
            {/* ── Print-only identity ──────────────────────────────────────
                The ink header does not print, so the name, role and contact
                line are re-rendered here as plain text for paper. Hidden on
                screen, where the header above already says all of it. */}
            <header className="resume-print-header hidden">
              <h2 className="text-h2 font-bold">{settings.siteName}</h2>
              <p className="text-body-lg">{t.resume.role}</p>
              <p className="mt-1 text-small">
                {[settings.location, settings.contactEmail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </header>

            <ResumeSection id={SECTION_IDS.profile} title={t.resume.summaryHeading}>
              <p className="max-w-[70ch] text-body text-foreground-muted">
                {t.resume.summary}
              </p>
            </ResumeSection>

            {capabilities.length > 0 ? (
              <ResumeSection
                id={SECTION_IDS.capabilities}
                title={t.resume.capabilities.heading}
              >
                <ResumeCapabilities groups={capabilities} />
              </ResumeSection>
            ) : null}

            {experienceEntries.length > 0 ? (
              <ResumeSection
                id={SECTION_IDS.experience}
                title={t.resume.experience.heading}
                action={{
                  href: localePath(locale, "experience"),
                  label: t.resume.experience.viewAll,
                }}
              >
                <ResumeExperienceList t={t} entries={experienceEntries} />
              </ResumeSection>
            ) : null}

            {educationEntries.current.length + educationEntries.completed.length >
            0 ? (
              <ResumeSection
                id={SECTION_IDS.education}
                title={t.resume.education.heading}
                action={{
                  href: localePath(locale, "education"),
                  label: t.resume.education.viewAll,
                }}
              >
                <ResumeEducationList
                  t={t}
                  current={educationEntries.current}
                  completed={educationEntries.completed}
                />
              </ResumeSection>
            ) : null}

            {projectInputs.length > 0 ? (
              <ResumeSection
                id={SECTION_IDS.projects}
                title={t.resume.projects.heading}
                action={{
                  href: localePath(locale, "projects"),
                  label: t.resume.projects.viewAll,
                }}
              >
                <ResumeProjects locale={locale} t={t} projects={projectInputs} />
              </ResumeSection>
            ) : null}

            {publicationEntries.length > 0 ? (
              <ResumeSection
                id={SECTION_IDS.publications}
                title={t.resume.publications.heading}
                action={{
                  href: localePath(locale, "publications"),
                  label: t.resume.publications.viewAll,
                }}
              >
                <ResumePublications publications={publicationEntries} />
              </ResumeSection>
            ) : null}

            {languages.length > 0 ? (
              <ResumeSection
                id="resume-languages"
                title={t.resume.languages.heading}
              >
                <ResumeLanguages languages={languages} />
              </ResumeSection>
            ) : null}

            <div className="resume-contact">
              <ResumeSection
                id={SECTION_IDS.contact}
                title={t.resume.contact.heading}
              >
                <ResumeContact
                  t={t}
                  links={contactLinks}
                  availability={availability}
                  copySlot={
                    settings.contactEmail ? (
                      <CopyButton
                        value={settings.contactEmail}
                        label={t.resume.contact.copyEmail}
                        copiedLabel={t.resume.contact.emailCopied}
                        failedLabel={t.resume.contact.emailCopyFailed}
                        className="print:hidden"
                      />
                    ) : null
                  }
                />
              </ResumeSection>
            </div>
          </main>

          <ResumeUtilityPanel
            locale={locale}
            t={t}
            pageUrl={pageUrl}
            alternateLocale={alternateLocale}
            resume={
              resume
                ? {
                    versionLabel: resume.versionLabel,
                    documentLocale: resume.locale,
                    updatedLabel: formatDate(resume.updatedAt, locale),
                    fileLabel: `${fileTypeLabel(resume.asset.mime_type)} · ${formatFileSize(
                      resume.asset.file_size_bytes,
                      locale,
                    )}`,
                    isFallback: resume.isFallback,
                  }
                : null
            }
          >
            <ResumeSectionNav label={t.resume.nav.label} sections={navSections} />
          </ResumeUtilityPanel>
        </div>
      </div>

      {/* Screen only: a printed résumé ends at the contact details, not at a
          call to action that cannot be clicked. */}
      {/* Screen only: a printed résumé ends at the contact details, not at a
          call to action that cannot be clicked. */}
      <div data-print="hide">
        <ClosingBand
          headingId="resume-cta-heading"
          eyebrow={t.nav.resume}
          heading={t.resume.cta.heading}
          body={interpolate(t.resume.lastUpdated, {
            date: resume ? formatDate(resume.updatedAt, locale) : "",
          })}
          actions={[
            {
              href: localePath(locale, "contact"),
              label: t.resume.cta.contact,
              variant: "accent",
              iconEnd: "arrowRight",
            },
            {
              href: localePath(locale, "projects"),
              label: t.resume.cta.projects,
              variant: "outline",
            },
          ]}
        />
      </div>
    </>
  );
}
