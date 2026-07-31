import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/primitives";
import { OutboundLink } from "@/components/public/outbound-link";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ProjectCardData } from "@/lib/data/projects";
import { coverFallbackFor } from "@/lib/data/live-platforms";
import { cn } from "@/lib/utils/cn";

/**
 * Full-width alternating project showcase, used for featured work.
 *
 * This is the piece the brief cared most about: projects had to stop being
 * small equal cards in a three-up grid and become the visual centre of the
 * page. Each entry is a half-page screenshot in a browser frame beside its own
 * copy, with the orientation flipping on every other item.
 *
 * Link structure: the card is deliberately *not* one big anchor. The title
 * links to the case study and the live-site link is a separate anchor, because
 * nesting an external link inside a card-wide link is invalid HTML and produces
 * unpredictable keyboard behaviour. The title link is stretched over the media
 * and copy with a pseudo-element so the whole block is still clickable, and the
 * live link is lifted above it in the stacking order.
 */
export function ProjectShowcase({
  project,
  locale,
  t,
  index,
  priority = false,
  headingLevel = 3,
}: {
  project: ProjectCardData;
  locale: Locale;
  t: Dictionary;
  /** Drives both the displayed numeral and the alternating orientation. */
  index: number;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  // A CMS cover always wins. The fallback is a committed screenshot of the live
  // site, used only so a project with no uploaded cover still reads as a
  // shipped product instead of a grey box.
  const cmsCover = resolveImage(project.cover, locale, "preview");
  const fallback = cmsCover
    ? null
    : coverFallbackFor(project.slug, t.projects.screenshotAlt);
  const cover =
    cmsCover ??
    (fallback ? { ...fallback, blurDataURL: null as string | null } : null);

  const href = localePath(locale, `projects/${project.slug}`);
  const contentLang = langAttribute(locale, project.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3";

  // Odd items put the media on the right at desktop width. On mobile the media
  // always comes first, so the reading order stays consistent.
  const mediaRight = index % 2 === 1;
  const number = String(index + 1).padStart(2, "0");
  const category = project.categories[0]?.name ?? null;

  return (
    <article className="group relative isolate grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      {/* ── Media ────────────────────────────────────────────────────────── */}
      <div className={cn("lift relative", mediaRight && "lg:order-2")}>
        {/* Coloured lift behind the frame. */}
        <div
          aria-hidden="true"
          className="absolute -inset-4 -z-10 rounded-(--radius-2xl) opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgb(var(--glow-primary) / 0.35), transparent 70%)",
          }}
        />

        <BrowserFrame url={project.liveUrl}>
          {cover ? (
            <Image
              src={cover.src}
              alt={cover.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 92vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              placeholder={cover.blurDataURL ? "blur" : undefined}
              blurDataURL={cover.blurDataURL ?? undefined}
              className="lift__media object-cover object-top"
            />
          ) : (
            // A project may legitimately have no screenshot yet. This is a
            // designed placeholder rather than a broken image.
            <div
              aria-hidden="true"
              className="flex h-full items-center justify-center bg-surface-muted text-foreground-subtle"
            >
              <Icon name="layers" size={40} />
            </div>
          )}
        </BrowserFrame>
      </div>

      {/* ── Copy ─────────────────────────────────────────────────────────── */}
      <div className={cn("flex flex-col gap-5", mediaRight && "lg:order-1")}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="font-mono text-h2 font-bold leading-none text-gradient"
          >
            {number}
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-3">
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

            {category ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{category}</span>
              </>
            ) : null}

            {project.yearLabel ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{project.yearLabel}</span>
              </>
            ) : null}
          </div>

          <Heading className="text-h2">
            {/*
              `after:absolute after:inset-0` stretches the hit area over the
              whole article without wrapping it in an anchor.
            */}
            <Link
              href={href}
              lang={contentLang}
              className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary"
            >
              {project.title}
            </Link>
          </Heading>
        </div>

        {project.summary ? (
          <p lang={contentLang} className="max-w-[54ch] text-body-lg text-foreground-muted">
            {project.summary}
          </p>
        ) : null}

        {project.role ? (
          <p className="text-small text-foreground-muted">
            <span className="font-medium text-foreground-subtle">{t.projects.role}: </span>
            {project.role}
          </p>
        ) : null}

        {project.technologies.length > 0 ? (
          <ul aria-label={t.projects.technologies} className="flex flex-wrap gap-2">
            {project.technologies.slice(0, 6).map((tech) => (
              <li key={tech.id}>
                <span className="inline-flex rounded-(--radius-full) border border-border bg-surface px-3 py-1 text-[0.8125rem] text-foreground-muted">
                  {tech.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-5 pt-1 text-small font-semibold">
          <span className="inline-flex items-center gap-2 text-primary">
            {t.home.featured.viewCaseStudy}
            <Icon name="arrowRight" size={17} className="travel" />
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
              className="relative z-10 inline-flex items-center gap-2 font-medium text-foreground-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
            >
              <Icon name="externalLink" size={16} />
              {t.home.featured.visitLive}
            </OutboundLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * A minimal browser chrome around a screenshot.
 *
 * Purely decorative — `aria-hidden` on the chrome row, and the host label is
 * presentational text, not a link. It exists so a flat screenshot reads as a
 * shipped product rather than as a stock image, which is most of the difference
 * between a portfolio that looks live and one that looks like a template.
 */
function BrowserFrame({
  url,
  children,
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  // Never render a raw URL that failed to parse; the frame is decoration and
  // must not throw on malformed CMS data.
  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host.replace(/^www\./, "");
    } catch {
      host = null;
    }
  }

  return (
    <div className="overflow-hidden rounded-(--radius-xl) border border-border bg-surface-raised shadow-(--shadow-lg)">
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3"
      >
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>

        {host ? (
          <span className="ms-2 truncate rounded-(--radius-full) bg-background/60 px-3 py-0.5 text-[0.75rem] text-foreground-subtle">
            {host}
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
        {children}
      </div>
    </div>
  );
}
