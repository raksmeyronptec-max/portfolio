import Image from "next/image";

import { Badge, Card, SmartLink, Tag } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { getDictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { PublicationSummary } from "@/lib/content/publication";

/**
 * One publication in a listing.
 *
 * ── Why the whole card is not a link ───────────────────────────────────────
 * It looks like one and behaves like one, but the anchor is only around the
 * title, stretched over the card with `::after`. Wrapping everything would put
 * the cover's alt text, the type, the year, the audience, the page count and
 * every topic tag inside the accessible name of a single link — which a screen
 * reader then reads as one sentence forty words long, for every card in the
 * list. The stretched-link pattern gives the same click target with a link name
 * that is just the title.
 *
 * ── Khmer typography ───────────────────────────────────────────────────────
 * The title carries `lang` when the book's own title is in a different language
 * from the page, and `leading-khmer` whenever Khmer script is rendered. Khmer
 * has tall stacked diacritics that a Latin line-height clips; `letter-spacing`
 * is never negative on this component for the same reason.
 */
export function PublicationCard({
  publication,
  locale,
  /** `h2` in a listing, `h3` inside a section that already has one. */
  headingLevel = "h2",
}: {
  publication: PublicationSummary;
  locale: Locale;
  headingLevel?: "h2" | "h3";
}) {
  const t = getDictionary(locale);
  const Heading = headingLevel;

  /*
   * The book's own title is shown under the display title only when the two
   * genuinely differ — on a Khmer page they are usually the same string, and
   * printing it twice under an "Original title" label is noise.
   */
  const showsOriginal = Boolean(publication.originalTitle);

  const meta = [
    publication.type?.name,
    publication.editionLabel ?? (publication.year ? String(publication.year) : null),
    publication.gradeLevel,
  ].filter((value): value is string => Boolean(value));

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden">
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-muted">
        {publication.cover ? (
          <Image
            src={publication.cover.src}
            alt={publication.cover.alt}
            fill
            /*
             * The listing is a responsive grid: one column below 640, two to
             * 1024, three above. Telling the optimiser that means a phone
             * downloads a phone-sized cover rather than a desktop-sized one.
             */
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.03]"
            placeholder={publication.cover.blurDataURL ? "blur" : "empty"}
            blurDataURL={publication.cover.blurDataURL ?? undefined}
          />
        ) : (
          /*
           * A book with no cover yet still needs a fixed-ratio box, or the grid
           * reflows when one card has an image and another does not. The glyph
           * is decorative — the title beside it carries the meaning.
           */
          <div className="flex h-full w-full items-center justify-center text-foreground-subtle">
            <Icon name="fileText" size={40} aria-hidden />
          </div>
        )}

        {publication.typesetWithLatex ? (
          <span className="absolute right-2 top-2 rounded-(--radius-full) bg-surface/90 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.04em] text-foreground-muted backdrop-blur">
            {t.publications.latexBadge}
          </span>
        ) : null}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {publication.type ? (
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">
            {publication.type.name}
          </p>
        ) : null}

        <Heading className="text-body font-semibold leading-khmer text-foreground">
          <SmartLink
            href={publication.href}
            /*
             * The stretched link. `before:` rather than `after:` so the LaTeX
             * badge and any future overlay stay clickable if they ever need to
             * be; z-ordering is easier to reason about with the overlay behind.
             */
            className="before:absolute before:inset-0 before:content-[''] hover:underline focus-visible:outline-none"
          >
            {publication.title}
          </SmartLink>
        </Heading>

        {showsOriginal ? (
          <p
            className="text-small leading-khmer text-foreground-muted"
            lang={publication.originalTitleLang ?? undefined}
          >
            {publication.originalTitle}
          </p>
        ) : null}

        {publication.summary ? (
          <p
            className="line-clamp-3 text-small leading-khmer text-foreground-muted"
            /*
             * `lang` on the prose, not the card. When the requested locale has
             * no translation the summary is English on a Khmer page, and saying
             * so is what stops a screen reader pronouncing English with Khmer
             * phonetics — the document-level version of this bug is the one
             * docs/AUDIT.md records from v1.
             */
            lang={publication.isFallback ? (publication.contentLocale ?? undefined) : undefined}
          >
            {publication.summary}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <p className="mt-auto pt-2 text-[0.75rem] leading-khmer text-foreground-subtle">
            {meta.join(" · ")}
            {publication.pageCount ? (
              <>
                {" · "}
                {t.publications.pageCountPlural.replace(
                  "{count}",
                  String(publication.pageCount),
                )}
              </>
            ) : null}
          </p>
        ) : null}

        {publication.topics.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {publication.topics.slice(0, 3).map((topic) => (
              <li key={topic.id}>
                <Tag>{topic.name}</Tag>
              </li>
            ))}
          </ul>
        ) : null}

        {/*
         * Download availability is stated, never actioned, from a card.
         *
         * The button would need the file size and the edition to be honest about
         * what it hands over, and a listing does not load either. A badge says
         * the book is downloadable and the detail page does it properly.
         */}
        {publication.access.canDownloadPdf ? (
          <p className="pt-1">
            <Badge tone="success" icon="download">
              {t.publications.download}
            </Badge>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
