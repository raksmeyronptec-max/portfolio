import { Reveal } from "@/components/motion/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { formatNumeral } from "@/lib/content/experience-period";
import type { ExperienceView } from "@/lib/content/experience-view";
import type { LinkedJourneyStory } from "@/lib/data/journey";
import { cn } from "@/lib/utils/cn";
import { ExperienceEntryCard } from "./entry-card";
import {
  ExperienceFilters,
  type ExperienceFilterOption,
} from "./filters";
import { kindMark, trackMark } from "./marks";

/**
 * The dual-track timeline.
 *
 * ── One DOM tree, two layouts ──────────────────────────────────────────────
 * Education runs down the left, product engineering down the right, with a
 * hairline rail and the year markers between them. Below `lg` the same list
 * collapses to a single chronological stream — same elements, same order, one
 * grid definition. There is no second copy of the markup for mobile, so there
 * is nothing for a screen reader to announce twice and nothing to keep in sync.
 *
 * ── Reading order is the chronology ────────────────────────────────────────
 * Entries are emitted in date order and placed into a column with
 * `grid-column`, never reordered with `order`. Visual position and DOM position
 * therefore agree at every width, which is what stops the tab order and the
 * screen-reader order from diverging from what the page looks like.
 *
 * The order itself is derived: `compareByPeriod` sorts on years parsed from the
 * entries, not on `sort_order`, which was hand-maintained and had the page
 * reading 2023 → 2025 → 2024 → 2025 → 2024.
 *
 * ── Nothing here is scroll-revealed ────────────────────────────────────────
 * The entries had a staggered `Reveal` and it had to come out. `Reveal` hides an
 * element until its own IntersectionObserver fires, and the filter changes
 * layout without scrolling: an entry that had never been scrolled past was still
 * `pending`, and selecting "Practicum" lifted it into the viewport still at zero
 * opacity. The visible result was a blank gap where an entry should be —
 * reproduced at 1440px, and the reason this is plain markup now.
 *
 * The section heading above still reveals, because nothing can move it. The rail
 * is simply drawn: a line that redraws itself on every scroll is motion applied
 * to a static fact, and it has to be undone for reduced motion anyway.
 */

export function ExperienceTimeline({
  locale,
  t,
  views,
  stories,
  sectionId,
  headingId,
  filters,
}: {
  locale: Locale;
  t: Dictionary;
  views: ExperienceView[];
  /** Journey stories keyed by experience id. Frequently empty. */
  stories: Record<string, LinkedJourneyStory[] | undefined>;
  sectionId: string;
  headingId: string;
  /** Omitted when there is not enough to filter. */
  filters: ExperienceFilterOption[];
}) {
  const list = (
    <ol
      aria-label={t.experience.timeline.listLabel}
      className="relative flex flex-col"
    >
      <span aria-hidden="true" className="experience-rail" />

      {views.map((view) => (
        <li
          key={view.id}
          data-facets={view.facets.join(" ")}
          className={cn(
            "relative grid gap-x-6 pb-10 last:pb-0",
            "lg:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] lg:gap-x-8 lg:pb-14",
          )}
        >
          {/*
            The rail marker and its year.

            `aria-hidden` on purpose: the card immediately beside it already
            states the full, localised period. Announcing the year again would
            make every entry read "2024. 2024—2025. Teaching Practicum…".
          */}
          <div
            aria-hidden="true"
            className="flex items-center gap-3 pb-3 lg:col-start-2 lg:row-start-1 lg:flex-col lg:gap-2 lg:pt-7 lg:pb-0"
          >
            <span
              className="size-2.5 shrink-0 rounded-full ring-4 ring-background"
              style={{ background: kindMark(view.kind, view.track) }}
            />
            {view.period.startYear !== null ? (
              <p className="font-mono text-[0.8125rem] font-medium text-foreground-subtle">
                {formatNumeral(view.period.startYear, locale)}
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "ps-8 lg:ps-0",
              view.track === "education"
                ? "lg:col-start-1 lg:row-start-1"
                : "lg:col-start-3 lg:row-start-1",
            )}
          >
            <ExperienceEntryCard
              locale={locale}
              t={t}
              view={view}
              stories={stories[view.id]}
            />
          </div>
        </li>
      ))}
    </ol>
  );

  return (
    <section id={sectionId} aria-labelledby={headingId} className="scroll-mt-20">
      <div className="container-content section-y flex flex-col gap-8">
        <Reveal className="flex max-w-[52ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.experience.timeline.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.experience.timeline.heading}
          </h2>
          <p className="text-body-lg text-foreground-muted">
            {t.experience.timeline.description}
          </p>
        </Reveal>

        {/*
          Column headers, wide screens only and decorative: each card names its
          own track in text, so these repeat information rather than carry it.
        */}
        <div
          aria-hidden="true"
          className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] lg:gap-x-8"
        >
          <p
            className="experience-mark text-eyebrow font-semibold uppercase"
            style={{ "--mark-color": trackMark("education") } as object}
          >
            {t.experience.tracks.education.label}
          </p>
          <span />
          <p
            className="experience-mark text-eyebrow font-semibold uppercase"
            style={{ "--mark-color": trackMark("product") } as object}
          >
            {t.experience.tracks.product.label}
          </p>
        </div>

        {filters.length > 1 ? (
          <div className="flex flex-col gap-8">
            <ExperienceFilters t={t} options={filters}>
              {list}
            </ExperienceFilters>
          </div>
        ) : (
          list
        )}
      </div>
    </section>
  );
}
