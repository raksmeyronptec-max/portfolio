import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SmartLink, StatusDot } from "@/components/ui/primitives";
import { Breadcrumbs, TableOfContents } from "@/components/ui/navigation";
import { OutboundLink } from "@/components/public/outbound-link";
import {
  CaseStudyBody,
  ProjectFacts,
  caseStudySections,
} from "@/components/public/case-study";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, locales, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { publicStorageUrl, resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import { getProjectBySlug, getPublishedProjectSlugs } from "@/lib/data/projects";
import { coverFallbackFor } from "@/lib/data/live-platforms";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  projectSchema,
} from "@/lib/seo/jsonld";

export const revalidate = 300;

/**
 * Pre-render every published project in both locales.
 *
 * `dynamicParams` stays at its default (`true`), so a project published after the
 * last build is still served — rendered on demand, then cached. That is what makes
 * publishing from the admin feel immediate without a redeploy.
 */
export async function generateStaticParams() {
  const projects = await getPublishedProjectSlugs();
  return locales.flatMap((locale) =>
    projects.map((project) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const project = await getProjectBySlug(slug, locale);
  if (!project) {
    // Do not invent metadata for a page that will 404.
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  return buildPageMetadata({
    locale,
    path: `projects/${slug}`,
    title: project.seoTitle ?? project.title,
    description:
      project.seoDescription ??
      truncateDescription(project.summary ?? project.problem, locale),
    ogImage: project.ogImage ?? project.cover,
    type: "article",
    publishedTime: project.publishedAt,
    modifiedTime: project.updatedAt,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const project = await getProjectBySlug(slug, locale);

  // RLS already hid drafts, so "not found" here covers both "no such project" and
  // "not published" — deliberately indistinguishable from the outside.
  if (!project) notFound();

  const cover = resolveImage(project.cover, locale, "preview");

  /*
   * The hero image. A CMS cover always wins; the fallback is a committed
   * screenshot of the live site, so a case study without an uploaded cover
   * still opens on the product rather than on a wall of text.
   */
  const coverFallback = cover
    ? null
    : coverFallbackFor(project.slug, t.projects.screenshotAlt);
  const heroImage = cover
    ? cover
    : coverFallback
      ? { ...coverFallback, blurDataURL: null as string | null, caption: null }
      : null;
  const sections = caseStudySections(project, t);
  const contentLang = langAttribute(locale, project.contentLocale);

  const breadcrumbs = [
    { label: t.nav.home, href: localePath(locale) },
    { label: t.nav.projects, href: localePath(locale, "projects") },
    { label: project.title },
  ];

  const structuredData = graph([
    projectSchema({
      locale,
      slug: project.slug,
      title: project.title,
      description: project.summary,
      imageUrl:
        (project.cover
          ? publicStorageUrl(
              project.cover.bucket_id,
              project.cover.preview_path ?? project.cover.storage_path,
              project.cover.storage_provider,
            )
          : null) ?? undefined,
      liveUrl: project.liveUrl,
      repositoryUrl: project.repositoryUrl,
      datePublished: project.publishedAt,
      dateModified: project.updatedAt,
      technologies: project.technologies.map((tech) => tech.name),
      organizationName: project.organization,
      // A deployed web application is a SoftwareApplication; anything without a
      // live URL is described as a CreativeWork instead.
      isSoftware: Boolean(project.liveUrl),
    }),
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.projects, url: absoluteUrl(localePath(locale, "projects")) },
      {
        name: project.title,
        url: absoluteUrl(localePath(locale, `projects/${project.slug}`)),
      },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />
      <PageViewTracker
        locale={locale}
        eventName="project_view"
        entityType="project"
        entityId={project.id}
        entitySlug={project.slug}
      />

      <article>
        {/* ── Header ───────────────────────────────────────────────────────
            An ink editorial hero, matching every other public page, with the
            cover image overlapping its lower edge below. Pulled up under the
            sticky header for the same reason as PageHeader — see the comment
            there. */}
        <header
          data-scheme="ink"
          className="decorated bg-background text-foreground"
          style={{ marginTop: "calc(-1 * var(--header-height))" }}
        >
          <div
            aria-hidden="true"
            className="glow"
            style={{ "--glow-x": "80%", "--glow-y": "12%", "--glow-alpha": "0.2" } as object}
          />
          <div
            aria-hidden="true"
            className="grid-lines"
            style={{ "--grid-alpha": "0.045" } as object}
          />

          <div
            className="container-content flex flex-col gap-6 pb-16"
            style={{ paddingTop: "calc(var(--header-height) + clamp(2rem, 4vw, 3.5rem))" }}
          >
            <Breadcrumbs items={breadcrumbs} label={t.a11y.breadcrumb} />

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                <StatusDot
                  tone={project.projectStatus === "live" ? "success" : "warning"}
                />
                {t.projects.projectStatus[project.projectStatus]}
              </Badge>

              {project.featured ? (
                <Badge tone="accent" icon="star">
                  {t.common.featured}
                </Badge>
              ) : null}

              {project.categories.map((category) => (
                <Badge key={category.id} tone="primary">
                  {category.name}
                </Badge>
              ))}
            </div>

            <h1 className="text-display max-w-[20ch]" lang={contentLang}>
              {project.title}
            </h1>

            {project.summary ? (
              <p
                className="max-w-[62ch] text-body-lg text-foreground-muted"
                lang={contentLang}
              >
                {project.summary}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {project.liveUrl ? (
                <OutboundLink
                  href={project.liveUrl}
                  newTabHint={t.a11y.opensInNewTab}
                  event={{
                    name: "project_live_link_click",
                    locale,
                    entityType: "project",
                    entityId: project.id,
                    entitySlug: project.slug,
                    properties: { url: project.liveUrl },
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-full) bg-accent px-6 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
                >
                  {t.projects.liveSite}
                  <span aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </span>
                </OutboundLink>
              ) : null}

              {project.repositoryUrl ? (
                <OutboundLink
                  href={project.repositoryUrl}
                  newTabHint={t.a11y.opensInNewTab}
                  event={{
                    name: "project_repository_click",
                    locale,
                    entityType: "project",
                    entityId: project.id,
                    entitySlug: project.slug,
                    properties: { url: project.repositoryUrl },
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-full) border border-border-strong bg-surface px-6 text-base font-medium transition-colors hover:bg-surface-muted"
                >
                  {t.projects.repository}
                </OutboundLink>
              ) : null}

              <ButtonLink
                href={localePath(locale, "projects")}
                variant="ghost"
                iconStart="arrowLeft"
              >
                {t.projects.backToProjects}
              </ButtonLink>
            </div>
          </div>
        </header>

        {/* ── Cover ────────────────────────────────────────────────────────
            Lifted so it straddles the boundary between the ink hero and the
            body, which is what stops the page reading as two stacked slabs. */}
        {heroImage ? (
          <div className="container-content -mt-12 sm:-mt-16">
            <figure className="flex flex-col gap-3">
              <div className="relative aspect-[16/9] overflow-hidden rounded-(--radius-xl) border border-border bg-surface-muted shadow-(--shadow-xl)">
                <Image
                  src={heroImage.src}
                  alt={heroImage.alt}
                  fill
                  sizes="(min-width: 1280px) 76rem, 100vw"
                  priority
                  placeholder={heroImage.blurDataURL ? "blur" : undefined}
                  blurDataURL={heroImage.blurDataURL ?? undefined}
                  className="object-cover object-top"
                />
              </div>
              {heroImage.caption ? (
                <figcaption className="text-[0.8125rem] text-foreground-subtle">
                  {heroImage.caption}
                </figcaption>
              ) : null}
            </figure>
          </div>
        ) : null}

        {/* ── Body + sidebar ─────────────────────────────────────────────── */}
        <div className="container-content grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <div className="min-w-0">
            <CaseStudyBody
              project={project}
              locale={locale}
              t={t}
              sections={sections}
            />
          </div>

          {/*
            Sticky sidebar on large screens only. On small screens it flows after
            the article, so the facts never push the prose below the fold.
          */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
            <ProjectFacts project={project} locale={locale} t={t} />

            <TableOfContents
              heading={t.projects.onThisPage}
              items={sections.map((section) => ({
                id: section.id,
                label: section.label,
              }))}
            />

            {project.liveUrl ? (
              <p className="text-[0.8125rem] text-foreground-muted">
                <SmartLink
                  href={project.liveUrl}
                  newTabHint={t.a11y.opensInNewTab}
                  showExternalIcon
                  className="text-primary underline underline-offset-2 hover:decoration-2"
                >
                  {new URL(project.liveUrl).host}
                </SmartLink>
              </p>
            ) : null}
          </aside>
        </div>
      </article>
    </>
  );
}
