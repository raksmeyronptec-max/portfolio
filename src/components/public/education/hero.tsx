import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Breadcrumbs } from "@/components/ui/navigation";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { CONNECTION_MARK } from "./marks";

/**
 * The Education page's opening band.
 *
 * Structurally the same contract as the Experience hero, for the same reasons:
 * `data-scheme="ink"` gives the transparent site header a reliably dark ground,
 * and the negative top margin pulls the band under the sticky header while the
 * padding gives the space back. See `experience/hero.tsx` for the full note.
 *
 * ── The convergence diagram ────────────────────────────────────────────────
 * Two named paths meeting in one mission — the page's whole argument, drawn
 * once, statically. It is a real list, not an image: a screen reader gets the
 * two degrees and the mission as three ordered text items, and the connecting
 * strokes are `aria-hidden` decoration on top. Nothing in it is information
 * the prose beside it does not also state.
 */
export function EducationHero({
  locale,
  t,
  /** Anchor the primary action scrolls to. */
  spotlightId,
}: {
  locale: Locale;
  t: Dictionary;
  spotlightId: string;
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
            "--glow-x": "80%",
            "--glow-y": "14%",
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
            { label: t.nav.education },
          ]}
          label={t.a11y.breadcrumb}
        />

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent">
              <span aria-hidden="true" className="h-px w-8 bg-accent" />
              {t.education.hero.eyebrow}
            </p>

            <h1 className="text-h1 max-w-[20ch] text-balance">
              {t.education.hero.headline}
            </h1>

            <p className="max-w-[58ch] text-body-lg text-foreground-muted">
              {t.education.hero.lede}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink
                href={`#${spotlightId}`}
                variant="accent"
                iconEnd="arrowRight"
              >
                {t.education.hero.explore}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "resume")}
                variant="outline"
                iconStart="fileText"
              >
                {t.nav.resume}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "publications")}
                variant="link"
                iconEnd="arrowRight"
              >
                {t.education.hero.publications}
              </ButtonLink>
            </div>
          </div>

          <ConvergenceDiagram t={t} />
        </div>
      </div>
    </section>
  );
}

// ── Diagram ─────────────────────────────────────────────────────────────────

function ConvergenceDiagram({ t }: { t: Dictionary }) {
  const paths = [
    {
      key: "teacher",
      label: t.education.hero.pathTeacher,
      detail: t.education.hero.pathTeacherDetail,
      icon: "teacher" as const,
      mark: "var(--experience-education)",
    },
    {
      key: "mathematics",
      label: t.education.hero.pathMathematics,
      detail: t.education.hero.pathMathematicsDetail,
      icon: "barChart" as const,
      mark: "var(--experience-product)",
    },
  ];

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="text-eyebrow font-semibold uppercase text-foreground-subtle">
        {t.education.hero.pathLabel}
      </figcaption>

      <ul className="flex flex-col">
        {paths.map((path) => (
          <li key={path.key} className="relative flex items-center gap-4 pb-5">
            {/* Stroke from each degree down toward the mission node. */}
            <span
              aria-hidden="true"
              className="absolute start-[1.375rem] top-11 h-[calc(100%-2.75rem)] w-px"
              style={{
                backgroundImage: `linear-gradient(to bottom, ${path.mark}, color-mix(in oklab, ${CONNECTION_MARK} 45%, transparent))`,
              }}
            />

            <span
              aria-hidden="true"
              className="experience-chip relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border"
              style={{ "--mark-color": path.mark } as object}
            >
              <Icon name={path.icon} size={19} />
            </span>

            <span className="flex flex-col">
              <span className="text-body font-medium text-foreground">
                {path.label}
              </span>
              <span className="text-[0.8125rem] text-foreground-subtle">
                {path.detail}
              </span>
            </span>
          </li>
        ))}

        <li className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="experience-chip relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) border"
            style={{ "--mark-color": CONNECTION_MARK } as object}
          >
            <Icon name="lightbulb" size={19} />
          </span>

          <span className="text-body font-semibold text-foreground">
            {t.education.hero.pathMission}
          </span>
        </li>
      </ul>
    </figure>
  );
}
