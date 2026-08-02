import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Breadcrumbs } from "@/components/ui/navigation";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";

/**
 * The Experience page's opening band.
 *
 * ── Why this replaces the shared `PageHeader` ──────────────────────────────
 * `PageHeader` is the right component for a page whose job is to introduce a
 * list. This page's job is to make an argument — that the classroom work and
 * the engineering work are one direction — and the argument has to land before
 * the first entry or the timeline reads as two unrelated CVs stapled together.
 *
 * The two structural tricks `PageHeader` performs are kept exactly, because
 * they are not decoration:
 *
 *   · `data-scheme="ink"` gives the transparent site header a reliably dark
 *     ground to sit on before the visitor scrolls. Without it the ink-scoped
 *     header text lands on a light surface at about 1.2:1.
 *   · The negative top margin pulls this band *under* the sticky header, and
 *     the matching padding gives the space back, so nothing is ever hidden.
 *
 * ── The path diagram ───────────────────────────────────────────────────────
 * Supplementary, and built from real text in an ordered list rather than an
 * image or a canvas. A screen reader gets five ordered steps; a reader with
 * images off gets five ordered steps; the visual connectors are `aria-hidden`
 * pseudo-decoration on top. Nothing in it is information that is not also in
 * the prose beside it.
 */

const PATH_STEPS: ReadonlyArray<{
  key: keyof Dictionary["experience"]["hero"]["path"];
  icon: IconName;
  /**
   * Where the step sits in the handover from classroom to product. The colour
   * is decorative reinforcement of the order the list already states.
   */
  mark: string;
}> = [
  { key: "teaching", icon: "teacher", mark: "var(--experience-education)" },
  { key: "observation", icon: "eye", mark: "var(--experience-education)" },
  { key: "research", icon: "search", mark: "var(--experience-connection)" },
  { key: "engineering", icon: "code", mark: "var(--experience-product)" },
  { key: "systems", icon: "layers", mark: "var(--experience-product)" },
];

export type ExperienceSummaryItem = {
  id: string;
  label: string;
  value: string;
};

export function ExperienceHero({
  locale,
  t,
  summary,
  /** Anchor the primary action scrolls to. */
  timelineId,
}: {
  locale: Locale;
  t: Dictionary;
  summary: ExperienceSummaryItem[];
  timelineId: string;
}) {
  return (
    <section
      data-scheme="ink"
      className="decorated bg-background text-foreground"
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      <div
        aria-hidden="true"
        className="grid-lines"
        style={{ "--grid-alpha": "0.05" } as object}
      />
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "82%",
            "--glow-y": "12%",
            "--glow-size": "56%",
            "--glow-alpha": "0.22",
          } as object
        }
      />

      <div
        className="container-content flex flex-col gap-8 pb-14 sm:pb-16"
        style={{
          paddingTop: "calc(var(--header-height) + clamp(2rem, 4vw, 3.25rem))",
        }}
      >
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.experience },
          ]}
          label={t.a11y.breadcrumb}
        />

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent">
              <span aria-hidden="true" className="h-px w-8 bg-accent" />
              {t.experience.hero.eyebrow}
            </p>

            {/*
              The page's one H1. It states the argument rather than repeating
              the navigation label — "Experience" is already in the eyebrow, the
              breadcrumb, the document title and the tab.
            */}
            <h1 className="text-h1 max-w-[19ch] text-balance">
              {t.experience.hero.headline}
            </h1>

            <p className="max-w-[58ch] text-body-lg text-foreground-muted">
              {t.experience.hero.lede}
            </p>

            {/*
              Three actions, in descending commitment: read this page, read the
              résumé, look at the products. A fourth would flatten the hierarchy
              rather than add a route.
            */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink
                href={`#${timelineId}`}
                variant="accent"
                iconEnd="arrowRight"
              >
                {t.experience.hero.explore}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "resume")}
                variant="outline"
                iconStart="fileText"
              >
                {t.nav.resume}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "projects")}
                variant="link"
                iconEnd="arrowRight"
              >
                {t.experience.hero.projects}
              </ButtonLink>
            </div>
          </div>

          <PathDiagram t={t} />
        </div>

        {summary.length > 0 ? <SummaryStrip t={t} items={summary} /> : null}
      </div>
    </section>
  );
}

// ── Path diagram ────────────────────────────────────────────────────────────

function PathDiagram({ t }: { t: Dictionary }) {
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="text-eyebrow font-semibold uppercase text-foreground-subtle">
        {t.experience.hero.pathLabel}
      </figcaption>

      <ol className="flex flex-col">
        {PATH_STEPS.map((step, index) => (
          <li key={step.key} className="relative flex items-center gap-4 pb-5 last:pb-0">
            {/*
              The connector. Absolutely positioned and aria-hidden: the list is
              already ordered, so this repeats the sequence visually and adds
              nothing for a screen reader to announce.
            */}
            {index < PATH_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute start-[1.375rem] top-11 h-[calc(100%-2.75rem)] w-px"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, var(--experience-connection), color-mix(in oklab, var(--experience-connection) 20%, transparent))",
                }}
              />
            ) : null}

            <span
              aria-hidden="true"
              className="experience-chip relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border"
              style={{ "--mark-color": step.mark } as object}
            >
              <Icon name={step.icon} size={19} />
            </span>

            <span className="text-body font-medium text-foreground">
              {t.experience.hero.path[step.key]}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// ── Summary strip ───────────────────────────────────────────────────────────

/**
 * The verified summary.
 *
 * Every value is computed from the entries that are actually published — a span
 * is the earliest year evidenced on a track, a count is a count. The page never
 * asserts a number it cannot derive, so an item whose value cannot be computed
 * is simply not passed in. There are no animated counters: a figure that spins
 * up from zero is decoration applied to a fact.
 */
function SummaryStrip({
  t,
  items,
}: {
  t: Dictionary;
  items: ExperienceSummaryItem[];
}) {
  return (
    <dl
      aria-label={t.experience.summary.label}
      /*
        `subgrid` so the values line up across a row even when one label wraps
        to two lines and its neighbour does not — which Khmer, running 20–40%
        longer than English, does on almost every viewport.
      */
      className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border-veil pt-8 sm:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="row-span-2 grid grid-rows-subgrid gap-1.5"
        >
          <dt className="text-eyebrow font-semibold uppercase text-foreground-subtle">
            {item.label}
          </dt>
          <dd className="font-mono text-h4 font-semibold text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
