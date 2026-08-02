import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/states";
import { ExperienceHero } from "@/components/public/experience/hero";
import { ExperienceTracks } from "@/components/public/experience/tracks";
import { ExperienceTimeline } from "@/components/public/experience/timeline";
import { EvidenceMap } from "@/components/public/experience/evidence-map";
import { ExperienceClosingCta } from "@/components/public/experience/closing-cta";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getExperiences } from "@/lib/data/cv";
import { getFeaturedProjects } from "@/lib/data/projects";
import { getFeaturedPublications } from "@/lib/data/publications";
import { getJourneyStoriesByRelation } from "@/lib/data/journey";
import {
  buildEvidenceThemes,
  buildExperienceFilters,
  buildExperienceSummary,
  buildExperienceViews,
  type ProjectInput,
  type PublicationInput,
} from "@/lib/content/experience-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  profilePageSchema,
} from "@/lib/seo/jsonld";

/**
 * The Experience page.
 *
 * ── One argument, one data source ──────────────────────────────────────────
 * The page says that the classroom work and the engineering work are the same
 * line of work, and it has to say it with the CMS's own content. So everything
 * below — the hero's figures, the two track panels, the chronology, the
 * evidence map — is derived once by `buildExperienceViews` and its siblings and
 * then rendered. No section restates another's text, and no component invents a
 * date, a relationship or a count.
 *
 * ── Why the extra queries ──────────────────────────────────────────────────
 * Projects and publications are fetched so the page can *link* to the real
 * things the entries name, rather than describing them again. Both are already
 * cached list queries used by the homepage, all four run in parallel, and the
 * route stays statically rendered on a 300-second revalidate.
 */

export const revalidate = 300;

/** Stable ids, shared between the hero's anchor and the section it targets. */
const TIMELINE_SECTION_ID = "experience-timeline";
const TRACKS_HEADING_ID = "experience-tracks-heading";
const TIMELINE_HEADING_ID = "experience-timeline-heading";
const EVIDENCE_HEADING_ID = "experience-evidence-heading";
const CTA_HEADING_ID = "experience-cta-heading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("experience", locale);

  return buildPageMetadata({
    locale,
    path: "experience",
    title: override?.title ?? t.experience.title,
    description: override?.description ?? t.experience.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  const [experiences, journeyByExperience, projects, publications] =
    await Promise.all([
      getExperiences(locale),
      getJourneyStoriesByRelation("experience", locale),
      /*
        Six is the ceiling, not a target: only projects an entry's own prose
        actually names end up linked, so a project that is never mentioned costs
        nothing but a row in a query that was already running for the homepage.
      */
      getFeaturedProjects(locale, 6),
      getFeaturedPublications(locale, 4),
    ]);

  const projectInputs: ProjectInput[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    liveUrl: project.liveUrl,
    technologies: project.technologies,
    categories: project.categories,
  }));

  const publicationInputs: PublicationInput[] = publications.map(
    (publication) => ({
      id: publication.id,
      slug: publication.slug,
      href: publication.href,
      title: publication.title,
      subject: publication.subject,
    }),
  );

  const views = buildExperienceViews({
    entries: experiences,
    projects: projectInputs,
    locale,
    t,
  });

  const summary = buildExperienceSummary({ views, locale, t });
  const filters = buildExperienceFilters({ views, t });
  const themes = buildEvidenceThemes({
    views,
    projects: projectInputs,
    publications: publicationInputs,
    locale,
    t,
  });

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      {
        name: t.nav.experience,
        url: absoluteUrl(localePath(locale, "experience")),
      },
    ]),
    /*
      ProfilePage, pointing at the site-wide Person node. Nothing stronger is
      emitted: `JobPosting` would be a lie, and an `Organization` relationship
      would assert an employment link the CMS does not record.
    */
    profilePageSchema({
      locale,
      path: "experience",
      name: t.experience.title,
      description: t.experience.description,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <ExperienceHero
        locale={locale}
        t={t}
        summary={summary}
        timelineId={TIMELINE_SECTION_ID}
      />

      {views.length === 0 ? (
        <div className="container-content py-16">
          <EmptyState icon="briefcase" title={t.experience.emptyState} />
        </div>
      ) : (
        <>
          <ExperienceTracks
            t={t}
            views={views}
            headingId={TRACKS_HEADING_ID}
          />

          <ExperienceTimeline
            locale={locale}
            t={t}
            views={views}
            stories={journeyByExperience}
            sectionId={TIMELINE_SECTION_ID}
            headingId={TIMELINE_HEADING_ID}
            filters={filters}
          />

          <EvidenceMap
            locale={locale}
            t={t}
            themes={themes}
            headingId={EVIDENCE_HEADING_ID}
          />
        </>
      )}

      <ExperienceClosingCta locale={locale} t={t} headingId={CTA_HEADING_ID} />
    </>
  );
}
