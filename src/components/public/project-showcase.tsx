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

function techGroup(slug: string, name: string) {
  const value = `${slug} ${name}`.toLowerCase();

  // Integrations are checked before infrastructure so "Cloudflare Turnstile"
  // is not swallowed by the broader Cloudflare match.
  if (
    ["gemini", "google oauth", "turnstile", "emailjs", "recaptcha"].some(
      (term) => value.includes(term),
    )
  ) {
    return "ai";
  }
  if (["next", "react", "tailwind"].some((term) => value.includes(term))) {
    return "frontend";
  }
  if (["supabase", "postgres", "firebase"].some((term) => value.includes(term))) {
    return "backend";
  }
  if (["vercel", "cloudflare", "netlify", "render"].some((term) => value.includes(term))) {
    return "infra";
  }
  return "neutral";
}

/** Compact, keyboard-accessible case-study preview used on listing pages. */
export function ProjectShowcase({
  project,
  locale,
  t,
  headingLevel = 3,
}: {
  project: ProjectCardData;
  locale: Locale;
  t: Dictionary;
  headingLevel?: 2 | 3;
}) {
  const cmsCover = resolveImage(project.cover, locale, "preview");
  const fallback = cmsCover
    ? null
    : coverFallbackFor(project.slug, t.projects.screenshotAlt);
  const cover = cmsCover ?? fallback;
  const caseStudyUrl = localePath(locale, `projects/${project.slug}`);
  const contentLang = langAttribute(locale, project.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const media = (
    <>
      {cover ? (
        <Image
          src={cover.src}
          alt={cover.alt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          loading="lazy"
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
        <span className="case-card-cta">
          {project.liveUrl ? t.home.featured.visitLive : t.home.featured.viewCaseStudy}{" "}
          {project.liveUrl ? "↗" : "→"}
        </span>
      </span>
    </>
  );

  return (
    <article className="case-card">
      {project.liveUrl ? (
        <OutboundLink
          href={project.liveUrl}
          event={{
            name: "project_live_link_click",
            locale,
            entityType: "project",
            entityId: project.id,
            entitySlug: project.slug,
            properties: { url: project.liveUrl, source: "case_card_media" },
          }}
          newTabHint={t.a11y.opensInNewTab}
          className="case-card-media focus-ring"
        >
          {media}
        </OutboundLink>
      ) : (
        <Link
          href={caseStudyUrl}
          className="case-card-media focus-ring"
          aria-label={`${t.home.featured.viewCaseStudy}: ${project.title}`}
        >
          {media}
        </Link>
      )}

      <div className="case-card-body">
        {project.role || project.organization ? (
          <div className="case-card-meta">
            {project.role ? <span className="case-card-role">{project.role}</span> : null}
            {project.organization ? (
              <span className="case-card-org">{project.organization}</span>
            ) : null}
          </div>
        ) : null}

        <Heading>
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

        <div className="case-card-footer">
          <Link href={caseStudyUrl} className="case-card-link focus-ring">
            {t.home.caseStudy.readCaseStudy} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
