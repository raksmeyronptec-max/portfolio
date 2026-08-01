import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Timeline } from "@/components/public/home-sections";
import { ExperiencePhotos } from "@/components/public/experience-photos";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getExperiences } from "@/lib/data/cv";
import { getJourneyStoriesByRelation } from "@/lib/data/journey";
import { JourneyStoryLinks } from "@/components/public/journey-story-links";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph } from "@/lib/seo/jsonld";

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
  /*
    One query for the whole page rather than one per role. Section 16 of the
    brief: Experience keeps its curated cover and up to three preview thumbnails,
    and the *full* collection lives on the journey story — so this adds a link,
    not a second gallery.
  */
  const [experiences, journeyByExperience] = await Promise.all([
    getExperiences(locale),
    getJourneyStoriesByRelation("experience", locale),
  ]);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.experience, url: absoluteUrl(localePath(locale, "experience")) },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.experience.title}
        description={t.experience.description}
        eyebrow={t.home.journey.eyebrow}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.experience },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="↗"
      />

      <div className="container-content flex flex-col gap-8 py-14 sm:py-16">
        {experiences.length === 0 ? (
          <EmptyState icon="briefcase" title={t.experience.emptyState} />
        ) : (
          /*
            Reuses the homepage's hairline timeline rather than restating each
            role as a bordered card, which the brief called a dashboard record.
            Achievements are appended to the description here because the shared
            timeline carries one prose slot per entry; the full text is still
            rendered, just without a second nested heading level.
          */
          <Timeline
            locale={locale}
            t={t}
            items={experiences.map((entry) => ({
              id: entry.id,
              anchorId: `experience-${entry.slug}`,
              kind: "experience" as const,
              title: entry.roleTitle,
              organization: entry.location
                ? `${entry.organization} · ${entry.location}`
                : entry.organization,
              organizationUrl: entry.organizationUrl,
              period: entry.periodLabel,
              description: entry.description ?? entry.summary,
              detail: entry.achievements,
              isCurrent: entry.isCurrent,
              contentLocale: entry.contentLocale,
              /*
                Omitted entirely when there is no cover, rather than passed as an
                empty component. An entry without photographs must render exactly
                as it did before this feature existed — no placeholder box, no
                "no photos" line, no reserved space.
              */
              media: entry.cover ? (
                <ExperiencePhotos
                  locale={locale}
                  t={t}
                  cover={entry.cover}
                  gallery={entry.gallery}
                  entryLabel={entry.roleTitle}
                />
              ) : undefined,
              tags: [
                t.experience.kind[entry.kind as keyof typeof t.experience.kind] ??
                  entry.kind,
                ...entry.tags.map((tag) => tag.label),
              ],
              footer: (
                <JourneyStoryLinks
                  locale={locale}
                  t={t}
                  stories={journeyByExperience[entry.id]}
                />
              ),
            }))}
          />
        )}
      </div>
    </>
  );
}
