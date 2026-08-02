import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/reveal";
import { OutboundLink } from "@/components/public/outbound-link";
import { caseStudySections } from "@/components/public/case-study";
import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import { resolveImage } from "@/lib/content/media";
import { coverFallbackFor } from "@/lib/data/live-platforms";
import { truncateDescription } from "@/lib/seo/metadata";
import type { ProjectDetailData } from "@/lib/data/projects";

/* ═══════════════════════════════════════════════════════════════════════════
   Featured case study — the flagship, told properly.

   Why this exists as its own section
     The homepage used to give all three platforms the same treatment: three
     equal showcases in a row. That is a catalogue, and a catalogue makes a
     visitor choose where to start. Leading with one project told end to end —
     problem, approach, outcome — answers "can this person actually build
     something" before anything else has to.

   Which project
     Whichever the CMS puts first. `sort_order` on a featured project is the
     owner's own ranking, so the flagship is changed by dragging a row in the
     admin, not by editing a slug in here. Nothing in this file names a project.

   What it will not do
     Invent. Every beat below renders only when the CMS field behind it has
     prose, so a half-written case study is a shorter section rather than a run
     of empty headings. There are no fabricated metrics: `metrics` is rendered
     from verified rows only — RLS filters the rest out before this code sees
     them — and if there are none, the strip is absent.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The three beats the homepage tells.
 *
 * Deliberately a subset of the case study's own section list rather than a
 * second mapping of the same columns: `caseStudySections()` already knows which
 * fields exist and which are empty, so this cannot drift from the detail page.
 * Each beat falls back through alternatives, because a project that documents
 * its architecture but not its "solution" still has a middle act.
 */
const BEATS: ReadonlyArray<{ key: string; candidates: readonly string[] }> = [
  { key: "problem", candidates: ["problem", "target-users", "overview"] },
  { key: "approach", candidates: ["solution", "ux-decisions", "architecture"] },
  { key: "outcome", candidates: ["results", "key-features", "lessons"] },
] as const;

/** Roughly a short paragraph — long enough to be a real answer, short enough
 *  that three of them still read as a summary. */
const EXCERPT_CHARS = 300;

/**
 * A preview excerpt that stops at the end of a sentence.
 *
 * `truncateDescription()` cuts at a word boundary, which is right for a meta
 * description nobody reads as prose but leaves visible stubs here — the first
 * beat ended on "…is in the same position as a student for whom it does not
 * exist. And…", which reads like the page failed to load.
 *
 * So: keep whole sentences while they fit, and fall back to the shared
 * word-boundary cut when the very first sentence is already over length.
 * Khmer uses "។" (khan) as its full stop and no spaces between words, which is
 * why the terminator set includes it and why the fallback matters.
 */
function excerpt(body: string, locale: Locale): string | undefined {
  const normalised = body.replace(/\s+/g, " ").trim();
  if (normalised.length <= EXCERPT_CHARS) return normalised;

  const window = normalised.slice(0, EXCERPT_CHARS);
  const lastStop = Math.max(
    window.lastIndexOf("។"),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );

  // Only trust a sentence break past the halfway mark; before that the excerpt
  // would be too short to say anything.
  if (lastStop > EXCERPT_CHARS * 0.45) {
    return normalised.slice(0, lastStop + 1).trim();
  }

  return truncateDescription(normalised, locale, EXCERPT_CHARS);
}

export function FeaturedCaseStudy({
  project,
  locale,
  t,
}: {
  project: ProjectDetailData;
  locale: Locale;
  t: Dictionary;
}) {
  const sections = caseStudySections(project, t);
  const byId = new Map(sections.map((section) => [section.id, section]));

  const used = new Set<string>();
  const beats = BEATS.map((beat) => {
    const found = beat.candidates
      .map((id) => byId.get(id))
      .find((section) => section && !used.has(section.id));
    if (found) used.add(found.id);
    return found ? { key: beat.key, section: found } : null;
  }).filter((beat): beat is { key: string; section: { id: string; label: string; body: string } } =>
    Boolean(beat),
  );

  // Nothing written yet: the ordinary featured-projects grid is a better
  // answer than a heading over an empty column.
  if (beats.length === 0) return null;

  const contentLang = langAttribute(locale, project.contentLocale);
  const cover =
    resolveImage(project.cover, locale, "preview") ??
    coverFallbackFor(project.slug, t.projects.screenshotAlt);

  const beatLabels: Record<string, string> = {
    problem: t.home.caseStudy.problem,
    approach: t.home.caseStudy.approach,
    outcome: t.home.caseStudy.outcome,
  };

  return (
    <section
      aria-labelledby="featured-case-study-heading"
      className="bg-surface-muted"
    >
      <div className="container-content section-y">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Reveal className="flex max-w-[52ch] flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.home.caseStudy.eyebrow}
          </p>

          <h2 id="featured-case-study-heading" className="text-h2" lang={contentLang}>
            {project.title}
          </h2>

          {project.summary ? (
            <p className="text-body-lg text-foreground-muted" lang={contentLang}>
              {project.summary}
            </p>
          ) : null}
        </Reveal>

        {/* ── Body ────────────────────────────────────────────────────────
            Mobile puts the visual first and the story under it; desktop puts
            the visual in a sticky rail so it stays with the prose. `lg:sticky`
            only — a sticky element on a short mobile viewport fights the
            scroll, which the brief calls out directly. */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-col gap-6">
              {cover ? (
                <div className="overflow-hidden rounded-(--radius-xl) border border-border bg-surface shadow-md">
                  <Image
                    src={cover.src}
                    alt={cover.alt}
                    width={1200}
                    height={750}
                    sizes="(min-width: 1024px) 42vw, 92vw"
                    className="h-auto w-full object-cover"
                  />
                </div>
              ) : null}

              {/* ── Facts ─────────────────────────────────────────────────
                  Every row is conditional: a project with no organisation
                  recorded shows three rows, not a blank fourth. */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {project.role ? (
                  <Fact label={t.home.caseStudy.role} value={project.role} lang={contentLang} />
                ) : null}
                {project.organization ? (
                  <Fact
                    label={t.home.caseStudy.organisation}
                    value={project.organization}
                    lang={contentLang}
                  />
                ) : null}
                {project.yearLabel ? (
                  <Fact label={t.home.caseStudy.year} value={project.yearLabel} />
                ) : null}
                {project.categories.length > 0 ? (
                  <Fact
                    label={t.home.caseStudy.category}
                    value={project.categories.map((c) => c.name).join(", ")}
                  />
                ) : null}
              </dl>

              {/* Verified metrics only. RLS drops unverified rows, so an empty
                  list here means "none measured", never "none shown". */}
              {project.metrics.length > 0 ? (
                <dl className="flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-5">
                  {project.metrics.slice(0, 3).map((metric) => (
                    <div key={metric.id} className="flex flex-col gap-1">
                      <dd className="text-h3 font-bold tabular-nums text-foreground">
                        {metric.value}
                        {metric.unit ? (
                          <span className="text-body font-medium text-foreground-muted">
                            {metric.unit}
                          </span>
                        ) : null}
                      </dd>
                      <dt className="text-small text-foreground-muted">{metric.label}</dt>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </Reveal>

          {/* ── Story ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-8">
            {beats.map((beat, index) => (
              <Reveal key={beat.key} delay={index * 60}>
                <article className="flex flex-col gap-2.5">
                  <h3 className="flex items-center gap-3 text-h4 font-semibold">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-(--radius-full) border border-border-strong text-[0.75rem] font-bold tabular-nums text-foreground-muted"
                    >
                      {index + 1}
                    </span>
                    {beatLabels[beat.key] ?? beat.section.label}
                  </h3>

                  <p
                    className="text-body text-foreground-muted"
                    lang={contentLang}
                  >
                    {/* Excerpted, not reproduced: the homepage is a preview and
                        the full prose lives one click away. */}
                    {excerpt(beat.section.body, locale)}
                  </p>
                </article>
              </Reveal>
            ))}

            {/* ── Key features ──────────────────────────────────────────── */}
            {project.features.length > 0 ? (
              <Reveal delay={200}>
                <h3 className="mb-3 text-h4 font-semibold">
                  {t.home.caseStudy.whatItDoes}
                </h3>
                <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {project.features.slice(0, 4).map((feature) => (
                    <li key={feature.id} className="flex items-start gap-2.5">
                      <Icon
                        name="check"
                        size={16}
                        aria-hidden
                        className="mt-1 shrink-0 text-success"
                      />
                      <span className="text-small text-foreground-muted" lang={contentLang}>
                        {feature.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}

            {/* ── Technologies ──────────────────────────────────────────── */}
            {project.technologies.length > 0 ? (
              <Reveal delay={240}>
                <h3 className="sr-only">{t.home.caseStudy.builtWith}</h3>
                <ul className="flex flex-wrap gap-2">
                  {project.technologies.slice(0, 8).map((tech) => (
                    <li key={tech.id}>
                      <Tag>{tech.name}</Tag>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}

            {/* ── Actions ───────────────────────────────────────────────── */}
            <Reveal delay={280} className="flex flex-wrap items-center gap-3">
              <ButtonLink
                href={localePath(locale, `projects/${project.slug}`)}
                variant="primary"
                iconEnd="arrowRight"
                className="rounded-(--radius-full) px-5"
              >
                {t.home.caseStudy.readCaseStudy}
              </ButtonLink>

              {project.liveUrl ? (
                <OutboundLink
                  href={project.liveUrl}
                  newTabHint={t.a11y.opensInNewTab}
                  event={{
                    name: "project_live_link_click",
                    locale,
                    properties: { slug: project.slug, url: project.liveUrl },
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-full) border border-border px-5 text-small font-semibold text-foreground transition-colors duration-200 hover:border-border-interactive hover:bg-surface"
                >
                  <Icon name="externalLink" size={16} aria-hidden />
                  {interpolate(t.home.caseStudy.visitProject, { name: project.title })}
                </OutboundLink>
              ) : null}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({
  label,
  value,
  lang,
}: {
  label: string;
  value: string;
  lang?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-eyebrow font-semibold uppercase text-foreground-subtle">
        {label}
      </dt>
      <dd className="text-small text-foreground" lang={lang}>
        {value}
      </dd>
    </div>
  );
}
