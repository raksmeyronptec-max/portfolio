import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { OutboundLink } from "@/components/public/outbound-link";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ProjectCardData } from "@/lib/data/projects";
import { coverFallbackFor } from "@/lib/data/live-platforms";

const TECH_GROUPS = {
  frontend: ["next", "react", "tailwind"],
  backend: ["supabase", "postgres", "firebase"],
  infrastructure: ["vercel", "cloudflare", "netlify"],
  ai: ["gemini", "oauth", "openai", "api"],
} as const;

function techGroup(slug: string, name: string) {
  const value = `${slug} ${name}`.toLowerCase();
  return (
    Object.entries(TECH_GROUPS).find(([, terms]) =>
      terms.some((term) => value.includes(term)),
    )?.[0] ?? "neutral"
  );
}

/** Compact, keyboard-accessible case-study preview used on listing pages. */
export function ProjectShowcase({
  project,
  locale,
  t,
  priority = false,
  headingLevel = 3,
}: {
  project: ProjectCardData;
  locale: Locale;
  t: Dictionary;
  index: number;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const cmsCover = resolveImage(project.cover, locale, "preview");
  const fallback = cmsCover
    ? null
    : coverFallbackFor(project.slug, t.projects.screenshotAlt);
  const cover = cmsCover ?? (fallback ? { ...fallback, blurDataURL: null } : null);
  const caseStudyUrl = localePath(locale, `projects/${project.slug}`);
  const contentLang = langAttribute(locale, project.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3";

  return (
    <article className="case-card">
      <Link
        href={caseStudyUrl}
        className="case-card-media focus-ring"
        aria-label={`${t.home.featured.viewCaseStudy}: ${project.title}`}
      >
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
            className="case-card-img"
          />
        ) : (
          <span className="case-card-placeholder" aria-hidden="true">
            <Icon name="layers" size={36} />
          </span>
        )}
        <span className="case-card-overlay" aria-hidden="true">
          <span className="case-card-cta">{t.home.featured.viewCaseStudy} →</span>
        </span>
      </Link>

      <div className="case-card-body">
        <Heading className="text-h4">
          <Link href={caseStudyUrl} lang={contentLang} className="case-card-title focus-ring">
            {project.title}
          </Link>
        </Heading>

        {project.summary ? (
          <p lang={contentLang} className="case-card-description">
            {project.summary}
          </p>
        ) : null}

        {project.technologies.length > 0 ? (
          <ul aria-label={t.projects.technologies} className="case-card-tags">
            {project.technologies.slice(0, 7).map((tech) => (
              <li key={tech.id}>
                <span className="tech-pill" data-tech-group={techGroup(tech.slug, tech.name)}>
                  {tech.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="case-card-actions">
          {project.liveUrl ? (
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
              className="link-live focus-ring"
            >
              {t.home.featured.visitLive} <span aria-hidden="true">↗</span>
            </OutboundLink>
          ) : null}
          <Link href={caseStudyUrl} className="link-case focus-ring">
            {t.home.featured.viewCaseStudy}
          </Link>
        </div>
      </div>
    </article>
  );
}
