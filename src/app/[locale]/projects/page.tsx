import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Pagination } from "@/components/ui/navigation";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { ProjectCard } from "@/components/public/project-card";
import { ProjectFilters } from "@/components/public/project-filters";
import { getDictionary, plural } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import {
  getProjectCategories,
  getUsedTechnologies,
  listProjects,
  type ProjectStatus,
} from "@/lib/data/projects";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  itemListSchema,
} from "@/lib/seo/jsonld";

export const revalidate = 300;

const PROJECT_STATUSES: ProjectStatus[] = [
  "live",
  "in_development",
  "maintained",
  "sunset",
  "concept",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("projects", locale);

  return buildPageMetadata({
    locale,
    path: "projects",
    title: override?.title ?? t.projects.title,
    description: override?.description ?? t.projects.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: raw }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  // Every parameter is read defensively: a hand-edited URL must degrade to the
  // unfiltered list rather than error.
  const search = single(query.q) ?? "";
  const category = single(query.category) ?? "";
  const technology = single(query.tech) ?? "";
  const statusParam = single(query.status) ?? "";
  const status = PROJECT_STATUSES.includes(statusParam as ProjectStatus)
    ? (statusParam as ProjectStatus)
    : undefined;
  const featuredOnly = single(query.featured) === "1";
  const page = toPositiveInt(single(query.page), 1);

  const [result, categories, technologies] = await Promise.all([
    listProjects(locale, {
      search,
      category: category || undefined,
      technology: technology || undefined,
      status,
      featuredOnly,
      page,
      perPage: 9,
    }),
    getProjectCategories(locale),
    getUsedTechnologies(),
  ]);

  const resultLabel = plural(
    result.total,
    t.projects.resultCount,
    t.projects.resultCountPlural,
  );

  const hasFilters =
    Boolean(search) || Boolean(category) || Boolean(technology) || Boolean(status) || featuredOnly;

  const breadcrumbs = [
    { label: t.nav.home, href: localePath(locale) },
    { label: t.nav.projects },
  ];

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.projects, url: absoluteUrl(localePath(locale, "projects")) },
    ]),
    itemListSchema({
      name: t.projects.title,
      items: result.items.map((project) => ({
        name: project.title,
        url: absoluteUrl(localePath(locale, `projects/${project.slug}`)),
      })),
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <div className="container-content flex flex-col gap-8 py-10 sm:py-14">
        <Breadcrumbs items={breadcrumbs} label={t.a11y.breadcrumb} />

        <SectionHeading
          headingLevel={1}
          title={t.projects.title}
          description={t.projects.description}
        />

        <ProjectFilters
          locale={locale}
          t={t}
          initial={{
            search,
            category,
            technology,
            status: status ?? "",
            featuredOnly,
          }}
          categories={categories.map((item) => ({
            value: item.slug,
            label: item.name,
          }))}
          technologies={technologies.map((item) => ({
            value: item.slug,
            label: item.name,
          }))}
          statuses={PROJECT_STATUSES.map((value) => ({
            value,
            label: t.projects.projectStatus[value],
          }))}
          resultLabel={resultLabel}
        />

        {/*
          Polite live region. Announces the new count after filtering so a
          screen-reader user is told the results changed instead of having to go
          looking for them.
        */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {resultLabel}
        </p>

        {result.items.length === 0 ? (
          <EmptyState
            icon="layers"
            title={hasFilters ? t.projects.noResults : t.projects.emptyState}
            description={hasFilters ? t.projects.noResultsHint : undefined}
            actions={
              hasFilters ? (
                <ButtonLink
                  href={localePath(locale, "projects")}
                  variant="outline"
                  iconStart="refresh"
                >
                  {t.a11y.clearFilters}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((project, index) => (
              <li key={project.id} className="flex">
                <ProjectCard
                  project={project}
                  locale={locale}
                  t={t}
                  priority={index === 0}
                  headingLevel={2}
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          buildHref={(nextPage) => {
            const params = new URLSearchParams();
            if (search) params.set("q", search);
            if (category) params.set("category", category);
            if (technology) params.set("tech", technology);
            if (status) params.set("status", status);
            if (featuredOnly) params.set("featured", "1");
            if (nextPage > 1) params.set("page", String(nextPage));
            const qs = params.toString();
            return `${localePath(locale, "projects")}${qs ? `?${qs}` : ""}`;
          }}
          labels={{
            nav: t.a11y.pagination,
            previous: t.a11y.previous,
            next: t.a11y.next,
            pageOf: t.common.pageOf,
          }}
        />
      </div>
    </>
  );
}

/** Query params can arrive as arrays; take the first value. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
