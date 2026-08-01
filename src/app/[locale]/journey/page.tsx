import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { JourneyTimeline } from "@/components/public/journey-timeline";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getJourneyCategories, getJourneyEntries } from "@/lib/data/journey";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, itemListSchema } from "@/lib/seo/jsonld";

/**
 * The journey timeline.
 *
 * A Server Component that fetches and resolves everything, then hands an already
 * shaped array to one Client Component for the filtering. The stories themselves
 * are server-rendered, so the page is crawlable and readable with JavaScript
 * disabled; only the filter controls need the client.
 *
 * `revalidate = 300` matches the other content listings. Publishing a story calls
 * `revalidateJourney()`, so the window is a backstop for changes made outside the
 * app rather than the normal path.
 */
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
  const override = await getSeoOverride("journey", locale);

  return buildPageMetadata({
    locale,
    path: "journey",
    title: override?.title ?? t.journey.title,
    description: override?.description ?? t.journey.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const [entries, categories] = await Promise.all([
    getJourneyEntries(locale),
    getJourneyCategories(locale),
  ]);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.journey, url: absoluteUrl(localePath(locale, "journey")) },
    ]),
    /*
     * An ItemList of the stories, which is what lets a search engine understand
     * this as a collection rather than one long page. Names and URLs only — no
     * organiser, no participant, no date is asserted here, because most of those
     * are exactly the fields the seeded records mark as unconfirmed, and
     * structured data that states an unverified fact is worse than none.
     */
    ...(entries.length > 0
      ? [
          itemListSchema({
            name: t.journey.title,
            items: entries.map((entry) => ({
              name: entry.title,
              url: absoluteUrl(localePath(locale, `journey/${entry.slug}`)),
            })),
          }),
        ]
      : []),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.journey.title}
        description={t.journey.description}
        eyebrow={t.journey.eyebrow}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.journey },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="◷"
      />

      <div className="container-content flex flex-col gap-8 py-14 sm:py-16">
        {entries.length === 0 ? (
          /*
            The empty state says why rather than just "nothing here". Photographs
            of classrooms wait on a privacy review, and a visitor who arrives
            early should understand that this is a deliberate gate rather than an
            abandoned page.
          */
          <EmptyState
            icon="mapPin"
            title={t.journey.emptyHeading}
            description={t.journey.emptyBody}
          />
        ) : (
          <JourneyTimeline
            locale={locale}
            t={t}
            entries={entries}
            categories={categories}
          />
        )}
      </div>
    </>
  );
}
