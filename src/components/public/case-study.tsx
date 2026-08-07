import Image from "next/image";

import { Badge, Card, CardBody, Divider, ProseText, SmartLink, Tag } from "@/components/ui/primitives";
import { Icon, toIconName } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { formatDate, type Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { ProjectDetailData, ProjectMediaItem } from "@/lib/data/projects";

/* ═══════════════════════════════════════════════════════════════════════════
   Case-study body.

   Every section is optional and simply does not render when the CMS field is
   empty, so a partially written case study reads as a shorter article rather than
   as a page full of empty headings.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CaseStudySection = { id: string; label: string; body: string };

/**
 * Builds the ordered list of sections that actually have content.
 *
 * Shared with the table of contents so the two can never disagree — a ToC entry
 * that scrolls to nothing is worse than no ToC.
 */
export function caseStudySections(
  project: ProjectDetailData,
  t: Dictionary,
): CaseStudySection[] {
  const translation = project.translation;
  if (!translation) return [];

  const candidates: Array<[string, string, string | null]> = [
    ["overview", t.projects.sections.overview, translation.overview],
    ["problem", t.projects.sections.problem, translation.problem],
    ["target-users", t.projects.sections.targetUsers, translation.target_users],
    ["goals", t.projects.sections.goals, translation.goals],
    ["my-role", t.projects.sections.myRole, translation.my_role],
    ["responsibilities", t.projects.sections.responsibilities, translation.responsibilities],
    ["constraints", t.projects.sections.constraints, translation.constraints],
    ["research", t.projects.sections.research, translation.research],
    ["ux-decisions", t.projects.sections.uxDecisions, translation.ux_decisions],
    ["architecture", t.projects.sections.architecture, translation.architecture],
    ["database", t.projects.sections.databaseDecisions, translation.database_decisions],
    ["key-features", t.projects.sections.keyFeatures, translation.key_features],
    ["security", t.projects.sections.security, translation.security_notes],
    ["accessibility", t.projects.sections.accessibility, translation.accessibility_notes],
    ["seo", t.projects.sections.seo, translation.seo_notes],
    ["performance", t.projects.sections.performance, translation.performance_notes],
    ["challenges", t.projects.sections.challenges, translation.challenges],
    ["solution", t.projects.sections.solution, translation.solution],
    ["results", t.projects.sections.results, translation.results],
    ["lessons", t.projects.sections.lessons, translation.lessons],
    ["next-steps", t.projects.sections.nextSteps, translation.next_steps],
  ];

  return candidates
    .filter((entry): entry is [string, string, string] => Boolean(entry[2]?.trim()))
    .map(([id, label, body]) => ({ id, label, body }));
}

export function CaseStudyBody({
  project,
  locale,
  t,
  sections,
}: {
  project: ProjectDetailData;
  locale: Locale;
  t: Dictionary;
  sections: CaseStudySection[];
}) {
  const contentLang = langAttribute(locale, project.contentLocale);
  const take = (ids: string[], used: Set<string>) => {
    const match = ids
      .map((id) => sections.find((section) => section.id === id))
      .find((section) => section && !used.has(section.id));
    if (match) used.add(match.id);
    return match;
  };
  const used = new Set<string>();
  const primarySections = [
    {
      tone: "problem",
      label: locale === "km" ? "បញ្ហា" : "The problem",
      section: take(["problem", "constraints", "challenges", "overview"], used),
    },
    {
      tone: "approach",
      label: locale === "km" ? "វិធីសាស្ត្រ" : "The approach",
      section: take(["solution", "architecture", "ux-decisions", "research", "key-features"], used),
    },
    {
      tone: "result",
      label: locale === "km" ? "អ្វីដែលវាធ្វើឥឡូវនេះ" : "What it does now",
      section: take(["results", "key-features", "overview", "next-steps"], used),
    },
  ].filter((item): item is { tone: string; label: string; section: CaseStudySection } => Boolean(item.section));
  const supportingSections = sections.filter((section) => !used.has(section.id));
  const leadMetric = project.metrics[0] ?? null;

  return (
    <div className="flex flex-col gap-10">
      {project.isTranslationFallback ? (
        // Say so rather than silently serving one language as though it were
        // another. The prose itself also carries a `lang` attribute, so screen
        // readers switch voice correctly.
        <Notice tone="info">
          <p>{t.projects.translationFallback}</p>
        </Notice>
      ) : null}

      {primarySections.length > 0 ? (
        <div className="case-blocks">
          {primarySections.map(({ tone, label, section }) => (
            <section
              key={tone}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className={`case-block ${tone}`}
            >
              <h2 id={`${section.id}-heading`} className="case-label">
                {label}
              </h2>
              <ProseText text={section.body} />
              {tone === "result" && leadMetric ? (
                <p className="mt-4 text-small text-foreground-muted">
                  <span className="metric-pull">
                    {leadMetric.value}{leadMetric.unit ? ` ${leadMetric.unit}` : ""}
                  </span>{" "}
                  {leadMetric.label}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {supportingSections.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`} className="text-h3 font-semibold">
            {section.label}
          </h2>
          <ProseText text={section.body} className="mt-3" />
        </section>
      ))}

      {project.features.length > 0 ? (
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-h3 font-semibold">
            {t.projects.sections.keyFeatures}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {project.features.map((feature) => (
              <li key={feature.id}>
                <Card className="h-full">
                  <CardBody className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) bg-secondary-subtle text-secondary-subtle-foreground">
                      <Icon name={toIconName(feature.icon, "check")} size={18} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold" lang={contentLang}>
                        {feature.title}
                      </p>
                      {feature.description ? (
                        <p className="text-small text-foreground-muted" lang={contentLang}>
                          {feature.description}
                        </p>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ProjectMetrics project={project} locale={locale} t={t} />

      <ProjectGallery media={project.media} locale={locale} t={t} />
    </div>
  );
}

// ── Metrics ─────────────────────────────────────────────────────────────────

/**
 * Measured results.
 *
 * Only verified metrics reach this component: the RLS policy on
 * `project_metrics` filters unverified rows out for anonymous readers, and the
 * database refuses to mark a metric verified without a `source_note`. Each figure
 * therefore renders with its provenance visible, which is the difference between
 * a result and a claim.
 */
function ProjectMetrics({
  project,
  locale,
  t,
}: {
  project: ProjectDetailData;
  locale: Locale;
  t: Dictionary;
}) {
  if (project.metrics.length === 0) return null;

  return (
    <section aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" className="text-h3 font-semibold">
        {t.projects.metrics.heading}
      </h2>
      <p className="mt-2 text-small text-foreground-muted">{t.projects.metrics.note}</p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {project.metrics.map((metric) => (
          <div
            key={metric.id}
            className="flex flex-col gap-1 rounded-(--radius-lg) border border-border bg-surface p-5"
          >
            <dd className="text-h2 font-bold tabular-nums text-primary">
              {metric.value}
              {metric.unit ? (
                <span className="ml-1 text-h4 font-semibold text-foreground-muted">
                  {metric.unit}
                </span>
              ) : null}
            </dd>
            <dt className="text-small font-medium">{metric.label}</dt>

            {metric.sourceNote ? (
              <p className="mt-1 text-[0.8125rem] text-foreground-subtle">
                {metric.sourceNote}
              </p>
            ) : null}

            {metric.measuredAt ? (
              <p className="text-[0.8125rem] text-foreground-subtle">
                {formatDate(metric.measuredAt, locale, {
                  year: "numeric",
                  month: "short",
                })}
              </p>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── Gallery ─────────────────────────────────────────────────────────────────

function ProjectGallery({
  media,
  locale,
  t,
}: {
  media: ProjectMediaItem[];
  locale: Locale;
  t: Dictionary;
}) {
  if (media.length === 0) return null;

  const beforeAfterPairs = groupBeforeAfter(media);
  const gallery = media.filter(
    (item) => item.variant !== "before" && item.variant !== "after",
  );

  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="text-h3 font-semibold">
        {t.projects.sections.gallery}
      </h2>

      {/* ── Before / after ─────────────────────────────────────────────────── */}
      {beforeAfterPairs.length > 0 ? (
        <div className="mt-4 flex flex-col gap-6">
          {beforeAfterPairs.map((pair) => (
            <div key={pair.key} className="grid gap-4 sm:grid-cols-2">
              {(["before", "after"] as const).map((side) => {
                const item = pair[side];
                if (!item) return null;
                const image = resolveImage(item.asset, locale, "preview");
                if (!image) return null;

                return (
                  <figure key={side} className="flex flex-col gap-2">
                    <Badge tone={side === "before" ? "neutral" : "success"}>
                      {side === "before"
                        ? t.projects.gallery.before
                        : t.projects.gallery.after}
                    </Badge>
                    <div className="relative aspect-[16/10] overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        loading="lazy"
                        placeholder={image.blurDataURL ? "blur" : undefined}
                        blurDataURL={image.blurDataURL ?? undefined}
                        className="object-cover"
                      />
                    </div>
                    {item.caption ? (
                      <figcaption className="text-[0.8125rem] text-foreground-muted">
                        {item.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Screenshots and diagrams ───────────────────────────────────────── */}
      {gallery.length > 0 ? (
        <ul className="mt-4 grid gap-5 sm:grid-cols-2">
          {gallery.map((item) => {
            const image = resolveImage(item.asset, locale, "preview");
            if (!image) return null;

            const variantLabel =
              item.variant === "desktop_screenshot"
                ? t.projects.gallery.desktop
                : item.variant === "mobile_screenshot"
                  ? t.projects.gallery.mobile
                  : item.variant === "diagram"
                    ? t.projects.gallery.diagram
                    : null;

            return (
              <li key={item.id}>
                <figure className="flex flex-col gap-2">
                  {variantLabel ? <Tag>{variantLabel}</Tag> : null}
                  <div
                    className={
                      item.variant === "mobile_screenshot"
                        ? "relative mx-auto aspect-[9/16] w-full max-w-[16rem] overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted"
                        : "relative aspect-[16/10] overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted"
                    }
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      loading="lazy"
                      placeholder={image.blurDataURL ? "blur" : undefined}
                      blurDataURL={image.blurDataURL ?? undefined}
                      className="object-contain"
                    />
                  </div>
                  {item.caption ? (
                    <figcaption className="text-[0.8125rem] text-foreground-muted">
                      {item.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** Pairs `before`/`after` items that share a `pair_key`. */
function groupBeforeAfter(media: ProjectMediaItem[]) {
  const pairs = new Map<
    string,
    { key: string; before?: ProjectMediaItem; after?: ProjectMediaItem }
  >();

  for (const item of media) {
    if (item.variant !== "before" && item.variant !== "after") continue;
    const key = item.pairKey ?? item.id;
    const existing = pairs.get(key) ?? { key };
    existing[item.variant] = item;
    pairs.set(key, existing);
  }

  // A lone "before" with no "after" is not a comparison, so it is dropped.
  return [...pairs.values()].filter((pair) => pair.before && pair.after);
}

// ── Sidebar facts ───────────────────────────────────────────────────────────

/**
 * Project facts panel.
 *
 * Unconfirmed fields render as "not yet confirmed" instead of being hidden or
 * filled with a guess. This is the visible half of the `needs_review` model from
 * the migration: the seed leaves team size, duration and dates empty for all
 * three real projects because none of them can be verified from outside.
 */
export function ProjectFacts({
  project,
  locale,
  t,
}: {
  project: ProjectDetailData;
  locale: Locale;
  t: Dictionary;
}) {
  const rows: Array<{ label: string; value: React.ReactNode; unconfirmed?: boolean }> = [
    { label: t.projects.status, value: t.projects.projectStatus[project.projectStatus] },
    { label: t.projects.role, value: project.role },
    { label: t.projects.organization, value: project.organization },
    {
      label: t.projects.year,
      value:
        project.yearLabel ??
        project.periodLabel ??
        (project.startedAt ? formatDate(project.startedAt, locale, { year: "numeric" }) : null),
    },
    { label: t.projects.teamSize, value: project.teamSize, unconfirmed: true },
    { label: t.projects.duration, value: project.durationLabel, unconfirmed: true },
  ];

  const visible = rows.filter((row) => row.value != null || row.unconfirmed);

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          {visible.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-[0.8125rem] font-medium uppercase tracking-[0.04em] text-foreground-subtle">
                {row.label}
              </dt>
              <dd className="text-small">
                {row.value != null ? (
                  row.value
                ) : (
                  <span className="italic text-foreground-subtle">
                    {t.projects.notConfirmed}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {project.technologies.length > 0 ? (
          <>
            <Divider />
            <div className="flex flex-col gap-2">
              <p className="text-[0.8125rem] font-medium uppercase tracking-[0.04em] text-foreground-subtle">
                {t.projects.technologies}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {project.technologies.map((tech) => (
                  <li key={tech.id}>
                    <Tag>{tech.name}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {project.categories.length > 0 ? (
          <>
            <Divider />
            <ul className="flex flex-wrap gap-1.5">
              {project.categories.map((category) => (
                <li key={category.id}>
                  <Badge tone="primary">{category.name}</Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {project.repositoryUrl ? (
          <>
            <Divider />
            <SmartLink
              href={project.repositoryUrl}
              newTabHint={t.a11y.opensInNewTab}
              className="inline-flex items-center gap-2 text-small text-primary underline underline-offset-2 hover:decoration-2"
            >
              <Icon name="github" size={16} />
              {t.projects.repository}
            </SmartLink>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
