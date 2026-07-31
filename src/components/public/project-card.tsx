import Image from "next/image";
import Link from "next/link";

import { StatusDot } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { OutboundLink } from "@/components/public/outbound-link";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ProjectCardData } from "@/lib/data/projects";
import { coverFallbackFor } from "@/lib/data/live-platforms";

/**
 * Project card, used on the projects index grid.
 *
 * Rebuilt from v2's bordered box: the screenshot now fills the top of the card
 * edge to edge with no inner border, the whole card lifts on hover, and the
 * metadata row sits over the image rather than adding another stacked strip.
 *
 * Link structure: the card is not one big anchor. The title links to the case
 * study and the live-site link is a separate anchor, because nesting an
 * external link inside a card-wide link is invalid HTML and produces
 * unpredictable keyboard behaviour. The title link is stretched over the card
 * with a pseudo-element so the whole surface is still clickable, while the live
 * link sits above it in the stacking order.
 */
export function ProjectCard({
  project,
  locale,
  t,
  priority = false,
  headingLevel = 3,
}: {
  project: ProjectCardData;
  locale: Locale;
  t: Dictionary;
  /** Only true for the first card above the fold. */
  priority?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  // A CMS cover always wins; the fallback is a committed screenshot of the live
  // site. See `coverFallbackFor`.
  const cmsCover = resolveImage(project.cover, locale, "card");
  const fallback = cmsCover
    ? null
    : coverFallbackFor(project.slug, t.projects.screenshotAlt);
  const cover =
    cmsCover ??
    (fallback ? { ...fallback, blurDataURL: null as string | null } : null);

  const href = localePath(locale, `projects/${project.slug}`);
  const contentLang = langAttribute(locale, project.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const category = project.categories[0]?.name ?? null;

  return (
    <article className="lift group relative isolate flex flex-1 flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface hover:border-border-interactive hover:shadow-(--shadow-lg)">
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
        {cover ? (
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            loading={priority ? undefined : "lazy"}
            placeholder={cover.blurDataURL ? "blur" : undefined}
            blurDataURL={cover.blurDataURL ?? undefined}
            className="lift__media object-cover object-top"
          />
        ) : (
          // Designed placeholder rather than a broken image: a project may
          // legitimately have no cover yet.
          <div
            className="flex h-full items-center justify-center text-foreground-subtle"
            aria-hidden="true"
          >
            <Icon name="layers" size={32} />
          </div>
        )}

        {/* Keeps the status pill legible over any screenshot. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent"
        />

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-black/55 px-2.5 py-1 text-[0.75rem] font-medium text-white backdrop-blur-sm">
            <StatusDot
              tone={
                project.projectStatus === "live"
                  ? "success"
                  : project.projectStatus === "sunset"
                    ? "neutral"
                    : "warning"
              }
            />
            {t.projects.projectStatus[project.projectStatus]}
          </span>

          {project.featured ? (
            <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-accent px-2.5 py-1 text-[0.75rem] font-semibold text-accent-foreground">
              <Icon name="star" size={12} />
              {t.common.featured}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8125rem] text-foreground-subtle">
          {category ? <span>{category}</span> : null}
          {category && project.yearLabel ? <span aria-hidden="true">·</span> : null}
          {project.yearLabel ? <span>{project.yearLabel}</span> : null}
        </div>

        <Heading className="text-h4 font-semibold">
          {/*
            `after:absolute after:inset-0` stretches the hit area over the card
            without wrapping the card in an anchor.
          */}
          <Link
            href={href}
            lang={contentLang}
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {project.title}
          </Link>
        </Heading>

        {project.summary ? (
          <p lang={contentLang} className="line-clamp-3 text-small text-foreground-muted">
            {project.summary}
          </p>
        ) : null}

        {project.technologies.length > 0 ? (
          <ul
            aria-label={t.projects.technologies}
            className="mt-auto flex flex-wrap gap-1.5 pt-2"
          >
            {project.technologies.slice(0, 4).map((tech) => (
              <li key={tech.id}>
                <span className="inline-flex rounded-(--radius-full) border border-border bg-surface-muted px-2.5 py-0.5 text-[0.75rem] text-foreground-muted">
                  {tech.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-small font-medium">
          <span className="inline-flex items-center gap-1.5 text-primary">
            {t.home.featured.viewCaseStudy}
            <Icon name="arrowRight" size={16} className="travel" />
          </span>

          {project.liveUrl ? (
            // `relative z-10` lifts this above the stretched title link.
            <OutboundLink
              href={project.liveUrl}
              event={{
                name: "project_live_link_click",
                locale,
                entityType: "project",
                entityId: project.id,
                entitySlug: project.slug,
                properties: { url: project.liveUrl },
              }}
              newTabHint={t.a11y.opensInNewTab}
              className="relative z-10 ms-auto inline-flex items-center gap-1.5 text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
            >
              <Icon name="externalLink" size={15} />
              {t.home.featured.visitLive}
            </OutboundLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
