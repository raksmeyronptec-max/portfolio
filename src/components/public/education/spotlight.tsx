import { Icon, type IconName } from "@/components/ui/icon";
import { SmartLink, StatusDot, Tag } from "@/components/ui/primitives";
import { JourneyStoryLinks } from "@/components/public/journey-story-links";
import { Reveal } from "@/components/motion/reveal";
import { langAttribute } from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { LinkedJourneyStory } from "@/lib/data/journey";
import type { ProgrammeView } from "@/lib/content/education-view";
import { cn } from "@/lib/utils/cn";
import { educationTrackMark, CONNECTION_MARK } from "./marks";

/**
 * The dual-degree spotlight: the two active programmes at full editorial
 * weight, and the sentence that joins them.
 *
 * ── This IS the featured presentation ──────────────────────────────────────
 * The brief sketches a spotlight *and* two separate featured-programme
 * sections. Rendering both would print each degree's story twice on one page,
 * and the second copy always drifts — so the spotlight panels carry the whole
 * treatment: identity, dates, schedule, summary, focus, evidence links, and a
 * `<details>` panel holding everything below the fold of a scan.
 *
 * ── What the panels never do ───────────────────────────────────────────────
 * No completion percentages: the CMS stores no semester or credit data, and a
 * bar computed from calendar time would present elapsed time as academic
 * progress. The status is the honest pair the data supports — "In progress"
 * plus "Expected completion: {year}" — and the expected year is never drawn
 * as an achieved one.
 */

const TRACK_ICONS: Record<ProgrammeView["track"], IconName> = {
  teacher: "teacher",
  mathematics: "barChart",
};

/** Default-view chips. The rest of the focus list lives in the details. */
const FOCUS_LIMIT = 3;

export function DualDegreeSpotlight({
  locale,
  t,
  programmes,
  stories,
  sectionId,
  headingId,
}: {
  locale: Locale;
  t: Dictionary;
  programmes: ProgrammeView[];
  /** Journey stories keyed by education id. Frequently empty. */
  stories: Record<string, LinkedJourneyStory[] | undefined>;
  sectionId: string;
  headingId: string;
}) {
  if (programmes.length === 0) return null;

  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      className="scroll-mt-20 bg-surface-muted"
    >
      <div className="container-content section-y flex flex-col gap-10">
        <Reveal className="flex max-w-[48ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.education.spotlight.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.education.spotlight.heading}
          </h2>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {programmes.map((programme, index) => (
            <Reveal key={programme.id} delay={index * 90}>
              <ProgrammePanel
                locale={locale}
                t={t}
                programme={programme}
                stories={stories[programme.id]}
              />
            </Reveal>
          ))}
        </div>

        {/* ── The sentence that joins them ──────────────────────────────── */}
        <Reveal delay={180}>
          <blockquote className="relative mx-auto max-w-[54ch] rounded-(--radius-xl) border border-border bg-surface px-6 py-8 text-center sm:px-10">
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-px w-12"
              style={{ background: CONNECTION_MARK }}
            />
            <p className="text-h4 font-medium leading-relaxed text-balance text-foreground">
              {t.education.spotlight.connection}
            </p>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

function ProgrammePanel({
  locale,
  t,
  programme,
  stories,
}: {
  locale: Locale;
  t: Dictionary;
  programme: ProgrammeView;
  stories: LinkedJourneyStory[] | undefined;
}) {
  const mark = educationTrackMark(programme.track);
  const contentLang = langAttribute(locale, programme.contentLocale);
  const trackLabel =
    programme.track === "mathematics"
      ? t.education.spotlight.mathematicsLabel
      : t.education.spotlight.teacherLabel;

  const primaryFocus = programme.focus.slice(0, FOCUS_LIMIT);
  const remainingFocus = programme.focus.slice(FOCUS_LIMIT);

  const hasDetails =
    Boolean(programme.description) ||
    Boolean(programme.achievements) ||
    remainingFocus.length > 0 ||
    Boolean(programme.institutionUrl) ||
    (stories?.length ?? 0) > 0;

  return (
    <article
      id={programme.anchorId}
      className={cn(
        "relative flex h-full scroll-mt-24 flex-col gap-4 overflow-hidden",
        "rounded-(--radius-xl) border border-border bg-surface p-5 shadow-(--shadow-xs) sm:p-7",
        "transition-[border-color] hover:border-border-strong",
      )}
    >
      {/* Track mark: a one-pixel top edge, never a coloured card. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, ${mark}, transparent 72%)`,
        }}
      />

      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            aria-hidden="true"
            className="experience-chip inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border"
            style={{ "--mark-color": mark } as object}
          >
            <Icon name={TRACK_ICONS[programme.track]} size={20} />
          </span>

          <div className="flex flex-col gap-0.5">
            <span
              className="experience-mark text-eyebrow font-semibold uppercase"
              style={{ "--mark-color": mark } as object}
            >
              {trackLabel}
            </span>

            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {programme.periodLabel ? (
                <span className="font-mono text-[0.8125rem] text-foreground-subtle">
                  {programme.periodLabel}
                </span>
              ) : null}

              {/*
                The status pair. The words carry it — the dot only repeats
                them, and green appears nowhere else on the page.
              */}
              <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-success-subtle px-2.5 py-0.5 text-[0.75rem] font-semibold text-success-foreground">
                <StatusDot tone="success" className="size-1.5" />
                {t.education.status.inProgress}
              </span>
            </span>
          </div>
        </div>

        <h3 className="text-h3 font-semibold text-balance" lang={contentLang}>
          {programme.institution}
        </h3>

        {programme.qualification ? (
          <p
            className="text-body font-medium text-foreground"
            lang={contentLang}
          >
            {programme.qualification}
          </p>
        ) : null}

        {programme.fieldOfStudy ? (
          <p className="text-small text-foreground-muted" lang={contentLang}>
            {programme.fieldOfStudy}
          </p>
        ) : null}
      </header>

      {/* Expected completion and schedule as short labelled facts, not a
          metadata table — the old page's dt/dd grid is what made a live degree
          read like a transcript. A missing value simply does not render. */}
      {programme.expectedLabel || programme.scheduleLabel ? (
        <div className="flex flex-col gap-1.5 border-s-2 border-border ps-4">
          {programme.expectedLabel ? (
            <p className="text-small font-medium text-foreground">
              {programme.expectedLabel}
            </p>
          ) : null}

          {programme.scheduleLabel ? (
            <p className="inline-flex items-center gap-1.5 text-small text-foreground-muted">
              <Icon name="clock" size={14} aria-hidden="true" />
              <span className="sr-only">{t.education.schedule}: </span>
              {programme.scheduleLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {primaryFocus.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-semibold uppercase text-foreground-subtle">
            {t.education.spotlight.focusHeading}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {primaryFocus.map((label) => (
              <li key={label}>
                <Tag>{label}</Tag>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasDetails ? (
        <details className="experience-details mt-auto border-t border-border pt-4">
          <summary
            className={cn(
              "inline-flex min-h-11 items-center gap-2 text-small font-semibold",
              "text-foreground transition-colors hover:text-primary",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Icon
              name="chevronDown"
              size={16}
              className="experience-details__chevron"
            />
            {t.education.spotlight.viewDetails}
          </summary>

          <div className="flex flex-col gap-5 pt-5">
            {programme.description ? (
              <section className="flex flex-col gap-2">
                <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
                  {t.education.spotlight.aboutHeading}
                </h4>
                <p
                  className="max-w-[64ch] text-small text-foreground-muted"
                  lang={contentLang}
                >
                  {programme.description}
                </p>
              </section>
            ) : null}

            {programme.achievements ? (
              <section className="flex flex-col gap-2">
                <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
                  {t.education.spotlight.progressHeading}
                </h4>
                <p
                  className="max-w-[64ch] text-small text-foreground-muted"
                  lang={contentLang}
                >
                  {programme.achievements}
                </p>
              </section>
            ) : null}

            {remainingFocus.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {remainingFocus.map((label) => (
                  <li key={label}>
                    <Tag>{label}</Tag>
                  </li>
                ))}
              </ul>
            ) : null}

            <JourneyStoryLinks locale={locale} t={t} stories={stories} />

            {programme.institutionUrl ? (
              <p>
                <SmartLink
                  href={programme.institutionUrl}
                  newTabHint={t.a11y.opensInNewTab}
                  showExternalIcon
                  className="inline-flex min-h-11 items-center text-small font-medium text-primary underline underline-offset-4"
                >
                  {t.education.spotlight.institutionLink}
                </SmartLink>
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </article>
  );
}
