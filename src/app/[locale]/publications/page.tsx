import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { PublicationFilters } from "@/components/public/publication-filters";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getPublications } from "@/lib/data/publications";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, itemListSchema } from "@/lib/seo/jsonld";

/**
 * The publications listing.
 *
 * A Server Component that fetches and resolves everything, then hands an
 * already-shaped array to one Client Component for the filtering. Every
 * publication is server-rendered, so the page is crawlable and readable with
 * JavaScript disabled; only the filter controls need the client.
 *
 * `revalidate = 300` matches the other content listings. Publishing calls
 * `revalidatePublications()`, so the window is a backstop for changes made
 * outside the app rather than the normal path.
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
  const override = await getSeoOverride("publications", locale);

  return buildPageMetadata({
    locale,
    path: "publications",
    title: override?.title ?? t.publications.title,
    description: override?.description ?? t.publications.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function PublicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const { publications, types, subjects, years } = await getPublications(locale);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.publications, url: absoluteUrl(localePath(locale, "publications")) },
    ]),
    /*
     * An ItemList of the books, which is what lets a search engine understand
     * this as a collection rather than one long page.
     *
     * Names and URLs only. No ISBN, no publisher, no rating, no review count —
     * the brief rules those out and they would be fabrications here anyway.
     * `Book` markup with an invented `isbn` is a false claim about a real
     * registry, and structured data that states an unverified fact is worse than
     * none at all.
     */
    ...(publications.length > 0
      ? [
          itemListSchema({
            name: t.publications.title,
            items: publications.map((publication) => ({
              name: publication.title,
              url: absoluteUrl(publication.href),
            })),
          }),
        ]
      : []),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        eyebrow={t.publications.eyebrow}
        title={t.publications.title}
        description={t.publications.description}
        watermark="∑"
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.publications },
        ]}
        breadcrumbLabel={t.publications.title}
      />

      <section className="section-y">
        <div className="container-content">
          {publications.length === 0 ? (
            <EmptyState
              icon="book"
              title={t.publications.emptyHeading}
              description={t.publications.emptyBody}
            />
          ) : (
            <PublicationFilters
              publications={publications}
              locale={locale}
              types={types}
              subjects={subjects}
              years={years}
            />
          )}
        </div>
      </section>
    </>
  );
}
