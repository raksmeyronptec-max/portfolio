import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NeighbourNav } from "@/components/ui/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { PageHeader } from "@/components/layout/page-header";
import { JourneyGallery } from "@/components/public/journey-gallery";
import { JourneyVideo } from "@/components/public/journey-video";
import { OutboundLink } from "@/components/public/outbound-link";
import { TrackedInternalLink } from "@/components/public/tracked-link";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import {
  getJourneyEntry,
  getJourneyNeighbours,
  getPublishedJourneySlugs,
} from "@/lib/data/journey";
import { isoDuration } from "@/lib/validation/journey";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, prune } from "@/lib/seo/jsonld";
import type { JourneyRelationTarget } from "@/lib/content/journey";
import { cn } from "@/lib/utils/cn";

export const revalidate = 300;

/**
 * One journey story.
 *
 * ── Editorial, not an admin record ─────────────────────────────────────────
 * The brief's instruction — "do not make the page look like an Admin record" —
 * is what drives the layout. There is no field/value table of the story's
 * metadata; the period, place and organisation are set as a single line of
 * eyebrow text under the title, the way a magazine would, and the prose runs at a
 * measured 68 characters with generous leading. The gallery comes after the story
 * rather than before it, because the writing is the piece and the photographs
 * corroborate it.
 */

export async function generateStaticParams() {
  /*
   * Prerender the published stories at build time.
   *
   * Slugs come from an RLS-constrained query, so a draft cannot be prerendered
   * even by accident. Locales are not enumerated here — Next generates the
   * `[locale]` combinations from the route's own segment config, and listing them
   * would duplicate `locales` in a second place that could drift.
   */
  const stories = await getPublishedJourneySlugs();
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const entry = await getJourneyEntry(slug, locale);
  if (!entry) return {};

  return buildPageMetadata({
    locale,
    path: `journey/${slug}`,
    title: entry.seoTitle ?? entry.title,
    description:
      entry.seoDescription ?? truncateDescription(entry.summary ?? entry.story, locale),
    // The cover is already a public, optimised derivative; `ogImageUrl` takes it
    // directly rather than re-resolving the asset.
    ogImageUrl: entry.cover?.fullSrc ?? null,
    type: "article",
    publishedTime: entry.publishedAt,
    modifiedTime: entry.updatedAt,
  });
}

export default async function JourneyStoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const entry = await getJourneyEntry(slug, locale);
  if (!entry) notFound();

  const { previous, next } = await getJourneyNeighbours(slug, locale);

  const canonical = absoluteUrl(localePath(locale, `journey/${slug}`));

  /*
   * The lead media.
   *
   * A cover video leads with the poster-first facade rather than a still, because
   * a story whose primary artefact is a video should open on it. Everything else
   * leads with the cover photograph, and the rest goes in the gallery below.
   */
  const lead = entry.cover;
  const galleryItems = entry.gallery;

  const videos = [lead, ...galleryItems].filter(
    (item): item is NonNullable<typeof item> => Boolean(item?.video),
  );

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.journey, url: absoluteUrl(localePath(locale, "journey")) },
      { name: entry.title, url: canonical },
    ]),

    prune({
      "@type": "Article",
      headline: entry.title,
      description: entry.summary ?? undefined,
      url: canonical,
      inLanguage: locale,
      image: entry.cover?.fullSrc,
      datePublished: entry.publishedAt ?? undefined,
      dateModified: entry.updatedAt,
      author: { "@id": `${absoluteUrl("/")}#person` },
      /*
       * `about` carries the category and nothing else.
       *
       * Deliberately no `organizer`, `participant`, `award` or `location` —
       * those are precisely the fields the seeded records mark as unconfirmed,
       * and asserting an unverified organiser in structured data is fabrication
       * that a search engine will then repeat.
       */
      about: entry.category ? { "@type": "Thing", name: entry.category.name } : undefined,
    }),

    /*
     * VideoObject per video.
     *
     * `contentUrl` is the platform URL rather than a file we host, and
     * `thumbnailUrl` is our own poster derivative. `uploadDate` is omitted
     * entirely unless the story carries a real date — Google warns about it as a
     * recommended field, but inventing one to silence a warning would put a false
     * date in the index.
     */
    ...videos.map((item) =>
      prune({
        "@type": "VideoObject",
        name: item.video?.title || item.alt || entry.title,
        description: item.caption ?? entry.summary ?? undefined,
        thumbnailUrl: item.fullSrc,
        contentUrl: item.video?.url,
        embedUrl: item.video?.embedUrl ?? undefined,
        duration: isoDuration(item.video?.durationSeconds) ?? undefined,
        uploadDate: entry.eventDate ?? entry.publishedAt ?? undefined,
        inLanguage: locale,
      }),
    ),
  ]);

  const contentLang =
    entry.isFallback && entry.contentLocale && entry.contentLocale !== locale
      ? entry.contentLocale
      : undefined;

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker
        locale={locale}
        eventName="journey_view"
        entityType="journey"
        entityId={entry.id}
        entitySlug={entry.slug}
      />

      <PageHeader
        title={entry.title}
        description={entry.summary}
        eyebrow={entry.category?.name ?? t.journey.eyebrow}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.journey, href: localePath(locale, "journey") },
          { label: entry.title },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
      >
        {/*
          Period, place and organisation as one editorial line rather than a
          field/value table. This is the difference between a story and a record.
        */}
        {entry.periodLabel || entry.organisation || entry.location ? (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-foreground-muted">
            {[entry.periodLabel, entry.organisation, entry.location]
              .filter(Boolean)
              .map((value, index) => (
                <span key={value} className="inline-flex items-center gap-2.5">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  {value}
                </span>
              ))}
          </p>
        ) : null}
      </PageHeader>

      <article className="container-content flex flex-col gap-10 py-12 sm:py-14">
        {/* ── Lead media ─────────────────────────────────────────────────── */}
        {lead ? (
          lead.video ? (
            <JourneyVideo
              locale={locale}
              t={t}
              item={lead}
              entrySlug={entry.slug}
              // The one justified priority image on the page: it is the LCP
              // element. Nothing else on this route sets it.
              priority
            />
          ) : (
            <figure className="m-0 flex flex-col gap-2">
              {/*
                A fixed-ratio box with `fill` inside it, so there is no layout
                shift regardless of the source aspect ratio, and `priority`
                because this is the LCP element — the only one on the route that
                sets it.
              */}
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-(--radius-lg)",
                  "aspect-[16/9] border border-border bg-surface-muted",
                )}
              >
                <Image
                  src={lead.fullSrc}
                  alt={lead.alt}
                  fill
                  sizes="(min-width: 1024px) 900px, 100vw"
                  priority
                  placeholder={lead.blurDataURL ? "blur" : undefined}
                  blurDataURL={lead.blurDataURL ?? undefined}
                  style={
                    lead.objectPosition
                      ? { objectPosition: lead.objectPosition }
                      : undefined
                  }
                  className="object-cover"
                />
              </div>

              {lead.caption ? (
                <figcaption className="max-w-[62ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
                  {lead.caption}
                </figcaption>
              ) : null}
            </figure>
          )
        ) : null}

        {/* ── Story ──────────────────────────────────────────────────────── */}
        {entry.story ? (
          <div className="max-w-[68ch]" lang={contentLang}>
            {/*
              `whitespace-pre-line` on paragraph-split text rather than a markdown
              renderer. `react/no-danger` is an error in this codebase, and the
              story field is plain prose typed into a textarea — running it
              through a parser would add a dependency and an injection surface to
              solve a problem that does not exist.

              `leading-relaxed` for the same reason the captions use it: Khmer's
              stacked subscript consonants collide at English line heights.
            */}
            {entry.story.split(/\n{2,}/).map((paragraph, index) => (
              <p
                key={index}
                className="mb-4 whitespace-pre-line text-body leading-relaxed last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        {/* ── Highlights ─────────────────────────────────────────────────── */}
        {entry.highlights.length > 0 ? (
          <section className="max-w-[68ch]">
            <h2 className="mb-3 text-[1.125rem] font-semibold">
              {t.journey.highlights}
            </h2>
            <ul className="flex list-none flex-col gap-2 p-0">
              {entry.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2.5 text-small leading-relaxed">
                  <Icon
                    name="check"
                    size={16}
                    className="mt-1 shrink-0 text-success-foreground"
                  />
                  <span lang={contentLang}>{highlight}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Gallery ────────────────────────────────────────────────────── */}
        {galleryItems.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-[1.125rem] font-semibold">{t.journey.gallery.view}</h2>
            <JourneyGallery
              locale={locale}
              t={t}
              items={galleryItems}
              entryLabel={entry.title}
              entrySlug={entry.slug}
            />
          </section>
        ) : null}

        {/* ── External link ──────────────────────────────────────────────── */}
        {entry.externalUrl ? (
          <p>
            <OutboundLink
              href={entry.externalUrl}
              event={{
                name: "outbound_link_click",
                locale,
                entityType: "journey",
                entitySlug: entry.slug,
              }}
              showIcon
              newTabHint={t.a11y.opensInNewTab}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
                "underline decoration-border-strong underline-offset-4 transition-colors",
                "hover:decoration-current",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
              )}
            >
              {t.journey.externalLink}
            </OutboundLink>
          </p>
        ) : null}

        {/* ── Relations ──────────────────────────────────────────────────── */}
        {entry.relations.length > 0 ? (
          <RelatedRecords
            locale={locale}
            t={t}
            relations={entry.relations}
            entrySlug={entry.slug}
          />
        ) : null}

        {/* ── Previous / next ────────────────────────────────────────────── */}
        <NeighbourNav
          label={t.journey.storyNavigation}
          previous={
            previous
              ? {
                  href: localePath(locale, `journey/${previous.slug}`),
                  label: t.journey.previousStory,
                  title: previous.title,
                }
              : null
          }
          next={
            next
              ? {
                  href: localePath(locale, `journey/${next.slug}`),
                  label: t.journey.nextStory,
                  title: next.title,
                }
              : null
          }
        />

        <p>
          <Link
            href={localePath(locale, "journey")}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
              "text-foreground-muted underline decoration-transparent underline-offset-4",
              "transition-colors hover:text-foreground hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Icon name="arrowLeft" size={15} />
            {t.journey.backToJourney}
          </Link>
        </p>
      </article>
    </>
  );
}

// ── Related records ─────────────────────────────────────────────────────────

const RELATION_ICONS: Record<JourneyRelationTarget["type"], IconName> = {
  experience: "briefcase",
  education: "graduation",
  certificate: "award",
  project: "layers",
};

const RELATION_EVENTS: Record<
  JourneyRelationTarget["type"],
  | "journey_related_experience_click"
  | "journey_related_education_click"
  | "journey_related_certificate_click"
  | "journey_related_project_click"
> = {
  experience: "journey_related_experience_click",
  education: "journey_related_education_click",
  certificate: "journey_related_certificate_click",
  project: "journey_related_project_click",
};

/**
 * "What this connects to".
 *
 * The whole point of the relation model made visible: a story about an award
 * ceremony links to the credential it evidences, and a fieldwork story links to
 * the placement it happened during. Rendered as links rather than cards, because
 * the destination is where the detail is.
 */
function RelatedRecords({
  locale,
  t,
  relations,
  entrySlug,
}: {
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  relations: JourneyRelationTarget[];
  entrySlug: string;
}) {
  const labels: Record<JourneyRelationTarget["type"], string> = {
    experience: t.journey.relatedExperience,
    education: t.journey.relatedEducation,
    certificate: t.journey.relatedCertificate,
    project: t.journey.relatedProject,
  };

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-lg) border border-border bg-surface-muted p-5">
      <h2 className="text-[1.0625rem] font-semibold">{t.journey.relatedHeading}</h2>

      <ul className="flex list-none flex-col gap-2 p-0">
        {relations.map((relation) => (
          <li key={`${relation.type}-${relation.id}`}>
            <JourneyRelationLink
              locale={locale}
              relation={relation}
              typeLabel={labels[relation.type]}
              entrySlug={entrySlug}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function JourneyRelationLink({
  locale,
  relation,
  typeLabel,
  entrySlug,
}: {
  locale: Locale;
  relation: JourneyRelationTarget;
  typeLabel: string;
  entrySlug: string;
}) {
  const content = (
    <>
      <Icon
        name={RELATION_ICONS[relation.type]}
        size={16}
        className="shrink-0 text-foreground-subtle"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.75rem] uppercase tracking-[0.06em] text-foreground-subtle">
          {typeLabel}
        </span>
        <span className="truncate text-small font-medium">{relation.label}</span>
      </span>
      <Icon name="arrowRight" size={15} className="ml-auto shrink-0" />
    </>
  );

  const className = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-(--radius-md) px-2 py-1.5",
    "transition-colors hover:bg-surface",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
  );

  if (!relation.href) {
    return <span className={className}>{content}</span>;
  }

  /*
   * An internal `Link`, but the click is still recorded. `TrackedInternalLink`
   * exists because `OutboundLink` always renders an `<a target="_blank">`, and
   * sending a visitor to another page of the same site in a new tab is wrong.
   */
  return (
    <TrackedInternalLink
      href={relation.href}
      locale={locale}
      entrySlug={entrySlug}
      eventName={RELATION_EVENTS[relation.type]}
      className={className}
    >
      {content}
    </TrackedInternalLink>
  );
}

// ── Neighbour navigation ────────────────────────────────────────────────────

