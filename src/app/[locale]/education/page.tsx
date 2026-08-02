import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/states";
import { EducationHero } from "@/components/public/education/hero";
import { DualDegreeSpotlight } from "@/components/public/education/spotlight";
import { AcademicWeek } from "@/components/public/education/academic-week";
import { KnowledgeConvergence } from "@/components/public/education/convergence";
import { FieldworkFeature } from "@/components/public/education/fieldwork";
import { MilestoneAndTimeline } from "@/components/public/education/milestone-timeline";
import { ClosingBand } from "@/components/public/closing-band";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getEducation, getExperiences } from "@/lib/data/cv";
import { getFeaturedProjects } from "@/lib/data/projects";
import { getFeaturedPublications } from "@/lib/data/publications";
import {
  getJourneyEntries,
  getJourneyStoriesByRelation,
} from "@/lib/data/journey";
import {
  buildConvergenceApplications,
  buildEducationTimeline,
  buildEducationViews,
} from "@/lib/content/education-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  profilePageSchema,
} from "@/lib/seo/jsonld";

/**
 * The Education page.
 *
 * ── One argument, one derivation ───────────────────────────────────────────
 * "Two degrees, one educational mission." The two active programmes carry the
 * page; the school qualifications are the compact run-up to them, and every
 * claim in between — the week split, the convergence, the applications — is
 * derived once in `education-view.ts` from the CMS rows and the records the
 * other content types already publish.
 *
 * ── Why the extra queries ──────────────────────────────────────────────────
 * Experiences, projects, publications and journey stories are fetched so the
 * page can *link* to the real work that applies the study, rather than
 * describing it again. All are existing cached list queries, they run in
 * parallel, and the route stays statically rendered on a 300-second
 * revalidate — the cost is paid at build and revalidation time, not per
 * visit.
 */

export const revalidate = 300;

const SPOTLIGHT_SECTION_ID = "education-spotlight";
const SPOTLIGHT_HEADING_ID = "education-spotlight-heading";
const WEEK_HEADING_ID = "education-week-heading";
const CONVERGENCE_HEADING_ID = "education-convergence-heading";
const FIELDWORK_HEADING_ID = "education-fieldwork-heading";
const TIMELINE_HEADING_ID = "education-timeline-heading";
const CTA_HEADING_ID = "education-cta-heading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("education", locale);

  return buildPageMetadata({
    locale,
    path: "education",
    title: override?.title ?? t.education.title,
    description: override?.description ?? t.education.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function EducationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  const [
    education,
    journeyByEducation,
    journeyEntries,
    experiences,
    projects,
    publications,
  ] = await Promise.all([
    getEducation(locale),
    getJourneyStoriesByRelation("education", locale),
    getJourneyEntries(locale),
    getExperiences(locale),
    getFeaturedProjects(locale, 6),
    getFeaturedPublications(locale, 3),
  ]);

  const views = buildEducationViews({ entries: education, locale, t });
  const timeline = buildEducationTimeline({ views, locale, t });
  const applications = buildConvergenceApplications({
    evidence: {
      experiences,
      projects,
      publications,
    },
    locale,
    t,
  });

  /*
   * The fieldwork feature: the first journey story related to a current
   * programme, resolved to its full summary (cover, date, location) from the
   * already-fetched journey list. The by-relation map says *which* stories
   * belong here; the summaries carry what the feature renders.
   */
  const fieldworkProgramme = views.programmes.find(
    (programme) => (journeyByEducation[programme.id]?.length ?? 0) > 0,
  );
  const fieldworkSlug = fieldworkProgramme
    ? journeyByEducation[fieldworkProgramme.id]?.[0]?.slug
    : undefined;
  const fieldworkStory =
    journeyEntries.find((entry) => entry.slug === fieldworkSlug) ?? null;

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.education, url: absoluteUrl(localePath(locale, "education")) },
    ]),
    /*
      ProfilePage pointing at the site-wide Person node — nothing stronger.
      `EducationalOccupationalCredential` is deliberately not emitted: two of
      the four records are in-progress programmes, not credentials, and
      marking up the other two without verification URLs would assert more
      than the page can back.
    */
    profilePageSchema({
      locale,
      path: "education",
      name: t.education.title,
      description: t.education.description,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <EducationHero locale={locale} t={t} spotlightId={SPOTLIGHT_SECTION_ID} />

      {views.programmes.length === 0 && views.milestones.length === 0 ? (
        <div className="container-content py-16">
          <EmptyState icon="graduation" title={t.education.emptyState} />
        </div>
      ) : (
        <>
          <DualDegreeSpotlight
            locale={locale}
            t={t}
            programmes={views.programmes}
            stories={journeyByEducation}
            sectionId={SPOTLIGHT_SECTION_ID}
            headingId={SPOTLIGHT_HEADING_ID}
          />

          <AcademicWeek
            t={t}
            programmes={views.programmes}
            headingId={WEEK_HEADING_ID}
          />

          <KnowledgeConvergence
            t={t}
            programmes={views.programmes}
            applications={applications}
            headingId={CONVERGENCE_HEADING_ID}
          />

          <FieldworkFeature
            locale={locale}
            t={t}
            story={fieldworkStory}
            programmeName={fieldworkProgramme?.institution ?? null}
            headingId={FIELDWORK_HEADING_ID}
          />

          <MilestoneAndTimeline
            locale={locale}
            t={t}
            milestone={views.nationalMilestone}
            points={timeline}
            headingId={TIMELINE_HEADING_ID}
          />
        </>
      )}

      <ClosingBand
        headingId={CTA_HEADING_ID}
        eyebrow={t.education.cta.eyebrow}
        heading={t.education.cta.heading}
        body={t.education.cta.body}
        actions={[
          {
            href: localePath(locale, "experience"),
            label: t.education.cta.experience,
            variant: "accent",
            iconEnd: "arrowRight",
          },
          {
            href: localePath(locale, "publications"),
            label: t.education.cta.publications,
            variant: "outline",
          },
          {
            href: localePath(locale, "resume"),
            label: t.nav.resume,
            variant: "link",
            iconEnd: "arrowRight",
          },
        ]}
      />
    </>
  );
}
