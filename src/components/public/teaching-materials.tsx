import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeader } from "@/components/public/section-header";
import { formatNumber, plural, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ContentLanguage } from "@/lib/validation/publication";
import type { PublicationSummary } from "@/lib/content/publication";

/**
 * Teaching materials — the authored books, as a gallery.
 *
 * Replaces the previous `SelectedPublications` band, which rendered the same
 * publications through the full `PublicationCard`. The brief asked for these to
 * read as evidence of the educator identity rather than as one more card grid,
 * so the card here is cover-led and carries only what a stranger needs to
 * believe the claim: what it is, what it covers, how long it is, what language
 * it is in.
 *
 * Everything is CMS data. Nothing about a book is inferred — a missing page
 * count or an unknown language drops the fragment rather than guessing, the
 * same rule `buildCitation()` follows.
 *
 * Renders nothing when nothing is featured. An empty band under a heading that
 * promises books is worse than no band.
 */
export function TeachingMaterials({
  locale,
  t,
  publications,
}: {
  locale: Locale;
  t: Dictionary;
  publications: PublicationSummary[];
}) {
  if (publications.length === 0) return null;

  return (
    <section
      id="teaching"
      aria-labelledby="teaching-heading"
      className="section-y scroll-section"
    >
      {/*
        960px rather than `container-content`. A book cover is 3:4, so at the
        full content width three of them become 570px wide and 760px tall —
        the covers stop being a gallery and start being a slideshow.
      */}
      <div className="container-content">
        <div className="mx-auto max-w-[960px]">
        <SectionHeader
          id="teaching-heading"
          label={t.home.teaching.label}
          title={t.home.teaching.heading}
          description={t.home.teaching.description}
        />

        <ul className="book-grid">
          {publications.map((publication, index) => (
            <BookCard
              key={publication.id}
              publication={publication}
              locale={locale}
              t={t}
              /* 100ms apart, per the brief. Below 640 the grid is a horizontal
                 rail and every card is in view at once, but the observer only
                 fires for the ones that actually intersect, so off-screen
                 cards still animate when scrolled to. */
              delay={index * 100}
            />
          ))}
        </ul>

        <Reveal delay={publications.length * 100} className="mt-8">
          <Link
            href={localePath(locale, "publications")}
            className="link-underline inline-flex min-h-11 items-center gap-2 text-small font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            {t.home.publications.viewAll}
            <Icon name="arrowRight" size={16} aria-hidden />
          </Link>
        </Reveal>
        </div>
      </div>
    </section>
  );
}

function BookCard({
  publication,
  locale,
  t,
  delay,
}: {
  publication: PublicationSummary;
  locale: Locale;
  t: Dictionary;
  delay: number;
}) {
  /*
   * Page count and language, joined only when both are known. `pageCount` is
   * nullable in the schema and a book whose length has not been recorded must
   * not render "0 pages".
   */
  const meta = [
    publication.pageCount === null
      ? null
      : plural(
          publication.pageCount,
          t.publications.pageCount,
          t.publications.pageCountPlural,
          { count: formatNumber(publication.pageCount, locale) },
        ),
    languageLabel(publication.contentLanguage, t),
  ].filter((value): value is string => Boolean(value));

  return (
    <Reveal as="li" delay={delay} className="book-card">
      <div className="book-cover">
        {publication.cover ? (
          <Image
            src={publication.cover.src}
            alt={publication.cover.alt}
            fill
            /* Three across above 1024, two to 640, a 240px rail below it. */
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 240px"
            className="book-img"
            placeholder={publication.cover.blurDataURL ? "blur" : "empty"}
            blurDataURL={publication.cover.blurDataURL ?? undefined}
          />
        ) : (
          /* Decorative: the title beside it carries the meaning, and the box
             still holds its 3:4 ratio so the grid does not reflow. */
          <Icon name="fileText" size={36} aria-hidden />
        )}
      </div>

      <div className="book-info">
        <h3>
          <Link href={publication.href} className="book-card__link">
            {publication.title}
          </Link>
        </h3>

        {publication.originalTitle ? (
          /* The title as printed on the book, shown only when it differs from
             the display title, and carrying its own `lang` — a Khmer title on
             an English page must not be read with English phonetics. */
          <p lang={publication.originalTitleLang ?? undefined}>
            {publication.originalTitle}
          </p>
        ) : null}

        {publication.summary ? (
          <p
            /* `lang` on the prose, not the card: when the requested locale has
               no translation this paragraph is English on a Khmer page. The
               document-level version of this bug is the one docs/AUDIT.md
               records from v1. */
            lang={
              publication.isFallback
                ? (publication.contentLocale ?? undefined)
                : undefined
            }
          >
            {publication.summary}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <span className="book-meta">{meta.join(" · ")}</span>
        ) : null}
      </div>
    </Reveal>
  );
}

function languageLabel(
  language: ContentLanguage,
  t: Dictionary,
): string | null {
  switch (language) {
    case "km":
      return t.publications.languageKm;
    case "en":
      return t.publications.languageEn;
    case "bilingual":
      return t.publications.languageBilingual;
    /* "other" is a real answer in the CMS but not a useful one to a reader —
       it says the language was recorded without saying which. Dropped rather
       than printed as "Other". */
    default:
      return null;
  }
}
