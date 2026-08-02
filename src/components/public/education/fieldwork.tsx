import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import { plural } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { formatNumeral } from "@/lib/content/experience-period";
import { langAttribute } from "@/lib/content/translation";
import type { JourneyEntrySummary } from "@/lib/content/journey";
import { FIELDWORK_MARK } from "./marks";

/**
 * Teacher-education fieldwork, presented as academic evidence.
 *
 * ── The journey story is the source, and the destination ───────────────────
 * Fieldwork lives in the CMS as a journey story related to the PTEC programme
 * — its photographs, captions and privacy review all happen there. So this
 * section renders the story's own cover, title, date and summary, and its one
 * action leads to the story page, where the existing reviewed gallery (with
 * its keyboard navigation, focus trap and Escape handling) already lives.
 * Building a second gallery here would duplicate that machinery and create a
 * second place for a privacy mistake.
 *
 * Renders nothing when no fieldwork story is linked. A programme without
 * fieldwork photographs is a programme without fieldwork photographs — not a
 * gap to fill with a placeholder.
 */
export function FieldworkFeature({
  locale,
  t,
  story,
  /** The programme the story is related to, for the "Part of" line. */
  programmeName,
  headingId,
}: {
  locale: Locale;
  t: Dictionary;
  story: JourneyEntrySummary | null;
  programmeName: string | null;
  headingId: string;
}) {
  if (!story) return null;

  const contentLang = langAttribute(locale, story.contentLocale);
  const href = localePath(locale, `journey/${story.slug}`);

  const photoLabel =
    story.photoCount > 0
      ? plural(story.photoCount, t.journey.photoCount, t.journey.photoCountPlural, {
          count: formatNumeral(story.photoCount, locale),
        })
      : null;

  return (
    <section aria-labelledby={headingId}>
      <div className="container-content section-y flex flex-col gap-8">
        <Reveal className="flex max-w-[52ch] flex-col gap-3">
          <p
            className="experience-mark flex items-center gap-2.5 text-eyebrow font-semibold uppercase"
            style={{ "--mark-color": FIELDWORK_MARK } as object}
          >
            <span
              aria-hidden="true"
              className="h-px w-8"
              style={{ background: FIELDWORK_MARK }}
            />
            {t.education.fieldwork.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.education.fieldwork.heading}
          </h2>
        </Reveal>

        <Reveal delay={90}>
          <article className="relative grid overflow-hidden rounded-(--radius-xl) border border-border bg-surface shadow-(--shadow-xs) lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 z-10 h-px"
              style={{
                background: `linear-gradient(to right, ${FIELDWORK_MARK}, transparent 72%)`,
              }}
            />

            {/*
              The story's reviewed cover. Only rendered when one exists —
              `JourneyMediaItem` already passed the privacy gates, and its alt
              text is the reviewed one, not a filename.
            */}
            {story.cover ? (
              <div className="relative aspect-[16/10] bg-surface-muted lg:aspect-auto lg:min-h-full">
                <Image
                  src={story.cover.src}
                  alt={story.cover.alt}
                  fill
                  sizes="(min-width: 1024px) 620px, 100vw"
                  loading="lazy"
                  placeholder={story.cover.blurDataURL ? "blur" : undefined}
                  blurDataURL={story.cover.blurDataURL ?? undefined}
                  style={
                    story.cover.objectPosition
                      ? { objectPosition: story.cover.objectPosition }
                      : undefined
                  }
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-3 p-5 sm:p-7">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.8125rem] text-foreground-subtle">
                {story.periodLabel ?? story.year}
                {story.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="mapPin" size={13} aria-hidden="true" />
                    {story.location}
                  </span>
                ) : null}
              </p>

              <h3 className="text-h3 font-semibold text-balance" lang={contentLang}>
                {story.title}
              </h3>

              {story.summary ? (
                <p
                  className="max-w-[58ch] text-body text-foreground-muted"
                  lang={contentLang}
                >
                  {story.summary}
                </p>
              ) : null}

              {programmeName ? (
                <p className="text-small text-foreground-subtle">
                  {t.education.fieldwork.partOf}{" "}
                  <span className="font-medium text-foreground-muted">
                    {programmeName}
                  </span>
                </p>
              ) : null}

              <p className="mt-auto pt-2">
                <Link
                  href={href}
                  className="group inline-flex min-h-11 items-center gap-2 text-body font-semibold text-primary"
                >
                  {t.education.fieldwork.viewStory}
                  {photoLabel ? (
                    <span className="text-small font-normal text-foreground-subtle">
                      · {photoLabel}
                    </span>
                  ) : null}
                  <Icon name="arrowRight" size={17} className="travel" />
                </Link>
              </p>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
