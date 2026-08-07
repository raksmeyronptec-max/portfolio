import { Reveal } from "@/components/motion/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { langAttribute } from "@/lib/content/translation";
import type { ExperienceView } from "@/lib/content/experience-view";
import type { LinkedJourneyStory } from "@/lib/data/journey";
import {
  ExperienceFilters,
  type ExperienceFilterOption,
} from "./filters";

/** A single chronological rail with server-rendered, filterable entries. */
export function ExperienceTimeline({
  locale,
  t,
  views,
  stories: _stories,
  sectionId,
  headingId,
  filters,
}: {
  locale: Locale;
  t: Dictionary;
  views: ExperienceView[];
  stories: Record<string, LinkedJourneyStory[] | undefined>;
  sectionId: string;
  headingId: string;
  filters: ExperienceFilterOption[];
}) {
  const list = (
    <ol aria-label={t.experience.timeline.listLabel} className="timeline">
      {views.map((view, index) => {
        const organisation = [view.organization, view.location]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(" · ");
        const currentLabel =
          view.kind.toLowerCase() === "practicum"
            ? t.experience.status.currentPracticum
            : t.experience.status.currentRole;

        return (
          <Reveal
            as="li"
            key={view.id}
            id={view.anchorId}
            delay={Math.min(index, 6) * 100}
            data-facets={view.facets.join(" ")}
            className="timeline-item"
          >
            <div className="timeline-left">
              <span className="timeline-date">
                {view.periodLabel ?? t.experience.timeline.undated}
              </span>
              {organisation ? <span className="timeline-org">{organisation}</span> : null}
            </div>

            <div className="timeline-line" aria-hidden="true">
              <span className="timeline-dot" data-active={view.isCurrent ? "true" : "false"} />
              {index !== views.length - 1 ? <span className="timeline-connector" /> : null}
            </div>

            <article className="timeline-right" lang={langAttribute(locale, view.contentLocale)}>
              <div className="flex flex-wrap items-center gap-2">
                <h3>{view.roleTitle}</h3>
                {view.isCurrent ? <span className="sr-only">({currentLabel})</span> : null}
              </div>
              {view.summary ?? view.description ? <p>{view.summary ?? view.description}</p> : null}
              {view.primaryTags.length > 0 ? (
                <ul className="timeline-tags" aria-label={t.experience.card.skills}>
                  {view.primaryTags.map((tag) => (
                    <li key={tag.key}>
                      <span className="timeline-tag">{tag.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.contributions.length > 0 ? (
                <ul className="timeline-contributions">
                  {view.contributions.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          </Reveal>
        );
      })}
    </ol>
  );

  return (
    <section id={sectionId} aria-labelledby={headingId} className="scroll-mt-20">
      <div className="container-content section-y flex flex-col gap-8">
        <Reveal className="mx-auto flex max-w-[52ch] flex-col gap-3 text-center">
          <p className="text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            {t.experience.timeline.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">{t.experience.timeline.heading}</h2>
          <p className="text-body-lg text-foreground-muted">{t.experience.timeline.description}</p>
        </Reveal>

        {filters.length > 1 ? (
          <ExperienceFilters t={t} options={filters}>{list}</ExperienceFilters>
        ) : (
          list
        )}
      </div>
    </section>
  );
}
