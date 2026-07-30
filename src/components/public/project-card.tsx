import Image from "next/image";
import Link from "next/link";

import { Badge, Card, StatusDot, TagList } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { OutboundLink } from "@/components/public/outbound-link";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ProjectCardData } from "@/lib/data/projects";
import { cn } from "@/lib/utils/cn";

/**
 * Project card.
 *
 * Link structure: the card is not one big anchor. The title links to the case
 * study and the live-site link is a separate anchor, because nesting an external
 * link inside a card-wide link is invalid HTML and produces unpredictable
 * keyboard behaviour. The title link is stretched over the card with a
 * pseudo-element so the whole surface is still clickable, while the live link sits
 * above it in the stacking order.
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
  const cover = resolveImage(project.cover, locale, "card");
  const href = localePath(locale, `projects/${project.slug}`);
  const contentLang = langAttribute(locale, project.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <Card
      as="article"
      interactive
      className="group relative isolate flex flex-col overflow-hidden"
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
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
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
          />
        ) : (
          // Placeholder rather than a broken image: a project may legitimately
          // have no cover yet.
          <div
            className="flex h-full items-center justify-center text-foreground-subtle"
            aria-hidden="true"
          >
            <Icon name="layers" size={32} />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {project.featured ? (
            <Badge tone="accent" icon="star">
              {t.common.featured}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] text-foreground-muted">
          <span className="inline-flex items-center gap-1.5">
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

          {project.yearLabel ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{project.yearLabel}</span>
            </>
          ) : null}

          {project.role ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{project.role}</span>
            </>
          ) : null}
        </div>

        <Heading className="text-h4 font-semibold">
          {/*
            `after:absolute after:inset-0` stretches the hit area over the card
            without wrapping the card in an anchor.
          */}
          <Link
            href={href}
            lang={contentLang}
            className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
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
          <TagList
            label={t.projects.technologies}
            className="mt-auto pt-1"
            items={project.technologies.slice(0, 4).map((tech) => ({
              id: tech.id,
              label: tech.name,
            }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-4 pt-1 text-small font-medium">
          <span className="inline-flex items-center gap-1.5 text-primary">
            {t.home.featured.viewCaseStudy}
            <Icon
              name="arrowRight"
              size={16}
              className="transition-transform motion-safe:group-hover:translate-x-0.5"
            />
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
              className={cn(
                "relative z-10 inline-flex items-center gap-1.5",
                "text-foreground-muted underline decoration-transparent underline-offset-2",
                "transition-colors hover:text-foreground hover:decoration-current",
              )}
            >
              <Icon name="externalLink" size={15} />
              {t.home.featured.visitLive}
            </OutboundLink>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
