import { Reveal } from "@/components/motion/reveal";
import { langAttribute } from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type {
  MilestoneView,
  TimelinePoint,
} from "@/lib/content/education-view";
import { cn } from "@/lib/utils/cn";

/**
 * The national milestone and the compact chronology, as one section.
 *
 * ── Why they share a section ───────────────────────────────────────────────
 * The Bac II Grade A is the one earlier qualification that carries real
 * weight, and the rest of the history exists to give it a place in time. A
 * featured certificate panel followed by a separate five-card timeline would
 * hand earlier education a third of the page — the exact imbalance the brief
 * calls out. So: one editorial panel for the graded result, one hairline
 * chronology for everything else, together under one heading.
 *
 * ── What the milestone panel does not do ───────────────────────────────────
 * No trophy, no confetti, no "top student" claim — the CMS records a grade, a
 * scale and a description, and those are what render. The recorded score
 * appears because the CMS already publishes it in both locales' achievements
 * text; this section adds no exposure that page did not have.
 */
export function MilestoneAndTimeline({
  locale,
  t,
  milestone,
  points,
  headingId,
}: {
  locale: Locale;
  t: Dictionary;
  milestone: MilestoneView | null;
  points: TimelinePoint[];
  headingId: string;
}) {
  if (!milestone && points.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="bg-surface-muted">
      <div className="container-content section-y flex flex-col gap-10">
        <Reveal className="flex max-w-[52ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.education.timeline.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.education.timeline.heading}
          </h2>
        </Reveal>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          {milestone ? (
            <Reveal>
              <NationalMilestone locale={locale} t={t} milestone={milestone} />
            </Reveal>
          ) : null}

          {points.length > 0 ? (
            <Reveal delay={90}>
              <CompactTimeline t={t} points={points} />
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ── National milestone ──────────────────────────────────────────────────────

function NationalMilestone({
  locale,
  t,
  milestone,
}: {
  locale: Locale;
  t: Dictionary;
  milestone: MilestoneView;
}) {
  const contentLang = langAttribute(locale, milestone.contentLocale);

  return (
    <article
      id={milestone.anchorId}
      className="relative flex scroll-mt-24 flex-col gap-4 overflow-hidden rounded-(--radius-xl) border border-border bg-surface p-5 shadow-(--shadow-xs) sm:p-7"
    >
      {/* The achievement takes the education gold — the same vocabulary as
          the teaching track, at certificate weight. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, var(--experience-education), transparent 72%)",
        }}
      />

      <p
        className="experience-mark text-eyebrow font-semibold uppercase"
        style={{ "--mark-color": "var(--experience-education)" } as object}
      >
        {t.education.milestone.eyebrow}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-h4 font-semibold text-balance" lang={contentLang}>
            {milestone.qualification ?? milestone.institution}
          </h3>
          <p className="text-small text-foreground-muted" lang={contentLang}>
            {milestone.institution}
          </p>
        </div>

        {milestone.gradeValue ? (
          /*
            The grade, at display size, with its scale directly under it — "A"
            alone is meaningless without the scale that awarded it, which is
            why the two render as one block or not at all.
          */
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-(--radius-lg) border border-border bg-surface-muted px-5 py-3 text-center">
            <span className="text-eyebrow font-semibold uppercase text-foreground-subtle">
              {t.education.milestone.gradeHeading}
            </span>
            <span
              aria-hidden="true"
              className="experience-mark font-display text-[2.75rem] leading-none font-bold"
              style={{ "--mark-color": "var(--experience-education)" } as object}
            >
              {milestone.gradeValue}
            </span>
            <span className="sr-only">{milestone.gradeValue}</span>
            {milestone.gradeScale ? (
              <span className="max-w-[16ch] text-[0.75rem] leading-snug text-foreground-subtle">
                {milestone.gradeScale}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {milestone.description ? (
        <p className="max-w-[58ch] text-small text-foreground-muted" lang={contentLang}>
          {milestone.description}
        </p>
      ) : null}

      {milestone.achievements ? (
        <p className="max-w-[58ch] text-small font-medium text-foreground" lang={contentLang}>
          {milestone.achievements}
        </p>
      ) : null}
    </article>
  );
}

// ── Compact timeline ────────────────────────────────────────────────────────

function CompactTimeline({
  t,
  points,
}: {
  t: Dictionary;
  points: TimelinePoint[];
}) {
  return (
    <ol
      aria-label={t.education.timeline.listLabel}
      className="relative flex flex-col"
    >
      {/*
        A local hairline, not `.experience-rail` — that one recentres itself
        between the two columns at `lg`, which is right for the dual-track
        timeline and wrong inside this half-width column.
      */}
      <span
        aria-hidden="true"
        className="absolute inset-y-2 start-[4.5px] w-px bg-border-strong"
      />

      {points.map((point) => (
        <li key={point.id} className="relative flex gap-4 pb-6 last:pb-0">
          <span
            aria-hidden="true"
            className={cn(
              "relative z-10 mt-[0.4rem] size-2.5 shrink-0 rounded-full ring-4 ring-surface-muted",
            )}
            style={{
              background: point.isExpected
                ? "transparent"
                : "var(--border-strong)",
              // An expected point is an outline, not a filled dot — the shape
              // says "not yet" alongside the label that already does.
              boxShadow: point.isExpected
                ? "inset 0 0 0 1.5px var(--experience-connection)"
                : undefined,
            }}
          />

          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-mono text-[0.8125rem] font-medium text-foreground-subtle">
                {point.yearLabel}
              </span>
              {point.isExpected ? (
                <span
                  className="experience-chip inline-flex items-center rounded-(--radius-full) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                  style={
                    { "--mark-color": "var(--experience-connection)" } as object
                  }
                >
                  {t.education.timeline.expectedMarker}
                </span>
              ) : null}
            </p>

            <p className="text-small font-semibold text-foreground">
              {point.href ? (
                <a href={point.href} className="hover:underline">
                  {point.title}
                </a>
              ) : (
                point.title
              )}
            </p>

            {point.detail ? (
              <p className="text-[0.8125rem] text-foreground-muted">
                {point.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
